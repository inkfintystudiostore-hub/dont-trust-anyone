// Usage: node tools/recolor-glb.mjs <src> <dest>
// Makes Mimi from Momo: same clean mesh, body cream -> peach, crimson sprout -> mint.
// (Meshy kept painting/sculpting a face onto its own Mimi, see assets/ASSET_LIST.md.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const [src, dest] = process.argv.slice(2);
if (![src, dest].every((n) => /^[a-z0-9_]+$/.test(n ?? ''))) throw new Error('usage: node tools/recolor-glb.mjs <src> <dest>');

const CREAM = [228, 214, 160], PEACH = [250, 162, 136]; // body: measured Momo cream -> Mimi reference peach
const CRIMSON_LUM = 0.299 * 128 + 0.587 * 0 + 0.114 * 32, MINT = [143, 220, 192];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(`assets/raw/${src}.glb`);
const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 3) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const mx = Math.max(r, g, b), sat = mx ? (mx - Math.min(r, g, b)) / mx : 0;
  const reddish = r > g * 1.6 && r > b * 1.2 && sat > 0.45;
  const out = reddish
    ? MINT.map((c) => c * Math.min(1.25, Math.max(0.7, (0.299 * r + 0.587 * g + 0.114 * b) / CRIMSON_LUM)))
    : [r, g, b].map((c, k) => c * (PEACH[k] / CREAM[k]));
  for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, Math.round(out[k])));
}
const jpg = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
await io.write(`assets/raw/${dest}.glb`, doc);
console.log(`wrote assets/raw/${dest}.glb from ${src}.glb`);
