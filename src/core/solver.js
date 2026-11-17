/**
 * Level solver (dev tool, not shipped in the game loop): beam search over chunked inputs on the
 * real deterministic game step. Proves a level is beatable and records a replay for tests.
 * Single-thread only. Allocates freely; never call it from the game loop.
 *
 * @example
 * const r = solveLevel(LEVELS[0]);           // { replay: 'r40 R1 r22', frames } or null
 * const c = solveLevel(coopLevel, { coop: true }); // { replay: ['r..', 'r..'] }
 */
import { createGame, step, cloneGame } from './game.js';
import { encodeReplay, DT } from './replay.js';

const SOLO_ACTS = ['r', 'l', '.', 'R', 'L', 'J'];
// Co-op: drop joint idle+idle and pairs where both jump in place, keeping the search tractable.
const COOP_ACTS = [];
for (const a of SOLO_ACTS) for (const b of SOLO_ACTS) if (!(a === '.' && b === '.')) COOP_ACTS.push([a, b]);
COOP_ACTS.push(['.', '.']);
const DIR = { '.': 0, l: -1, r: 1, J: 0, L: -1, R: 1 };
const JUMP = { J: true, L: true, R: true };

const r = (v, k) => Math.round(v * k);

function stateKey(g) {
  let s = '';
  for (const p of g.players) {
    s += `${r(p.x, 6)},${r(p.y, 6)},${r(p.vx, 1)},${r(p.vy, 0.34)},${p.onGround ? 1 : 0},${p.gravDir},${p.flipped > 0 ? 1 : 0},${p.atDoor ? 1 : 0},${p.stun > 0 ? 1 : 0},${p.slip > 0 ? 1 : 0}|`;
  }
  for (const t of g.traps) {
    s += `${t.state[0]}${t.active ? 1 : 0}${t.revealed ? 1 : 0}${t.collected ? 1 : 0}${t.triggered ? 1 : 0}${t.armed ? 1 : 0}${t.open ? 1 : 0}${t.defused ? 1 : 0}${t.stopIndex}${t.curCx}`;
    if (t.state !== 'idle' || t.vx || t.vy) s += `${r(t.x, 2)},${r(t.y + t.offsetY, 2)},${r(t.timer, 5)}`;
    s += ';';
  }
  if (g.door) s += `D${r(g.door.x, 2)}${g.door.shrunk ? 1 : 0}`;
  s += `K${g.keysLeft}${g.syncActive ? 1 : 0}${g.darkTimer > 0 ? 1 : 0}`;
  return s;
}

function score(g) {
  const d = g.door;
  if (!d) return 0;
  let s = 0;
  for (const p of g.players) s += p.atDoor ? -50 : Math.abs(p.x - d.x) + 0.6 * Math.abs(p.y - d.y);
  // Milestones dominate distance so states past a door run / key pickup are never pruned for being "far".
  let milestones = (d.stopIndex ?? 0) * 3 - g.keysLeft;
  for (const t of g.traps) if (t.kind === 'bomb' && t.defused) milestones++;
  return s - milestones * 1000;
}

/**
 * @param {object} level parsed level
 * @param {{coop?: boolean, chunk?: number, beam?: number, maxDepth?: number, maxMs?: number}} opts
 * @returns {{replay: string|string[], frames: number}|null}
 */
export function solveLevel(level, { coop = false, chunk = 4, beam = 3000, maxDepth = 1500, maxMs = 60000 } = {}) {
  const root = createGame([level], 0, { coop });
  const acts = coop ? COOP_ACTS : SOLO_ACTS.map((a) => [a]);
  const seen = new Set([stateKey(root)]);
  let layer = [{ g: root, path: null }];
  const t0 = Date.now();
  for (let depth = 0; depth < maxDepth && layer.length; depth++) {
    if (Date.now() - t0 > maxMs) return null;
    const next = [];
    for (const node of layer) {
      for (const a of acts) {
        const c = cloneGame(node.g);
        let ok = true;
        for (let f = 0; f < chunk; f++) {
          const ins = a.map((code) => ({ left: DIR[code] < 0, right: DIR[code] > 0, jump: !!JUMP[code] && f === 0 }));
          step(c, coop ? ins : ins[0], DT);
          if (c.dead) { ok = false; break; }
          if (c.finished) break;
        }
        if (!ok) continue;
        const path = { prev: node.path, a };
        if (c.finished) return { replay: unwind(path, chunk, a.length), frames: (depth + 1) * chunk };
        const k = stateKey(c);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ g: c, path, s: score(c) });
      }
    }
    if (next.length > beam) {
      next.sort((x, y) => x.s - y.s);
      // Keep mostly the best, plus a spread of the rest so detours (running doors, keys) survive.
      const keep = next.slice(0, Math.floor(beam * 0.7));
      const rest = next.slice(keep.length);
      const stride = rest.length / (beam - keep.length);
      for (let i = 0; i < beam - keep.length; i++) keep.push(rest[Math.floor(i * stride)]);
      layer = keep;
    } else layer = next;
  }
  return null;
}

function unwind(path, chunk, n) {
  const list = [];
  for (let p = path; p; p = p.prev) list.push(p.a);
  list.reverse();
  const AFTER_JUMP = { J: '.', L: 'l', R: 'r' };
  const tracks = [];
  for (let i = 0; i < n; i++) {
    const chunks = [];
    for (const a of list) {
      const c = a[i];
      if (!JUMP[c]) chunks.push([c, chunk]);
      else { chunks.push([c, 1]); if (chunk > 1) chunks.push([AFTER_JUMP[c], chunk - 1]); }
    }
    tracks.push(encodeReplay(chunks));
  }
  return n === 1 ? tracks[0] : tracks;
}
