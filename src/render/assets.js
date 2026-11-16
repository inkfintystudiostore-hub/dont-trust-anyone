import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Box3, Group, Vector3 } from 'three';

/**
 * Loads compressed GLBs from /models and normalises each: given height, feet at y=0, centred on x/z.
 * Each result is a Group (scale/offset live on its child), so clones can be positioned freely.
 * @example
 * const models = await loadModels({ momo: 0.95, darwaza: 1.35 });
 * scene.add(models.momo.clone(true));
 */
export async function loadModels(heights) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const entries = await Promise.all(
    Object.entries(heights).map(async ([name, h]) => {
      const root = (await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)).scene;
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new Box3().setFromObject(root);
      root.scale.setScalar(h / box.getSize(new Vector3()).y);
      box.setFromObject(root);
      const c = box.getCenter(new Vector3());
      root.position.set(-c.x, -box.min.y, -c.z);
      const g = new Group();
      g.add(root);
      return [name, g];
    }),
  );
  return Object.fromEntries(entries);
}
