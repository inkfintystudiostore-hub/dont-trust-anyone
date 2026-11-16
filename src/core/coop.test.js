import { describe, it, expect } from 'vitest';
import { parseLevel } from './level.js';
import { createGame, step, exportCoopSnapshot, applyCoopSnapshot } from './game.js';

const NONE = { left: false, right: false, down: false, jump: false };
const RIGHT = { left: false, right: true, down: false, jump: false };
const JUMP_R = { left: false, right: true, down: false, jump: true };
const DT = 1 / 60;

const lvl = (opts) => parseLevel({ name: 'CoopTest', ...opts });

function runCoop(g, in0, in1, frames) {
  const events = [];
  for (let i = 0; i < frames; i++) events.push(...step(g, [in0, in1], DT));
  return events;
}

describe('2-player co-op rules', () => {
  it('spawns two players (Momo & Mimi) and mirrors shared traps when P2 touches them', () => {
    const level = lvl({
      rows: [
        '..........',
        'P........D',
        '###FF#####',
        '###..#####',
      ],
    });
    const g = createGame([level], 0, { coop: true });
    expect(g.players).toHaveLength(2);
    expect(g.players[0].x).toBe(g.level.start.x);
    expect(g.players[1].x).toBe(g.level.start.x);

    // Only P2 walks onto fallingFloor F; P1 stands still at spawn
    runCoop(g, NONE, RIGHT, 40);
    expect(g.traps[0].state).not.toBe('idle');
    expect(g.players[0].x).toBeCloseTo(g.level.start.x, 3);
    expect(g.players[1].x).toBeGreaterThan(g.level.start.x + 1);
  });

  it('requires BOTH players to reach the door — P1 alone waits and cannot finish level', () => {
    const levels = [
      lvl({ rows: ['......', 'P....D', '######'] }),
      lvl({ rows: ['......', 'P....D', '######'] }),
    ];
    const g = createGame(levels, 0, { coop: true });

    // P1 runs all the way to D; P2 stays at P
    const ev1 = runCoop(g, RIGHT, NONE, 60);
    expect(g.players[0].atDoor).toBe(true);
    expect(g.players[1].atDoor).toBe(false);
    expect(g.levelIndex).toBe(0);
    expect(g.finished).toBe(false);
    expect(ev1.some((e) => e.type === 'doorWait' && e.playerIndex === 0)).toBe(true);

    // Now P2 runs to D -> both clear the level together
    const ev2 = runCoop(g, NONE, RIGHT, 60);
    expect(ev2.some((e) => e.type === 'win')).toBe(true);
    expect(g.levelIndex).toBe(1);
    expect(g.players[0].atDoor).toBe(false);
    expect(g.players[1].atDoor).toBe(false);
  });

  it('restarts level for BOTH players if either dies — even while partner waits at door', () => {
    const level = lvl({
      rows: [
        '.............',
        'P....^.....D.',
        '############.',
      ],
    });
    const g = createGame([level], 0, { coop: true });

    // P1 jumps safely over spike ^ at x=5 and waits at door D (x=11.5)
    runCoop(g, RIGHT, NONE, 18);
    step(g, [JUMP_R, NONE], DT);
    runCoop(g, RIGHT, NONE, 100);
    expect(g.players[0].atDoor).toBe(true);
    expect(g.dead).toBe(false);

    // P2 walks blindly into spike ^ -> BOTH must restart
    const ev = runCoop(g, NONE, RIGHT, 55);
    const death = ev.find((e) => e.type === 'death');
    expect(death).toBeTruthy();
    expect(death.victim).toBe(1);
    expect(g.dead).toBe(true);
    expect(g.deaths).toBe(1);

    // Wait out DEATH_PAUSE -> respawn resets BOTH players back to start
    const evRespawn = runCoop(g, NONE, NONE, 45);
    expect(evRespawn.some((e) => e.type === 'respawn')).toBe(true);
    expect(g.dead).toBe(false);
    expect(g.players[0].atDoor).toBe(false);
    expect(g.players[1].atDoor).toBe(false);
    expect(g.players[0].x).toBeCloseTo(g.level.start.x, 2);
    expect(g.players[1].x).toBeCloseTo(g.level.start.x, 2);
  });

  it('does not lock atDoor on a runningDoor before its stops are exhausted', () => {
    const level = lvl({
      rows: [
        '..............',
        '.T...P...D....',
        '##############',
      ],
      traps: [{ at: 'D', runTo: 'T', radius: 2.0 }],
    });
    const g = createGame([level], 0, { coop: true });
    runCoop(g, RIGHT, NONE, 30);
    expect(g.door.ran).toBe(true);
    expect(g.players[0].atDoor).toBe(false);
  });

  it('exports and applies compact co-op snapshots accurately on guest client', () => {
    const levels = [
      lvl({ rows: ['..........', 'P...L....D', '##########'] }),
      lvl({ rows: ['..........', 'P........D', '##########'] }),
    ];
    const host = createGame(levels, 0, { coop: true });
    const guest = createGame(levels, 0, { coop: true });

    runCoop(host, RIGHT, JUMP_R, 25);
    const snap = exportCoopSnapshot(host);
    applyCoopSnapshot(guest, snap);

    expect(guest.players[0].x).toBeCloseTo(host.players[0].x, 4);
    expect(guest.players[1].x).toBeCloseTo(host.players[1].x, 4);
    expect(guest.traps[0].state).toBe(host.traps[0].state);
    expect(guest.time).toBeCloseTo(host.time, 4);
  });
});
