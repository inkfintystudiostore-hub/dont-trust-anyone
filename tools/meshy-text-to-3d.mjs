// Usage: node tools/meshy-text-to-3d.mjs <name> "<prompt>" [polycount] ["texture prompt"] [--preview-id=<id>]
// Runs Meshy v2 Text-to-3D preview + refine, saving assets/raw/<name>.glb (+ thumbnail).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rawArgs = process.argv.slice(2);
const previewFlag = rawArgs.find((a) => a.startsWith('--preview-id='));
const existingPreviewId = previewFlag ? previewFlag.slice('--preview-id='.length) : null;
const [name, prompt, polyArg, texturePrompt] = rawArgs.filter((a) => !a.startsWith('--preview-id='));
if (!name || (!prompt && !existingPreviewId) || !/^[a-z0-9_]+$/.test(name)) {
  throw new Error('usage: node tools/meshy-text-to-3d.mjs <name> "<prompt>" [polycount] ["texture prompt"] [--preview-id=<id>]');
}
const polycount = Number(polyArg ?? 6000);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.meshy?.env?.MESHY_API_KEY;
if (!key) throw new Error('MESHY_API_KEY not found in ~/.claude.json mcpServers.meshy.env');

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const call = async (url, init) => {
  const r = await fetch(url, { headers, ...init });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
};

const before = (await call('https://api.meshy.ai/openapi/v1/balance')).balance;

let previewId = existingPreviewId;
if (!previewId) {
  const { result } = await call('https://api.meshy.ai/openapi/v2/text-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'preview',
      prompt,
      ai_model: 'latest',
      should_remesh: true,
      target_polycount: polycount,
      target_formats: ['glb'],
    }),
  });
  previewId = result;
  console.log(`preview ${previewId} started (balance: ${before})`);

  let previewTask;
  for (;;) {
    await new Promise((r) => setTimeout(r, 8000));
    previewTask = await call(`https://api.meshy.ai/openapi/v2/text-to-3d/${previewId}`);
    console.log(`preview ${previewTask.status} ${previewTask.progress}%`);
    if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(previewTask.status)) break;
  }
  if (previewTask.status !== 'SUCCEEDED') {
    throw new Error(`preview ${previewTask.status}: ${JSON.stringify(previewTask.task_error)}`);
  }
} else {
  console.log(`reusing preview ${previewId} (balance: ${before})`);
}

const { result: refineId } = await call('https://api.meshy.ai/openapi/v2/text-to-3d', {
  method: 'POST',
  body: JSON.stringify({
    mode: 'refine',
    preview_task_id: previewId,
    texture_resolution: '2k',
    enable_pbr: true,
    ...(texturePrompt && { texture_prompt: texturePrompt }),
  }),
});
console.log(`refine ${refineId} started`);

let refineTask;
for (;;) {
  await new Promise((r) => setTimeout(r, 8000));
  refineTask = await call(`https://api.meshy.ai/openapi/v2/text-to-3d/${refineId}`);
  console.log(`refine ${refineTask.status} ${refineTask.progress}%`);
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(refineTask.status)) break;
}
if (refineTask.status !== 'SUCCEEDED') {
  throw new Error(`refine ${refineTask.status}: ${JSON.stringify(refineTask.task_error)}`);
}

const outDir = join(root, 'assets/raw');
mkdirSync(outDir, { recursive: true });
const save = async (url, file) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${file} -> HTTP ${r.status}`);
  writeFileSync(join(outDir, file), Buffer.from(await r.arrayBuffer()));
};
await save(refineTask.model_urls.glb, `${name}.glb`);
if (refineTask.thumbnail_url) await save(refineTask.thumbnail_url, `${name}.thumb.png`);

const after = (await call('https://api.meshy.ai/openapi/v1/balance')).balance;
console.log(`saved assets/raw/${name}.glb | credits used: ${before - after} | balance: ${after}`);
