// Co-op room catalog (Momo = P1, Mimi = P2). Built "forward only": the partner who stays behind is
// released by the one who went ahead, so nobody walks back. Placeholders as in compose.js.
// `script` = the intended choreography, used by the co-op solver (src/core/coopSolver.js) to prove
// each room is fair: phases of [P1 target, P2 target], room-local x, 'hold' = stay put, 'exit' = room exit.
// Solo trap rooms (rooms.js) also appear in co-op levels; both players face the same trap.
const R = (rows, traps = [], extra = {}) => ({ rows, traps, ...extra });
const L = (a, b, o) => +(a + (b - a) * Math.max(0, Math.min(1, o.h ?? 0))).toFixed(3);
const bombDefused = (g) => g.traps.every((t) => t.kind !== 'bomb' || t.defused);

export const COOP_ROOMS = {
  // one holds the plate, the other crosses the laser and holds the far plate for the first
  plateRelay: () => R([
    '............................',
    '............................',
    '............................',
    '............................',
    's.....H......=.....H....e...',
    '############################',
    '############################',
  ], [], { script: [
    { p: [19.5, 6.5] },
    { p: ['hold', 'exit'] },
    { p: ['exit', 'hold'] },
  ] }),

  // the bridge drops if both stand on it: cross one at a time
  weightBridge: (o = {}) => R([
    '............................',
    '............................',
    '............................',
    '............................',
    's.....................e.....',
    '########______##############',
    '########......##############',
  ], [{ at: '_', delay: L(0.15, 0.08, o), respawn: 2.0 }], { script: [
    { p: [5.5, 5.5] },
    { p: [17.5, 'hold'] },
    { p: ['hold', 17.5] },
    { p: ['exit', 'exit'] },
  ] }),

  // the door stays locked until the key is taken from behind the laser
  keyVault: () => R([
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    's.....H......=...*...H....e...',
    '##############################',
    '##############################',
  ], [], { script: [
    { p: [21.5, 6.5] },
    { p: ['hold', 'exit'] },
    { p: ['exit', 'hold'] },
  ] }),

  // the bomb only accepts a defuse while the plate is held
  bombDefuse: (o = {}) => R([
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    's....H.............@......e...',
    '##############################',
    '##############################',
  ], [{ at: '@', fuse: L(12, 8, o), defuseTime: 1.2, triggerDist: 6.5 }], { script: [
    { p: [19.5, 5.5], until: bombDefused },
    { p: ['exit', 'exit'] },
  ] }),

  // two lasers, two colours: B is relayed first, then A
  twoChannels: () => R([
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    's....h.....-...h.H.....=.....H...e..',
    '####################################',
    '####################################',
  ], [], { script: [
    { p: [15.5, 5.5] },
    { p: ['hold', 17.5] },
    { p: [29.5, 'hold'] },
    { p: ['hold', 'exit'] },
    { p: ['exit', 'hold'] },
  ] }),

  // both stand on the amber plates at once (too far apart to tap in passing), then 2.5 s to clear the lasers
  syncPlates: () => R([
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    's...+.......+..=.-.........e..',
    '##############################',
    '##############################',
  ], [], { script: [
    { p: [12.5, 4.5] },
    { p: ['exit', 'exit'] },
  ] }),
};
