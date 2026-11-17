import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Box3, Group, Vector3 } from 'three';

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();

function createLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

async function loadOne(loader, name, h) {
  const root = (await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)).scene;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  _box.setFromObject(root);
  root.scale.setScalar(h / _box.getSize(_size).y);
  _box.setFromObject(root);
  _box.getCenter(_center);
  root.position.set(-_center.x, -_box.min.y, -_center.z);
  const g = new Group();
  g.add(root);
  return g;
}

/**
 * Loads compressed GLBs from /models and normalises each: given height, feet at y=0, centred on x/z.
 * Each result is a Group (scale/offset live on its child), so clones can be positioned freely.
 * @example
 * const models = await loadModels({ momo: 0.95, darwaza: 1.35 });
 * scene.add(models.momo.clone(true));
 */
export async function loadModels(heights) {
  const loader = createLoader();
  const entries = await Promise.all(
    Object.entries(heights).map(async ([name, h]) => [name, await loadOne(loader, name, h)]),
  );
  return Object.fromEntries(entries);
}

/**
 * Progressive model store: loads only required models at boot, then preloads the rest in the background.
 */
export function createModelStore(heights) {
  const loader = createLoader();
  const models = {};
  const pending = new Map();

  function ensureOne(name) {
    if (models[name]) return Promise.resolve(models[name]);
    if (pending.has(name)) return pending.get(name);
    const h = heights[name];
    if (h === undefined) return Promise.reject(new Error(`Unknown model: ${name}`));
    const p = loadOne(loader, name, h).then((g) => {
      models[name] = g;
      pending.delete(name);
      return g;
    }, (err) => {
      pending.delete(name);
      throw err;
    });
    pending.set(name, p);
    return p;
  }

  function hasAll(names) {
    for (const name of names) if (!models[name]) return false;
    return true;
  }

  async function ensure(names) {
    const missing = [];
    for (const name of names) if (!models[name]) missing.push(name);
    if (missing.length === 0) return models;
    await Promise.all(missing.map(ensureOne));
    return models;
  }

  function preloadAll() {
    return ensure(Object.keys(heights));
  }

  return { models, hasAll, ensure, preloadAll };
}
