// Shot list for the 30s launch ad (Hook C). ctrl = body of (p0, p1, g, f, st) => [momoInput, mimiInput].
export const SHOTS = [
  // ---- 2-player (host view, Momo + Mimi) ----
  { id: 'c_lobby', coop: true, level: 37, lobby: true, dpr: 2.4 },
  { id: 'c37_bomb', coop: true, level: 37, pre: 30, maxSec: 20, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'c36_release', coop: true, level: 36, maxSec: 12, tail: 30, ctrl: `
    if (!st.ph) st.ph = 1;
    if (st.ph === 1) { const a = mv(p0, 4.5); if (!a.left && !a.right && p1.x > 9.6) st.ph = 2; return [a, R]; }
    return [R, R];` },
  { id: 'c38_laser', coop: true, level: 38, maxSec: 10, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'c39_squad', coop: true, level: 39, maxSec: 14, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'c40_ghost', coop: true, level: 40, maxSec: 14, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'c41_rocket', coop: true, level: 41, maxSec: 14, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'c42_finale', coop: true, level: 42, maxSec: 14, tail: 30, ctrl: 'return [R, f > 26 ? R : N];' },
  { id: 'e_duo', coop: true, level: 37, zoom: 3.6, pre: 40, maxSec: 6, tail: 0, ctrl: 'if (f >= 150) st.done = true; return [N, f < 16 ? R : N];' },
  { id: 'c37_idle', coop: true, level: 37, pre: 60, maxSec: 1, tail: 0, ctrl: 'st.done = true; return [N, N];' },

  // ---- solo ----
  { id: 's01_fall', level: 1, ctrl: 'return [R];' },
  { id: 's01_door', level: 1, maxSec: 14, tail: 45, ctrl: `return [plan([
    { dir: 1, jumpAt: (p) => p.x >= 8.6, until: landedPast(11) },
    { dir: 1, jumpAt: (p) => p.x >= 13.4, until: landedPast(17) },
    { dir: 1, until: (_, gg) => gg.door.ran },
  ])];` },
  { id: 's02_bonk', level: 2, ctrl: 'return [plan([{ dir: 1, jumpAt: (p) => p.x >= 5.4, until: landedPast(8) }])];' },
  { id: 's06_banana', level: 6, ctrl: 'return [R];' },
  { id: 's07_chicken', level: 7, ctrl: 'return [plan([{ dir: 1, until: (p) => p.onGround && p.y > 4.5 }, { dir: 1, until: won }])];' },
  { id: 's08_coin', level: 8, ctrl: 'return [R];' },
  { id: 's09_fakewin', level: 9, maxSec: 14, ctrl: 'return [plan([{ dir: 1, jumpAt: (p) => p.x >= 4.5, until: landedPast(8) }, { dir: 1, until: won }])];' },
  { id: 's12_crusher', level: 12, ctrl: 'return [R];' },
  { id: 's13_punch', level: 13, ctrl: 'return [plan([{ dir: 1, jumpAt: (p) => p.x >= 5.2, until: landedPast(9.5) }, { dir: 1, until: won }])];' },
  { id: 's14_boulder', level: 14, ctrl: 'return [R];' },
  { id: 's18_sneeze', level: 18, ctrl: 'return [R];' },
  { id: 's23_ghostbridge', level: 23, ctrl: 'return [R];' },
  { id: 's29_bakery', level: 29, ctrl: 'return [R];' },
  { id: 's31_launch', level: 31, ctrl: 'return [R];' },
  { id: 's33_robot', level: 33, ctrl: 'return [R];' },
];
