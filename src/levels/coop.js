// Couples co-op levels C1-C15 (World 5), Level Devil style: co-op puzzle rooms (coopRooms.js) chained
// with solo trap rooms (rooms.js) that both players face together. C1-C6 introduce one co-op idea each;
// after that every room is a callback, tuned harder with the level (h). Text keys: c<N>.* (coopText.js).
import { ROOMS } from './rooms.js';
import { COOP_ROOMS } from './coopRooms.js';
import { composeLevel } from './compose.js';

const ANY = { ...ROOMS, ...COOP_ROOMS };
const SCHEDULE = [
  ['spikePop', 'plateRelay'], // C1 plates + laser
  ['pitNear', 'weightBridge'], // C2 weight bridge
  ['coinRow', 'keyVault'], // C3 key
  ['icicleHall', 'bananaSlide', 'bombDefuse'], // C4 bomb
  ['crusherWalk', 'plateRelay', 'twoChannels'], // C5 two colours
  ['sawTunnel', 'weightBridge', 'syncPlates'], // C6 sync plates
  ['spikePop', 'keyVault', 'bananaSlide', 'bombDefuse'], // C7
  ['pitNear', 'coinRow', 'twoChannels', 'syncPlates'], // C8
  ['icicleHall', 'crusherWalk', 'weightBridge', 'keyVault'], // C9
  ['sawTunnel', 'spikePop', 'bombDefuse', 'plateRelay'], // C10
  ['bananaSlide', 'pitNear', 'syncPlates', 'coinRow', 'twoChannels'], // C11
  ['icicleHall', 'weightBridge', 'crusherWalk', 'keyVault', 'bombDefuse'], // C12
  ['sawTunnel', 'spikePop', 'twoChannels', 'bananaSlide', 'syncPlates'], // C13
  ['pitNear', 'coinRow', 'keyVault', 'icicleHall', 'weightBridge', 'bombDefuse'], // C14
  ['crusherWalk', 'sawTunnel', 'plateRelay', 'spikePop', 'syncPlates', 'twoChannels'], // C15 finale
];

const LAST = SCHEDULE.length - 1;
const firstSeen = new Map();
SCHEDULE.forEach((rooms, i) => rooms.forEach((r) => { if (!firstSeen.has(r)) firstSeen.set(r, i); }));

export const COOP_RAW = SCHEDULE.map((rooms, i) => {
  const n = i + 1;
  return composeLevel({
    name: `c${n}.name`,
    world: 5,
    coopOnly: true,
    // a room teaches at h=0 the first time it appears in co-op, then follows the level's hardness
    rooms: rooms.map((r) => ({ id: r, ...ANY[r]({ h: firstSeen.get(r) === i ? 0 : i / LAST }) })),
    signs: [{ x: 4.5, text: `c${n}.sign` }],
    taunts: [`c${n}.t1`, `c${n}.t2`, `c${n}.t3`],
  });
});
