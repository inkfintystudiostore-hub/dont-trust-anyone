/**
 * Input replays: a compact, deterministic record of one solution per level.
 * Token = <code><frames>. Codes: '.' idle, 'l' left, 'r' right, 'd' fall-fast,
 * 'J' jump, 'L' jump+left, 'R' jump+right. Jump is pressed on the token's first frame only.
 * Co-op replays are an array with one string per player (same frame timeline).
 *
 * @example
 * runReplay(level, 'r30 R1 r40').won // true if that input wins the level
 */
import { createGame, step } from './game.js';

export const DT = 1 / 60;
const DIR = { '.': 0, l: -1, r: 1, d: 0, J: 0, L: -1, R: 1 };
const JUMP = { J: true, L: true, R: true };

/** Expands a replay string to a per-frame input array. */
export function decodeReplay(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    const code = tok[0];
    const n = Number(tok.slice(1) || 1);
    if (!(code in DIR) || !Number.isInteger(n) || n < 1) throw new Error(`bad replay token "${tok}"`);
    for (let f = 0; f < n; f++) {
      const dir = DIR[code];
      out.push({ left: dir < 0, right: dir > 0, down: code === 'd', jump: !!JUMP[code] && f === 0 });
    }
  }
  return out;
}

/** Encodes a list of [code, frames] chunks, merging repeats of non-jump codes. */
export function encodeReplay(chunks) {
  const toks = [];
  for (const [code, n] of chunks) {
    const last = toks[toks.length - 1];
    if (last && !JUMP[code] && last[0] === code) last[1] += n;
    else toks.push([code, n]);
  }
  return toks.map(([c, n]) => `${c}${n}`).join(' ');
}

/** Plays a replay (string, or [p1, p2] for co-op). Returns { won, death, frames }. */
export function runReplay(level, replay, { coop = false, extraFrames = 120 } = {}) {
  const tracks = (Array.isArray(replay) ? replay : [replay]).map(decodeReplay);
  const g = createGame([level], 0, { coop });
  const len = Math.max(...tracks.map((t) => t.length)) + extraFrames;
  const idle = { left: false, right: false, jump: false };
  for (let f = 0; f < len; f++) {
    const inputs = tracks.map((t) => t[f] ?? idle);
    const ev = step(g, coop ? inputs : inputs[0], DT);
    const death = ev.find((e) => e.type === 'death');
    if (death) return { won: false, death, frames: f };
    if (g.finished) return { won: true, death: null, frames: f };
  }
  return { won: false, death: null, frames: len };
}

/** Stable short hash of a parsed level's gameplay data, to detect stale replays. */
export function levelHash(level) {
  const s = JSON.stringify([level.W, level.H, Array.from(level.tiles), level.start, level.door, level.trapDefs, level.coopOnly]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
