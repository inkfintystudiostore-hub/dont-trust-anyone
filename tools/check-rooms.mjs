// Checks every catalog room on its own: rows line up, a naive runner does not win, the solver wins.
// Usage: node tools/check-rooms.mjs [roomName ...]
import { ROOMS as SOLO } from '../src/levels/rooms.js';
import { COOP_ROOMS } from '../src/levels/coopRooms.js';
import { composeLevel } from '../src/levels/compose.js';
import { parseLevel } from '../src/core/level.js';
import { createGame, step } from '../src/core/game.js';
import { solveLevel } from '../src/core/solver.js';

const COOP = process.argv.includes('--coop');
const ROOMS = COOP ? COOP_ROOMS : SOLO;
const hi = process.argv.indexOf('--h'); const H = hi > 0 ? Number(process.argv[hi + 1]) : 0;
const args = process.argv.slice(2).filter((a, i, all) => a !== '--h' && a !== '--coop' && all[i - 1] !== '--h');
const names = args.length ? args : Object.keys(ROOMS);
let bad = 0;
for (const name of names) {
  const room = ROOMS[name]({ h: H });
  const widths = new Set(room.rows.map((r) => r.length));
  if (widths.size > 1) { console.log(`${name}: ROW WIDTHS ${[...widths]}`); bad++; continue; }
  const level = parseLevel(composeLevel({ name, coopOnly: COOP, rooms: [room] }));
  const g = createGame([level], 0, { coop: COOP });
  let naive = 'stuck';
  for (let f = 0; f < 60 * 10; f++) {
    const ev = step(g, COOP ? [{ right: true }, { right: true }] : { right: true }, 1 / 60);
    if (ev.some((e) => e.type === 'death')) { naive = 'died'; break; }
    if (g.finished) { naive = 'WON'; break; }
  }
  const t0 = Date.now();
  const res = solveLevel(level, { coop: COOP, chunk: COOP ? 4 : 3, beam: 2000, maxMs: COOP ? 90000 : 40000 });
  const ok = res && naive !== 'WON';
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}: naive ${naive}, solver ${res ? `${(res.frames / 60).toFixed(1)}s` : 'FAILED'} (${Date.now() - t0} ms)`);
}
process.exit(bad ? 1 : 0);
