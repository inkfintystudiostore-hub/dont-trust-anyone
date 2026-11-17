// Solo levels L1-L47, Level Devil style: each level chains one-screen rooms (see rooms.js).
// Schedule from tools/plan-levels.mjs: one debut per level from L6 (last room = the new trick),
// every earlier trap comes back within 8 levels, harder each time (h grows with the level number).
// Text keys: s<N>.name / s<N>.sign / s<N>.t1..t3 in src/levels/soloText.js.
import { ROOMS } from './rooms.js';
import { composeLevel } from './compose.js';

// [rooms..., debut room is last when the level introduces a trap]; null debut = callback-only level
const SCHEDULE = [
  { rooms: ['doorRunHome'], debut: true }, // L1 fallingFloor
  { rooms: ['invisGap', 'spikePop'], debut: true }, // L2 invisibleBlock + hiddenSpikes
  { rooms: ['coinRow', 'ghostBridge'], debut: true }, // L3 chompCoin + ghostFloor
  { rooms: ['pitNear', 'icicleHall'], debut: true }, // L4 icicle (pit opens as you approach)
  { rooms: ['spikePop', 'fakeExit'], debut: true }, // L5 fakeDoor
  { rooms: ['invisGap', 'swapRun'], debut: true }, // L6 spikeSwap
  { rooms: ['coinBait', 'bananaSlide'], debut: true }, // L7 bananaPeel
  { rooms: ['ghostBridge', 'risingTrap'], debut: true }, // L8 risingFloor
  { rooms: ['icicleHall', 'chickenSpikes'], debut: true }, // L9 rubberChicken
  { rooms: ['fakeExit', 'swapRun'], breather: true }, // L10
  { rooms: ['invisGap', 'crusherWalk'], debut: true }, // L11 crusher
  { rooms: ['bananaSlide', 'conveyorSpike'], debut: true }, // L12 conveyor
  { rooms: ['coinRow', 'risingTrap', 'sawTunnel'], debut: true }, // L13 saw
  { rooms: ['ghostBridge', 'chickenSpikes', 'glovePunch'], debut: true }, // L14 boxingGlove
  { rooms: ['icicleHall', 'swapRun'], breather: true }, // L15
  { rooms: ['fakeExit', 'crusherWalk', 'springCeiling'], debut: true }, // L16 springTrap
  { rooms: ['invisGap', 'conveyorSpike', 'hungryGap'], debut: true }, // L17 hungryFloor
  { rooms: ['bananaSlide', 'sawPit', 'boulderRoll'], debut: true }, // L18 boulder
  { rooms: ['risingTrap', 'glovePunch', 'closingHall'], debut: true }, // L19 closingWall
  { rooms: ['chickenSpikes', 'ghostBridge', 'swapRun'], breather: true }, // L20
  { rooms: ['icicleHall', 'springCeiling', 'cannonHall'], debut: true }, // L21 pieCannon
  { rooms: ['crusherWalk', 'fakeExit', 'flipRoom'], debut: true }, // L22 controlsFlip
  { rooms: ['hungryGap', 'conveyorSpike', 'invisGap', 'swellHall'], debut: true }, // L23 sizeSwell
  { rooms: ['boulderRoll', 'sawTunnel', 'bananaSlide', 'launchPad'], debut: true }, // L24 launchFloor
  { rooms: ['closingHall', 'swapRun'], breather: true }, // L25
  { rooms: ['glovePunch', 'risingTrap', 'chickenSpikes', 'gravRoom'], debut: true }, // L26 gravityFlip
  { rooms: ['ghostBridge', 'cannonHall', 'springCeiling', 'shySteps'], debut: true }, // L27 shyPlatform
  { rooms: ['icicleHall', 'flipRoom', 'crusherWalk', 'fakeFlag'], debut: true }, // L28 fakeCheckpoint
  { rooms: ['fakeExit', 'swellHall', 'hungryGap', 'bluffDoors'], debut: true }, // L29 bluffDoor
  { rooms: ['launchPad', 'boulderRoll', 'swapRun'], breather: true }, // L30
  { rooms: ['sawPit', 'closingHall', 'gravRoom', 'portalUp'], debut: true }, // L31 portalWall
  { rooms: ['glovePunch', 'risingTrap', 'shySteps', 'robotCopy'], debut: true }, // L32 mimicRobot
  { rooms: ['cannonHall', 'fakeFlag', 'flipRoom', 'ghostChase'], debut: true }, // L33 booGhost
  { rooms: ['icicleHall', 'swellHall', 'hungryGap', 'candleDark'], debut: true }, // L34 darkCandle
  { rooms: ['boulderRoll', 'fakeExit', 'swapRun'], breather: true }, // L35
  { rooms: ['launchPad', 'gravRoom', 'closingHall', 'sawTunnel', 'bluffDoors'] }, // L36
  { rooms: ['robotCopy', 'shySteps', 'glovePunch', 'risingTrap', 'portalUp'] }, // L37
  { rooms: ['ghostChase', 'fakeFlag', 'cannonHall', 'flipRoom', 'candleDark'] }, // L38
  { rooms: ['swellHall', 'hungryGap', 'icicleHall', 'fakeExit', 'swapRun'] }, // L39
  { rooms: ['launchPad', 'gravRoom', 'bluffDoors'], breather: true }, // L40
  { rooms: ['closingHall', 'sawPit', 'robotCopy', 'shySteps', 'portalUp'] }, // L41
  { rooms: ['glovePunch', 'risingTrap', 'ghostChase', 'candleDark', 'fakeFlag'] }, // L42
  { rooms: ['cannonHall', 'flipRoom', 'swellHall', 'boulderRoll', 'swapRun'] }, // L43
  { rooms: ['icicleHall', 'fakeExit', 'launchPad', 'gravRoom', 'bluffDoors'] }, // L44
  { rooms: ['robotCopy', 'shySteps', 'closingHall', 'sawTunnel', 'ghostChase', 'portalUp'] }, // L45
  { rooms: ['candleDark', 'fakeFlag', 'glovePunch', 'risingTrap', 'cannonHall', 'flipRoom'] }, // L46
  { rooms: ['swellHall', 'hungryGap', 'launchPad', 'gravRoom', 'icicleHall', 'swapRun'] }, // L47 finale
];

const worldOf = (i) => (i < 12 ? 1 : i < 24 ? 2 : i < 36 ? 3 : 4);
const LAST = SCHEDULE.length - 1;

export const SOLO_RAW = SCHEDULE.map(({ rooms, debut, breather }, i) => {
  const n = i + 1;
  const h = i / LAST;
  return composeLevel({
    name: `s${n}.name`,
    world: worldOf(i),
    breather: !!breather,
    // the debut room teaches at h=0; every callback room is tuned to this level's hardness
    // L1-L5 are all debuts: everything at h=0
    rooms: rooms.map((r, k) => ({ id: r, ...ROOMS[r]({ h: i < 5 || (debut && k === rooms.length - 1) ? 0 : h }) })),
    signs: [{ x: 4.5, text: `s${n}.sign` }],
    taunts: [`s${n}.t1`, `s${n}.t2`, `s${n}.t3`],
  });
});
