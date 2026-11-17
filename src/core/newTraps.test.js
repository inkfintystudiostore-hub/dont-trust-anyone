// Level Devil trap set: each one must catch a naive runner AND be beatable (proved by the solver).
import { describe, it, expect } from 'vitest';
import { parseLevel } from './level.js';
import { createGame, step } from './game.js';
import { solveLevel } from './solver.js';
import { runReplay } from './replay.js';

const DT = 1 / 60;
function runRight(level, frames = 60 * 8) {
  const g = createGame([level]);
  for (let f = 0; f < frames; f++) {
    const ev = step(g, { right: true }, DT);
    const d = ev.find((e) => e.type === 'death');
    if (d) return { died: d.cause, g };
    if (g.finished) return { won: true, g };
  }
  return { stuck: true, g };
}
function fair(level) {
  const res = solveLevel(level, { chunk: 3, beam: 1500, maxMs: 30000 });
  expect(res, 'solver found no solution').toBeTruthy();
  expect(runReplay(level, res.replay).won).toBe(true);
}

const icicle = parseLevel({
  name: 'icicle',
  rows: [
    '##########################',
    '..........;...............',
    '..........................',
    '.P...................D....',
    '##########################',
  ],
});
const risingFloor = parseLevel({
  name: 'rising',
  rows: [
    '##########################',
    '########^^^^##############',
    '..........................',
    '..........................',
    '.P...................D....',
    '########[[[[##############',
  ],
});
const saw = parseLevel({
  name: 'saw',
  rows: [
    '..........................',
    '..........................',
    '..........................',
    '.P.........&.........D....',
    '##########################',
  ],
  traps: [{ at: '&', dir: -1, range: 5, speed: 4 }],
});
const swell = parseLevel({
  name: 'swell',
  rows: [
    '..........................',
    '..........#######.........',
    '..........^^^^^^^.........',
    '.P....{..............D....',
    '##########################',
  ],
});
const spikeSwap = parseLevel({
  name: 'swap',
  rows: [
    '..........................',
    '..........................',
    '..........................',
    '.P1.........,.........D2..',
    '##########################',
  ],
  traps: [{ at: 'D', runTo: ['1', '2'], radius: 1.5 }],
});
const closingWall = parseLevel({
  name: 'wall',
  rows: [
    '..........................',
    '..........................',
    '..............]...........',
    '..............]...........',
    '.P............]......D....',
    '##########################',
  ],
  traps: [{ at: ']', dx: -2 }],
});

describe('Level Devil trap set', () => {
  it('icicle drops on a runner, and waiting it out works', () => {
    expect(runRight(icicle).died).toBe('icicle');
    fair(icicle);
  });
  it('rising floor carries a walker into the ceiling spikes, jumping the strip works', () => {
    expect(runRight(risingFloor).died).toMatch(/spikes|crushed/);
    fair(risingFloor);
  });
  it('patrol saw cuts a runner, timing the pass works', () => {
    expect(runRight(saw).died).toBe('saw');
    fair(saw);
  });
  it('size swell makes Momo giant under low ceiling spikes, jumping the pad works', () => {
    const r = runRight(swell);
    expect(r.died).toBe('spikes');
    fair(swell);
  });
  it('spike-swap tile is safe twice and kills on the third pass', () => {
    expect(runRight(spikeSwap, 60 * 12).won).toBeFalsy();
    const g = createGame([spikeSwap]);
    const t = g.traps.find((x) => x.kind === 'spikeSwap');
    expect(t.after).toBe(2);
    fair(spikeSwap);
  });
  it('closing wall slams shut ahead of a runner (stuck), and it crushes anyone inside it', () => {
    expect(runRight(closingWall).stuck).toBe(true);
    const g = createGame([closingWall]);
    const t = g.traps.filter((x) => x.kind === 'closingWall').sort((a, b) => a.cy - b.cy)[0];
    g.player.x = t.cx + 0.5;
    g.player.prevX = t.cx + 1.4;
    g.player.y = 1;
    t.state = 'closing';
    t.timer = 0;
    const ev = step(g, {}, DT);
    expect(ev.find((e) => e.type === 'death')?.cause).toBe('crushed');
  });
  it('size swell wears off and restores the normal hitbox', () => {
    const g = createGame([swell]);
    for (let f = 0; f < 60 && g.player.size === 1; f++) step(g, { right: true }, DT);
    expect(g.player.size).toBeCloseTo(2);
    g.player.sizeTimer = 0.01;
    step(g, {}, DT);
    expect(g.player.size).toBe(1);
    expect(g.player.height).toBeCloseTo(0.86);
  });
});
