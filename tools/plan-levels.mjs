// Prints a room schedule for the solo levels that satisfies the trap ledger (callbacks by overdue-ness).
// Usage: node tools/plan-levels.mjs > scratch.json   (the result is pasted into src/levels/solo.js)
import { ROOMS } from '../src/levels/rooms.js';
import { composeLevel } from '../src/levels/compose.js';
import { parseLevel } from '../src/core/level.js';

const KIND_ROOMS = {
  fallingFloor: ['pitNear', 'pitTwice'], hiddenSpikes: ['spikePop'], invisibleBlock: ['invisGap'],
  ghostFloor: ['ghostBridge'], chompCoin: ['coinRow', 'coinBait'], icicle: ['icicleHall'], fakeDoor: ['fakeExit'],
  spikeSwap: ['swapRun'], bananaPeel: ['bananaSlide'], risingFloor: ['risingTrap'], rubberChicken: ['chickenSpikes'],
  crusher: ['crusherWalk'], conveyor: ['conveyorSpike'], saw: ['sawTunnel', 'sawPit'], boxingGlove: ['glovePunch'],
  springTrap: ['springCeiling'], hungryFloor: ['hungryGap'], boulder: ['boulderRoll'], closingWall: ['closingHall'],
  pieCannon: ['cannonHall'], controlsFlip: ['flipRoom'], sizeSwell: ['swellHall'], launchFloor: ['launchPad'],
  gravityFlip: ['gravRoom'], shyPlatform: ['shySteps'], fakeCheckpoint: ['fakeFlag'], bluffDoor: ['bluffDoors'],
  portalWall: ['portalUp'], mimicRobot: ['robotCopy'], booGhost: ['ghostChase'], darkCandle: ['candleDark'],
};
const DEBUTS = [
  ['doorRunHome'], ['invisGap', 'spikePop'], ['coinRow', 'ghostBridge'], ['pitNear', 'icicleHall'], ['spikePop', 'fakeExit'],
  'spikeSwap', 'bananaPeel', 'risingFloor', 'rubberChicken', null, 'crusher', 'conveyor', 'saw', 'boxingGlove', null,
  'springTrap', 'hungryFloor', 'boulder', 'closingWall', null, 'pieCannon', 'controlsFlip', 'sizeSwell', 'launchFloor', null,
  'gravityFlip', 'shyPlatform', 'fakeCheckpoint', 'bluffDoor', null, 'portalWall', 'mimicRobot', 'booGhost', 'darkCandle', null,
  null, null, null, null, null, null, null, null, null, null, null, null,
];
const BREATHERS = new Set([9, 14, 19, 24, 29, 34, 39]);
const roomCount = (i) => (i < 5 ? 0 : i < 12 ? 2 : i < 22 ? 3 : i < 34 ? 4 : i < 44 ? 5 : 6) - (BREATHERS.has(i) ? (i < 22 ? 1 : 2) : 0);
const kindsOf = (name) => [...new Set(parseLevel(composeLevel({ name, rooms: [ROOMS[name]()] })).trapDefs.map((t) => t.kind))].filter((k) => k !== 'runningDoor');
const isFinal = (name) => !!ROOMS[name]().final;

const lastSeen = new Map();
const uses = new Map();
const plan = [];
for (let i = 0; i < DEBUTS.length; i++) {
  let rooms;
  const d = DEBUTS[i];
  if (Array.isArray(d)) rooms = [...d];
  else {
    const debutRoom = d ? KIND_ROOMS[d][0] : null;
    const debutKinds = new Set(debutRoom ? kindsOf(debutRoom) : []);
    const n = roomCount(i) - (debutRoom ? 1 : 0);
    const cands = [...lastSeen.keys()].filter((k) => !debutKinds.has(k))
      .sort((a, b) => (lastSeen.get(a) - lastSeen.get(b)) || ((uses.get(a) ?? 0) - (uses.get(b) ?? 0)));
    rooms = [];
    const covered = new Set(debutKinds);
    let finalRoom = null;
    for (const k of cands) {
      if (rooms.length + (finalRoom ? 1 : 0) >= n) break;
      if (covered.has(k)) continue;
      const opts = KIND_ROOMS[k];
      const name = opts[(uses.get(k) ?? 0) % opts.length];
      if (isFinal(name)) { if (debutRoom || finalRoom) continue; finalRoom = name; }
      else rooms.push(name);
      for (const kk of kindsOf(name)) covered.add(kk);
    }
    if (debutRoom) rooms.push(debutRoom);
    else if (finalRoom) rooms.push(finalRoom);
  }
  for (const name of rooms) for (const k of kindsOf(name)) { lastSeen.set(k, i); uses.set(k, (uses.get(k) ?? 0) + 1); }
  plan.push(rooms);
}
console.log(JSON.stringify(plan));
