/**
 * Room-by-room level solver (dev/test tool), solo or co-op: walks the level room by room. Puzzle rooms run their scripted
 * choreography (coopRooms.js `script`); trap rooms are solved by beam search on the shared state.
 * Records one input track per player. Single-thread only; allocates freely (never in the game loop).
 *
 * @example
 * const r = solveCoop(parseLevel(raw), raw.spans); // { replay: [p1, p2], frames } or null
 * const s = solveBySpans(parseLevel(raw), raw.spans); // solo: { replay: 'r30 R1 ...', frames }
 */
import { createGame, step } from './game.js';
import { searchFrom } from './solver.js';
import { DT, decodeReplay, encodeReplay } from './replay.js';

const code = (inp) => {
  const d = inp.right ? 'r' : inp.left ? 'l' : '.';
  if (!inp.jump) return d;
  return d === 'r' ? 'R' : d === 'l' ? 'L' : 'J';
};

export function solveCoop(level, spans, opts = {}) {
  return solveBySpans(level, spans, { ...opts, coop: true });
}

export function solveBySpans(level, spans, { coop = false, beam = 1500, maxMs = 90000, chunk = 4 } = {}) {
  const g = createGame([level], 0, { coop });
  const n = g.players.length;
  const frames = [];
  const apply = (ins) => {
    frames.push(ins);
    step(g, coop ? ins : ins[0], DT);
    if (g.dead) throw new Error(`solver died (${g.deathCause}) at f=${frames.length}`);
  };
  try {
    for (const span of spans) {
      if (g.finished) break;
      if (span.script) runScript(g, span, apply);
      else {
        const endX = span.x0 + span.w - 0.6;
        const goal = span.last ? (s) => s.finished : (s) => s.players.every((p) => p.x >= endX && p.onGround);
        const score = span.last ? undefined : (s) => s.players.reduce((a, p) => a + Math.max(0, endX - p.x) + (p.onGround ? 0 : 0.3), 0);
        // coarse steps first; finer timing only for the rooms that need it
        let res = null;
        // co-op: try both players moving together first, separate moves only if that fails
        const modes = coop ? [true, false] : [false];
        for (const lockstep of modes) {
          for (const c of [chunk, 3, 2].filter((v, k, arr) => arr.indexOf(v) === k && v <= chunk)) {
            res = searchFrom(g, { coop, lockstep, chunk: c, beam, maxMs, goal, score });
            if (res) break;
          }
          if (res) break;
        }
        if (!res) return null;
        const tr = (coop ? res.replay : [res.replay]).map(decodeReplay);
        for (let f = 0; f < tr[0].length; f++) { apply(tr.map((t) => t[f])); if (g.finished) break; }
      }
    }
  } catch {
    return null;
  }
  if (!g.finished) return null;
  const tracks = Array.from({ length: n }, (_, i) => encodeReplay(frames.map((ins) => [code(ins[i]), 1])));
  return { replay: coop ? tracks : tracks[0], frames: frames.length };
}

function target(span, t) {
  if (t === 'hold') return null;
  if (t === 'exit') return span.exitX;
  return span.x0 + t;
}

function runScript(g, span, apply) {
  for (const phase of span.script) {
    for (let f = 0; ; f++) {
      if (f > 60 * 25) throw new Error('script phase timed out');
      const reached = g.players.map((p, i) => {
        const X = target(span, phase.p[i]);
        return X === null || p.atDoor || (Math.abs(p.x - X) < 0.25 && p.onGround);
      });
      if (g.finished || (reached.every(Boolean) && (!phase.until || phase.until(g)))) break;
      const ins = g.players.map((p, i) => {
        const X = target(span, phase.p[i]);
        if (X === null || p.atDoor) return { left: false, right: false, jump: false };
        const dx = X - p.x;
        // brake early so the player settles on a plate instead of sliding past it
        const go = Math.abs(dx) > 0.12 && !(Math.abs(dx) < 0.45 && Math.abs(p.vx) > 1.5);
        return { left: go && dx < 0, right: go && dx > 0, jump: false };
      });
      apply(ins);
    }
  }
}
