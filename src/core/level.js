/**
 * Level format: ASCII rows, top row first. One char = one 1x1 tile.
 *   #  ground        ^  spikes (floor/ceil) P  player start    D  door
 *   F  falling floor G  ghost floor         I  invisible block S  hidden spikes
 *   B  banana peel   R  rubber chicken      C  chomp coin      X  fake win door
 *   >  conveyor ->   <  conveyor <-         M  ceiling crusher V  boxing glove
 *   O  boulder       U  controls flip       Y  gravity flip    Z  slow caramel
 *   W  sneeze cloud  K  fake checkpoint     N  dark candle     L  launch floor
 *   A  anti-jump     J  mystery gift box    E  mirror robot    Q  peek-a-boo ghost
 *   *  golden key    H  hold plate A        =  hazard gate A   h  hold plate B
 *   -  hazard gate B @  co-op bomb
 *   ;  ceiling icicle (drops)    ]  closing wall (slams shut past a line)   [  rising floor
 *   &  patrol saw    {  size swell (giant)   ,  spike-swap tile (safe twice, spikes on 3rd pass)
 *   any other letter/digit: marker (e.g. T, 1..9 = door run targets)
 * `traps` tunes trap chars: { at: 'S', delay, radius } or { at: 'D', runTo: 'T' | ['1','2'], radius }.
 *
 * @example
 * const level = parseLevel({ name: 'Easy', rows: ['P..D', '####'] });
 * level.W === 4; level.H === 2; level.start // { x: 0.5, y: 1 }
 */
export const TILE = { EMPTY: 0, SOLID: 1, SPIKES: 2 };

const TRAP_BUILDERS = {
  F: (base, cfg) => ({ kind: 'fallingFloor', ...base, delay: cfg.delay ?? 0.25 }),
  G: (base) => ({ kind: 'ghostFloor', ...base }),
  I: (base) => ({ kind: 'invisibleBlock', ...base }),
  B: (base, cfg) => ({ kind: 'bananaPeel', ...base, duration: cfg.duration ?? 1.5, speed: cfg.speed ?? 8.5 }),
  R: (base, cfg) => ({ kind: 'rubberChicken', ...base, boost: cfg.boost ?? 1.42 }),
  C: (base) => ({ kind: 'chompCoin', ...base }),
  X: (base, cfg) => ({ kind: 'fakeDoor', ...base, radius: cfg.radius ?? 3.5 }),
  S: (base, cfg) => ({ kind: 'hiddenSpikes', ...base, delay: cfg.delay ?? 0.15, radius: cfg.radius ?? 1.5 }),
  '>': (base, cfg) => ({ kind: 'conveyor', ...base, dir: 1, speed: cfg.speed ?? 3.2 }),
  '<': (base, cfg) => ({ kind: 'conveyor', ...base, dir: -1, speed: cfg.speed ?? 3.2 }),
  M: (base, cfg) => ({ kind: 'crusher', ...base, delay: cfg.delay ?? 0.16, slamSpeed: cfg.slamSpeed ?? 24, riseSpeed: cfg.riseSpeed ?? 4, rest: cfg.rest ?? 0.45 }),
  V: (base, cfg) => ({ kind: 'boxingGlove', ...base, dir: cfg.dir ?? -1, reach: cfg.reach ?? 2.8 }),
  O: (base, cfg) => ({ kind: 'boulder', ...base, dir: cfg.dir ?? -1, speed: cfg.speed ?? 6.2, triggerDist: cfg.triggerDist ?? 6 }),
  U: (base, cfg) => ({ kind: 'controlsFlip', ...base, duration: cfg.duration ?? 3.0 }),
  Y: (base) => ({ kind: 'gravityFlip', ...base }),
  Z: (base, cfg) => ({ kind: 'slowFloor', ...base, speedMul: cfg.speedMul ?? 0.5, jumpMul: cfg.jumpMul ?? 0.78 }),
  W: (base, cfg) => ({ kind: 'sneezeCloud', ...base, dir: cfg.dir ?? -1, delay: cfg.delay ?? 0.45, power: cfg.power ?? 12.5 }),
  K: (base) => ({ kind: 'fakeCheckpoint', ...base }),
  N: (base, cfg) => ({ kind: 'darkCandle', ...base, duration: cfg.duration ?? 1.8 }),
  L: (base, cfg) => ({ kind: 'launchFloor', ...base, delay: cfg.delay ?? 0.12, boost: cfg.boost ?? 19 }),
  A: (base, cfg) => ({ kind: 'antiJump', ...base, radius: cfg.radius ?? 4.5 }),
  J: (base, cfg) => ({ kind: 'giftTrap', ...base, duration: cfg.duration ?? 3.0 }),
  E: (base, cfg) => ({ kind: 'mimicRobot', ...base, speed: cfg.speed ?? 4.2 }),
  Q: (base, cfg) => ({ kind: 'booGhost', ...base, speed: cfg.speed ?? 3.6 }),
  '*': (base) => ({ kind: 'keyItem', ...base }),
  H: (base) => ({ kind: 'plateA', ...base, channel: 'A' }),
  '=': (base) => ({ kind: 'gateA', ...base, channel: 'A' }),
  h: (base) => ({ kind: 'plateB', ...base, channel: 'B' }),
  '-': (base) => ({ kind: 'gateB', ...base, channel: 'B' }),
  '@': (base, cfg) => ({ kind: 'bomb', ...base, fuse: cfg.fuse ?? 12.0, defuseTime: cfg.defuseTime ?? 1.2, triggerDist: cfg.triggerDist ?? 6.5 }),
  '!': (base, cfg) => ({ kind: 'springTrap', ...base, delay: cfg.delay ?? 0.08, boost: cfg.boost ?? 21.5, cooldown: cfg.cooldown ?? 0.9 }),
  '%': (base, cfg) => ({ kind: 'magnetOrb', ...base, radius: cfg.radius ?? 4.2, force: cfg.force ?? 16.0 }),
  '$': (base, cfg) => ({ kind: 'pieCannon', ...base, dir: cfg.dir ?? -1, range: cfg.range ?? cfg.triggerDist ?? 5.8, speed: cfg.speed ?? 11.5, cooldown: cfg.cooldown ?? 2.2 }),
  '~': (base, cfg) => ({ kind: 'discoFloor', ...base, duration: cfg.duration ?? 1.1 }),
  '+': (base) => ({ kind: 'syncPlate', ...base }),
  '?': (base, cfg) => ({ kind: 'bluffDoor', ...base, swapOnDeath: cfg.swapOnDeath ?? true }),
  '_': (base, cfg) => ({ kind: 'weightBridge', ...base, delay: cfg.delay ?? 0.15, respawn: cfg.respawn ?? 2.0 }),
  ':': (base, cfg) => ({ kind: 'countdownLie', ...base, triggerDist: cfg.triggerDist ?? 5.5, stepTime: cfg.stepTime ?? 0.55 }),
  '/': (base, cfg) => ({ kind: 'shyPlatform', ...base, shift: cfg.shift ?? 2, triggerDist: cfg.triggerDist ?? 5.0 }),
  '(': (base, cfg) => ({ kind: 'hungryFloor', ...base, delay: cfg.delay ?? 0.4, spitUp: !!cfg.spitUp }),
  '|': (base, cfg) => ({ kind: 'portalWall', ...base, toMarker: cfg.to ?? null }),
  // Level Devil set (2026-11-17). Symbols, not letters, so marker letters stay free.
  ';': (base, cfg) => ({ kind: 'icicle', ...base, delay: cfg.delay ?? 0.05, radius: cfg.radius ?? 2.2 }),
  ']': (base, cfg) => ({ kind: 'closingWall', ...base, dx: cfg.dx ?? 1.2, delay: cfg.delay ?? 0.06 }),
  '[': (base, cfg) => ({ kind: 'risingFloor', ...base, rise: cfg.rise ?? 3, speed: cfg.speed ?? 6, delay: cfg.delay ?? 0.1 }),
  '&': (base, cfg) => ({ kind: 'saw', ...base, dir: cfg.dir ?? 1, speed: cfg.speed ?? 3.5, range: cfg.range ?? 4, axis: cfg.axis ?? 'x', popup: cfg.popup ?? 0 }),
  '{': (base, cfg) => ({ kind: 'sizeSwell', ...base, scale: cfg.scale ?? 2, duration: cfg.duration ?? 3.5 }),
  ',': (base, cfg) => ({ kind: 'spikeSwap', ...base, after: cfg.after ?? 2 }),
};

export function parseLevel({ name, world = 1, coopOnly = false, breather = false, rows, traps = [], signs = [], taunts = [] }) {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const tiles = new Uint8Array(W * H);
  const cells = []; // special cells: { ch, cx, cy }
  let start = null;
  let door = null;
  const markers = {};

  rows.forEach((row, r) => {
    const cy = H - 1 - r;
    for (let cx = 0; cx < W; cx++) {
      const ch = row[cx] ?? '.';
      const i = cy * W + cx;
      if (ch === '#') tiles[i] = TILE.SOLID;
      else if (ch === '^') tiles[i] = TILE.SPIKES;
      else if (ch === 'P') start = { x: cx + 0.5, y: cy };
      else if (ch === 'D') door = { x: cx + 0.5, y: cy };
      else if (TRAP_BUILDERS[ch]) cells.push({ ch, cx, cy });
      else if (/[A-Za-z0-9]/.test(ch)) (markers[ch] ??= []).push({ x: cx + 0.5, y: cy });
    }
  });
  if (!start) throw new Error(`level "${name}" has no P`);

  const cfg = (ch) => traps.find((t) => t.at === ch) ?? {};
  const trapDefs = cells.map(({ ch, cx, cy }) => TRAP_BUILDERS[ch]({ cx, cy, cell: cy * W + cx }, cfg(ch)));
  const doorCfg = cfg('D');
  if (door && doorCfg.shrink) {
    door.shrink = true;
    door.shrinkRadius = doorCfg.radius ?? 3.0;
    door.shrinkDuration = doorCfg.duration ?? 5.0;
  }
  for (const t of trapDefs) {
    if (t.kind === 'portalWall' && t.toMarker) {
      const target = markers[t.toMarker]?.[0];
      if (!target) throw new Error(`level "${name}" portalWall missing target marker "${t.toMarker}"`);
      t.to = target;
    }
  }
  const route = Array.isArray(doorCfg.runTo) ? doorCfg.runTo : (doorCfg.runTo ? [doorCfg.runTo] : []);
  const stops = route.map((m) => {
    const stop = markers[m]?.[0];
    if (!stop) throw new Error(`level "${name}" runningDoor missing target marker "${m}"`);
    return stop;
  });
  if (door && stops.length) trapDefs.push({ kind: 'runningDoor', to: stops[0], stops, radius: doorCfg.radius ?? 2 });

  return { name, world, coopOnly: !!coopOnly, breather: !!breather, W, H, tiles, start, door, markers, trapDefs, signs, taunts };
}
