// Fairness for every level: a recorded solution (tools/solve-levels.mjs: room-by-room solver, scripted
// choreography for co-op puzzle rooms) still wins with zero deaths, and players who only run right never win.
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../levels.js';
import { createGame, step } from './game.js';
import { runReplay, levelHash } from './replay.js';
import REPLAYS from '../replays.json';

const all = LEVELS.map((l, i) => [i + 1, l.coopOnly ? 'co-op' : 'solo', l]);

describe('every level is beatable (recorded replays)', () => {
  it.each(all)('L%i (%s) replay is current and wins', (_, __, level) => {
    const rec = REPLAYS[level.name];
    expect(rec, `no replay for ${level.name}: run node tools/solve-levels.mjs`).toBeTruthy();
    expect(rec.hash, `stale replay for ${level.name}: run node tools/solve-levels.mjs`).toBe(levelHash(level));
    const r = runReplay(level, rec.replay, { coop: level.coopOnly });
    expect(r.death?.cause ?? null).toBe(null);
    expect(r.won).toBe(true);
  });
});

describe('every level punishes players who only run right', () => {
  it.each(all)('L%i (%s) naive runners do not win', (_, __, level) => {
    const g = createGame([level], 0, { coop: level.coopOnly });
    const input = level.coopOnly ? [{ right: true }, { right: true }] : { right: true };
    for (let f = 0; f < 60 * 30 && !g.finished; f++) {
      if (step(g, input, 1 / 60).some((e) => e.type === 'death')) break;
    }
    expect(g.finished).toBe(false);
  });
});
