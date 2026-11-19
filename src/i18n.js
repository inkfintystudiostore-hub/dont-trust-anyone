import { SOLO_TEXT } from './levels/soloText.js';
import { COOP_TEXT } from './levels/coopText.js';
import { ROOM_HINT_TEXT } from './levels/roomHints.js';

// All player-facing text. Add a language by adding a table; `t()` falls back to Hinglish.
const STRINGS = {
  hi: {
    ...SOLO_TEXT,
    ...COOP_TEXT,
    ...ROOM_HINT_TEXT,
    'menu.eyebrow': 'Inkfinity Studio · Game Room',
    'menu.title': "Don't Trust<br>Anyone",
    'menu.sub': 'Floor pe bharosa mat karna. Darwaze pe bhi nahi.',
    'menu.solo': 'Solo khelo',
    'menu.map': 'Level Map',
    'menu.home': 'Home',
    'menu.online': 'Dost ke saath (2P Co-op)',
    'menu.keys': '<kbd>←</kbd> <kbd>→</kbd> chalo · <kbd>↓</kbd> fast-fall · <kbd>Space</kbd> koodo · <kbd>R</kbd> restart · <kbd>M</kbd> map',
    'coop.title': '2-Player Co-op Room',
    'coop.rule': 'Ek mara to DONO restart! Dono door pe pahunchenge tabhi level paar.',
    'coop.tabCreate': 'Room Banao',
    'coop.tabJoin': 'Room Join Karo',
    'coop.nameLabel': 'Tumhara naam',
    'coop.copyCode': 'Code Copy',
    'coop.copyLink': 'Invite Link Copy',
    'coop.levelLabel': 'Level chuno',
    'coop.startL1Note': 'Hamesha Level 1 se shuru! Dono saath milke L1 → L42 end gate tak paar karo.',
    'coop.joinBtn': 'Join Karo',
    'coop.startBtn': 'Match Shuru Karo',
    'coop.waitP2': 'Friend (Mimi) ka intezaar hai… link bhejo!',
    'coop.readyP2': 'Dono taiyaar! Start dabao.',
    'coop.waitHost': 'Room connected! Host ke start karne ka intezaar…',
    'coop.doorWait': '1/2 Door pe — partner ka intezaar!',
    'coop.doorLocked': 'Chabi laao ya Bomb defuse karo pehle!',
    'coop.keyGot': 'Golden Key mil gayi!',
    'coop.defused': 'Bomb Defused! Shaabash team!',
    'coop.gateOpen': 'Gate khul gaya — jaldi niklo!',
    'coop.died': '{name} mar gaya! Dono wapas!',
    'coop.leave': 'Co-op Chhodo',
    'coop.waitAgain': 'Host ke naye match ka intezaar hai…',
    'map.play': 'Is Level Pe Khelo',
    'map.lockedCoop': 'Sirf 2-Player Co-op mein khulega 🔒',
    'world.1': '1 · Candy Meadow',
    'world.2': '2 · Toy Factory',
    'world.3': '3 · Haunted Bakery',
    'world.4': '4 · Mind Games',
    'world.5': '5 · Couple Co-op',
    'end.title': 'Tum jeet gaye?!',
    'end.sub': 'Kul deaths: <b id="end-deaths">0</b>. Kabootar impressed nahi hai.',
    'end.again': 'Phir se khelo',
    'loading.title': 'Momo aa raha hai…',
    'hud.level': 'Level {n}: {name}',
    'hud.cleared': 'Level paar! × {n}',
    'hud.flawless': 'Ek bhi death nahi?! Cheater!',
    'hud.flipped': 'Ulta!',
    'hud.rotate': 'Behtar view ke liye phone ghumao',
    'trap.fakeWin': 'LEVEL COMPLETE!',
    'trap.fakeSave': 'Checkpoint saved!',
    'trap.fakeSaveOops': 'Jhooth tha 😂',
    'trap.gift': 'SURPRISE! 🎁',
    'taunt.10': '10 deaths! Ab thoda dhyan se 😅',
    'taunt.25': '25 deaths! Kabootar popcorn laa raha hai 🍿',
    'taunt.50': '50 deaths! Legend ban gaye tum 💀',

    'taunt.1': 'Phir se? 😂',
    'taunt.2': 'Kabootar bhi hans raha hai 🐦',
    'taunt.3': 'Itna easy level aur tum...',
    'taunt.4': 'Arre yaar 🤦',
    'taunt.5': 'Momo ki mummy ro rahi hai',
  },
};
let lang = 'hi';

/** @example t('hud.level', { n: 2, name: t('l2.name') }) // "Level 2: Upar Mat Dekhna" */
export function t(key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.hi[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

/** Fills every [data-i18n] element (innerHTML is safe: these strings are ours, never user input). */
export function applyI18n(rootEl = document) {
  for (const el of rootEl.querySelectorAll('[data-i18n]')) el.innerHTML = t(el.dataset.i18n);
}
