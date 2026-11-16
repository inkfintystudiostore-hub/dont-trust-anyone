import { describe, it, expect } from 'vitest';
import { LEVELS } from '../levels.js';
import { createGame, step } from './game.js';

const DT = 1 / 60;

/**
 * Runs 2-player co-op simulation until g.finished, death, or timeout.
 * controlFn(p0, p1, g, frame, state) returns [in0, in1].
 */
function playCoop(levelIndex, controlFn, maxFrames = 60 * 35) {
  const g = createGame([LEVELS[levelIndex]], 0, { coop: true });
  const state = {};
  for (let f = 0; f < maxFrames; f++) {
    const [in0, in1] = controlFn(g.players[0], g.players[1], g, f, state);
    const ev = step(g, [in0, in1], DT);
    const death = ev.find((e) => e.type === 'death');
    if (death) {
      throw new Error(`died (${death.cause}, victim=${death.victim}) at x=${death.x.toFixed(2)}, f=${f}`);
    }
    if (g.finished) return g;
  }
  throw new Error(
    `coop timed out at p0=(${g.players[0].x.toFixed(2)},${g.players[0].y.toFixed(2)}), `
    + `p1=(${g.players[1].x.toFixed(2)},${g.players[1].y.toFixed(2)}), keysLeft=${g.keysLeft}`
  );
}

/** Simple position follower helper for one bot player. */
function moveTo(p, targetX, { tol = 0.14, jumpIf = false } = {}) {
  const dx = targetX - p.x;
  const jump = !!(jumpIf && p.onGround);
  if (Math.abs(dx) <= tol && !jump) return { left: false, right: false, jump: false };
  return { left: dx < -tol, right: dx > tol, jump };
}

describe('World 5 uncoordinated rushing always fails', () => {
  const rushRight = () => [{ right: true }, { right: true }];

  it('L36: rushing through closed hazard gate (=) kills both partners', () => {
    expect(() => playCoop(35, rushRight, 60 * 6)).toThrow(/died \(gate/);
  });

  it('L36: jumping over closed hazard gate (=) without pressing H STILL kills (no jump bypass)', () => {
    const jumpGate = (p0, p1) => [
      { right: true, jump: p0.x >= 9.6 && p0.x <= 10.5 },
      { right: true, jump: p1.x >= 9.6 && p1.x <= 10.5 },
    ];
    expect(() => playCoop(35, jumpGate, 60 * 6)).toThrow(/died \(gate/);
  });

  it('L37: rushing without holding H leaves bomb undefused or hits hidden spikes', () => {
    expect(() => playCoop(36, rushRight, 60 * 18)).toThrow(/died/);
  });

  it('L38: rushing floor path without upper shield H dies at triple laser', () => {
    expect(() => playCoop(37, rushRight, 60 * 6)).toThrow(/died \(gate/);
  });

  it('L39: rushing without holding H dies on gate or bomb', () => {
    expect(() => playCoop(38, rushRight, 60 * 18)).toThrow(/died/);
  });

  it('L40: rushing without watchtower plate H dies at closed laser', () => {
    expect(() => playCoop(39, rushRight, 60 * 6)).toThrow(/died \(gate/);
  });

  it('L41: rushing without holding H or clearing launch floor dies', () => {
    expect(() => playCoop(40, rushRight, 60 * 6)).toThrow(/died/);
  });

  it('L42: rushing couples finale without coordination dies', () => {
    expect(() => playCoop(41, rushRight, 60 * 10)).toThrow(/died/);
  });
});

describe('World 5 Couples Co-op 0-death solutions (L36-L42)', () => {
  it('L36: Airlock Key Handoff (H -> * -> H relay -> h -> D)', () => {
    const g = playCoop(35, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      if (st.phase === 0) {
        // P0 holds left H (4.5), P1 grabs key (14.5) and steps onto right H (16.5)
        if (game.keysLeft === 0 && p1.x >= 16.2) st.phase = 1;
        return [moveTo(p0, 4.5), moveTo(p1, game.keysLeft > 0 ? 14.5 : 16.5)];
      }
      if (st.phase === 1) {
        // P1 holds right H (16.5), P0 crosses = and reaches left h (19.5)
        if (p0.x >= 19.2) st.phase = 2;
        return [moveTo(p0, 19.5), moveTo(p1, 16.5)];
      }
      if (st.phase === 2) {
        // P0 holds left h (19.5), P1 crosses - and reaches right h (24.5)
        if (p1.x >= 24.2) st.phase = 3;
        return [moveTo(p0, 19.5), moveTo(p1, 24.5)];
      }
      // P1 holds right h briefly until P0 clears -, then both enter D
      if (p0.x < 22.8) return [moveTo(p0, 23.5), moveTo(p1, 24.5)];
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
    expect(g.keysLeft).toBe(0);
  });

  it('L37: Bomb Squad (P0 holds H while P1 jumps S, defuses @, grabs *, holds right H)', () => {
    const g = playCoop(36, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      const bomb = game.traps.find((t) => t.kind === 'bomb');
      if (st.phase === 0) {
        if (bomb.defused && game.keysLeft === 0 && p1.x >= 22.2) st.phase = 1;
        // P0 holds left H (4.5). P1 jumps over S (x ~ 7.7..10.5), defuses @ (12.5), grabs * (20.5), holds H (22.5)
        const jumpS = p1.x >= 7.6 && p1.x <= 8.2;
        const target = !bomb.defused ? 12.5 : (game.keysLeft > 0 ? 20.5 : 22.5);
        return [moveTo(p0, 4.5), moveTo(p1, target, { jumpIf: jumpS })];
      }
      // P1 holds right H (22.5) while P0 jumps S and crosses @ + =
      if (p0.x < 21.8) {
        const jumpS = p0.x >= 7.6 && p0.x <= 8.2;
        return [moveTo(p0, 22.5, { jumpIf: jumpS }), moveTo(p1, 22.5)];
      }
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
  });

  it('L38: Sync Bridge Shield (both hit + together to latch === while P1 grabs * & holds H)', () => {
    const g = playCoop(37, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      if (st.phase === 0) {
        // P0 climbs upper bridge to + (9.5), P1 stands on lower + (9.5) to latch === open for 2.5s
        const jumpUp = p0.y < 3.5 && p0.x >= 4.4 && p0.x <= 5.4;
        if (game.syncLatch > 0.2) st.phase = 1;
        return [moveTo(p0, 9.5, { jumpIf: jumpUp }), moveTo(p1, 9.5)];
      }
      if (st.phase === 1) {
        // Both rush across latched ===! P1 grabs * (18.5) & holds H (20.5), P0 drops off bridge and crosses ===
        if (game.keysLeft === 0 && p1.x >= 20.2 && p0.x >= 19.5) st.phase = 2;
        return [moveTo(p0, 20.5), moveTo(p1, game.keysLeft > 0 ? 18.5 : 20.5)];
      }
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
  });

  it('L39: Anti-Jump + Bomb + Mirror Robot + Pit', () => {
    const g = playCoop(38, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      const bomb = game.traps.find((t) => t.kind === 'bomb');
      const robot = game.traps.find((t) => t.kind === 'mimicRobot');
      if (st.phase === 0) {
        // P0 holds left H (4.5) while P1 defuses bomb & grabs key (waking mimicRobot)
        if (bomb.defused && game.keysLeft === 0) st.phase = 1;
        return [moveTo(p0, 4.5), moveTo(p1, !bomb.defused ? 12.5 : 18.5)];
      }
      if (st.phase === 1) {
        // P0 STILL holds H (4.5) keeping = open so P1 walks left through = to march mimicRobot into pit 26..27
        if (robot.state === 'done') st.phase = 2;
        return [moveTo(p0, 4.5), moveTo(p1, 11.5)];
      }
      if (st.phase === 2) {
        // Now P1 holds right H (19.5) while P0 crosses =
        if (p0.x >= 18.8) st.phase = 3;
        return [p1.x >= 19.2 ? moveTo(p0, 19.5) : moveTo(p0, 4.5), moveTo(p1, 19.5)];
      }
      // Pit is cols 26..27 (x = 26.0..28.0)
      const jumpPit = (p) => p.x >= 24.8 && p.x <= 25.7;
      return [
        moveTo(p0, doorX, { jumpIf: jumpPit(p0) }),
        moveTo(p1, doorX, { jumpIf: jumpPit(p1) }),
      ];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
  });

  it('L40: Peek-a-Boo Ghost + Magnet Watchtower (hold H then h to reverse % & freeze Q)', () => {
    const g = playCoop(39, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      if (st.phase === 0) {
        // P0 stands on H (6.5) while P1 crosses = to 13.5
        if (p1.x >= 13.5) st.phase = 1;
        return [moveTo(p0, 6.5), moveTo(p1, 13.5)];
      }
      if (st.phase === 1) {
        // P0 moves to h (9.5) facing RIGHT (freezes Q + reverses % to boost P1!) while P1 grabs * (19.5) and holds H (22.5)
        if (game.keysLeft === 0 && p1.x >= 22.2 && p1.onGround) st.phase = 2;
        const in0 = Math.abs(p0.x - 9.5) > 0.14
          ? moveTo(p0, 9.5)
          : { right: p0.face < 0, left: false, jump: false };
        const ghost = game.traps.find((t) => t.kind === 'booGhost');
        const jumpQ = ghost && Math.abs(ghost.x - p1.x) < 1.6 && p1.x < ghost.x;
        return [in0, moveTo(p1, game.keysLeft > 0 ? 19.5 : 22.5, { jumpIf: !!jumpQ })];
      }
      // P1 holds right H (22.5) facing LEFT to keep Q frozen while P0 walks/jumps past Q
      if (p0.x < 21.8) {
        const in1 = Math.abs(p1.x - 22.5) > 0.14
          ? moveTo(p1, 22.5)
          : { left: p1.face > 0, right: false, jump: false };
        const ghost = game.traps.find((t) => t.kind === 'booGhost');
        const jumpQ = ghost && Math.abs(ghost.x - p0.x) < 1.6 && p0.x < ghost.x;
        return [moveTo(p0, 22.5, { jumpIf: !!jumpQ }), in1];
      }
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
  });

  it('L41: Twin Keys + Launch Floor under Ceiling Spikes', () => {
    const g = playCoop(40, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      if (st.phase === 0) {
        // P0 holds left H (4.5). P1 crosses = (10.5), jumps LLL (11..15) at 11.2, grabs *1 (16.5), goes to H (18.5)
        if (game.keysLeft <= 1 && p1.x >= 18.3 && p1.onGround) st.phase = 1;
        const jumpL1 = p1.x >= 11.1 && p1.x <= 11.7;
        return [moveTo(p0, 4.5), moveTo(p1, game.keysLeft === 2 ? 16.5 : 18.5, { jumpIf: jumpL1 })];
      }
      if (st.phase === 1) {
        // P1 holds middle H (18.5), P0 crosses =, jumps LLL at 11.2, steps on h (20.5)
        if (p0.x >= 20.2) st.phase = 2;
        const jumpL0 = p0.x >= 11.1 && p0.x <= 11.7;
        return [moveTo(p0, 20.5, { jumpIf: jumpL0 }), moveTo(p1, 18.5)];
      }
      if (st.phase === 2) {
        // P0 holds h (20.5), P1 crosses - (23.5), grabs *2 (25.5), holds right h (28.5)
        if (game.keysLeft === 0 && p1.x >= 28.2) st.phase = 3;
        return [moveTo(p0, 20.5), moveTo(p1, game.keysLeft > 0 ? 25.5 : 28.5)];
      }
      if (p0.x < 26.5) return [moveTo(p0, 28.5), moveTo(p1, 28.5)];
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
    expect(g.keysLeft).toBe(0);
  });

  it('L42: Couples Finale (Launch + Bomb + Mirror/Ghost + Moving Door)', () => {
    const g = playCoop(41, (p0, p1, game, _f, st) => {
      st.phase ??= 0;
      const doorX = game.door.x;
      const jumpLaunch = (p) => p.x >= 5.1 && p.x <= 5.7;
      if (st.phase === 0) {
        // Both jump LLL (6..8), P0 holds H (10.5), P1 defuses @ (14.5), grabs * (20.5), stands H (21.5)
        const bomb = game.traps.find((t) => t.kind === 'bomb');
        if (bomb.defused && game.keysLeft === 0 && p1.x >= 21.2) st.phase = 1;
        const t1 = !bomb.defused ? 14.5 : (game.keysLeft > 0 ? 20.5 : 21.5);
        return [moveTo(p0, 10.5, { jumpIf: jumpLaunch(p0) }), moveTo(p1, t1, { jumpIf: jumpLaunch(p1) })];
      }
      if (st.phase === 1) {
        // P1 holds right H (21.5) facing RIGHT to freeze Q while P0 crosses = and reaches h (24.5)
        if (p0.x >= 24.2) st.phase = 2;
        const in1 = Math.abs(p1.x - 21.5) > 0.14
          ? moveTo(p1, 21.5)
          : { right: p1.face < 0, left: false, jump: false };
        return [moveTo(p0, 24.5), in1];
      }
      if (st.phase === 2) {
        // P0 holds left h (24.5) facing right, P1 jumps Q (26.5) -> takes pie hit if needed -> crosses - (29.5) -> holds right h (32.5)
        if (p1.x >= 32.2 && p1.onGround) st.phase = 3;
        const in0 = Math.abs(p0.x - 24.5) > 0.14 ? moveTo(p0, 24.5) : { right: p0.face < 0, left: false, jump: false };
        const pie = game.traps.find((t) => t.kind === 'pieCannon');
        const jumpPie = pie && pie.state === 'flying' && pie.x - p1.x < 1.8 && pie.x > p1.x;
        const in1 = p1.x < 26.8
          ? { right: true, left: false, jump: p1.x >= 24.8 && p1.x <= 26.5 }
          : moveTo(p1, 32.5, { jumpIf: !!jumpPie });
        return [in0, in1];
      }
      // Phase 3: P1 holds right h (32.5) facing LEFT while P0 jumps Q (26.5) and crosses - (29.5), then both go to D
      if (!p0.atDoor && p0.x < 30.2) {
        const in1 = Math.abs(p1.x - 32.5) > 0.14 ? moveTo(p1, 32.5) : { left: p1.face > 0, right: false, jump: false };
        const ghost = game.traps.find((t) => t.kind === 'booGhost');
        const jumpQ = ghost && Math.abs(ghost.x - p0.x) < 1.3 && p0.x < ghost.x;
        return [moveTo(p0, doorX, { jumpIf: !!jumpQ }), in1];
      }
      return [moveTo(p0, doorX), moveTo(p1, doorX)];
    });
    expect(g.finished).toBe(true);
    expect(g.deaths).toBe(0);
    expect(g.keysLeft).toBe(0);
  });
});
