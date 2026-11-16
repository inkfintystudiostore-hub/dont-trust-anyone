import { Group, Mesh, MeshStandardMaterial, CylinderGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const BASE_GEO = new RoundedBoxGeometry(20, 0.8, 9.6, 3, 0.25);
const PAD_GEO = new RoundedBoxGeometry(4.2, 0.35, 7.6, 2, 0.16);
const NODE_GEO = new CylinderGeometry(0.32, 0.36, 0.18, 16);

const MAT = {
  wood: new MeshStandardMaterial({ color: '#e6ccb2', roughness: 0.7 }),
  w1: new MeshStandardMaterial({ color: '#9fe3c9', roughness: 0.6 }),
  w2: new MeshStandardMaterial({ color: '#f4b98f', roughness: 0.6 }),
  w3: new MeshStandardMaterial({ color: '#cbb6e6', roughness: 0.6 }),
  w4: new MeshStandardMaterial({ color: '#ff8fab', roughness: 0.55 }),
  locked: new MeshStandardMaterial({ color: '#cfc4bc', roughness: 0.8 }),
  open: new MeshStandardMaterial({ color: '#fffbf7', roughness: 0.4 }),
  cleared: new MeshStandardMaterial({ color: '#ff8fb0', roughness: 0.4 }),
  active: new MeshStandardMaterial({ color: '#8b0d1a', emissive: '#8b0d1a', emissiveIntensity: 0.35, roughness: 0.3 }),
};

/**
 * Miniature 3D tabletop diorama displaying Worlds 1–4 and all level nodes.
 */
export function createDiorama(scene, levels, models) {
  const root = new Group();
  root.visible = false;
  scene.add(root);

  const board = new Mesh(BASE_GEO, MAT.wood);
  board.position.set(0, -0.4, 0);
  board.receiveShadow = true;
  root.add(board);

  const worldMats = [MAT.w1, MAT.w2, MAT.w3, MAT.w4];
  for (let w = 0; w < 4; w++) {
    const padX = (w - 1.5) * 4.6;
    const pad = new Mesh(PAD_GEO, worldMats[w]);
    pad.position.set(padX, 0.12, 0);
    pad.receiveShadow = true;
    root.add(pad);
    const tree = models.lollipop_tree.clone(true);
    tree.scale.setScalar(0.5);
    tree.position.set(padX + 1.35, 0.3, -2.6);
    root.add(tree);
  }

  const nodeMeshes = [];
  for (let i = 0; i < levels.length; i++) {
    const w = Math.floor(i / 10);
    const padX = (w - 1.5) * 4.6;
    const local = i % 10;
    const col = local % 2;
    const row = Math.floor(local / 2);
    const nx = padX + (col === 0 ? -0.95 : 0.95) + (row % 2 === 1 ? 0.28 : -0.28);
    const nz = -2.4 + row * 1.25;
    const node = new Mesh(NODE_GEO, MAT.locked);
    node.position.set(nx, 0.36, nz);
    node.castShadow = true;
    root.add(node);
    nodeMeshes.push(node);
  }

  const pigeon = models.kabootar.clone(true);
  pigeon.scale.setScalar(0.85);
  root.add(pigeon);

  let selected = 0;

  function sync(save, selIndex) {
    selected = selIndex;
    for (let i = 0; i < nodeMeshes.length; i++) {
      const m = nodeMeshes[i];
      if (i === selected) m.material = MAT.active;
      else if (save.bestDeaths[i] !== undefined) m.material = MAT.cleared;
      else if (i >= 30 || i <= save.unlocked) m.material = MAT.open;
      else m.material = MAT.locked;
    }
  }

  function update(dt, time) {
    if (!root.visible) return;
    root.rotation.y = Math.sin(time * 0.35) * 0.08;
    const target = nodeMeshes[selected];
    if (target) {
      const k = 1 - Math.exp(-10 * dt);
      pigeon.position.x += (target.position.x - pigeon.position.x) * k;
      pigeon.position.z += (target.position.z - pigeon.position.z) * k;
      pigeon.position.y = 0.72 + Math.sin(time * 4) * 0.08;
      pigeon.rotation.y = Math.sin(time * 1.5) * 0.3;
    }
  }

  return {
    root,
    show(v) { root.visible = v; },
    sync,
    update,
  };
}
