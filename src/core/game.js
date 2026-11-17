/**
 * Game rules: level state, traps, deaths, win (Solo & 2-Player Co-op). Pure logic, no rendering. Single-thread only.
 * In 2-player co-op: traps affect both players, if EITHER dies both restart together, and BOTH must reach the door to win.
 *
 * @example
 * const g = createGame([parseLevel(json)], 0, { coop: true });
 * for (const e of step(g, [in1, in2], 1 / 60)) if (e.type === 'death') sfx.death();
 */
import { TILE } from './level.js';
import { PHYS, movePlayer, overlaps } from './physics.js';

export const DEATH_PAUSE = 0.6; // seconds the splat shows before respawn
export const STUN = 0.35; // seconds of no control after bonking an invisible block
const PIT_Y = -2;
const hw = (p) => p.halfW ?? PHYS.halfW;
const ht = (p) => p.height ?? PHYS.height;
const IDLE_IN = { left: false, right: false, down: false, jump: false };

function createPlayerState() {
  return {
    x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, onGround: false, coyote: 0, jumpBuf: 0,
    jumped: false, landed: false, face: 1, stun: 0, slip: 0, slipDir: 1, slipSpeed: 8.5,
    flipped: 0, beltVx: 0, speedMul: 1, jumpMul: 1, gravDir: 1, atDoor: false, prevJump: false,
    pieTimer: 0, danceTimer: 0, magnetPull: 0, trapAnim: null, trapAnimTimer: 0,
    portalCd: 0, _lockedNotified: false, _shrunkNotified: false,
    size: 1, sizeTimer: 0, halfW: PHYS.halfW, height: PHYS.height,
    hit: { bonkCx: -1, bonkCy: -1, wallCx: -1, wallCy: -1 },
  };
}

export function createGame(levels, levelIndex = 0, opts = {}) {
  const coop = !!opts.coop;
  const players = coop ? [createPlayerState(), createPlayerState()] : [createPlayerState()];
  const g = {
    coop, levels, levelIndex, deaths: 0, levelDeaths: 0, killerTrapIndex: -1, lastTrapIndex: -1, lastTrapTime: -99,
    finished: false, time: 0, darkTimer: 0, keysTotal: 0, keysLeft: 0, channelA: false, channelB: false,
    hasPlateA: false, hasPlateB: false, syncActive: false, syncLatch: 0,
    dead: false, deadTimer: 0, deathCause: null, deathVictim: -1, prevJump: false,
    events: [], hit: players[0].hit,
    players,
    player: players[0],
    _wants: [0, 0],
  };
  g.isSolid = (cx, cy) => isSolid(g, cx, cy);
  loadLevel(g, levelIndex);
  return g;
}

/**
 * Deep copy of a running game for search tools (solver). Levels are shared read-only.
 * @example const c = cloneGame(g); step(c, { right: true }, 1 / 60); // g unchanged
 */
export function cloneGame(g) {
  // Shallow per-object copies: trap/player fields are flat; nested trap data (stops, to) is read-only.
  const c = { ...g, events: [], _wants: [...g._wants], solid: g.solid.slice() };
  c.players = g.players.map((p) => ({ ...p, hit: { ...p.hit } }));
  c.player = c.players[0];
  c.hit = c.player.hit;
  c.traps = g.traps.map((t) => ({ ...t }));
  c.bluffDoor = g.bluffDoor ? c.traps[g.traps.indexOf(g.bluffDoor)] : null;
  c.door = g.door ? { ...g.door } : null;
  c.isSolid = (cx, cy) => isSolid(c, cx, cy);
  return c;
}

export function loadLevel(g, index) {
  g.levelIndex = index;
  g.level = g.levels[index];
  g.levelDeaths = 0;
  g.killerTrapIndex = -1;
  g.finished = false;
  g.solid = new Uint8Array(g.level.tiles.length);
  resetLevel(g);
}

/** Resets current level attempt without wiping levelDeaths. */
export function restartAttempt(g) {
  g.finished = false;
  resetLevel(g);
}

function resetLevel(g) {
  const L = g.level;
  for (let i = 0; i < L.tiles.length; i++) g.solid[i] = L.tiles[i] === TILE.SOLID ? 1 : 0;
  g.door = L.door ? {
    x: L.door.x, y: L.door.y, ran: false, stopIndex: 0,
    shrink: !!L.door.shrink, shrunk: false, unshrunkTimer: 0,
    shrinkRadius: L.door.shrinkRadius ?? 3.0, shrinkDuration: L.door.shrinkDuration ?? 5.0,
  } : null;
  g.traps = L.trapDefs.map((d) => ({
    ...d, state: 'idle', timer: 0, offsetY: 0, vx: 0, vy: 0, x: d.cx + 0.5, y: d.cy, prevX: d.cx + 0.5, prevY: d.cy,
    ext: 0, hit: false, hitMask: 0, insideMask: 0, shy: false, onGround: false, face: -1,
    homeCx: d.cx, curCx: d.cx, step: 0, swapped: d.kind === 'bluffDoor' && d.swapOnDeath && (g.levelDeaths % 2 === 1),
    revealed: false, active: false, armed: false, triggered: false, collected: false, pressed: false, open: false,
    defuse: 0, defused: false, defusing: false, cooldown: 0, stopIndex: 0, syncTimer: 0,
  }));
  g.keysTotal = 0;
  g.hasPlateA = false;
  g.hasPlateB = false;
  g.hasWeightBridge = false;
  g.bluffDoor = null;
  g.syncActive = false;
  g.syncLatch = 0;
  for (const t of g.traps) {
    if (t.kind === 'fallingFloor' || t.kind === 'launchFloor' || t.kind === 'antiJump' ||
        t.kind === 'invisibleBlock' || t.kind === 'conveyor' || t.kind === 'slowFloor' ||
        t.kind === 'springTrap' || t.kind === 'discoFloor' || t.kind === 'weightBridge' ||
        t.kind === 'shyPlatform' || t.kind === 'hungryFloor' || t.kind === 'risingFloor') {
      g.solid[t.cell] = 1;
    }
    if (t.kind === 'weightBridge') g.hasWeightBridge = true;
    if (t.kind === 'bluffDoor') g.bluffDoor = t;
    if (t.kind === 'keyItem') g.keysTotal++;
    if (t.kind === 'plateA') g.hasPlateA = true;
    if (t.kind === 'plateB') g.hasPlateB = true;
    if (t.kind === 'gateA' || t.kind === 'gateB') {
      let cy = t.cy + 1;
      while (cy < L.H && L.tiles[cy * L.W + t.cx] !== TILE.SOLID) cy++;
      t.topY = cy < L.H ? cy : L.H + 3;
    }
  }
  g.keysLeft = g.keysTotal;
  g.channelA = false;
  g.channelB = false;
  for (const p of g.players) {
    Object.assign(p, {
      x: L.start.x, y: L.start.y, prevX: L.start.x, prevY: L.start.y, vx: 0, vy: 0,
      onGround: false, coyote: 0, jumpBuf: 0, jumped: false, landed: false, face: 1,
      stun: 0, slip: 0, slipDir: 1, slipSpeed: 8.5, flipped: 0, beltVx: 0, speedMul: 1, jumpMul: 1,
      gravDir: 1, atDoor: false, prevJump: false, portalCd: 0, _lockedNotified: false, _shrunkNotified: false,
      pieTimer: 0, danceTimer: 0, magnetPull: 0, trapAnim: null, trapAnimTimer: 0,
      size: 1, sizeTimer: 0, halfW: PHYS.halfW, height: PHYS.height,
    });
    p.hit.bonkCx = -1; p.hit.bonkCy = -1; p.hit.wallCx = -1; p.hit.wallCy = -1;
  }
  g.prevJump = false;
  g.lastTrapIndex = -1;
  g.lastTrapTime = -99;
  g.darkTimer = 0;
  g.dead = false;
  g.deadTimer = 0;
  g.deathCause = null;
  g.deathVictim = -1;
}

function isSolid(g, cx, cy) {
  const L = g.level;
  if (cx < 0 || cx >= L.W) return true;
  if (cy < 0 || cy >= L.H) return false;
  return g.solid[cy * L.W + cx] === 1;
}

function emit(g, type, extra) {
  const e = extra ?? {};
  e.type = type;
  g.events.push(e);
}

function die(g, cause, trapIndex = -1, victimIndex = 0) {
  if (g.dead) return;
  const victim = g.players[victimIndex] ?? g.player;
  g.dead = true;
  g.deadTimer = DEATH_PAUSE;
  g.deathCause = cause;
  g.deathVictim = victimIndex;
  if (trapIndex >= 0) g.killerTrapIndex = trapIndex;
  else if (g.lastTrapIndex >= 0 && g.time - g.lastTrapTime <= 2.2) g.killerTrapIndex = g.lastTrapIndex;
  g.deaths++;
  g.levelDeaths++;
  emit(g, 'death', { cause, victim: victimIndex, x: victim.x, y: victim.y });
}

function advancePlayer(g, pi, inp, dt, emitEvents) {
  const p = g.players[pi];
  if (!p) return;
  p.prevX = p.x;
  p.prevY = p.y;
  const jumpPressed = !!inp.jump && !p.prevJump;
  p.prevJump = !!inp.jump;
  if (pi === 0) g.prevJump = p.prevJump;

  if (p.atDoor) {
    p.vx = 0;
    p.vy = 0;
    p.jumped = false;
    p.landed = false;
    g._wants[pi] = 0;
    return;
  }

  const stunned = p.stun > 0;
  p.stun = Math.max(0, p.stun - dt);
  const slipping = p.slip > 0;
  p.slip = Math.max(0, p.slip - dt);
  p.flipped = Math.max(0, p.flipped - dt);
  p.pieTimer = Math.max(0, p.pieTimer - dt);
  p.danceTimer = Math.max(0, p.danceTimer - dt);
  p.portalCd = Math.max(0, p.portalCd - dt);
  if (p.sizeTimer > 0 && (p.sizeTimer -= dt) <= 0) { p.size = 1; p.halfW = PHYS.halfW; p.height = PHYS.height; }
  p.trapAnimTimer = Math.max(0, p.trapAnimTimer - dt);
  if (p.trapAnimTimer <= 0) p.trapAnim = null;
  if (p.pieTimer > 0) p.speedMul *= 0.65;
  if (p.danceTimer > 0 && p.onGround && !stunned) {
    if (Math.floor(g.time * 8) !== Math.floor((g.time - dt) * 8)) {
      p.vy = 4.6 * p.gravDir;
      p.onGround = false;
    }
  }
  const rawWant = Number.isFinite(inp.moveX)
    ? Math.max(-1, Math.min(1, inp.moveX))
    : ((inp.right ? 1 : 0) - (inp.left ? 1 : 0));
  const want = p.flipped > 0 ? -rawWant : rawWant;
  g._wants[pi] = want;
  if (Math.abs(want) > 0.05 && !stunned && !slipping) p.face = want > 0 ? 1 : -1;
  const dir = stunned ? p.vx / PHYS.move : (slipping ? p.slipDir * (p.slipSpeed / PHYS.move) : want);
  if (stunned) { p.speedMul = 1; p.beltVx = 0; }
  movePlayer(p, dir, jumpPressed && !stunned && !slipping, dt, g.isSolid, p.hit);
  if (inp.down && !p.onGround && !stunned) {
    p.vy = Math.max(-PHYS.maxFall, Math.min(PHYS.maxFall, p.vy - PHYS.gravity * 0.65 * dt * p.gravDir));
  }
  if (emitEvents) {
    if (p.jumped) emit(g, 'jump', { playerIndex: pi });
    if (p.landed) emit(g, 'land', { playerIndex: pi });
  }
}

/** Local-only player movement prediction for co-op Guest without mutating lethal/win state. */
export function stepPlayerLocal(g, playerIndex, inp, dt, opts = null) {
  if (g.finished || g.dead) return;
  const clampedDt = Math.min(dt, 1 / 30);
  advancePlayer(g, playerIndex, inp ?? IDLE_IN, clampedDt, false);
  if (opts?.predictTraps) {
    predictGuestTrapsLocal(g, playerIndex, clampedDt);
  }
}

/** Predicts Guest-triggered pop-up/floor traps locally so traps appear with 0ms lag. */
function predictGuestTrapsLocal(g, playerIndex, dt) {
  const p = g.players?.[playerIndex];
  if (!p || p.atDoor) return;
  for (let i = 0; i < g.traps.length; i++) {
    const t = g.traps[i];
    switch (t.kind) {
      case 'fallingFloor':
        if (t.state === 'idle' && (standingOn(p, t.cx, t.cy) || (t.near > 0 && Math.abs(p.x - (t.cx + 0.5)) < t.near && p.y >= t.cy + 0.9 && p.y < t.cy + 4))) {
          t.state = 'shaking';
          t.timer = t.delay;
        } else if (t.state === 'shaking' && (t.timer -= dt) <= 0) {
          t.state = 'falling';
          g.solid[t.cell] = 0;
        } else if (t.state === 'falling') {
          t.vy -= PHYS.gravity * dt;
          t.offsetY += t.vy * dt;
        }
        break;
      case 'launchFloor':
        if (t.state === 'idle' && standingOn(p, t.cx, t.cy)) {
          t.state = 'shaking';
          t.timer = t.delay;
        } else if (t.state === 'shaking' && (t.timer -= dt) <= 0) {
          t.state = 'launching';
          g.solid[t.cell] = 0;
        } else if (t.state === 'launching') {
          t.offsetY += 16 * dt;
        }
        break;
      case 'invisibleBlock':
        if (!t.revealed && ((p.hit.bonkCx === t.cx && p.hit.bonkCy === t.cy) || (p.hit.wallCx === t.cx && p.hit.wallCy === t.cy))) {
          t.revealed = true;
          p.vx = 0;
          p.vy = p.gravDir > 0 ? Math.min(p.vy, -4) : Math.max(p.vy, 4);
          p.stun = STUN;
          p.slip = 0;
          p.trapAnim = 'bonk';
          p.trapAnimTimer = STUN;
        }
        break;
      case 'hiddenSpikes':
        if (!t.armed) {
          if (Math.abs(p.x - (t.cx + 0.5)) < t.radius && Math.abs(p.y - t.cy) < 2) {
            t.armed = true;
            t.timer = t.delay;
          }
        } else if (!t.active && (t.timer -= dt) <= 0) {
          t.active = true;
        }
        break;
      case 'antiJump':
        if (!t.active && p.jumped && Math.abs(p.x - (t.cx + 0.5)) < t.radius && Math.abs(p.y - t.cy) < 3) {
          t.active = true;
        }
        break;
      case 'icicle': case 'closingWall': case 'risingFloor': case 'saw': case 'sizeSwell': case 'spikeSwap':
        t.prevX = t.x; t.prevY = t.y;
        updateDevilTrap(g, t, i, dt, false, playerIndex);
        break;
      case 'plateA':
      case 'plateB':
      case 'syncPlate':
        if (p.onGround && p.x + hw(p) > t.cx + 0.08 && p.x - hw(p) < t.cx + 0.92 && Math.abs(p.y - t.cy) < 0.45) {
          t.pressed = true;
        }
        break;
      default:
        break;
    }
  }
}

export function step(g, inputOrInputs, dt) {
  g.events.length = 0;
  dt = Math.min(dt, 1 / 30);
  g.time += dt;
  g.darkTimer = Math.max(0, g.darkTimer - dt);

  const isArr = Array.isArray(inputOrInputs);
  const in0 = (isArr ? inputOrInputs[0] : inputOrInputs) ?? IDLE_IN;
  const in1 = (isArr ? inputOrInputs[1] : IDLE_IN) ?? IDLE_IN;

  if (g.finished) return g.events;

  if (g.dead) {
    g.deadTimer -= dt;
    if (g.deadTimer <= 0) { resetLevel(g); emit(g, 'respawn'); }
    return g.events;
  }

  for (let pi = 0; pi < g.players.length; pi++) {
    advancePlayer(g, pi, pi === 0 ? in0 : in1, dt, true);
  }

  updateTraps(g, dt);
  checkHazards(g);

  if (!g.dead && g.door && !hasPendingDoorRun(g)) {
    if (g.door.shrink) {
      if (g.channelA) {
        g.door.unshrunkTimer = g.door.shrinkDuration;
        g.door.shrunk = false;
      } else if (g.door.unshrunkTimer > 0) {
        g.door.unshrunkTimer = Math.max(0, g.door.unshrunkTimer - dt);
        g.door.shrunk = false;
      } else {
        const near = g.players.some((p) => !p.atDoor && Math.hypot(p.x - g.door.x, p.y - g.door.y) <= g.door.shrinkRadius);
        g.door.shrunk = near;
      }
    }
    const bluff = g.bluffDoor;
    const swapped = !!(bluff && bluff.swapped);
    const realDoor = swapped ? { x: bluff.cx + 0.5, y: bluff.cy } : g.door;
    const fakeDoorPos = bluff ? (swapped ? g.door : { x: bluff.cx + 0.5, y: bluff.cy }) : null;
    if (fakeDoorPos) {
      for (let pi = 0; pi < g.players.length; pi++) {
        const p = g.players[pi];
        if (!p.atDoor && overlaps(p, fakeDoorPos.x - 0.35, fakeDoorPos.y, fakeDoorPos.x + 0.35, fakeDoorPos.y + 1.2)) {
          p.x = g.level.start.x;
          p.y = g.level.start.y;
          p.vx = 0;
          p.vy = 0;
          p.stun = 0.25;
          emit(g, 'doorBluff', { playerIndex: pi, x: fakeDoorPos.x, y: fakeDoorPos.y });
        }
      }
    }
    const locked = g.keysLeft > 0 || hasUndefusedBomb(g);
    const shrunk = !swapped && !!g.door.shrunk;
    for (let pi = 0; pi < g.players.length; pi++) {
      const p = g.players[pi];
      if (p.atDoor) continue;
      if (overlaps(p, realDoor.x - 0.35, realDoor.y, realDoor.x + 0.35, realDoor.y + 1.2)) {
        if (locked) {
          if (!p._lockedNotified) {
            p._lockedNotified = true;
            emit(g, 'doorLocked', { playerIndex: pi, keysLeft: g.keysLeft });
          }
          continue;
        }
        if (shrunk) {
          if (!p._shrunkNotified) {
            p._shrunkNotified = true;
            emit(g, 'doorShrunk', { playerIndex: pi, x: realDoor.x, y: realDoor.y });
          }
          continue;
        }
        if (!g.coop) {
          win(g);
          break;
        }
        p.atDoor = true;
        p.vx = 0;
        p.vy = 0;
        emit(g, 'doorWait', { playerIndex: pi, x: realDoor.x, y: realDoor.y });
      } else {
        p._lockedNotified = false;
        p._shrunkNotified = false;
      }
    }
    if (!locked && !shrunk && g.coop && g.players.every((p) => p.atDoor)) win(g);
  }
  return g.events;
}

function hasUndefusedBomb(g) {
  for (let i = 0; i < g.traps.length; i++) {
    const t = g.traps[i];
    if (t.kind === 'bomb' && !t.defused) return true;
  }
  return false;
}

function hasPendingDoorRun(g) {
  for (let i = 0; i < g.traps.length; i++) {
    const t = g.traps[i];
    if (t.kind === 'runningDoor' && t.stopIndex < t.stops.length) return true;
  }
  return false;
}

function footCellY(p) {
  return p.gravDir < 0 ? Math.floor(p.y + ht(p) + 0.01) : Math.floor(p.y - 0.01);
}

function standingOn(p, cx, cy) {
  return !p.atDoor && p.onGround && footCellY(p) === cy && p.x + hw(p) > cx && p.x - hw(p) < cx + 1;
}

function updateTraps(g, dt) {
  const players = g.players;
  for (let pi = 0; pi < players.length; pi++) {
    players[pi].beltVx = 0;
    players[pi].speedMul = 1;
    players[pi].jumpMul = 1;
    players[pi].magnetPull = 0;
  }

  const prevA = g.channelA;
  const prevB = g.channelB;
  const prevSync = g.syncActive;
  g.channelA = false;
  g.channelB = false;
  let syncCount = 0;
  let syncReady = 0;
  let weightRiders = 0;
  if (g.hasWeightBridge) {
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (g.traps.some((wt) => wt.kind === 'weightBridge' && wt.state !== 'fallen' && standingOn(p, wt.cx, wt.cy))) {
        weightRiders++;
      }
    }
  }
  for (let i = 0; i < g.traps.length; i++) {
    const t = g.traps[i];
    if (t.kind === 'syncPlate') {
      syncCount++;
      let on = false;
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (!p.atDoor && p.onGround && p.x + hw(p) > t.cx + 0.08 && p.x - hw(p) < t.cx + 0.92 && Math.abs(p.y - t.cy) < 0.45) {
          on = true;
          break;
        }
      }
      t.pressed = on;
      t.syncTimer = on ? 0.9 : Math.max(0, (t.syncTimer ?? 0) - dt);
      if (t.syncTimer > 0) syncReady++;
      continue;
    }
    if (t.kind !== 'plateA' && t.kind !== 'plateB') continue;
    let on = false;
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (!p.atDoor && p.onGround && p.x + hw(p) > t.cx + 0.08 && p.x - hw(p) < t.cx + 0.92 && Math.abs(p.y - t.cy) < 0.45) {
        on = true;
        break;
      }
    }
    t.pressed = on;
    if (on) {
      if (t.kind === 'plateA') g.channelA = true;
      else g.channelB = true;
    }
  }
  g.syncLatch = Math.max(0, (g.syncLatch ?? 0) - dt);
  if (syncCount >= 2 && syncReady === syncCount) {
    g.syncLatch = 2.5;
  }
  g.syncActive = g.syncLatch > 0;
  if (g.syncActive && !prevSync) emit(g, 'gateOpen', { channel: 'SYNC' });
  if (g.channelA && !prevA) emit(g, 'gateOpen', { channel: 'A' });
  if (g.channelB && !prevB) emit(g, 'gateOpen', { channel: 'B' });

  for (let i = 0; i < g.traps.length; i++) {
    const t = g.traps[i];
    t.prevX = t.x;
    t.prevY = t.y;
    switch (t.kind) {
      case 'fallingFloor': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            // near > 0: Level Devil pit, drops as you approach (only from above the floor)
            const close = t.near > 0 && !p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < t.near && p.y >= t.cy + 0.9 && p.y < t.cy + 4;
            if (close || standingOn(p, t.cx, t.cy)) {
              t.state = 'shaking'; t.timer = t.delay;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        } else if (t.state === 'shaking' && (t.timer -= dt) <= 0) {
          t.state = 'falling'; g.solid[t.cell] = 0;
        } else if (t.state === 'falling') {
          t.vy -= PHYS.gravity * dt; t.offsetY += t.vy * dt;
        }
        break;
      }
      case 'ghostFloor':
        for (let pi = 0; pi < players.length; pi++) {
          if (!players[pi].atDoor && overlaps(players[pi], t.cx + 0.1, t.cy, t.cx + 0.9, t.cy + 1)) {
            g.lastTrapIndex = i; g.lastTrapTime = g.time;
          }
        }
        break;
      case 'invisibleBlock':
        if (!t.revealed) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (p.atDoor) continue;
            if ((p.hit.bonkCx === t.cx && p.hit.bonkCy === t.cy) || (p.hit.wallCx === t.cx && p.hit.wallCy === t.cy)) {
              t.revealed = true;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              p.vx = 0;
              p.vy = p.gravDir > 0 ? Math.min(p.vy, -4) : Math.max(p.vy, 4);
              p.stun = STUN;
              p.slip = 0;
              p.trapAnim = 'bonk';
              p.trapAnimTimer = STUN;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'hiddenSpikes':
        if (!t.armed) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < t.radius && Math.abs(p.y - t.cy) < 2) {
              t.armed = true; t.timer = t.delay;
              break;
            }
          }
        } else if (!t.active && (t.timer -= dt) <= 0) {
          t.active = true;
          emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
        }
        break;
      case 'bananaPeel':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && p.onGround && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 0.35)) {
              t.triggered = true;
              p.slip = t.duration;
              p.slipDir = Math.abs(p.vx) > 0.2 ? Math.sign(p.vx) : p.face;
              p.slipSpeed = t.speed;
              p.vx = p.slipDir * t.speed;
              p.trapAnim = 'slip';
              p.trapAnimTimer = t.duration;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.2 });
              break;
            }
          }
        }
        break;
      case 'rubberChicken':
        t.cooldown = Math.max(0, t.cooldown - dt);
        t.timer = Math.max(0, t.timer - dt);
        if (t.cooldown <= 0) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && p.vy * p.gravDir <= 2 && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 0.55)) {
              p.y = p.gravDir > 0 ? Math.max(p.y, t.cy + 0.08) : Math.min(p.y, t.cy + 0.92 - ht(p));
              p.vy = PHYS.jump * t.boost * p.gravDir;
              p.onGround = false;
              p.coyote = 0;
              p.slip = 0;
              p.trapAnim = 'launch';
              p.trapAnimTimer = 0.6;
              t.cooldown = 0.2;
              t.timer = 0.25;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.3 });
            }
          }
        }
        break;
      case 'chompCoin':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.15, t.cy + 0.15, t.cx + 0.85, t.cy + 0.85)) {
              t.triggered = true;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              die(g, 'chomp', i, pi);
              break;
            }
          }
        }
        break;
      case 'fakeDoor':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 1.2)) {
              t.triggered = true;
              emit(g, 'fakeWin', { x: t.cx + 0.5, y: t.cy + 0.5 });
              for (const f of g.traps) {
                if (f.kind === 'fallingFloor' && f.state !== 'falling' && Math.abs(f.cx - t.cx) <= t.radius) {
                  f.state = 'falling';
                  g.solid[f.cell] = 0;
                }
              }
              break;
            }
          }
        }
        break;
      case 'conveyor':
        for (let pi = 0; pi < players.length; pi++) {
          if (standingOn(players[pi], t.cx, t.cy)) players[pi].beltVx = t.dir * t.speed;
        }
        break;
      case 'crusher': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < 1.9 && p.y <= t.cy + 0.2 && p.y > t.cy - 6) {
              t.state = 'warning';
              t.timer = t.delay;
              break;
            }
          }
        } else if (t.state === 'warning') {
          if ((t.timer -= dt) <= 0) {
            t.state = 'slam';
            emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          }
        } else if (t.state === 'slam') {
          t.offsetY -= t.slamSpeed * dt;
          const by = t.cy + t.offsetY;
          const hitFloor = by <= -1 || isSolid(g, t.cx, Math.floor(by));
          if (hitFloor) {
            t.offsetY = by <= -1 ? -t.cy - 1 : Math.floor(by) + 1 - t.cy;
            t.state = 'resting';
            t.timer = t.rest;
          }
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.08, t.cy + t.offsetY, t.cx + 0.92, t.cy + t.offsetY + 0.95)) die(g, 'crushed', i, pi);
          }
        } else if (t.state === 'resting') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.08, t.cy + t.offsetY, t.cx + 0.92, t.cy + t.offsetY + 0.95)) die(g, 'crushed', i, pi);
          }
          if ((t.timer -= dt) <= 0) t.state = 'rising';
        } else if (t.state === 'rising') {
          t.offsetY = Math.min(0, t.offsetY + t.riseSpeed * dt);
          if (t.offsetY === 0) t.state = 'idle';
        }
        break;
      }
      case 'boxingGlove': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (p.atDoor) continue;
            const dx = p.x - (t.cx + 0.5);
            if (Math.abs(p.y - t.cy) < 1.1 && dx * t.dir > 0 && Math.abs(dx) < 2.3) {
              t.state = 'winding';
              t.timer = 0.12;
              t.hit = false;
              break;
            }
          }
        } else if (t.state === 'winding') {
          if ((t.timer -= dt) <= 0) {
            t.state = 'punch';
            t.timer = 0.2;
            t.ext = t.reach;
            emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          }
        } else if (t.state === 'punch') {
          const xA = t.cx + 0.5;
          const xB = xA + t.dir * t.ext;
          if (!t.hit) {
            for (let pi = 0; pi < players.length; pi++) {
              const p = players[pi];
              if (!p.atDoor && overlaps(p, Math.min(xA, xB), t.cy + 0.1, Math.max(xA, xB), t.cy + 0.9)) {
                t.hit = true;
                p.vx = t.dir * 16;
                p.vy = p.gravDir > 0 ? Math.max(p.vy, 5) : Math.min(p.vy, -5);
                p.stun = 0.35;
                p.slip = 0;
                p.trapAnim = 'punch';
                p.trapAnimTimer = 0.45;
              }
            }
          }
          if ((t.timer -= dt) <= 0) { t.state = 'retract'; t.timer = 0.55; }
        } else if (t.state === 'retract') {
          t.timer -= dt;
          t.ext = Math.max(0, t.reach * (t.timer / 0.55));
          if (t.timer <= 0) { t.ext = 0; t.state = 'idle'; }
        }
        break;
      }
      case 'boulder': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - t.x) < t.triggerDist && Math.abs(p.y - t.y) < 4) {
              t.state = 'rolling';
              t.vx = t.dir * t.speed;
              t.vy = 0;
              emit(g, 'trap', { kind: t.kind, x: t.x, y: t.y });
              break;
            }
          }
        } else if (t.state === 'rolling') {
          t.x += t.vx * dt;
          t.vy -= PHYS.gravity * dt;
          t.y += t.vy * dt;
          const bCy = Math.floor(t.y);
          if (isSolid(g, Math.floor(t.x), bCy) && t.vy <= 0) {
            t.y = bCy + 1;
            t.vy = 0;
          }
          if (isSolid(g, Math.floor(t.x + t.dir * 0.45), Math.floor(t.y + 0.4)) || t.y < PIT_Y) {
            t.state = 'done';
          }
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.x - 0.42, t.y + 0.08, t.x + 0.42, t.y + 0.85)) die(g, 'boulder', i, pi);
          }
        }
        break;
      }
      case 'controlsFlip':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.1, t.cy, t.cx + 0.9, t.cy + 1)) {
              t.triggered = true;
              p.flipped = t.duration;
              p.trapAnim = 'flip';
              p.trapAnimTimer = 0.6;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'gravityFlip': {
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          const bit = 1 << pi;
          const hitZone = !p.atDoor && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 1);
          if (hitZone && !(t.insideMask & bit)) {
            p.gravDir *= -1;
            p.trapAnim = 'flip';
            p.trapAnimTimer = 0.6;
            p.onGround = false;
            p.coyote = 0;
            g.lastTrapIndex = i; g.lastTrapTime = g.time;
            emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          }
          if (hitZone) t.insideMask |= bit;
          else t.insideMask &= ~bit;
        }
        break;
      }
      case 'slowFloor':
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (standingOn(p, t.cx, t.cy)) {
            p.speedMul = t.speedMul;
            p.jumpMul = t.jumpMul;
          }
        }
        break;
      case 'sneezeCloud': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < 1.5 && p.y <= t.cy && p.y >= t.cy - 4.5) {
              t.state = 'charging';
              t.timer = t.delay;
              t.hitMask = 0;
              break;
            }
          }
        } else if (t.state === 'charging') {
          if ((t.timer -= dt) <= 0) {
            t.state = 'sneezing';
            t.timer = 0.35;
            emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          }
        } else if (t.state === 'sneezing') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            const bit = 1 << pi;
            if (!p.atDoor && !(t.hitMask & bit) && Math.abs(p.x - (t.cx + 0.5)) < 2.0 && p.y <= t.cy && p.y >= t.cy - 4.5) {
              t.hitMask |= bit;
              p.vx = t.dir * t.power;
              p.stun = 0.25;
              p.slip = 0;
              p.trapAnim = 'sneeze';
              p.trapAnimTimer = 0.45;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
            }
          }
          if ((t.timer -= dt) <= 0) { t.state = 'cooldown'; t.timer = 1.8; }
        } else if (t.state === 'cooldown') {
          if ((t.timer -= dt) <= 0) t.state = 'idle';
        }
        break;
      }
      case 'fakeCheckpoint':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 1.1)) {
              t.triggered = true;
              emit(g, 'fakeSave', { x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'darkCandle':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.15, t.cy, t.cx + 0.85, t.cy + 1)) {
              t.triggered = true;
              g.darkTimer = t.duration;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'launchFloor': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            if (standingOn(players[pi], t.cx, t.cy)) {
              t.state = 'shaking';
              t.timer = t.delay;
              break;
            }
          }
        } else if (t.state === 'shaking' && (t.timer -= dt) <= 0) {
          t.state = 'launching';
          g.solid[t.cell] = 0;
          t.vy = 18;
          emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < 0.85 && p.y >= t.cy && p.y <= t.cy + 1.4) {
              p.vy = Math.max(p.vy, t.boost);
              p.trapAnim = 'launch';
              p.trapAnimTimer = 0.65;
              p.onGround = false;
              p.coyote = 0;
            }
          }
        } else if (t.state === 'launching') {
          t.offsetY += t.vy * dt;
        }
        break;
      }
      case 'antiJump':
        if (!t.active) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && p.jumped && Math.abs(p.x - (t.cx + 0.5)) < t.radius && Math.abs(p.y - t.cy) < 3) {
              t.active = true;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'giftTrap':
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.1, t.cy, t.cx + 0.9, t.cy + 0.95)) {
              t.triggered = true;
              p.flipped = t.duration;
              p.vx = -p.face * 13;
              p.vy = 10 * p.gravDir;
              p.stun = 0.32;
              p.slip = 0;
              p.trapAnim = 'flip';
              p.trapAnimTimer = 0.6;
              emit(g, 'giftTrap', { x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        }
        break;
      case 'mimicRobot': {
        if (t.state === 'done') break;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.atDoor) continue;
          const d = Math.abs(p.x - t.x);
          if (d < bestDist) { bestDist = d; bestIdx = pi; }
        }
        if (t.state === 'idle' && bestDist < 12) t.state = 'active';
        if (t.state === 'active') {
          const targetP = players[bestIdx];
          const rDir = -(g._wants[bestIdx] ?? 0);
          if (rDir !== 0) t.face = rDir;
          t.vx = rDir * t.speed;
          if (!targetP.atDoor && targetP.jumped && t.onGround) { t.vy = 13.0; t.onGround = false; }
          t.vy = Math.max(-PHYS.maxFall, t.vy - PHYS.gravity * dt);
          t.x += t.vx * dt;
          if (t.vx > 0 && isSolid(g, Math.floor(t.x + 0.36), Math.floor(t.y + 0.2))) {
            t.x = Math.floor(t.x + 0.36) - 0.36 - 1e-4;
            t.vx = 0;
          } else if (t.vx < 0 && isSolid(g, Math.floor(t.x - 0.36), Math.floor(t.y + 0.2))) {
            t.x = Math.floor(t.x - 0.36) + 1 + 0.36 + 1e-4;
            t.vx = 0;
          }
          t.y += t.vy * dt;
          t.onGround = false;
          const ry = Math.floor(t.y);
          if (t.vy <= 0 && (isSolid(g, Math.floor(t.x - 0.34), ry) || isSolid(g, Math.floor(t.x + 0.34), ry))) {
            t.y = ry + 1;
            t.vy = 0;
            t.onGround = true;
          }
          if (t.y < PIT_Y) t.state = 'done';
          else {
            for (let pi = 0; pi < players.length; pi++) {
              const p = players[pi];
              if (!p.atDoor && overlaps(p, t.x - 0.34, t.y + 0.05, t.x + 0.34, t.y + 0.85)) die(g, 'robot', i, pi);
            }
          }
        }
        break;
      }
      case 'booGhost': {
        let bestDx = 0;
        let bestDy = 0;
        let bestDist = Infinity;
        let anyLooking = false;
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.atDoor) continue;
          const dx = p.x - t.x;
          const dy = (p.y + 0.1) - t.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 11 && dx * p.face < 0) anyLooking = true;
          if (dist < bestDist) { bestDist = dist; bestDx = dx; bestDy = dy; }
        }
        if (bestDist < 11) {
          t.shy = anyLooking;
          if (!t.shy && bestDist > 0.05) {
            t.x += (bestDx / bestDist) * t.speed * dt;
            t.y += (bestDy / bestDist) * t.speed * 0.65 * dt;
          }
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.x - 0.32, t.y + 0.05, t.x + 0.32, t.y + 0.82)) die(g, 'ghost', i, pi);
          }
        } else {
          t.shy = false;
        }
        break;
      }
      case 'runningDoor':
        t.cooldown = Math.max(0, t.cooldown - dt);
        if (t.stopIndex < t.stops.length && t.cooldown <= 0 && g.door) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - g.door.x) < t.radius && Math.abs(p.y - g.door.y) < 2) {
              const next = t.stops[t.stopIndex++];
              emit(g, 'trap', { kind: t.kind, x: g.door.x, y: g.door.y, toX: next.x, toY: next.y });
              g.door.x = next.x;
              g.door.y = next.y;
              g.door.stopIndex = t.stopIndex;
              g.door.ran = t.stopIndex >= t.stops.length;
              t.cooldown = 0.25;
              break;
            }
          }
        }
        break;
      case 'keyItem':
        if (!t.collected) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.1, t.cy, t.cx + 0.9, t.cy + 0.95)) {
              t.collected = true;
              g.keysLeft = Math.max(0, g.keysLeft - 1);
              emit(g, 'key', { x: t.cx + 0.5, y: t.cy + 0.5, left: g.keysLeft, playerIndex: pi });
              break;
            }
          }
        }
        break;
      case 'gateA':
        t.open = g.channelA || g.syncActive;
        break;
      case 'gateB':
        t.open = g.channelB || g.syncActive;
        break;
      case 'bomb': {
        if (t.defused) { t.state = 'defused'; t.defusing = false; break; }
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < t.triggerDist && Math.abs(p.y - t.cy) < 4) {
              t.state = 'ticking';
              t.timer = t.fuse;
              emit(g, 'trap', { kind: 'bomb', x: t.cx + 0.5, y: t.cy + 0.5 });
              break;
            }
          }
        } else if (t.state === 'ticking') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.timer = 0;
            t.state = 'exploded';
            t.defusing = false;
            emit(g, 'boom', { x: t.cx + 0.5, y: t.cy + 0.5 });
            die(g, 'bomb', i, 0);
            break;
          }
          let defuserNear = false;
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < 1.35 && Math.abs(p.y - t.cy) < 1.35) {
              defuserNear = true;
              break;
            }
          }
          const supported = !g.hasPlateA || !g.coop || g.channelA;
          if (defuserNear && supported) {
            t.defusing = true;
            t.defuse = Math.min(1, t.defuse + dt / t.defuseTime);
            if (t.defuse >= 1) {
              t.defused = true;
              t.defusing = false;
              t.state = 'defused';
              emit(g, 'defused', { x: t.cx + 0.5, y: t.cy + 0.5 });
            }
          } else {
            t.defusing = false;
            t.defuse = Math.max(0, t.defuse - dt * 0.25);
          }
        }
        break;
      }
      case 'springTrap': {
        const pinned = g.hasPlateA && g.coop && g.channelA;
        if (t.state === 'idle' && !pinned) {
          for (let pi = 0; pi < players.length; pi++) {
            if (standingOn(players[pi], t.cx, t.cy)) {
              t.state = 'shaking';
              t.timer = t.delay;
              break;
            }
          }
        } else if (t.state === 'shaking' && (t.timer -= dt) <= 0) {
          t.state = 'sprung';
          t.timer = t.cooldown;
          t.offsetY = 0.55;
          emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < 0.85 && p.y >= t.cy && p.y <= t.cy + 1.45) {
              p.vy = t.boost * p.gravDir;
              p.onGround = false;
              p.coyote = 0;
              p.trapAnim = 'boing';
              p.trapAnimTimer = 0.75;
            }
          }
        } else if (t.state === 'sprung') {
          t.offsetY = Math.max(0, t.offsetY - dt * 1.4);
          if ((t.timer -= dt) <= 0) {
            t.state = 'idle';
            t.offsetY = 0;
          }
        }
        break;
      }
      case 'magnetOrb': {
        const ox = t.cx + 0.5;
        const oy = t.cy + 0.5;
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (p.atDoor) continue;
          const dx = ox - p.x;
          const dist = Math.abs(dx);
          if (dist > 0.15 && dist < t.radius && Math.abs(p.y - t.cy) < 3.6) {
            const rawDir = Math.sign(dx);
            const pullDir = (g.coop && g.channelB) ? -rawDir : rawDir;
            const strength = 1 - dist / t.radius;
            p.beltVx += pullDir * (2.2 + 3.4 * strength);
            p.magnetPull = pullDir * Math.max(0.25, strength);
          }
        }
        break;
      }
      case 'pieCannon': {
        const ox = t.cx + 0.5;
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            const ahead = (p.x - ox) * t.dir;
            if (!p.atDoor && ahead > 0.4 && ahead < t.range && Math.abs(p.y - t.cy) < 1.6) {
              t.state = 'flying';
              t.x = ox + t.dir * 0.45;
              t.y = t.cy + 0.48;
              break;
            }
          }
        } else if (t.state === 'flying') {
          t.x += t.dir * t.speed * dt;
          let hit = false;
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.x - 0.3, t.y - 0.3, t.x + 0.3, t.y + 0.3)) {
              p.pieTimer = 1.4;
              p.vx = t.dir * 9.5;
              p.stun = 0.28;
              p.trapAnim = 'pie';
              p.trapAnimTimer = 1.4;
              emit(g, 'trap', { kind: t.kind, x: t.x, y: t.y });
              hit = true;
              break;
            }
          }
          if (hit || isSolid(g, Math.floor(t.x), Math.floor(t.y)) || Math.abs(t.x - ox) > t.range + 2) {
            t.state = 'cooldown';
            t.timer = t.cooldown;
          }
        } else if (t.state === 'cooldown' && (t.timer -= dt) <= 0) {
          t.state = 'idle';
        }
        break;
      }
      case 'discoFloor': {
        if (!(g.coop && g.channelB)) {
          for (let pi = 0; pi < players.length; pi++) {
            const p = players[pi];
            if (standingOn(p, t.cx, t.cy) && p.danceTimer <= 0.15) {
              p.danceTimer = t.duration;
              p.trapAnim = 'disco';
              p.trapAnimTimer = t.duration;
              t.active = true;
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
            }
          }
        }
        break;
      }
      case 'weightBridge': {
        if (t.state === 'idle') {
          if (weightRiders >= 2) {
            t.state = 'shaking';
            t.timer = t.delay;
            emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          }
        } else if (t.state === 'shaking') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.state = 'fallen';
            g.solid[t.cell] = 0;
            t.timer = t.respawn;
          }
        } else if (t.state === 'fallen') {
          t.timer -= dt;
          if (t.timer <= 0 && !players.some((p) => overlaps(p, t.cx, t.cy, t.cx + 1, t.cy + 1))) {
            t.state = 'idle';
            g.solid[t.cell] = 1;
          }
        }
        break;
      }
      case 'countdownLie': {
        if (t.state === 'idle') {
          if (players.some((p) => !p.atDoor && Math.abs(p.x - (t.cx + 0.5)) <= t.triggerDist)) {
            t.state = 'counting';
            t.step = 3;
            t.timer = t.stepTime;
            emit(g, 'countdown', { text: '3...', step: 3, x: t.cx + 0.5, y: t.cy + 1 });
          }
        } else if (t.state === 'counting') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.step--;
            t.timer = t.stepTime;
            if (t.step === 2) emit(g, 'countdown', { text: '2...', step: 2, x: t.cx + 0.5, y: t.cy + 1 });
            else if (t.step === 1) emit(g, 'countdown', { text: '1...', step: 1, x: t.cx + 0.5, y: t.cy + 1 });
            else {
              emit(g, 'countdown', { text: 'GO!', step: 0, x: t.cx + 0.5, y: t.cy + 1 });
              t.state = 'done';
            }
          }
        }
        break;
      }
      case 'shyPlatform': {
        const L = g.level;
        if (t.state === 'idle') {
          const jumpingNear = players.some((p) => !p.atDoor && (p.jumped || (!p.onGround && p.vy > 0)) && Math.abs(p.x - (t.homeCx + 0.5)) <= t.triggerDist);
          if (jumpingNear) {
            const targetCx = Math.max(0, Math.min(L.W - 1, t.homeCx + t.shift));
            if (targetCx !== t.curCx) {
              g.solid[t.cy * L.W + t.curCx] = 0;
              t.curCx = targetCx;
              g.solid[t.cy * L.W + t.curCx] = 1;
              t.x = t.curCx + 0.5;
              t.state = 'shifted';
              t.timer = 0.4;
              emit(g, 'trap', { kind: t.kind, x: t.x, y: t.cy + 0.5 });
            }
          }
        } else if (t.state === 'shifted') {
          t.timer = Math.max(0, t.timer - dt);
          if (t.timer <= 0 && players.every((p) => p.onGround || p.atDoor) &&
              !players.some((p) => !p.atDoor && Math.abs(p.x - (t.curCx + 0.5)) < 1.8 && Math.abs(p.y - (t.cy + 1)) < 1.2)) {
            g.solid[t.cy * L.W + t.curCx] = 0;
            t.curCx = t.homeCx;
            g.solid[t.cy * L.W + t.curCx] = 1;
            t.x = t.curCx + 0.5;
            t.state = 'idle';
          }
        }
        break;
      }
      case 'hungryFloor': {
        if (t.state === 'idle') {
          const standing = players.some((p) => standingOn(p, t.cx, t.cy));
          if (standing) {
            t.timer += dt;
            if (t.timer >= t.delay) {
              t.state = 'chomp';
              t.cooldown = 0.6;
              for (let pi = 0; pi < players.length; pi++) {
                const p = players[pi];
                if (standingOn(p, t.cx, t.cy)) {
                  if (t.spitUp) {
                    p.vy = 14 * p.gravDir;
                    p.onGround = false;
                  } else {
                    p.x = g.level.start.x;
                    p.y = g.level.start.y;
                    p.vx = 0;
                    p.vy = 0;
                    p.stun = 0.25;
                  }
                }
              }
              emit(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
            }
          } else {
            t.timer = 0;
          }
        } else if (t.state === 'chomp') {
          t.cooldown -= dt;
          if (t.cooldown <= 0) {
            t.state = 'idle';
            t.timer = 0;
          }
        }
        break;
      }
      case 'portalWall': {
        for (let pi = 0; pi < players.length; pi++) {
          const p = players[pi];
          if (!p.atDoor && p.portalCd <= 0 && overlaps(p, t.cx - 0.08, t.cy, t.cx + 1.08, t.cy + 1.05)) {
            p.x = t.to ? t.to.x : 1.5;
            p.y = t.to ? t.to.y : t.cy;
            p.vx = 0;
            p.vy = 0;
            p.portalCd = 0.35;
            emit(g, 'trap', { kind: t.kind, x: p.x, y: p.y });
          }
        }
        break;
      }
      case 'icicle': case 'closingWall': case 'risingFloor': case 'saw': case 'sizeSwell': case 'spikeSwap':
        updateDevilTrap(g, t, i, dt, true);
        break;
      default: break;
    }
  }
}

const NOOP = () => {};
/**
 * Level Devil trap set (icicle, closing wall, rising floor, saw, size swell, spike-swap).
 * auth = true on the host / solo (full rules). auth = false is guest prediction: only player `only`
 * triggers, nobody dies and no events fire, the host snapshot stays the judge.
 */
function updateDevilTrap(g, t, i, dt, auth, only = -1) {
  const players = g.players;
  const emitT = auth ? emit : NOOP;
  const dieT = auth ? die : NOOP;
  switch (t.kind) {
      case 'icicle': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < t.radius && p.y < t.cy && p.y > t.cy - 9) {
              t.state = 'armed'; t.timer = t.delay;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              break;
            }
          }
        } else if (t.state === 'armed') {
          if ((t.timer -= dt) <= 0) { t.state = 'falling'; emitT(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 }); }
        } else if (t.state === 'falling') {
          t.vy = Math.max(-PHYS.maxFall, t.vy - PHYS.gravity * dt);
          t.offsetY += t.vy * dt;
          const tipY = t.cy + t.offsetY;
          if (tipY < PIT_Y || isSolid(g, t.cx, Math.floor(tipY))) { t.state = 'done'; break; }
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.3, tipY, t.cx + 0.7, tipY + 0.9)) dieT(g, 'icicle', i, pi);
          }
        }
        break;
      }
      case 'closingWall': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            const line = t.cx + 0.5 + t.dx;
            // fires when a player crosses the trigger line in either direction
            if (!p.atDoor && Math.abs(p.y - t.cy) < 3 && p.prevX !== p.x && (p.prevX - line) * (p.x - line) <= 0) {
              t.state = 'closing'; t.timer = t.delay;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              break;
            }
          }
        } else if (t.state === 'closing' && (t.timer -= dt) <= 0) {
          t.state = 'closed';
          g.solid[t.cell] = 1;
          emitT(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.05, t.cy, t.cx + 0.95, t.cy + 1)) dieT(g, 'crushed', i, pi);
          }
        }
        break;
      }
      case 'risingFloor': {
        if (t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            if (!standingOn(players[pi], t.cx, t.cy)) continue;
            // the whole contiguous strip in this row rises together
            for (const o of g.traps) {
              if (o.kind === 'risingFloor' && o.state === 'idle' && o.cy === t.cy && Math.abs(o.cx - t.cx) <= 6) {
                o.state = 'armed'; o.timer = o.delay; o.curCy = o.cy;
              }
            }
            g.lastTrapIndex = i; g.lastTrapTime = g.time;
            emitT(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
            break;
          }
        } else if (t.state === 'armed') {
          if ((t.timer -= dt) <= 0) { t.state = 'rising'; t.timer = 1 / t.speed; }
        } else if (t.state === 'rising') {
          t.offsetY = Math.min(t.offsetY + t.speed * dt, (t.curCy ?? t.cy) + 1 - t.cy);
          if ((t.timer -= dt) <= 0) {
            const from = t.curCy ?? t.cy;
            const to = from + 1;
            const L = g.level;
            if (to >= L.H || to - t.cy > t.rise || isSolid(g, t.cx, to)) { t.state = 'up'; t.offsetY = from - t.cy; break; }
            g.solid[from * L.W + t.cx] = 0;
            g.solid[to * L.W + t.cx] = 1;
            t.curCy = to;
            t.offsetY = to - t.cy;
            t.timer += 1 / t.speed;
            for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
              const p = players[pi];
              if (p.atDoor || p.gravDir < 0) continue;
              if (p.x + hw(p) > t.cx && p.x - hw(p) < t.cx + 1 && p.y >= from + 0.9 && p.y <= to + 0.1) {
                p.y = to + 1;
                p.vy = Math.max(p.vy, 0);
                p.onGround = true;
                const head = Math.floor(p.y + ht(p) - 1e-4);
                for (let cx = Math.floor(p.x - hw(p) + 1e-4); cx <= Math.floor(p.x + hw(p) - 1e-4); cx++) {
                  if (isSolid(g, cx, head)) { dieT(g, 'crushed', i, pi); break; }
                }
              }
            }
          }
        }
        break;
      }
      case 'saw': {
        if (t.popup > 0 && t.state === 'idle') {
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            if (!p.atDoor && Math.abs(p.x - t.x) < t.popup && Math.abs(p.y - t.cy) < 3) {
              t.state = 'moving'; t.vx = t.dir * t.speed;
              emitT(g, 'trap', { kind: t.kind, x: t.x, y: t.y });
              break;
            }
          }
          break;
        }
        if (t.state === 'idle') { t.state = 'moving'; t.vx = t.dir * t.speed; }
        if (t.speed > 0 && t.range > 0) {
          const home = t.axis === 'y' ? t.cy : t.cx + 0.5;
          const pos = t.axis === 'y' ? t.y : t.x;
          const lo = Math.min(home, home + t.dir * t.range), hi = Math.max(home, home + t.dir * t.range);
          let next = pos + t.vx * dt;
          if (next > hi) { next = 2 * hi - next; t.vx = -Math.abs(t.vx); }
          else if (next < lo) { next = 2 * lo - next; t.vx = Math.abs(t.vx); }
          if (t.axis === 'y') t.y = next; else t.x = next;
        }
        for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
          const p = players[pi];
          if (!p.atDoor && overlaps(p, t.x - 0.36, t.y + 0.1, t.x + 0.36, t.y + 0.82)) dieT(g, 'saw', i, pi);
        }
        break;
      }
      case 'sizeSwell': {
        if (!t.triggered) {
          for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
            const p = players[pi];
            if (!p.atDoor && overlaps(p, t.cx + 0.1, t.cy, t.cx + 0.9, t.cy + 0.6)) {
              t.triggered = true;
              p.size = t.scale;
              p.sizeTimer = t.duration;
              p.halfW = PHYS.halfW * t.scale;
              p.height = PHYS.height * t.scale;
              p.trapAnim = 'swell';
              p.trapAnimTimer = 0.5;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              emitT(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.3, playerIndex: pi });
              break;
            }
          }
        }
        break;
      }
      case 'spikeSwap': {
        for (let pi = 0; pi < players.length; pi++) {
            if (only >= 0 && pi !== only) continue;
          const p = players[pi];
          const bit = 1 << pi;
          // counts approaches, not steps: the 3rd time you come near, the spikes pop while you are still
          // far enough away to react and jump (same reaction distance as hidden spikes)
          const inZone = !p.atDoor && Math.abs(p.x - (t.cx + 0.5)) < t.radius && Math.abs(p.y - t.cy) < 2;
          if (inZone && !(t.insideMask & bit)) {
            t.step++;
            if (t.step > t.after && !t.active) {
              t.active = true;
              g.lastTrapIndex = i; g.lastTrapTime = g.time;
              emitT(g, 'trap', { kind: t.kind, x: t.cx + 0.5, y: t.cy + 0.5 });
            }
          }
          if (inZone) t.insideMask |= bit;
          else t.insideMask &= ~bit;
        }
        break;
      }
      default: break;
  }
}

function isCeilingSpike(L, cx, cy) {
  return cy + 1 < L.H && L.tiles[(cy + 1) * L.W + cx] === TILE.SOLID && (cy === 0 || L.tiles[(cy - 1) * L.W + cx] !== TILE.SOLID);
}

function checkHazards(g) {
  const L = g.level;
  for (let pi = 0; pi < g.players.length; pi++) {
    const p = g.players[pi];
    if (p.atDoor) continue;
    if (p.y < PIT_Y || p.y > L.H + 3) { die(g, 'pit', -1, pi); return; }
    const x0 = Math.max(0, Math.floor(p.x - hw(p))), x1 = Math.min(L.W - 1, Math.floor(p.x + hw(p)));
    const y0 = Math.max(0, Math.floor(p.y)), y1 = Math.min(L.H - 1, Math.floor(p.y + ht(p)));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (L.tiles[cy * L.W + cx] !== TILE.SPIKES) continue;
      const sy = isCeilingSpike(L, cx, cy) ? cy + 0.5 : cy;
      if (overlaps(p, cx + 0.12, sy, cx + 0.88, sy + 0.5)) { die(g, 'spikes', -1, pi); return; }
    }
    for (let i = 0; i < g.traps.length; i++) {
      const t = g.traps[i];
      if (t.kind === 'hiddenSpikes' && t.active && overlaps(p, t.cx + 0.12, t.cy, t.cx + 0.88, t.cy + 0.72)) {
        die(g, 'spikes', i, pi);
        return;
      }
      if (t.kind === 'spikeSwap' && t.active && overlaps(p, t.cx + 0.12, t.cy, t.cx + 0.88, t.cy + 0.6)) {
        die(g, 'spikes', i, pi);
        return;
      }
      if (t.kind === 'antiJump' && t.active &&overlaps(p, t.cx + 0.12, t.cy + 0.95, t.cx + 0.88, t.cy + 1.55)) {
        die(g, 'spikes', i, pi);
        return;
      }
      if ((t.kind === 'gateA' || t.kind === 'gateB') && !t.open && overlaps(p, t.cx + 0.18, t.cy, t.cx + 0.82, t.topY ?? (t.cy + 0.95))) {
        die(g, 'gate', i, pi);
        return;
      }
    }
  }
}

function win(g) {
  emit(g, 'win', { level: g.levelIndex, deaths: g.levelDeaths });
  const next = g.levels[g.levelIndex + 1];
  if (next && (!next.coopOnly || g.coop)) loadLevel(g, g.levelIndex + 1);
  else g.finished = true;
}

// 4 decimals (0.1 mm) keeps 60 Hz snapshots ~30% smaller; non-numbers pass through untouched
const q4 = (v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v);

/** Compact JSON-safe state snapshot broadcast from Host (P1) to Guest (P2) in 2P co-op. */
export function exportCoopSnapshot(g, meta = null) {
  const snap = {
    levelIndex: g.levelIndex,
    time: g.time,
    darkTimer: g.darkTimer,
    keysLeft: g.keysLeft,
    channelA: g.channelA,
    channelB: g.channelB,
    syncActive: g.syncActive,
    syncLatch: g.syncLatch,
    dead: g.dead,
    deadTimer: g.deadTimer,
    deathCause: g.deathCause,
    deathVictim: g.deathVictim,
    deaths: g.deaths,
    levelDeaths: g.levelDeaths,
    finished: g.finished,
    door: g.door ? { x: g.door.x, y: g.door.y, ran: g.door.ran, stopIndex: g.door.stopIndex } : null,
    players: g.players.map((p) => ({
      x: q4(p.x), y: q4(p.y), vx: q4(p.vx), vy: q4(p.vy), face: p.face, gravDir: p.gravDir,
      onGround: p.onGround, stun: p.stun, slip: p.slip, slipDir: p.slipDir,
      flipped: p.flipped, atDoor: p.atDoor, beltVx: p.beltVx, speedMul: p.speedMul,
      pieTimer: p.pieTimer, danceTimer: p.danceTimer, magnetPull: p.magnetPull,
      trapAnim: p.trapAnim, trapAnimTimer: p.trapAnimTimer,
      size: p.size, sizeTimer: p.sizeTimer, halfW: p.halfW, height: p.height,
    })),
    traps: g.traps.reduce((acc, t, i) => {
      const active = t.kind === 'boulder' || t.kind === 'crusher' || t.kind === 'boxingGlove' || t.kind === 'saw'
        || (t.state !== undefined && t.state !== 'idle')
        || t.offsetY !== 0 || t.ext !== 0 || t.revealed || t.active || t.triggered
        || t.collected || t.pressed || t.open || t.defused || t.defusing || (t.timer ?? 0) > 0;
      if (!active) return acc;
      acc.push({
        i,
        kind: t.kind,
        state: t.state, offsetY: q4(t.offsetY), x: q4(t.x), y: q4(t.y), ext: q4(t.ext), vx: q4(t.vx),
        face: t.face, shy: t.shy, onGround: t.onGround, revealed: t.revealed,
        active: t.active, triggered: t.triggered, collected: t.collected, pressed: t.pressed,
        open: t.open, defuse: t.defuse, defused: t.defused, defusing: t.defusing,
        timer: t.timer, stopIndex: t.stopIndex, vy: t.vy, step: t.step, curCy: t.curCy, insideMask: t.insideMask,
      });
      return acc;
    }, []),
  };
  if (meta) {
    if (Number.isFinite(meta.simTick)) snap.simTick = meta.simTick;
    if (Number.isFinite(meta.ackSeq)) snap.ackSeq = meta.ackSeq;
  }
  return snap;
}

// trap states that only ever move forward within one attempt (guest prediction may be ahead of the host)
const ONE_WAY = {
  fallingFloor: ['idle', 'shaking', 'falling'],
  launchFloor: ['idle', 'shaking', 'launching'],
  icicle: ['idle', 'armed', 'falling', 'done'],
  closingWall: ['idle', 'closing', 'closed'],
  risingFloor: ['idle', 'armed', 'rising', 'up'],
};

/** Applies a Host snapshot onto the Guest simulation state without discarding smooth interpolation anchors. */
export function applyCoopSnapshot(g, snap, opts = null) {
  if (!snap) return { levelChanged: false, respawned: false };
  const levelChanged = snap.levelIndex !== g.levelIndex;
  const wasDead = g.dead;
  const prevTime = g.time;
  if (levelChanged) loadLevel(g, snap.levelIndex);
  const respawned = levelChanged || (wasDead && !snap.dead) || (snap.time < 0.25 && prevTime > 0.35);
  // Snapshots only list traps that are active, so after a respawn the guest must reset the level
  // itself, otherwise fallen floors, closed walls and popped spikes from the last attempt stay.
  if (respawned && !levelChanged) resetLevel(g);
  g.time = snap.time;
  g.darkTimer = snap.darkTimer;
  if (snap.keysLeft !== undefined) g.keysLeft = snap.keysLeft;
  if (snap.channelA !== undefined) g.channelA = snap.channelA;
  if (snap.channelB !== undefined) g.channelB = snap.channelB;
  if (snap.syncActive !== undefined) g.syncActive = snap.syncActive;
  if (snap.syncLatch !== undefined) g.syncLatch = snap.syncLatch;
  g.dead = snap.dead;
  g.deadTimer = snap.deadTimer;
  g.deathCause = snap.deathCause;
  g.deathVictim = snap.deathVictim;
  g.deaths = snap.deaths;
  g.levelDeaths = snap.levelDeaths;
  g.finished = snap.finished;
  if (snap.door && g.door) Object.assign(g.door, snap.door);
  const predictIdx = opts?.predictPlayerIndex ?? -1;
  const snapAlpha = Number.isFinite(opts?.snapAlpha) ? Math.max(0, Math.min(1, opts.snapAlpha)) : 1;
  if (Array.isArray(snap.players)) {
    for (let i = 0; i < Math.min(g.players.length, snap.players.length); i++) {
      const dst = g.players[i];
      const src = snap.players[i];
      if (i === predictIdx && opts?.skipPredictPlayer && !respawned && !g.dead && !src.atDoor) {
        continue;
      }
      const err = Math.hypot(src.x - dst.x, src.y - dst.y);
      const localAir = !dst.onGround && src.onGround && (dst.vy * dst.gravDir > 0.5 || Math.abs(dst.y - src.y) > 0.25);
      const maxPredictErr = localAir ? 2.5 : 2.2;
      if (i === predictIdx && !respawned && !g.dead && !src.atDoor && err < maxPredictErr) {
        dst.prevX = dst.x;
        dst.prevY = dst.y;
        const dx = src.x - dst.x;
        if (Math.abs(dx) > 0.35 || Math.abs(dst.vx) < 0.1) {
          dst.x += dx * 0.1;
        }
        if (!localAir) {
          const dy = src.y - dst.y;
          if (Math.abs(dy) > 0.25 || (dst.onGround && src.onGround)) {
            dst.y += dy * 0.15;
          }
          if (dst.onGround && src.onGround) {
            dst.vy = src.vy;
            dst.onGround = src.onGround;
          }
        }
        dst.gravDir = src.gravDir;
        dst.stun = src.stun;
        dst.slip = src.slip;
        dst.slipDir = src.slipDir;
        dst.flipped = src.flipped;
        dst.beltVx = src.beltVx ?? 0;
        dst.speedMul = src.speedMul ?? 1;
        dst.pieTimer = src.pieTimer;
        dst.danceTimer = src.danceTimer;
        dst.magnetPull = src.magnetPull;
        dst.trapAnim = src.trapAnim;
        dst.trapAnimTimer = src.trapAnimTimer;
        dst.size = src.size ?? 1;
        dst.sizeTimer = src.sizeTimer ?? 0;
        dst.halfW = src.halfW ?? PHYS.halfW;
        dst.height = src.height ?? PHYS.height;
      } else {
        const teleported = respawned || err > 2.5;
        const curX = dst.prevX + (dst.x - dst.prevX) * snapAlpha;
        const curY = dst.prevY + (dst.y - dst.prevY) * snapAlpha;
        const anchorX = teleported ? src.x : curX;
        const anchorY = teleported ? src.y : curY;
        Object.assign(dst, src);
        dst.prevX = anchorX;
        dst.prevY = anchorY;
      }
      dst.jumped = false;
      dst.landed = false;
    }
  }
  if (Array.isArray(snap.traps)) {
    for (let idx = 0; idx < snap.traps.length; idx++) {
      const src = snap.traps[idx];
      const ti = Number.isInteger(src?.i) ? src.i : idx;
      const dst = g.traps[ti];
      if (!dst || !src) continue;
      // one-way traps the guest already set off itself: an older host view must not undo them
      // (a floor reappearing under the guest, a wall reopening), the host catches up a moment later
      const order = ONE_WAY[dst.kind];
      if (!respawned && order && order.indexOf(src.state) < order.indexOf(dst.state)) continue;
      // the saw is simulated on the guest too; only take the host position if it drifted
      if (!respawned && dst.kind === 'saw' && dst.state === src.state && Math.abs(src.x - dst.x) + Math.abs(src.y - dst.y) < 1) continue;
      const teleported = respawned || (src.x !== undefined && Math.hypot(src.x - dst.x, (src.y ?? dst.y) - dst.y) > 2.5);
      const anchorX = teleported ? (src.x ?? dst.x) : dst.x;
      const anchorY = teleported ? (src.y ?? dst.y) : dst.y;
      Object.assign(dst, src);
      dst.prevX = anchorX;
      dst.prevY = anchorY;
      if ((dst.kind === 'fallingFloor' && dst.state === 'falling') ||
          (dst.kind === 'launchFloor' && dst.state === 'launching')) {
        g.solid[dst.cell] = 0;
      } else if (dst.kind === 'fallingFloor' || dst.kind === 'launchFloor') {
        g.solid[dst.cell] = 1;
      } else if (dst.kind === 'closingWall') {
        g.solid[dst.cell] = dst.state === 'closed' ? 1 : 0;
      } else if (dst.kind === 'risingFloor') {
        const W = g.level.W;
        for (let cy = dst.cy; cy <= dst.cy + dst.rise && cy < g.level.H; cy++) if (g.level.tiles[cy * W + dst.cx] !== TILE.SOLID) g.solid[cy * W + dst.cx] = 0;
        g.solid[(dst.curCy ?? dst.cy) * W + dst.cx] = 1;
      }
    }
  }
  return { levelChanged, respawned };
}
