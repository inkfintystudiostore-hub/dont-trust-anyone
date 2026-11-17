// Solves levels with the beam-search bot and stores replays in src/replays.json.
// Usage: node tools/solve-levels.mjs [all|stale|1,5,12] [--chunk 4] [--beam 3000]
// Default "stale": only levels whose replay is missing or whose level data changed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LEVELS } from '../src/levels.js';
import { solveLevel } from '../src/core/solver.js';
import { runReplay, levelHash } from '../src/core/replay.js';

const file = new URL('../src/replays.json', import.meta.url);
const db = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : def; };
const sel = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'stale';

const picks = LEVELS.map((l, i) => i).filter((i) => {
  if (sel === 'all') return true;
  if (sel === 'stale') return db[LEVELS[i].name]?.hash !== levelHash(LEVELS[i]);
  return sel.split(',').map(Number).includes(i + 1);
});

let failed = 0;
for (const i of picks) {
  const level = LEVELS[i];
  const coop = level.coopOnly;
  const t0 = Date.now();
  let res = null;
  for (const chunk of [opt('chunk', 4), 3, 2]) {
    res = solveLevel(level, { coop, chunk, beam: opt('beam', coop ? 1500 : 3000), maxMs: opt('ms', 90000) });
    if (res && runReplay(level, res.replay, { coop }).won) break;
    res = null;
  }
  const ms = Date.now() - t0;
  if (!res) { failed++; console.log(`L${i + 1} ${level.name}: NO SOLUTION (${ms} ms)`); continue; }
  db[level.name] = { hash: levelHash(level), replay: res.replay };
  console.log(`L${i + 1} ${level.name}: solved in ${(res.frames / 60).toFixed(1)}s game time (${ms} ms)`);
  writeFileSync(file, `${JSON.stringify(db, null, 1)}\n`);
}
console.log(`${picks.length - failed}/${picks.length} solved`);
process.exit(failed ? 1 : 0);
