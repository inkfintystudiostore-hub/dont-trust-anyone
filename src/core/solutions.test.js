// Fairness rule: every level must be beatable once you know the trick. A tiny bot replays the solution.
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../levels.js';
import { createGame, step } from './game.js';

const DT = 1 / 60;

/** plan: [{ dir: 1|-1, jumpAt?: (p, g) => bool, until: (p, g, ev) => bool }] — fails on any death. */
function play(levelIndex, plan) {
  const g = createGame([LEVELS[levelIndex]]);
  for (const s of plan) {
    let jumped = false;
    for (let f = 0; ; f++) {
      if (f > 60 * 20) throw new Error(`step timed out at x=${g.player.x.toFixed(2)}`);
      const p = g.player;
      const jump = s.holdJump
        ? !!s.jumpAt?.(p, g)
        : !jumped && p.onGround && !!s.jumpAt?.(p, g);
      if (jump) jumped = true;
      const ev = step(g, { left: s.dir < 0, right: s.dir > 0, jump }, DT);
      const death = ev.find((e) => e.type === 'death');
      if (death) throw new Error(`died (${death.cause}) at x=${death.x.toFixed(2)}`);
      if (s.until(g.player, g, ev, f)) break;
    }
  }
  return g;
}

const landedPast = (x) => (p) => p.onGround && p.x > x;
const won = (_, g) => g.finished;

describe('every trap catches a naive player first', () => {
  const diesWith = (levelIndex, plan) => expect(() => play(levelIndex, plan)).toThrow(/died/);
  it('L1: just walking right drops you through the falling tile', () =>
    diesWith(0, [{ dir: 1, until: won }]));
  it('L2: a normal jump at the gap edge bonks the invisible block', () =>
    diesWith(1, [{ dir: 1, jumpAt: (p) => p.x >= 5.4, until: landedPast(8) }]));
  it('L2: walking past the gap into the spikes', () =>
    diesWith(1, [{ dir: 1, jumpAt: (p) => p.x >= 3.6, until: landedPast(8) }, { dir: 1, until: won }]));
  it('L3: trusting the bridge', () => diesWith(2, [{ dir: 1, until: won }]));
  it('L4: distrusting the truthful sign and walking onto the lower bridge', () => diesWith(3, [{ dir: 1, until: won }]));
  it('L5: relaxing on the breather and walking onto the final falling floor', () =>
    diesWith(4, [
      { dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(8.5) },
      { dir: 1, jumpAt: (p) => p.x >= 10.2, until: landedPast(14.5) },
      { dir: 1, until: won },
    ]));
  it('L6: stepping on the banana peel slides into spikes', () => diesWith(5, [{ dir: 1, until: won }]));
  it('L7: bouncing on the second rubber chicken launches into ceiling spikes', () =>
    diesWith(6, [
      { dir: 1, until: (p) => p.onGround && p.y > 4.5 },
      { dir: 1, until: won },
    ]));
  it('L8: walking into the first chomp coin', () => diesWith(7, [{ dir: 1, until: won }]));
  it('L9: celebrating at the fake level-complete door drops you into the pit', () =>
    diesWith(8, [{ dir: 1, jumpAt: (p) => p.x >= 4.5, until: landedPast(8) }, { dir: 1, until: won }]));
  it('L10: running straight at the mini-boss door drops through the first falling bridge', () =>
    diesWith(9, [{ dir: 1, until: won }]));
  it('L11: conveyor accelerates naive runner into spikes', () => diesWith(10, [{ dir: 1, until: won }]));
  it('L12: ceiling crusher flattens naive runner', () => diesWith(11, [{ dir: 1, until: won }]));
  it('L13: boxing glove punches naive runner into spikes', () =>
    diesWith(12, [{ dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(9.5) }, { dir: 1, until: won }]));
  it('L14: rolling boulder crushes naive runner', () => diesWith(13, [{ dir: 1, until: won }]));
  it('L15: breather drops naive runner on final falling tiles', () => diesWith(14, [{ dir: 1, until: won }]));
  it('L16: controls flip walks player back into the pit', () =>
    diesWith(15, [{ dir: 1, jumpAt: (p) => p.x >= 3.8, until: landedPast(7.5) }, { dir: 1, until: won }]));
  it('L17: assembly line conveyor feeds into crusher', () => diesWith(16, [{ dir: 1, until: won }]));
  it('L18: sneeze cloud blows naive runner into spikes', () => diesWith(17, [{ dir: 1, until: won }]));
  it('L19: fake win banner drops bridge under feet', () => diesWith(18, [{ dir: 1, until: won }]));
  it('L20: Toy Master crusher catches naive runner', () => diesWith(19, [{ dir: 1, until: won }]));
  it('L21: ceiling spikes kill naive inverted runner', () => diesWith(20, [{ dir: 1, until: won }]));
  it('L22: sticky caramel slows naive runner under crusher', () => diesWith(21, [{ dir: 1, until: won }]));
  it('L23: lower ghost bridge drops naive runner', () => diesWith(22, [{ dir: 1, until: won }]));
  it('L24: dark candle hides spikes ahead', () => diesWith(23, [{ dir: 1, until: won }]));
  it('L25: haunted breather final ghost bridge drops naive runner', () => diesWith(24, [{ dir: 1, until: won }]));
  it('L26: double flip reverses runner into ceiling spikes', () => diesWith(25, [{ dir: 1, until: won }]));
  it('L27: lower ghost bridge beneath chomp coins kills runner', () => diesWith(26, [{ dir: 1, until: won }]));
  it('L28: sneeze cloud in the dark blows runner into spikes', () => diesWith(27, [{ dir: 1, until: won }]));
  it('L29: fake door after gravity flip drops runner into pit', () => diesWith(28, [{ dir: 1, until: won }]));
  it('L30: final boss crusher catches naive runner', () => diesWith(29, [{ dir: 1, until: won }]));
  it('L31: walking onto launch floor catapults naive runner into ceiling spikes', () => diesWith(30, [{ dir: 1, until: won }]));
  it('L31: jumping near anti-jump zone spikes the floor under feet', () =>
    diesWith(30, [
      { dir: 1, jumpAt: (p) => p.x >= 5.5, until: landedPast(11) },
      { dir: 1, jumpAt: (p) => p.x >= 15.0, until: won },
    ]));
  it('L32: picking up mystery gift knocks naive runner backward onto spike', () =>
    diesWith(31, [
      { dir: 1, jumpAt: (p) => p.x >= 4.0, until: landedPast(7) },
      { dir: 1, until: won },
    ]));
  it('L33: rushing straight into mirror toy robot causes head-on collision', () => diesWith(32, [{ dir: 1, until: won }]));
  it('L34: waiting facing right under crusher lets peek-a-boo ghost ambush from behind', () =>
    diesWith(33, [
      { dir: 1, until: (p) => p.x >= 12.2 },
      { dir: 0, until: won },
    ]));
  it('L35: walking blindly into launch floor catches naive runner in Mind Games finale', () => diesWith(34, [{ dir: 1, until: won }]));
});

describe('every level is beatable', () => {
  it('L1: hop the falling tile and the gap, the door runs home, go back', () => {
    const g = play(0, [
      { dir: 1, jumpAt: (p) => p.x >= 8.6, until: landedPast(11) },
      { dir: 1, jumpAt: (p) => p.x >= 13.4, until: landedPast(17) },
      { dir: 1, until: (_, gg) => gg.door.ran },
      { dir: -1, jumpAt: (p) => p.x <= 17.4, until: (p) => p.onGround && p.x < 13.5 },
      { dir: -1, jumpAt: (p) => p.x <= 11.3, until: (p) => p.onGround && p.x < 9 },
      { dir: -1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L2: jump early under the invisible block, hop the hidden spikes, jump the last gap', () => {
    const g = play(1, [
      { dir: 1, jumpAt: (p) => p.x >= 3.6, until: landedPast(8) },
      { dir: 1, jumpAt: (p) => p.x >= 11.3, until: landedPast(15) },
      { dir: 1, jumpAt: (p) => p.x >= 18.6, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L3: skip the fake bridge via the high road, hop the falling tile, spikes and the spike by the door', () => {
    const g = play(2, [
      { dir: 1, jumpAt: (p) => p.x >= 5.0, until: (p) => p.onGround && p.y > 3.5 },
      { dir: 1, jumpAt: () => true, until: (p) => p.onGround && p.y < 2.5 && p.x > 12 },
      { dir: 1, jumpAt: (p) => p.x >= 15.4, until: landedPast(19) },
      { dir: 1, jumpAt: (p, gg) => gg.door.ran && p.x >= 26.6, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L4: trust the sign, take the high road, hop the hidden spikes', () => {
    const g = play(3, [
      { dir: 1, jumpAt: (p) => p.x >= 5.0, until: (p) => p.onGround && p.y > 3.5 },
      { dir: 1, jumpAt: (p) => p.x >= 11.2, until: (p) => p.onGround && p.y > 3.5 && p.x > 14 },
      { dir: 1, until: (p) => p.onGround && p.y < 2.5 && p.x > 19 },
      { dir: 1, jumpAt: (p) => p.x >= 22.4, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L5: clear the breather gaps and jump the sneaky final falling floor', () => {
    const g = play(4, [
      { dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(8.5) },
      { dir: 1, jumpAt: (p) => p.x >= 10.2, until: landedPast(14.5) },
      { dir: 1, jumpAt: (p) => p.x >= 19.2, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L6: jump over both banana peels, spikes and pit', () => {
    const g = play(5, [
      { dir: 1, jumpAt: (p) => p.x >= 4.8, until: landedPast(7.8) },
      { dir: 1, jumpAt: (p) => p.x >= 9.6, until: landedPast(13.8) },
      { dir: 1, jumpAt: (p) => p.x >= 15.6, until: landedPast(19.0) },
      { dir: 1, jumpAt: (p) => p.x >= 19.2, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L7: ride first chicken to high ledge, jump over second chicken under ceiling spikes', () => {
    const g = play(6, [
      { dir: 1, until: (p) => p.onGround && p.y > 4.5 },
      { dir: 1, until: (p) => p.onGround && p.y < 2 && p.x > 15 },
      { dir: 1, jumpAt: (p) => p.x >= 18.8, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L8: skip all chomp coins including the falling-floor bait', () => {
    const g = play(7, [
      { dir: 1, jumpAt: (p) => p.x >= 5.8, until: landedPast(9) },
      { dir: 1, until: (p) => p.x >= 16 },
      { dir: 1, jumpAt: (p) => p.x >= 18.8, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L9: hop spikes, jump over the fake level-complete door, hop hidden spikes to real door', () => {
    const g = play(8, [
      { dir: 1, jumpAt: (p) => p.x >= 4.5, until: landedPast(8) },
      { dir: 1, jumpAt: (p) => p.x >= 12.2, until: landedPast(16.5) },
      { dir: 1, jumpAt: (p) => p.x >= 19.4, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L10: chase the door across 4 traps and catch it at the final stop', () => {
    const g = play(9, [
      { dir: 1, until: (_, gg) => gg.door.stopIndex >= 1 },
      { dir: 1, jumpAt: (p) => p.x >= 9.0, until: (_, gg) => gg.door.stopIndex >= 2 },
      { dir: 1, jumpAt: (p) => p.x >= 16.8, until: landedPast(20.5) },
      { dir: 1, jumpAt: (p) => p.x >= 20.8, until: (_, gg) => gg.door.stopIndex >= 3 },
      { dir: 1, jumpAt: (p) => p.x >= 28.8, until: (_, gg) => gg.door.stopIndex >= 4 },
      { dir: 1, jumpAt: (p) => p.x >= 36.8, until: landedPast(40.5) },
      { dir: 1, jumpAt: (p) => p.x >= 41.2, until: won },
    ]);
    expect(g.deaths).toBe(0);
    expect(g.door.ran).toBe(true);
  });

  it('precision windows for key jumps in L4-L10 are at least 0.12s wide', () => {
    const sweepWidth = (levelIndex, beforePlan, xFrom, xTo, afterPlan) => {
      let wins = 0;
      for (let tx = xFrom; tx <= xTo; tx += 0.05) {
        try {
          play(levelIndex, [
            ...beforePlan,
            { dir: 1, jumpAt: (p) => p.x >= tx, until: landedPast(tx + 2.2) },
            ...afterPlan,
          ]);
          wins++;
        } catch { /* missed window */ }
      }
      return (wins * 0.05) / 6.5;
    };
    expect(sweepWidth(3, [
      { dir: 1, jumpAt: (p) => p.x >= 5.0, until: (p) => p.onGround && p.y > 3.5 },
      { dir: 1, jumpAt: (p) => p.x >= 11.2, until: (p) => p.onGround && p.y > 3.5 && p.x > 14 },
      { dir: 1, until: (p) => p.onGround && p.y < 2.5 && p.x > 19 },
    ], 21.4, 23.6, [{ dir: 1, until: won }])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(4, [
      { dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(8.5) },
      { dir: 1, jumpAt: (p) => p.x >= 10.2, until: landedPast(14.5) },
    ], 18.0, 20.5, [{ dir: 1, until: won }])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(5, [
      { dir: 1, jumpAt: (p) => p.x >= 4.8, until: landedPast(7.8) },
      { dir: 1, jumpAt: (p) => p.x >= 9.6, until: landedPast(13.8) },
    ], 14.2, 16.4, [{ dir: 1, jumpAt: (p) => p.x >= 19.2, until: won }])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(6, [
      { dir: 1, until: (p) => p.onGround && p.y > 4.5 },
      { dir: 1, until: (p) => p.onGround && p.y < 2 && p.x > 15 },
    ], 17.8, 19.8, [{ dir: 1, until: won }])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(7, [
      { dir: 1, jumpAt: (p) => p.x >= 5.8, until: landedPast(9) },
      { dir: 1, until: (p) => p.x >= 16 },
    ], 17.6, 19.8, [{ dir: 1, until: won }])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(8, [
      { dir: 1, jumpAt: (p) => p.x >= 4.5, until: landedPast(8) },
    ], 11.2, 13.5, [
      { dir: 1, jumpAt: (p) => p.x >= 19.4, until: won },
    ])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(9, [
      { dir: 1, until: (_, gg) => gg.door.stopIndex >= 1 },
    ], 7.8, 10.2, [
      { dir: 1, jumpAt: (p) => p.x >= 16.8, until: landedPast(20.5) },
      { dir: 1, jumpAt: (p) => p.x >= 20.8, until: (_, gg) => gg.door.stopIndex >= 3 },
      { dir: 1, jumpAt: (p) => p.x >= 28.8, until: (_, gg) => gg.door.stopIndex >= 4 },
      { dir: 1, jumpAt: (p) => p.x >= 36.8, until: landedPast(40.5) },
      { dir: 1, jumpAt: (p) => p.x >= 41.2, until: won },
    ])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(10, [], 8.0, 10.0, [
      { dir: 1, jumpAt: (p) => p.x >= 19.6, until: won },
    ])).toBeGreaterThanOrEqual(0.12);

    expect(sweepWidth(14, [], 17.6, 19.8, [{ dir: 1, until: won }])).toBeGreaterThanOrEqual(0.12);
    expect(sweepWidth(23, [], 8.2, 10.2, [{ dir: 1, jumpAt: (p) => p.x >= 16.0, until: won }])).toBeGreaterThanOrEqual(0.12);
    expect(sweepWidth(28, [
      { dir: 1, until: (p) => p.gravDir > 0 && p.x > 13.5 && p.onGround },
    ], 14.0, 16.2, [{ dir: 1, jumpAt: (p) => p.x >= 21.0, until: won }])).toBeGreaterThanOrEqual(0.12);
  });

  // World 2 (Levels 11-20)
  it('L11: hop off fast conveyor over spikes, then jump from reverse conveyor across pit', () => {
    const g = play(10, [
      { dir: 1, jumpAt: (p) => p.x >= 9.0, until: landedPast(13.2) },
      { dir: 1, jumpAt: (p) => p.x >= 19.6, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L12: bait both ceiling crushers then run under while rising', () => {
    const g = play(11, [
      { dir: 1, until: (p) => p.x >= 7.7 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, until: (p) => p.x >= 16.7 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L13: hop entry spikes, jump spring trap, jump over boxing glove to door', () => {
    const g = play(12, [
      { dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(9.4) },
      { dir: 1, jumpAt: (p) => p.x >= 9.6, until: landedPast(13.8) },
      { dir: 1, jumpAt: (p) => p.x >= 13.8, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L14: jump over rolling boulder and hidden spikes', () => {
    const g = play(13, [
      { dir: 1, jumpAt: (p, gg) => { const b = gg.traps.find((t) => t.kind === 'boulder'); return b && b.state === 'rolling' && b.x - p.x < 2.2; }, until: landedPast(17) },
      { dir: 1, jumpAt: (p) => p.x >= 20.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L15: cross conveyors past fake checkpoint and jump final falling bridge', () => {
    const g = play(14, [
      { dir: 1, jumpAt: (p) => p.x >= 18.8, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L16: jump pit onto controls-flip, reverse input to clear second pit', () => {
    const g = play(15, [
      { dir: 1, jumpAt: (p) => p.x >= 3.8, until: (p) => p.flipped > 0 },
      { dir: -1, jumpAt: (p) => p.x >= 15.8, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L17: bait crusher, hop spikes, jump over boxing glove', () => {
    const g = play(16, [
      { dir: 1, until: (p) => p.x >= 9.6 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, jumpAt: (p) => p.x >= 15.2, until: landedPast(18.5) },
      { dir: 1, jumpAt: (p) => p.x >= 19.2, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L18: bait both sneeze clouds, jump spikes & pie during cooldown', () => {
    const g = play(17, [
      { dir: 1, until: (p) => p.x >= 9.05 },
      { dir: -1, until: (p) => p.x <= 8.0 },
      { dir: 0, until: (_, __, ___, f) => f >= 35 },
      { dir: 1, holdJump: true, jumpAt: (p) => p.x >= 13.2 && p.x <= 15.8, until: landedPast(16.8) },
      { dir: 1, until: (p) => p.x >= 19.05 },
      { dir: -1, until: (p) => p.x <= 18.6 },
      { dir: 0, until: (_, __, ___, f) => f >= 10 },
      { dir: 1, holdJump: true, jumpAt: (p, gg) => { const pie = gg.traps.find((t) => t.kind === 'pieCannon'); return pie && pie.state === 'flying' && pie.x - p.x < 2.2 && pie.x > p.x - 0.3; }, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L19: ignore fake checkpoint, jump fake door against magnet, jump boulder to exit', () => {
    const g = play(18, [
      { dir: 1, jumpAt: (p) => p.x >= 15.3, until: landedPast(18.8) },
      { dir: 1, jumpAt: (p, gg) => { const b = gg.traps.find((t) => t.kind === 'boulder'); return b && b.state === 'rolling' && b.x - p.x < 3.0; }, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L20: defeat Toy Master 4-stop door across conveyors, crusher, spring, flip-glove, boulder', () => {
    const g = play(19, [
      { dir: 1, until: (_, gg) => gg.door.stopIndex >= 1 },
      { dir: 1, jumpAt: (p) => p.x >= 11.4, until: (_, gg) => gg.door.stopIndex >= 2 },
      { dir: 1, until: (p) => p.x >= 17.6 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, jumpAt: (p) => p.x >= 21.4, until: (_, gg) => gg.door.stopIndex >= 3 },
      { dir: 1, until: (p) => p.flipped > 0 },
      { dir: -1, jumpAt: (p) => p.x >= 28.4, until: (_, gg) => gg.door.stopIndex >= 4 },
      { dir: -1, jumpAt: (p) => p.x >= 38.4, until: won },
    ]);
    expect(g.deaths).toBe(0);
    expect(g.door.ran).toBe(true);
  });

  // World 3 (Levels 21-30)
  it('L21: flip to ceiling, downward-jump ceiling spikes, flip back to floor', () => {
    const g = play(20, [
      { dir: 1, until: (p) => p.gravDir < 0 && p.onGround },
      { dir: 1, jumpAt: (p) => p.x >= 10.6, until: (p) => p.gravDir > 0 && p.onGround },
      { dir: 1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L22: bait crusher over caramel, hop pie, then jump final pit from solid edge', () => {
    const g = play(21, [
      { dir: 1, until: (p) => p.x >= 8.7 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, jumpAt: (p, gg) => { const pie = gg.traps.find((t) => t.kind === 'pieCannon'); return pie && pie.state === 'flying' && pie.x - p.x < 2.0 && pie.x > p.x; }, until: (p) => p.x >= 18.8 },
      { dir: 1, jumpAt: (p) => p.x >= 19.2, until: (p, gg) => gg.finished || p.x >= 26.5 },
      { dir: -1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L23: climb high road past ghost bridge and hop hidden spikes', () => {
    const g = play(22, [
      { dir: 1, jumpAt: (p) => p.x >= 4.8, until: (p) => p.onGround && p.y > 3.5 },
      { dir: 1, jumpAt: (p) => p.x >= 12.2, until: (p) => p.onGround && p.y > 3.5 && p.x > 15 },
      { dir: 1, until: (p) => p.onGround && p.y < 2.5 && p.x > 19 },
      { dir: 1, jumpAt: (p) => p.x >= 20.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L24: jump dark spikes and hidden spikes from memory', () => {
    const g = play(23, [
      { dir: 1, jumpAt: (p) => p.x >= 9.4, until: landedPast(13.4) },
      { dir: 1, jumpAt: (p) => p.x >= 16.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L25: haunted breather flips twice and hops high ledge over final ghost bridge', () => {
    const g = play(24, [
      { dir: 1, until: (p) => p.gravDir < 0 && p.onGround },
      { dir: 1, until: (p) => p.gravDir > 0 && p.onGround },
      { dir: 1, jumpAt: (p) => p.x >= 17.5, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L26: handle inverted gravity + flipped controls and downward-jump ceiling spikes', () => {
    const g = play(25, [
      { dir: 1, until: (p) => p.flipped > 0 },
      { dir: -1, jumpAt: (p) => p.x >= 14.2, until: (p) => p.gravDir > 0 && p.onGround },
      { dir: -1, until: (p, gg) => p.flipped <= 0 || gg.finished },
      { dir: 1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L27: use upper stepping stones over chomp coins and ghost bridge, hop exit spike', () => {
    const g = play(26, [
      { dir: 1, jumpAt: (p) => p.x >= 4.5, until: (p) => p.onGround && p.y > 3.5 },
      { dir: 1, jumpAt: (p) => p.x >= 7.8, until: (p) => p.onGround && p.y > 3.5 && p.x > 11 },
      { dir: 1, until: (p) => p.onGround && p.y < 2.5 && p.x > 17 },
      { dir: 1, jumpAt: (p) => p.x >= 19.2, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L28: bait sneeze in the dark, jump spikes, jump over rubber chicken under ceiling spikes', () => {
    const g = play(27, [
      { dir: 1, until: (p) => p.x >= 10.0 },
      { dir: -1, until: (p) => p.x <= 8.5 },
      { dir: 0, until: (_, __, ___, f) => f >= 35 },
      { dir: 1, jumpAt: (p) => p.x >= 12.0, until: landedPast(16.8) },
      { dir: 1, jumpAt: (p) => p.x >= 18.6, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L29: gravity flip past fake checkpoint, flip down and jump fake door to real exit', () => {
    const g = play(28, [
      { dir: 1, until: (p) => p.gravDir > 0 && p.x > 13.5 && p.onGround },
      { dir: 1, jumpAt: (p) => p.x >= 15.2, until: landedPast(19.5) },
      { dir: 1, jumpAt: (p) => p.x >= 21.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L30: Master Chef 5-stop finale across Worlds 1-3 mechanics', () => {
    const g = play(29, [
      { dir: 1, until: (_, gg) => gg.door.stopIndex >= 1 },
      { dir: 1, until: (p) => p.x >= 9.6 },
      { dir: 0, until: (_, __, ___, f) => f >= 55 },
      { dir: 1, until: (p) => p.gravDir < 0 && p.onGround },
      { dir: 1, jumpAt: (p) => p.x >= 21.4, until: (p) => p.gravDir > 0 && p.onGround },
      { dir: 1, until: (_, gg) => gg.door.stopIndex >= 3 },
      { dir: 1, jumpAt: (p) => p.x >= 31.2, until: (_, gg) => gg.door.stopIndex >= 4 },
      { dir: 1, jumpAt: (p) => p.x >= 39.2, until: landedPast(42.5) },
      { dir: 1, jumpAt: (p) => p.x >= 42.8, until: (_, gg) => gg.door.stopIndex >= 5 },
      { dir: 1, jumpAt: (p) => p.x >= 50.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
    expect(g.door.ran).toBe(true);
  });

  it('L31: jump over launch floor, then walk calmly across anti-jump without jumping', () => {
    const g = play(30, [
      { dir: 1, jumpAt: (p) => p.x >= 5.5, until: landedPast(11) },
      { dir: 1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L32: hop starter spike, jump over mystery gift box, and clear falling bridge', () => {
    const g = play(31, [
      { dir: 1, jumpAt: (p) => p.x >= 4.0, until: landedPast(7.8) },
      { dir: 1, jumpAt: (p) => p.x >= 8.7, until: landedPast(12.8) },
      { dir: 1, jumpAt: (p) => p.x >= 14.4, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L33: wake mirror toy robot, dump it in pit, jump spring trap & pie to exit', () => {
    const g = play(32, [
      { dir: 1, until: (p) => p.x >= 6.0 },
      { dir: -1, until: (_, gg) => gg.traps.find((t) => t.kind === 'mimicRobot').state === 'done' },
      { dir: 1, jumpAt: (p) => p.x >= 6.8, until: landedPast(9.8) },
      { dir: 1, jumpAt: (p) => p.x >= 17.0, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L34: bait crusher, look left to freeze peek-a-boo ghost, then walk past anti-jump', () => {
    const g = play(33, [
      { dir: 1, until: (p) => p.x >= 11.8 },
      { dir: -1, until: (_, __, ___, f) => f >= 14 },
      { dir: 0, until: (_, gg) => { const m = gg.traps.find((t) => t.kind === 'crusher'); return m.state === 'rising' && m.offsetY > -1.8; } },
      { dir: 1, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });

  it('L35: Mind Games finale — clear launch floor, gift, spring trap, walk anti-jump, dump mirror robot', () => {
    const g = play(34, [
      { dir: 1, jumpAt: (p) => p.x >= 5.5, until: landedPast(10.0) },
      { dir: 1, jumpAt: (p) => p.x >= 10.6, until: landedPast(15.0) },
      { dir: 1, until: (p) => p.x >= 18.0 },
      { dir: -1, until: (_, gg) => gg.traps.find((t) => t.kind === 'mimicRobot').x >= 29.4 },
      { dir: 0, until: (_, gg) => gg.traps.find((t) => t.kind === 'mimicRobot').state === 'done' },
      { dir: 1, jumpAt: (p) => p.x >= 24.0, until: landedPast(26.5) },
      { dir: 1, jumpAt: (p) => p.x >= 28.6, until: won },
    ]);
    expect(g.deaths).toBe(0);
  });
});
