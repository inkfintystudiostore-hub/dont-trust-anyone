// Usage: node tools/meshy-image-to-3d.mjs <name> [polycount] ["texture prompt"]
// Reads assets/refs/<name>.png, runs Meshy Image-to-3D, saves assets/raw/<name>.glb (+ thumbnail).
// The API key is read from the Meshy MCP entry in ~/.claude.json and never printed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [name, polyArg, texturePrompt] = process.argv.slice(2);
if (!name || !/^[a-z0-9_]+$/.test(name)) throw new Error('usage: node tools/meshy-image-to-3d.mjs <name> [polycount]');
const polycount = Number(polyArg ?? 10000);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.meshy?.env?.MESHY_API_KEY;
if (!key) throw new Error('MESHY_API_KEY not found in ~/.claude.json mcpServers.meshy.env');

const API = 'https://api.meshy.ai/openapi/v1';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const call = async (path, init) => {
  const r = await fetch(API + path, { headers, ...init });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
};

const png = readFileSync(join(root, 'assets/refs', `${name}.png`));
const before = (await call('/balance')).balance;

const { result: id } = await call('/image-to-3d', {
  method: 'POST',
  body: JSON.stringify({
    image_url: `data:image/png;base64,${png.toString('base64')}`,
    ai_model: 'latest',
    should_texture: true,
    should_remesh: true, // shortcut: fixed low-poly target for mobile; raise per asset if detail is lost
    target_polycount: polycount,
    target_formats: ['glb'],
    ...(texturePrompt && { texture_prompt: texturePrompt }), // e.g. to stop Meshy painting eyes
  }),
});
console.log(`task ${id} started (balance before: ${before})`);

let task;
for (;;) {
  await new Promise((r) => setTimeout(r, 10000));
  task = await call(`/image-to-3d/${id}`);
  console.log(`${task.status} ${task.progress}%`);
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status)) break;
}
if (task.status !== 'SUCCEEDED') throw new Error(`task ${task.status}: ${JSON.stringify(task.task_error)}`);

const outDir = join(root, 'assets/raw');
mkdirSync(outDir, { recursive: true });
const save = async (url, file) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${file} -> HTTP ${r.status}`);
  writeFileSync(join(outDir, file), Buffer.from(await r.arrayBuffer()));
};
await save(task.model_urls.glb, `${name}.glb`);
if (task.thumbnail_url) await save(task.thumbnail_url, `${name}.thumb.png`);

const after = (await call('/balance')).balance;
console.log(`saved assets/raw/${name}.glb | credits used: ${before - after} | balance: ${after}`);
