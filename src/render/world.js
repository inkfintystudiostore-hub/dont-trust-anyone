import {
  Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, ConeGeometry,
  CylinderGeometry, SphereGeometry, BoxGeometry, CircleGeometry, ShaderMaterial, Color,
  Object3D, CanvasTexture, SRGBColorSpace, FogExp2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TILE } from '../core/level.js';
import { t } from '../i18n.js';

const DEPTH = 2;
const GEO = {
  block: new RoundedBoxGeometry(1, 1, DEPTH, 2, 0.07),
  grass: new RoundedBoxGeometry(1.03, 0.24, DEPTH + 0.06, 2, 0.09),
  spike: new ConeGeometry(0.15, 0.5, 10),
  coin: new CylinderGeometry(0.32, 0.32, 0.1, 18),
  tooth: new ConeGeometry(0.07, 0.18, 6),
  eye: new SphereGeometry(0.065, 12, 10),
  pad: new CylinderGeometry(0.35, 0.4, 0.12, 16),
  bar: new BoxGeometry(0.28, 0.08, DEPTH * 0.7),
  zone: new BoxGeometry(0.86, 0.96, 0.55),
  candle: new CylinderGeometry(0.12, 0.14, 0.55, 12),
  flame: new ConeGeometry(0.09, 0.22, 10),
  plate: new BoxGeometry(0.14, 0.7, 0.7),
  backdrop: new PlaneGeometry(1, 1),
  shadowDisc: new CircleGeometry(0.42, 20),
};

const THEMES = {
  1: {
    dirt: new MeshStandardMaterial({ color: '#f4b98f', roughness: 0.75 }),
    grass: new MeshStandardMaterial({ color: '#9fe3c9', roughness: 0.6 }),
    backdrop: new MeshStandardMaterial({ color: '#c8efdc', roughness: 1 }),
    fog: '#ffe9dd',
    skyTop: '#ffd9eb',
    skyBot: '#fff3e8',
  },
  2: {
    dirt: new MeshStandardMaterial({ color: '#e6b89c', roughness: 0.7 }),
    grass: new MeshStandardMaterial({ color: '#68b0ab', roughness: 0.5 }),
    backdrop: new MeshStandardMaterial({ color: '#f4d5bd', roughness: 1 }),
    fog: '#ffe8d1',
    skyTop: '#ffcfab',
    skyBot: '#fff0dd',
  },
  3: {
    dirt: new MeshStandardMaterial({ color: '#8f6f9c', roughness: 0.75 }),
    grass: new MeshStandardMaterial({ color: '#e0b1cb', roughness: 0.55 }),
    backdrop: new MeshStandardMaterial({ color: '#cbb6e6', roughness: 1 }),
    fog: '#e8dbf7',
    skyTop: '#cdb8ef',
    skyBot: '#f5e7fb',
  },
  4: {
    dirt: new MeshStandardMaterial({ color: '#6f6594', roughness: 0.68 }),
    grass: new MeshStandardMaterial({ color: '#ff8fab', roughness: 0.48 }),
    backdrop: new MeshStandardMaterial({ color: '#b8b5e8', roughness: 1 }),
    fog: '#eee4ff',
    skyTop: '#a89fe6',
    skyBot: '#ffe2ec',
  },
};

const MAT = {
  spike: new MeshStandardMaterial({ color: '#c4213a', roughness: 0.4 }),
  mystery: new MeshStandardMaterial({ color: '#8b0d1a', roughness: 0.35 }),
  crusher: new MeshStandardMaterial({ color: '#5c1020', roughness: 0.4 }),
  coin: new MeshStandardMaterial({ color: '#ffd147', emissive: '#ff9f1c', emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.4 }),
  tooth: new MeshStandardMaterial({ color: '#fffbf7', roughness: 0.3 }),
  eye: new MeshStandardMaterial({ color: '#1f1916', roughness: 0.3 }),
  eyeWhite: new MeshStandardMaterial({ color: '#fffbf7', roughness: 0.3 }),
  robotEye: new MeshStandardMaterial({ color: '#ff3355', emissive: '#ff1e4d', emissiveIntensity: 0.9, roughness: 0.2 }),
  blush: new MeshStandardMaterial({ color: '#ff8da6', roughness: 0.5 }),
  belt: new MeshStandardMaterial({ color: '#3b3330', roughness: 0.5 }),
  beltBar: new MeshStandardMaterial({ color: '#ffd147', emissive: '#ff9f1c', emissiveIntensity: 0.2 }),
  flipPad: new MeshStandardMaterial({ color: '#ff9f1c', emissive: '#ff9f1c', emissiveIntensity: 0.3, roughness: 0.3 }),
  gravZone: new MeshStandardMaterial({ color: '#7b61ff', emissive: '#7b61ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.36 }),
  caramel: new MeshStandardMaterial({ color: '#c97122', roughness: 0.2, metalness: 0.1 }),
  candle: new MeshStandardMaterial({ color: '#fff4e0', roughness: 0.6 }),
  flame: new MeshStandardMaterial({ color: '#ffbe0b', emissive: '#ff8800', emissiveIntensity: 0.9 }),
  plate: new MeshStandardMaterial({ color: '#3b3330', roughness: 0.5, metalness: 0.3 }),
};

const SPIKE_X = [0.2, 0.5, 0.8];
const SPIKE_Z = [0.55, -0.15];

function makeShadowTex() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(31, 25, 22, 0.42)');
  g.addColorStop(0.65, 'rgba(31, 25, 22, 0.16)');
  g.addColorStop(1, 'rgba(31, 25, 22, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function addDoorEyes(doorObj) {
  const eyes = new Group();
  for (const sx of [-0.14, 0.14]) {
    const e = new Mesh(GEO.eye, MAT.eye);
    e.position.set(sx, 0, 0);
    e.scale.set(1, 1.2, 0.55);
    const w = new Mesh(GEO.eye, MAT.eyeWhite);
    w.scale.setScalar(0.32);
    w.position.set(0.02, 0.025, 0.035);
    e.add(w);
    eyes.add(e);
  }
  eyes.position.set(0, 0.88, 0.3);
  doorObj.add(eyes);
  return eyes;
}

/**
 * Builds the 3D scene for one level and keeps it in sync with game state.
 */
export function buildWorld(scene, level, models) {
  const root = new Group();
  scene.add(root);
  const { W, H, tiles } = level;
  const theme = THEMES[level.world ?? 1] ?? THEMES[1];
  scene.fog = new FogExp2(theme.fog, 0.011);

  const owned = []; // per-level GPU resources to dispose
  const dummy = new Object3D();
  const rand = seeded(level.name.length * 7919 + W + (level.world ?? 1) * 131);
  const isSolidTile = (cx, cy) => cx >= 0 && cx < W && cy >= 0 && cy < H && tiles[cy * W + cx] === TILE.SOLID;
  const topAt = (cx) => { for (let cy = H - 1; cy >= 0; cy--) if (isSolidTile(cx, cy)) return cy + 1; return 0; };

  // static ground (instanced)
  const solids = [], tops = [], spikes = [];
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    const tile = tiles[cy * W + cx];
    if (tile === TILE.SOLID) { solids.push([cx, cy]); if (!isSolidTile(cx, cy + 1)) tops.push([cx, cy]); }
    if (tile === TILE.SPIKES) spikes.push([cx, cy, isSolidTile(cx, cy + 1) && !isSolidTile(cx, cy - 1)]);
  }
  root.add(instanced(GEO.block, theme.dirt, solids, (cx, cy) => { dummy.rotation.set(0, 0, 0); dummy.position.set(cx + 0.5, cy + 0.5, 0); }));
  root.add(instanced(GEO.grass, theme.grass, tops, (cx, cy) => { dummy.rotation.set(0, 0, 0); dummy.position.set(cx + 0.5, cy + 0.92, 0); }));
  const spikeCells = spikes.flatMap(([cx, cy, ceil]) => SPIKE_X.flatMap((x) => SPIKE_Z.map((z) => [cx + x, cy, z, ceil])));
  if (spikeCells.length) root.add(instanced(GEO.spike, MAT.spike, spikeCells, (x, y, z, ceil) => {
    dummy.rotation.set(ceil ? Math.PI : 0, 0, 0);
    dummy.position.set(x, y + (ceil ? 0.75 : 0.25), z);
  }));
  dummy.rotation.set(0, 0, 0);

  // trap visuals, index-aligned with level.trapDefs (and game.traps)
  const visuals = level.trapDefs.map((d) => {
    let v = null;
    if (d.kind === 'fallingFloor' || d.kind === 'ghostFloor' || d.kind === 'launchFloor') {
      v = new Group();
      v.add(new Mesh(GEO.block, theme.dirt));
      const grass = new Mesh(GEO.grass, theme.grass);
      grass.position.y = 0.42;
      v.add(grass);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'antiJump') {
      v = new Group();
      v.add(new Mesh(GEO.block, theme.dirt));
      const grass = new Mesh(GEO.grass, theme.grass);
      grass.position.y = 0.42;
      v.add(grass);
      const spikesGrp = new Group();
      for (const x of SPIKE_X) for (const z of SPIKE_Z) {
        const s = new Mesh(GEO.spike, MAT.spike);
        s.position.set(x - 0.5, 0.25, z);
        spikesGrp.add(s);
      }
      spikesGrp.position.set(0, 0.5, 0);
      spikesGrp.scale.y = 0.01;
      spikesGrp.visible = false;
      v.userData.spikes = spikesGrp;
      v.add(spikesGrp);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'invisibleBlock') {
      v = new Mesh(GEO.block, MAT.mystery);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
      v.scale.set(0.9, 0.9, 0.5);
      v.visible = false;
    } else if (d.kind === 'hiddenSpikes') {
      v = new Group();
      for (const x of SPIKE_X) for (const z of SPIKE_Z) {
        const s = new Mesh(GEO.spike, MAT.spike);
        s.position.set(x - 0.5, 0.25, z);
        v.add(s);
      }
      v.position.set(d.cx + 0.5, d.cy, 0);
      v.scale.y = 0.01;
    } else if (d.kind === 'bananaPeel') {
      v = models.banana_peel.clone(true);
      v.position.set(d.cx + 0.5, d.cy, 0);
    } else if (d.kind === 'rubberChicken') {
      v = models.rubber_chicken.clone(true);
      v.position.set(d.cx + 0.5, d.cy, 0);
    } else if (d.kind === 'chompCoin') {
      v = new Group();
      const coin = new Mesh(GEO.coin, MAT.coin);
      coin.rotation.x = Math.PI / 2;
      v.add(coin);
      const teeth = new Group();
      for (const sx of [-0.12, 0.12]) {
        const top = new Mesh(GEO.tooth, MAT.tooth);
        top.position.set(sx, 0.14, 0.08);
        top.rotation.x = Math.PI;
        teeth.add(top);
        const bot = new Mesh(GEO.tooth, MAT.tooth);
        bot.position.set(sx, -0.14, 0.08);
        teeth.add(bot);
      }
      teeth.visible = false;
      v.userData.teeth = teeth;
      v.add(teeth);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'fakeDoor') {
      v = models.darwaza.clone(true);
      addDoorEyes(v);
      v.position.set(d.cx + 0.5, d.cy, -0.25);
    } else if (d.kind === 'conveyor') {
      v = new Group();
      v.add(new Mesh(GEO.block, MAT.belt));
      const bar = new Mesh(GEO.bar, MAT.beltBar);
      bar.position.y = 0.51;
      v.userData.bar = bar;
      v.add(bar);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'crusher') {
      v = new Group();
      v.add(new Mesh(GEO.block, MAT.crusher));
      for (const sx of [-0.18, 0.18]) {
        const eye = new Mesh(GEO.eye, MAT.eyeWhite);
        eye.position.set(sx, -0.1, 1.02);
        v.add(eye);
      }
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'boxingGlove') {
      v = new Group();
      const plate = new Mesh(GEO.plate, MAT.plate);
      v.add(plate);
      const glove = models.boxing_glove.clone(true);
      glove.position.set(0, 0.15, 0);
      glove.rotation.y = d.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      v.userData.glove = glove;
      v.add(glove);
      v.position.set(d.cx + 0.5, d.cy + 0.4, 0);
    } else if (d.kind === 'boulder') {
      v = models.boulder.clone(true);
      v.scale.setScalar(0.95);
      v.position.set(d.cx + 0.5, d.cy + 0.45, 0);
    } else if (d.kind === 'controlsFlip') {
      v = new Mesh(GEO.pad, MAT.flipPad);
      v.position.set(d.cx + 0.5, d.cy + 0.06, 0);
    } else if (d.kind === 'gravityFlip') {
      v = new Mesh(GEO.zone, MAT.gravZone);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'slowFloor') {
      v = new Group();
      v.add(new Mesh(GEO.block, theme.dirt));
      const caramel = new Mesh(GEO.grass, MAT.caramel);
      caramel.position.y = 0.42;
      v.add(caramel);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'sneezeCloud') {
      v = models.cotton_cloud.clone(true);
      v.position.set(d.cx + 0.5, d.cy + 0.5, 0);
    } else if (d.kind === 'fakeCheckpoint') {
      v = models.checkpoint_flag.clone(true);
      v.position.set(d.cx + 0.5, d.cy, -0.2);
    } else if (d.kind === 'darkCandle') {
      v = new Group();
      const body = new Mesh(GEO.candle, MAT.candle);
      body.position.y = 0.28;
      v.add(body);
      const flame = new Mesh(GEO.flame, MAT.flame);
      flame.position.y = 0.68;
      v.userData.flame = flame;
      v.add(flame);
      v.position.set(d.cx + 0.5, d.cy, -0.2);
    } else if (d.kind === 'giftTrap') {
      v = models.gift_box.clone(true);
      v.position.set(d.cx + 0.5, d.cy, 0);
    } else if (d.kind === 'mimicRobot') {
      v = new Group();
      const body = models.toy_robot.clone(true);
      v.add(body);
      const eyes = new Group();
      for (const sx of [-0.11, 0.11]) {
        const e = new Mesh(GEO.eye, MAT.robotEye);
        e.scale.set(0.85, 0.65, 0.45);
        e.position.set(sx, 0, 0);
        eyes.add(e);
      }
      eyes.position.set(0, 0.64, 0.28);
      v.userData.eyes = eyes;
      v.add(eyes);
      v.position.set(d.cx + 0.5, d.cy, 0);
    } else if (d.kind === 'booGhost') {
      v = new Group();
      const body = models.cute_ghost.clone(true);
      v.add(body);
      const eyes = [];
      for (const sx of [-0.11, 0.11]) {
        const e = new Mesh(GEO.eye, MAT.eye);
        e.position.set(sx, 0.54, 0.27);
        e.scale.set(0.95, 1.15, 0.5);
        eyes.push(e);
        v.add(e);
        const cheek = new Mesh(GEO.eye, MAT.blush);
        cheek.position.set(sx * 1.9, 0.46, 0.25);
        cheek.scale.set(0.9, 0.55, 0.35);
        v.add(cheek);
      }
      v.userData.eyes = eyes;
      v.position.set(d.cx + 0.5, d.cy, 0);
    }

    if (v) {
      v.userData.kind = d.kind;
      v.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      root.add(v);
    }
    return v;
  });

  // door + procedural eyes
  const door = level.door ? models.darwaza.clone(true) : null;
  const doorEyes = door ? addDoorEyes(door) : null;
  if (door) {
    door.position.set(level.door.x, level.door.y, -0.25);
    root.add(door);
  }
  const doorAnim = { fromX: 0, fromY: 0, toX: level.door?.x ?? 0, toY: level.door?.y ?? 0, u: 1 };

  // signs
  for (const s of level.signs) {
    const sign = models.gappu_sign.clone(true);
    sign.position.set(s.x, topAt(Math.floor(s.x)), -0.6);
    const tex = textTexture(t(s.text));
    const label = new Mesh(new PlaneGeometry(1.0, 0.42), new MeshBasicMaterial({ map: tex, transparent: true }));
    label.position.set(0, 0.86, 0.32);
    sign.add(label);
    owned.push(tex, label.geometry, label.material);
    root.add(sign);
  }

  // narrator pigeon
  const pigeonBaseY = topAt(Math.floor(level.start.x));
  const pigeon = models.kabootar.clone(true);
  pigeon.position.set(Math.max(0.45, level.start.x - 1.05), pigeonBaseY, -0.7);
  pigeon.rotation.y = 0.5;
  root.add(pigeon);

  // background: meadow strip, lollipop trees, boulders, clouds
  const backY = topAt(Math.floor(level.start.x)) - 0.65;
  const back = new Mesh(GEO.backdrop, theme.backdrop);
  back.rotation.x = -Math.PI / 2;
  back.scale.set(W + 80, 40, 1);
  back.position.set(W / 2, backY, -1.05 - 20);
  back.receiveShadow = true;
  root.add(back);
  for (let x = -6; x < W + 8; x += 4 + rand() * 4) {
    const tree = models.lollipop_tree.clone(true);
    tree.scale.setScalar(1.3 + rand() * 1.1);
    tree.position.set(x, backY, -3 - rand() * 4);
    tree.rotation.y = (rand() - 0.5) * 0.8;
    root.add(tree);
  }
  for (let i = 0; i < 2; i++) {
    const b = models.boulder.clone(true);
    b.scale.setScalar(0.8 + rand() * 0.6);
    b.position.set(rand() * W, backY, -2.5 - rand() * 3);
    root.add(b);
  }
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = models.cotton_cloud.clone(true);
    c.scale.setScalar(1.8 + rand() * 2);
    c.position.set(-8 + rand() * (W + 16), H + 1 + rand() * 3, -7 - rand() * 6);
    c.userData.speed = 0.15 + rand() * 0.25;
    clouds.push(c);
    root.add(c);
  }

  // animated parallax sky gradient + rolling hills band
  const skyUniforms = {
    uTop: { value: new Color(theme.skyTop) },
    uBot: { value: new Color(theme.skyBot) },
    uTime: { value: 0 },
    uScroll: { value: 0 },
  };
  const skyMat = new ShaderMaterial({
    uniforms: skyUniforms,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uBot;
      uniform float uTime, uScroll;
      varying vec2 vUv;
      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);
        vec3 col = mix(uBot, uTop, smoothstep(0.1, 0.92, h));
        float wave1 = 0.24 + 0.055 * sin(vUv.x * 18.0 - uScroll + uTime * 0.25);
        float wave2 = 0.15 + 0.04 * cos(vUv.x * 29.0 - uScroll * 1.4 - uTime * 0.18);
        col = mix(col, mix(uBot, uTop, 0.45), smoothstep(wave1 + 0.02, wave1 - 0.01, h) * 0.35);
        col = mix(col, mix(uBot, uTop, 0.65), smoothstep(wave2 + 0.015, wave2 - 0.01, h) * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyPlane = new Mesh(GEO.backdrop, skyMat);
  skyPlane.scale.set(W + 140, H + 56, 1);
  skyPlane.position.set(W / 2, H * 0.5 + 4, -24);
  owned.push(skyMat);
  root.add(skyPlane);

  // contact drop-shadows projected beneath active players onto nearest solid surface
  const shadowTex = makeShadowTex();
  const shadowPairs = [0, 1].map(() => {
    const mat = new MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7, depthWrite: false });
    const mesh = new Mesh(GEO.shadowDisc, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    owned.push(mat);
    root.add(mesh);
    return { mesh, mat };
  });
  owned.push(shadowTex);

  function update(g, dt, time, alpha = 1) {
    const k = (rate) => 1 - Math.exp(-rate * dt);
    skyUniforms.uTime.value = time;
    skyUniforms.uScroll.value = g.player.x * 0.12;

    for (let i = 0; i < visuals.length; i++) {
      const v = visuals[i], tr = g.traps[i];
      if (!v || !tr || v.userData.kind !== tr.kind) continue;
      if (tr.kind === 'fallingFloor') {
        v.position.x = tr.cx + 0.5 + (tr.state === 'shaking' ? Math.sin(time * 70) * 0.06 : 0);
        v.position.y = tr.cy + 0.5 + tr.offsetY;
        v.rotation.z = tr.state === 'falling' ? tr.offsetY * 0.15 : 0;
        v.visible = tr.offsetY > -12;
      } else if (tr.kind === 'launchFloor') {
        v.position.x = tr.cx + 0.5 + (tr.state === 'shaking' ? Math.sin(time * 90) * 0.06 : 0);
        v.position.y = tr.cy + 0.5 + tr.offsetY;
        v.visible = tr.offsetY < 18;
      } else if (tr.kind === 'ghostFloor') {
        v.position.y = tr.cy + 0.5;
      } else if (tr.kind === 'invisibleBlock') {
        v.visible = tr.revealed;
      } else if (tr.kind === 'hiddenSpikes') {
        const target = tr.active ? 1 : 0.01;
        v.scale.y += (target - v.scale.y) * k(30);
      } else if (tr.kind === 'antiJump') {
        const sp = v.userData.spikes;
        if (sp) {
          sp.visible = tr.active;
          const target = tr.active ? 1.35 : 0.01;
          sp.scale.y += (target - sp.scale.y) * k(34);
        }
      } else if (tr.kind === 'bananaPeel') {
        if (tr.triggered) { v.rotation.y += dt * 14; v.position.y = tr.cy + 0.15; }
        else { v.rotation.y = 0; v.position.y = tr.cy; }
      } else if (tr.kind === 'rubberChicken') {
        const sq = tr.timer > 0 ? Math.sin(tr.timer * 25) * 0.25 : 0;
        v.scale.set(1 + sq, Math.max(0.6, 1 - sq), 1 + sq);
      } else if (tr.kind === 'chompCoin') {
        v.userData.teeth.visible = tr.triggered;
        v.scale.setScalar(tr.triggered ? 1.35 : 1);
        v.rotation.y = tr.triggered ? 0 : time * 3;
        v.position.y = tr.cy + 0.5 + (tr.triggered ? 0 : Math.sin(time * 4 + tr.cx) * 0.08);
      } else if (tr.kind === 'fakeDoor') {
        const targetRot = tr.triggered ? -Math.PI / 2 : 0;
        v.rotation.x += (targetRot - v.rotation.x) * k(14);
      } else if (tr.kind === 'conveyor') {
        v.userData.bar.position.x = (((time * tr.dir * 2) % 0.6) + 0.6) % 0.6 - 0.3;
      } else if (tr.kind === 'crusher') {
        const jiggle = tr.state === 'warning' ? Math.sin(time * 75) * 0.05 : 0;
        v.position.set(tr.cx + 0.5 + jiggle, tr.cy + 0.5 + tr.offsetY, 0);
      } else if (tr.kind === 'boxingGlove') {
        v.userData.glove.position.x = tr.dir * tr.ext;
      } else if (tr.kind === 'boulder') {
        v.visible = tr.state !== 'done';
        const ix = (tr.prevX ?? tr.x) + (tr.x - (tr.prevX ?? tr.x)) * alpha;
        const iy = (tr.prevY ?? tr.y) + (tr.y - (tr.prevY ?? tr.y)) * alpha;
        v.position.set(ix, iy + 0.45, 0);
        if (tr.state === 'rolling') v.rotation.z -= tr.vx * dt * 2.1;
      } else if (tr.kind === 'controlsFlip') {
        v.rotation.y = time * 2.5;
        v.position.y = tr.cy + 0.06 + (tr.triggered ? 0.05 : 0);
      } else if (tr.kind === 'gravityFlip') {
        v.rotation.y = Math.sin(time * 2) * 0.25;
      } else if (tr.kind === 'sneezeCloud') {
        const s = tr.state === 'charging' ? 1.28 : 1;
        v.scale.setScalar(v.scale.x + (s - v.scale.x) * k(14));
        v.position.x = tr.cx + 0.5 + (tr.state === 'sneezing' ? Math.sin(time * 80) * 0.12 : 0);
      } else if (tr.kind === 'fakeCheckpoint') {
        if (tr.triggered) {
          v.position.y += dt * 11;
          v.rotation.y += dt * 10;
        } else {
          v.rotation.z = Math.sin(time * 3) * 0.08;
        }
      } else if (tr.kind === 'darkCandle') {
        const alive = !tr.triggered;
        v.userData.flame.visible = alive;
        if (alive) v.userData.flame.scale.set(1, 0.9 + Math.sin(time * 18) * 0.18, 1);
      } else if (tr.kind === 'giftTrap') {
        if (tr.triggered) {
          v.rotation.y += dt * 16;
          v.position.y += dt * 4.5;
          const sc = Math.max(0.01, v.scale.x - dt * 2.4);
          v.scale.setScalar(sc);
          v.visible = sc > 0.05;
        } else {
          v.visible = true;
          v.scale.setScalar(1);
          v.rotation.y = Math.sin(time * 2.4 + tr.cx) * 0.35;
          v.position.y = tr.cy + Math.max(0, Math.sin(time * 4.2 + tr.cx)) * 0.1;
        }
      } else if (tr.kind === 'mimicRobot') {
        v.visible = tr.state !== 'done';
        const ix = (tr.prevX ?? tr.x) + (tr.x - (tr.prevX ?? tr.x)) * alpha;
        const iy = (tr.prevY ?? tr.y) + (tr.y - (tr.prevY ?? tr.y)) * alpha;
        v.position.set(ix, iy, 0);
        const targetYaw = tr.face > 0 ? 0.55 : -0.55;
        v.rotation.y += (targetYaw - v.rotation.y) * k(16);
        const hop = tr.onGround && Math.abs(tr.vx) > 0.2 ? Math.abs(Math.sin(time * 16)) * 0.08 : 0;
        v.position.y += hop;
        if (v.userData.eyes) {
          v.userData.eyes.scale.y = tr.state === 'active' ? 1.25 : 0.7;
        }
      } else if (tr.kind === 'booGhost') {
        const ix = (tr.prevX ?? tr.x) + (tr.x - (tr.prevX ?? tr.x)) * alpha;
        const iy = (tr.prevY ?? tr.y) + (tr.y - (tr.prevY ?? tr.y)) * alpha;
        v.position.set(ix, iy + Math.sin(time * 5 + tr.cx) * 0.07, 0);
        const lookYaw = g.player.x >= ix ? 0.45 : -0.45;
        v.rotation.y += ((tr.shy ? lookYaw * 0.35 : lookYaw) - v.rotation.y) * k(12);
        if (v.userData.eyes) {
          for (const eye of v.userData.eyes) {
            eye.scale.set(tr.shy ? 1.25 : 0.95, tr.shy ? 0.22 : 1.15, 0.5);
          }
        }
      }
    }

    // update contact drop shadows for all active players
    const players = g.players ?? [g.player];
    for (let pi = 0; pi < shadowPairs.length; pi++) {
      const { mesh: disc, mat } = shadowPairs[pi];
      const p = players[pi];
      if (!p || g.dead || p.atDoor) {
        disc.visible = false;
        continue;
      }
      const px = (p.prevX ?? p.x) + (p.x - (p.prevX ?? p.x)) * alpha;
      const py = (p.prevY ?? p.y) + (p.y - (p.prevY ?? p.y)) * alpha;
      const pz = g.coop ? (pi === 0 ? 0.14 : -0.16) : 0;
      const cx = Math.floor(px);
      let surfY = null;
      if (p.gravDir > 0) {
        for (let cy = Math.floor(py + 0.05); cy >= 0; cy--) {
          if (g.isSolid(cx, cy)) { surfY = cy + 1; break; }
        }
        if (surfY !== null) {
          const dist = Math.max(0, py - surfY);
          const show = dist < 4.5;
          disc.visible = show;
          if (show) {
            disc.rotation.x = -Math.PI / 2;
            disc.position.set(px, surfY + 0.02, pz);
            disc.scale.setScalar(Math.max(0.32, 1 - dist * 0.14));
            mat.opacity = Math.max(0, (1 - dist / 4.5) * 0.72);
          }
        } else disc.visible = false;
      } else {
        for (let cy = Math.floor(py + 0.85); cy < H; cy++) {
          if (g.isSolid(cx, cy)) { surfY = cy; break; }
        }
        if (surfY !== null) {
          const dist = Math.max(0, surfY - (py + 0.86));
          const show = dist < 4.5;
          disc.visible = show;
          if (show) {
            disc.rotation.x = Math.PI / 2;
            disc.position.set(px, surfY - 0.02, pz);
            disc.scale.setScalar(Math.max(0.32, 1 - dist * 0.14));
            mat.opacity = Math.max(0, (1 - dist / 4.5) * 0.72);
          }
        } else disc.visible = false;
      }
    }

    // door hop + eye expression
    if (door) {
      if (g.door && (g.door.x !== doorAnim.toX || g.door.y !== doorAnim.toY)) {
        doorAnim.fromX = door.position.x; doorAnim.fromY = door.position.y;
        doorAnim.toX = g.door.x; doorAnim.toY = g.door.y; doorAnim.u = 0;
      }
      if (doorAnim.u < 1) {
        doorAnim.u = Math.min(1, doorAnim.u + dt * 2.2);
        const u = doorAnim.u;
        door.position.x = doorAnim.fromX + (doorAnim.toX - doorAnim.fromX) * u;
        door.position.y = doorAnim.fromY + (doorAnim.toY - doorAnim.fromY) * u + Math.sin(Math.PI * u) * 3;
        door.rotation.y = u * Math.PI * 4;
        doorEyes.scale.set(1.35, 1.35, 1);
      } else {
        door.rotation.y = Math.sin(time * 2) * 0.08;
        const near = g.door ? Math.hypot(g.player.x - g.door.x, g.player.y - g.door.y) < 3 : false;
        const blink = (time % 3.6) < 0.1 ? 0.15 : 1;
        doorEyes.scale.set(near ? 1.25 : 1, near ? 1.25 * blink : blink, 1);
      }
    }
    pigeon.position.y = pigeonBaseY + Math.sin(time * 4) * 0.05;
    pigeon.rotation.z = Math.sin(time * 3) * 0.06;
    for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > W + 10) c.position.x = -10; }
  }

  function snap(g) {
    if (door && g.door) {
      doorAnim.toX = g.door.x; doorAnim.toY = g.door.y; doorAnim.u = 1;
      door.position.set(g.door.x, g.door.y, -0.25);
      door.rotation.y = 0;
    }
    for (let i = 0; i < visuals.length; i++) {
      const v = visuals[i], tr = g.traps[i];
      if (!v || !tr || v.userData.kind !== tr.kind) continue;
      if (tr.kind === 'fallingFloor' || tr.kind === 'launchFloor') { v.position.set(tr.cx + 0.5, tr.cy + 0.5, 0); v.rotation.z = 0; v.visible = true; }
      else if (tr.kind === 'antiJump') { if (v.userData.spikes) { v.userData.spikes.visible = false; v.userData.spikes.scale.y = 0.01; } }
      else if (tr.kind === 'invisibleBlock') v.visible = false;
      else if (tr.kind === 'hiddenSpikes') v.scale.y = 0.01;
      else if (tr.kind === 'bananaPeel') { v.rotation.y = 0; v.position.y = tr.cy; }
      else if (tr.kind === 'rubberChicken') v.scale.set(1, 1, 1);
      else if (tr.kind === 'chompCoin') { v.userData.teeth.visible = false; v.scale.setScalar(1); }
      else if (tr.kind === 'fakeDoor') v.rotation.x = 0;
      else if (tr.kind === 'crusher') v.position.set(tr.cx + 0.5, tr.cy + 0.5, 0);
      else if (tr.kind === 'boxingGlove') v.userData.glove.position.x = 0;
      else if (tr.kind === 'boulder') { v.visible = true; v.rotation.z = 0; v.position.set(tr.x, tr.y + 0.45, 0); }
      else if (tr.kind === 'sneezeCloud') { v.scale.setScalar(1); v.position.set(tr.cx + 0.5, tr.cy + 0.5, 0); }
      else if (tr.kind === 'fakeCheckpoint') { v.rotation.set(0, 0, 0); v.position.set(tr.cx + 0.5, tr.cy, -0.2); }
      else if (tr.kind === 'darkCandle') v.userData.flame.visible = true;
      else if (tr.kind === 'giftTrap') { v.visible = true; v.scale.setScalar(1); v.rotation.set(0, 0, 0); v.position.set(tr.cx + 0.5, tr.cy, 0); }
      else if (tr.kind === 'mimicRobot') { v.visible = true; v.rotation.y = -0.55; v.position.set(tr.x, tr.y, 0); }
      else if (tr.kind === 'booGhost') { v.position.set(tr.x, tr.y, 0); v.rotation.y = 0; }
    }
  }

  function dispose() {
    scene.remove(root);
    for (const r of owned) r.dispose();
    root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  }

  function instanced(geo, mat, cells, place) {
    const m = new InstancedMesh(geo, mat, Math.max(1, cells.length));
    m.count = cells.length;
    cells.forEach((c, i) => { place(...c); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  return { root, update, snap, dispose, door };
}

function textTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 216;
  const x = c.getContext('2d');
  x.fillStyle = '#8b0d1a';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let size = 92;
  do { x.font = `800 ${size}px Outfit, system-ui, sans-serif`; size -= 4; } while (x.measureText(text).width > 470 && size > 30);
  x.fillText(text, 256, 112);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
