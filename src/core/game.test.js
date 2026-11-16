import { describe, it, expect } from 'vitest';
import { parseLevel } from './level.js';
import { createGame, loadLevel, restartAttempt, step } from './game.js';
import { PHYS } from './physics.js';

const NONE = { left: false, right: false, jump: false };
const LEFT = { left: true, right: false, jump: false };
const RIGHT = { left: false, right: true, jump: false };
const DT = 1 / 60;

// run n frames with a fixed input, collecting events
function run(g, input, frames) {
  const events = [];
  for (let i = 0; i < frames; i++) events.push(...step(g, input, DT));
  return events;
}

const lvl = (rows, traps = []) => parseLevel({ name: 't', rows, traps });

describe('physics', () => {
  it('falls and lands on solid ground', () => {
    const g = createGame([lvl(['P....', '.....', '#####'])]);
    run(g, NONE, 90);
    expect(g.player.onGround).toBe(true);
    expect(g.player.y).toBeCloseTo(1, 2); // ground top is y=1 (row 0 from bottom)
  });

  it('cannot walk through a wall', () => {
    const g = createGame([lvl(['P.#..', '..#..', '#####'])]);
    run(g, RIGHT, 120);
    expect(g.player.x + PHYS.halfW).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('jumps about 2.5 tiles high', () => {
    const g = createGame([lvl(['.....', '.....', '.....', '.....', 'P....', '#####'])]);
    run(g, NONE, 30);
    const y0 = g.player.y;
    let top = y0;
    step(g, { ...NONE, jump: true }, DT);
    for (let i = 0; i < 60; i++) { step(g, NONE, DT); top = Math.max(top, g.player.y); }
    expect(top - y0).toBeGreaterThan(2.2);
    expect(top - y0).toBeLessThan(3.2);
  });

  it('allows a jump shortly after walking off a ledge (coyote time)', () => {
    const g = createGame([lvl(['.....', '.....', 'P....', '#....'])]);
    run(g, NONE, 30);
    // walk off the edge, then press jump within the coyote window
    let frames = 0;
    while (g.player.onGround && frames++ < 120) step(g, RIGHT, DT);
    step(g, { ...RIGHT, jump: true }, DT);
    expect(g.player.vy).toBeGreaterThan(0);
  });
});

describe('deaths and win', () => {
  it('dies by falling into a pit, then respawns at start with +1 death', () => {
    const g = createGame([lvl(['P....', '.....', '#....'])]);
    const ev = run(g, RIGHT, 200);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'pit')).toBe(true);
    expect(g.deaths).toBeGreaterThanOrEqual(1);
  });

  it('dies on spikes', () => {
    const g = createGame([lvl(['P.^..', '#####'])]);
    const ev = run(g, RIGHT, 120);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
  });

  it('wins when touching the door and moves to the next level', () => {
    const g = createGame([lvl(['P.D', '###']), lvl(['P..', '###'])]);
    const ev = run(g, RIGHT, 120);
    expect(ev.some((e) => e.type === 'win')).toBe(true);
    expect(g.levelIndex).toBe(1);
  });
});

describe('traps', () => {
  it('falling floor drops shortly after being stood on', () => {
    const g = createGame([lvl(['.P...', '.F...', '.....', '.....'])]);
    const ev = run(g, NONE, 120);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'fallingFloor')).toBe(true);
    expect(ev.some((e) => e.type === 'death')).toBe(true);
  });

  it('ghost floor looks solid but is not', () => {
    const g = createGame([lvl(['P....', 'G....', '.....', '.....'])]);
    const ev = run(g, NONE, 120);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'pit')).toBe(true);
  });

  it('invisible block is solid and reveals itself when hit', () => {
    const g = createGame([lvl(['.....', '..I..', '.....', '.P...', '#####'])]);
    run(g, NONE, 20);
    g.player.x = 2.5;
    step(g, { ...NONE, jump: true }, DT);
    const ev = run(g, NONE, 60);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'invisibleBlock')).toBe(true);
    const block = g.traps.find((t) => t.kind === 'invisibleBlock');
    expect(block.revealed).toBe(true);
    expect(g.player.y).toBeLessThan(3); // bonked, never got above the block
  });

  it('hidden spikes pop up after a delay when the player comes near', () => {
    const g = createGame([lvl(['P....S....', '##########'], [{ at: 'S', delay: 0.3, radius: 3 }])]);
    const spikes = g.traps.find((t) => t.kind === 'hiddenSpikes');
    expect(spikes.active).toBe(false);
    const ev = run(g, RIGHT, 200);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'hiddenSpikes')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
  });

  it('running door jumps to its target when approached', () => {
    const g = createGame([lvl(['P...D....T', '##########'], [{ at: 'D', runTo: 'T', radius: 2 }])]);
    const doorX0 = g.door.x;
    const ev = run(g, RIGHT, 40);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'runningDoor')).toBe(true);
    expect(g.door.x).toBeGreaterThan(doorX0 + 4);
  });

  it('traps reset after a death', () => {
    const g = createGame([lvl(['.P...', '.F...', '.....', '.....'])]);
    for (let i = 0; i < 600 && !(g.deaths >= 1 && !g.dead); i++) step(g, NONE, DT);
    const floor = g.traps.find((t) => t.kind === 'fallingFloor');
    expect(g.deaths).toBe(1);
    expect(floor.state === 'idle' || floor.state === 'shaking').toBe(true);
    expect(floor.offsetY).toBe(0);
  });

  it('running door hops through multiple stops in order and resets on death', () => {
    const g = createGame([
      lvl(['P..D....1...^.2...', '##################'], [{ at: 'D', runTo: ['1', '2'], radius: 2 }]),
    ]);
    run(g, RIGHT, 40);
    expect(g.door.x).toBeCloseTo(8.5, 2);
    expect(g.door.ran).toBe(false);
    run(g, RIGHT, 50);
    expect(g.door.x).toBeCloseTo(14.5, 2);
    expect(g.door.ran).toBe(true);
    for (let i = 0; i < 120 && !(g.deaths >= 1 && !g.dead); i++) step(g, RIGHT, DT);
    expect(g.deaths).toBe(1);
    expect(g.door.x).toBeCloseTo(3.5, 2);
    expect(g.door.ran).toBe(false);
  });

  it('ceiling spikes under solid ground kill high-bouncing players while normal jumps stay safe underneath', () => {
    const g = createGame([
      lvl(['#####', '..^..', '.....', '.....', 'P....', '#####']),
    ]);
    run(g, RIGHT, 60);
    expect(g.deaths).toBe(0);
    g.player.x = 2.5;
    g.player.y = 1;
    g.player.vy = PHYS.jump;
    g.player.onGround = false;
    run(g, NONE, 45);
    expect(g.deaths).toBe(0);
    g.player.x = 2.5;
    g.player.y = 1;
    g.player.vy = 20;
    g.player.onGround = false;
    const ev = run(g, NONE, 25);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
  });

  it('banana peel makes the player slide uncontrollably into spikes and resets on respawn', () => {
    const g = createGame([lvl(['P..B...^..', '##########'])]);
    const ev = [];
    for (let i = 0; i < 160 && !(g.deaths >= 1 && !g.dead); i++) ev.push(...step(g, RIGHT, DT));
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'bananaPeel')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
    expect(g.dead).toBe(false);
    expect(g.player.slip).toBe(0);
  });

  it('jumping over a banana peel avoids slipping, and slipping blocks ground jump & stops at walls', () => {
    const gJump = createGame([lvl(['P..B....', '########'])]);
    run(gJump, NONE, 5);
    step(gJump, { ...RIGHT, jump: true }, DT);
    run(gJump, RIGHT, 50);
    expect(gJump.player.slip).toBe(0);

    const g = createGame([lvl(['P.B....#..', '##########'])]);
    run(g, NONE, 5);
    run(g, RIGHT, 25);
    const peel = g.traps.find((t) => t.kind === 'bananaPeel');
    expect(peel.triggered).toBe(true);
    expect(g.player.slip).toBeGreaterThan(0);
    const jumpEv = run(g, { left: true, right: false, jump: true }, 10);
    expect(jumpEv.some((e) => e.type === 'jump')).toBe(false);
    run(g, LEFT, 80);
    expect(g.player.x + PHYS.halfW).toBeLessThanOrEqual(7 + 1e-6);
  });

  it('rubber chicken launches player ~2x normal jump height without double-bouncing mid-air', () => {
    const g = createGame([lvl(['.......', '.......', '.......', '.......', '.......', '.......', 'P.R....', '#######'])]);
    let maxY = 1;
    let trapCount = 0;
    for (let i = 0; i < 90; i++) {
      const ev = step(g, RIGHT, DT);
      for (const e of ev) if (e.type === 'trap' && e.kind === 'rubberChicken') trapCount++;
      maxY = Math.max(maxY, g.player.y);
    }
    expect(trapCount).toBe(1);
    expect(maxY - 1).toBeGreaterThan(4.5);
    expect(maxY - 1).toBeLessThan(6.0);
  });

  it('chomp coin bites and kills the player on touch', () => {
    const g = createGame([lvl(['P..C..', '######'])]);
    const ev = run(g, RIGHT, 60);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'chompCoin')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'chomp')).toBe(true);
  });

  it('fake door triggers fakeWin without winning and collapses nearby falling floor, then resets', () => {
    const g = createGame([
      lvl(['P....X...D', '####FFF###']),
      lvl(['P..D', '####']),
    ]);
    const ev = [];
    for (let i = 0; i < 160 && !(g.deaths >= 1 && !g.dead); i++) ev.push(...step(g, RIGHT, DT));
    expect(ev.some((e) => e.type === 'fakeWin')).toBe(true);
    expect(ev.some((e) => e.type === 'win')).toBe(false);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'pit')).toBe(true);
    expect(g.levelIndex).toBe(0);
    const fake = g.traps.find((t) => t.kind === 'fakeDoor');
    const floors = g.traps.filter((t) => t.kind === 'fallingFloor');
    expect(fake.triggered).toBe(false);
    expect(floors.every((f) => f.state === 'idle')).toBe(true);
  });

  it('resetLevel clears jumped and landed flags and invisibleBlock bonk clears slip', () => {
    const g = createGame([lvl(['.....', '..I..', '.....', 'P.B..', '#####'])]);
    g.player.jumped = true;
    g.player.landed = true;
    loadLevel(g, 0);
    expect(g.player.jumped).toBe(false);
    expect(g.player.landed).toBe(false);

    run(g, RIGHT, 28); // step on peel -> slipping
    expect(g.player.slip).toBeGreaterThan(0);
    g.player.x = 2.5;
    g.player.y = 2.5;
    g.player.vy = 10;
    run(g, NONE, 10);
    expect(g.player.stun).toBeGreaterThan(0);
    expect(g.player.slip).toBe(0);
  });

  it('tracks prevX/prevY for render interpolation and resets them on loadLevel/respawn', () => {
    const g = createGame([lvl(['P..^..', '######'])]);
    step(g, RIGHT, DT);
    expect(g.player.prevX).toBeLessThan(g.player.x);
    loadLevel(g, 0);
    expect(g.player.prevX).toBeCloseTo(g.player.x, 5);
    expect(g.player.prevY).toBeCloseTo(g.player.y, 5);
  });

  it('conveyor pushes standing player horizontally in belt direction', () => {
    const g = createGame([lvl(['P.........', '#>>>>.....'])]);
    run(g, NONE, 10);
    const xBefore = g.player.x;
    run(g, RIGHT, 20);
    const xOnBelt = g.player.x;
    expect(xOnBelt - xBefore).toBeGreaterThan(2.0);
    // standing idle on belt still moves right
    const xIdle0 = g.player.x;
    run(g, NONE, 25);
    expect(g.player.x).toBeGreaterThan(xIdle0 + 0.5);
  });

  it('ceiling crusher slams down to crush player, rests, rises, and resets on death', () => {
    const g = createGame([lvl(['#####', '..M..', '.....', 'P....', '#####'])]);
    const ev = [];
    for (let i = 0; i < 120 && !(g.deaths >= 1 && !g.dead); i++) ev.push(...step(g, RIGHT, DT));
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'crusher')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'crushed')).toBe(true);
    const crusher = g.traps.find((t) => t.kind === 'crusher');
    expect(crusher.state).toBe('idle');
    expect(crusher.offsetY).toBe(0);
  });

  it('boxing glove punches player backward on approach', () => {
    const g = createGame([lvl(['P....V.', '#######'])]);
    const ev = run(g, RIGHT, 48);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'boxingGlove')).toBe(true);
    expect(g.player.stun).toBeGreaterThan(0);
    expect(g.player.vx).toBeLessThan(0);
  });

  it('rolling boulder rolls toward player on trigger, kills on hit, and resets on respawn', () => {
    const g = createGame([lvl(['P.....O..', '#########'])]);
    const ev = [];
    for (let i = 0; i < 160 && !(g.deaths >= 1 && !g.dead); i++) ev.push(...step(g, RIGHT, DT));
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'boulder')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'boulder')).toBe(true);
    const b = g.traps.find((t) => t.kind === 'boulder');
    expect(b.state).toBe('idle');
    expect(b.x).toBeCloseTo(6.5, 2);
  });

  it('controls flip reverses left/right movement temporarily', () => {
    const g = createGame([lvl(['....P.U....', '###########'])]);
    run(g, RIGHT, 25);
    expect(g.player.flipped).toBeGreaterThan(0);
    const x0 = g.player.x;
    run(g, RIGHT, 15);
    expect(g.player.x).toBeLessThan(x0);
  });

  it('gravity flip zone inverts gravity onto ceiling, supports downward jump, and kills if flying out top', () => {
    const g = createGame([lvl(['###########', '...........', '...........', 'P..Y.......', '###########'])]);
    run(g, RIGHT, 60);
    expect(g.player.gravDir).toBe(-1);
    expect(g.player.onGround).toBe(true);
    expect(g.player.y + PHYS.height).toBeCloseTo(4, 2);
    step(g, { ...NONE, jump: true }, DT);
    expect(g.player.vy).toBeLessThan(0);

    const gPit = createGame([lvl(['...........', '...........', 'P..Y.......', '###########'])]);
    const ev = run(gPit, RIGHT, 120);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'pit')).toBe(true);
  });

  it('slow caramel floor halves speed and lowers jump height', () => {
    const g = createGame([lvl(['..........', 'P.........', '#ZZZZZZZZ#'])]);
    run(g, RIGHT, 40);
    expect(g.player.x).toBeLessThan(3.0); // normally ~4.8 without slow
    const y0 = g.player.y;
    let maxY = y0;
    step(g, { ...NONE, jump: true }, DT);
    for (let i = 0; i < 40; i++) { step(g, NONE, DT); maxY = Math.max(maxY, g.player.y); }
    expect(maxY - y0).toBeLessThan(1.9);
  });

  it('sneeze cloud charges and blows player sideways when passing underneath', () => {
    const g = createGame([lvl(['...W......', '..........', 'P.........', '##########'], [{ at: 'W', dir: 1, delay: 0.2 }])]);
    let maxVx = 0;
    const ev = [];
    for (let i = 0; i < 60; i++) {
      ev.push(...step(g, RIGHT, DT));
      maxVx = Math.max(maxVx, g.player.vx);
    }
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'sneezeCloud')).toBe(true);
    expect(maxVx).toBeGreaterThan(PHYS.move);
  });

  it('fake checkpoint emits fakeSave and triggers flyaway without saving', () => {
    const g = createGame([lvl(['P..K..', '######'])]);
    const ev = run(g, RIGHT, 50);
    expect(ev.some((e) => e.type === 'fakeSave')).toBe(true);
    expect(g.traps.find((t) => t.kind === 'fakeCheckpoint').triggered).toBe(true);
  });

  it('dark candle activates darkTimer and clears it on respawn', () => {
    const g = createGame([lvl(['P..N..^..', '#########'])]);
    const ev = [];
    let sawDark = false;
    for (let i = 0; i < 160 && !(g.deaths >= 1 && !g.dead); i++) {
      const fEv = step(g, RIGHT, DT);
      ev.push(...fEv);
      if (fEv.some((e) => e.type === 'trap' && e.kind === 'darkCandle')) sawDark = g.darkTimer > 0;
    }
    expect(sawDark).toBe(true);
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'darkCandle')).toBe(true);
    expect(g.darkTimer).toBe(0);
  });

  it('loadLevel resets finished flag and restartAttempt preserves levelDeaths', () => {
    const g = createGame([lvl(['P.D', '###'])]);
    run(g, RIGHT, 40);
    expect(g.finished).toBe(true);
    loadLevel(g, 0);
    expect(g.finished).toBe(false);

    const g2 = createGame([lvl(['P.^.D', '#####'])]);
    for (let i = 0; i < 120 && !(g2.deaths >= 1 && !g2.dead); i++) step(g2, RIGHT, DT);
    expect(g2.levelDeaths).toBe(1);
    restartAttempt(g2);
    expect(g2.levelDeaths).toBe(1);
    expect(g2.player.x).toBeCloseTo(0.5, 3);
  });

  it('boxing glove and rubber chicken push away from ceiling when gravDir is -1', () => {
    const g = createGame([lvl(['##########', '.......V..', '..........', 'P.Y.......', '##########'])]);
    run(g, RIGHT, 40);
    expect(g.player.gravDir).toBe(-1);
    expect(g.player.onGround).toBe(true);
    let minVy = 0;
    const ev = [];
    for (let i = 0; i < 35; i++) {
      ev.push(...step(g, RIGHT, DT));
      minVy = Math.min(minVy, g.player.vy);
    }
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'boxingGlove')).toBe(true);
    expect(minVy).toBeLessThan(-3);

    const g2 = createGame([lvl(['##########', '.......R..', '..........', 'P.Y.......', '##########'])]);
    run(g2, RIGHT, 40);
    expect(g2.player.gravDir).toBe(-1);
    let minVy2 = 0;
    const rEv = [];
    for (let i = 0; i < 35; i++) {
      rEv.push(...step(g2, RIGHT, DT));
      minVy2 = Math.min(minVy2, g2.player.vy);
    }
    expect(rEv.some((e) => e.type === 'trap' && e.kind === 'rubberChicken')).toBe(true);
    expect(minVy2).toBeLessThan(-10);
  });

  it('launch floor rockets upward and flings the player up after brief shake', () => {
    const g = createGame([lvl(['#####', '..^..', '.....', '.P...', '.LLL.', '.....'])]);
    const ev = [];
    for (let i = 0; i < 90 && g.deaths === 0; i++) ev.push(...step(g, RIGHT, DT));
    expect(ev.some((e) => e.type === 'trap' && e.kind === 'launchFloor')).toBe(true);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
  });

  it('anti-jump trap is safe when walking across, but pops lethal spikes if player jumps', () => {
    const gWalk = createGame([lvl(['..........', 'P........D', '###AAAA###'])]);
    const evWalk = run(gWalk, RIGHT, 120);
    expect(gWalk.finished).toBe(true);
    expect(evWalk.some((e) => e.type === 'trap' && e.kind === 'antiJump')).toBe(false);

    const gJump = createGame([lvl(['..........', 'P........D', '###AAAA###'])]);
    run(gJump, RIGHT, 18);
    const evJump = [
      ...step(gJump, { ...RIGHT, jump: true }, DT),
      ...run(gJump, RIGHT, 90),
    ];
    expect(evJump.some((e) => e.type === 'trap' && e.kind === 'antiJump')).toBe(true);
    expect(evJump.some((e) => e.type === 'death' && e.cause === 'spikes')).toBe(true);
  });

  it('gift mimic flips controls and knocks player backward when touched', () => {
    const g = createGame([lvl(['P.......J........', '#################'])]);
    const ev = run(g, RIGHT, 85);
    expect(ev.some((e) => e.type === 'giftTrap')).toBe(true);
    expect(g.player.flipped).toBeGreaterThan(0);
    expect(g.player.vx).toBeLessThan(0);
  });

  it('mirror toy robot copies player inputs in reverse and kills on touch', () => {
    const g = createGame([lvl(['..........', 'P.......E.', '##########'])]);
    const xRobot0 = g.traps.find((t) => t.kind === 'mimicRobot').x;
    const ev = [];
    for (let i = 0; i < 90 && g.deaths === 0; i++) ev.push(...step(g, RIGHT, DT));
    const robot = g.traps.find((t) => t.kind === 'mimicRobot');
    expect(robot.x).toBeLessThan(xRobot0);
    expect(ev.some((e) => e.type === 'death' && e.cause === 'robot')).toBe(true);
  });

  it('peek-a-boo ghost creeps when player looks away and freezes when looked at', () => {
    const g = createGame([lvl(['...........', '.Q..P......', '###########'])]);
    const q = g.traps.find((t) => t.kind === 'booGhost');
    const qx0 = q.x;
    run(g, RIGHT, 20); // facing right (away from Q)
    expect(q.x).toBeGreaterThan(qx0);
    expect(q.shy).toBe(false);

    const qxLook = q.x;
    run(g, LEFT, 10); // turn to look at Q
    expect(q.shy).toBe(true);
    expect(q.x).toBeCloseTo(qxLook, 2);
  });

  it('down input accelerates falling for crisp aerial control and resetLevel restores new traps', () => {
    const level = lvl([
      '...........',
      'P..........',
      '...........',
      '...........',
      '###########',
    ]);
    const gNorm = createGame([level]);
    const gFast = createGame([level]);
    for (let i = 0; i < 10; i++) {
      step(gNorm, RIGHT, DT);
      step(gFast, { ...RIGHT, down: true }, DT);
    }
    expect(gFast.player.y).toBeLessThan(gNorm.player.y);

    const gReset = createGame([lvl(['.......', 'P.J.E.Q', '#LAA###'])]);
    const r0 = gReset.traps.find((t) => t.kind === 'mimicRobot').x;
    run(gReset, RIGHT, 90);
    restartAttempt(gReset);
    const l = gReset.traps.find((t) => t.kind === 'launchFloor');
    const a = gReset.traps.find((t) => t.kind === 'antiJump');
    const j = gReset.traps.find((t) => t.kind === 'giftTrap');
    const e = gReset.traps.find((t) => t.kind === 'mimicRobot');
    const q = gReset.traps.find((t) => t.kind === 'booGhost');
    expect(l.state).toBe('idle');
    expect(l.offsetY).toBe(0);
    expect(gReset.solid[l.cell]).toBe(1);
    expect(a.active).toBe(false);
    expect(j.triggered).toBe(false);
    expect(e.x).toBeCloseTo(r0, 4);
    expect(q.shy).toBe(false);
  });
});
