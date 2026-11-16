import { describe, it, expect } from 'vitest';
import { parseLevel } from './level.js';
import { createGame, step, exportCoopSnapshot, applyCoopSnapshot } from './game.js';

const NONE = { left: false, right: false, down: false, jump: false };
const RIGHT = { left: false, right: true, down: false, jump: false };
const LEFT = { left: true, right: false, down: false, jump: false };
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

    const ev1 = runCoop(g, RIGHT, NONE, 60);
    expect(g.players[0].atDoor).toBe(true);
    expect(g.players[1].atDoor).toBe(false);
    expect(g.levelIndex).toBe(0);
    expect(g.finished).toBe(false);
    expect(ev1.some((e) => e.type === 'doorWait' && e.playerIndex === 0)).toBe(true);

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

    runCoop(g, RIGHT, NONE, 18);
    step(g, [JUMP_R, NONE], DT);
    runCoop(g, RIGHT, NONE, 100);
    expect(g.players[0].atDoor).toBe(true);
    expect(g.dead).toBe(false);

    const ev = runCoop(g, NONE, RIGHT, 55);
    const death = ev.find((e) => e.type === 'death');
    expect(death).toBeTruthy();
    expect(death.victim).toBe(1);
    expect(g.dead).toBe(true);
    expect(g.deaths).toBe(1);

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

describe('analog moveX + co-op coordination traps', () => {
  it('supports proportional analog moveX steering from virtual joystick without breaking binary inputs', () => {
    const level = lvl({ rows: ['..............', 'P............D', '##############'] });
    const gFull = createGame([level], 0, { coop: false });
    const gHalf = createGame([level], 0, { coop: false });

    for (let i = 0; i < 30; i++) {
      step(gFull, { moveX: 1, down: false, jump: false }, DT);
      step(gHalf, { moveX: 0.45, down: false, jump: false }, DT);
    }
    expect(gFull.player.x).toBeGreaterThan(gHalf.player.x);
    expect(gHalf.player.x).toBeGreaterThan(level.start.x + 0.5);
  });

  it('locks exit door until every golden key (*) in the level is collected', () => {
    const level = lvl({
      rows: [
        '..............',
        '.*..P.......D.',
        '##############',
      ],
    });
    const g = createGame([level], 0, { coop: true });
    expect(g.keysLeft).toBe(1);

    // P1 runs straight to Door D without grabbing key * -> stays locked
    const evLocked = runCoop(g, RIGHT, NONE, 80);
    expect(g.players[0].atDoor).toBe(false);
    expect(g.finished).toBe(false);
    expect(evLocked.some((e) => e.type === 'doorLocked')).toBe(true);

    // P2 walks left to grab * -> key collected -> now BOTH can clear D
    const evKey = runCoop(g, NONE, LEFT, 45);
    expect(evKey.some((e) => e.type === 'key')).toBe(true);
    expect(g.keysLeft).toBe(0);

    runCoop(g, RIGHT, RIGHT, 120);
    expect(g.finished).toBe(true);
  });

  it('opens hazard gate (= / -) only while linked pressure plate (H / h) is held by a player', () => {
    const level = lvl({
      rows: [
        '................',
        'P..H....=.....D.',
        '################',
      ],
    });
    const gDie = createGame([level], 0, { coop: true });
    // P1 crosses = while nobody holds H -> dies!
    const evDie = runCoop(gDie, RIGHT, NONE, 80);
    expect(evDie.some((e) => e.type === 'death' && e.cause === 'gate')).toBe(true);

    const gSafe = createGame([level], 0, { coop: true });
    // P2 walks onto H (x=3.5) and waits there -> gate = opens!
    const evHold = runCoop(gSafe, NONE, RIGHT, 28);
    expect(gSafe.traps.find((t) => t.kind === 'plateA').pressed).toBe(true);
    expect(evHold.some((e) => e.type === 'gateOpen')).toBe(true);
    // P1 walks safely past = while P2 stands on H all the way to D
    runCoop(gSafe, RIGHT, NONE, 145);
    expect(gSafe.dead).toBe(false);
    expect(gSafe.players[0].atDoor).toBe(true);
  });

  it('requires partner support on H while teammate defuses bomb (@), or fuse explodes for both', () => {
    const level = lvl({
      rows: [
        '................',
        'P..H.....@....D.',
        '################',
      ],
      traps: [{ at: '@', fuse: 2.5 }],
    });

    // Solo/unheld attempt next to bomb without anyone holding H -> bomb explodes!
    const gBoom = createGame([level], 0, { coop: true });
    const evBoom = [
      ...runCoop(gBoom, RIGHT, NONE, 80),
      ...runCoop(gBoom, NONE, NONE, 120),
    ];
    expect(evBoom.some((e) => e.type === 'death' && e.cause === 'bomb')).toBe(true);

    // P2 stands on H while P1 stands beside @ to defuse it cleanly!
    const gDefuse = createGame([level], 0, { coop: true });
    runCoop(gDefuse, NONE, RIGHT, 28); // P2 on H (x~3.5)
    runCoop(gDefuse, RIGHT, NONE, 75); // P1 reaches @ (x~9.5)
    const evDefuse = runCoop(gDefuse, NONE, NONE, 100);
    const bomb = gDefuse.traps.find((t) => t.kind === 'bomb');
    expect(bomb.defused).toBe(true);
    expect(evDefuse.some((e) => e.type === 'defused')).toBe(true);
    expect(gDefuse.dead).toBe(false);
  });

  it('applyCoopSnapshot snaps prevX/prevY on respawn so Guest does not streak across the map', () => {
    const level = lvl({
      rows: [
        '................',
        'P....^........D.',
        '################',
      ],
    });
    const host = createGame([level], 0, { coop: true });
    const guest = createGame([level], 0, { coop: true });

    // Advance P0 onto spike at x=5.5 (dies at ~4.8, then guest sees dead=true far from spawn)
    runCoop(host, RIGHT, NONE, 55);
    expect(host.dead).toBe(true);
    applyCoopSnapshot(guest, exportCoopSnapshot(host));
    expect(guest.dead).toBe(true);
    expect(guest.players[0].x).toBeGreaterThan(3);

    // Respawn on Host (x resets to 0.5) -> apply onto Guest -> prevX must snap to 0.5, NOT old x > 3
    runCoop(host, NONE, NONE, 45);
    expect(host.dead).toBe(false);
    const { respawned } = applyCoopSnapshot(guest, exportCoopSnapshot(host));
    expect(respawned).toBe(true);
    expect(guest.players[0].x).toBeCloseTo(host.players[0].x, 4);
    expect(guest.players[0].prevX).toBeCloseTo(host.players[0].x, 4);
  });
});
