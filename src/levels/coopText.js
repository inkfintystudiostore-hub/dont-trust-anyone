// Player-facing text for couples co-op levels C1-C15 (Hinglish). Spread into i18n STRINGS.hi.
const L = [
  // [name, sign, taunt1, taunt2, taunt3]
  ['Haath Pakdo', 'Saath chalo', 'Ek ruka, ek gaya. Itna simple tha 😌', 'Plate chhodi, laser chalu', 'Partner pe bharosa? Galti.'],
  ['Ek Ek Karke', 'Pul mazboot hai', 'Pul ne dono ka wazan nahi uthaya 😂', 'Ladies first, ya gents first?', 'Diet pe jao dono'],
  ['Chabi Kiske Paas', 'Darwaza khula hai', 'Chabi ke bina darwaza nahi khulta 🔑', 'Laser ne pyaar tod diya', 'Ek ne pakdi, ek ne chhodi'],
  ['Tik Tik Boom', 'Bomb nakli hai', 'Plate chhodi to defuse bhi gaya 💣', 'Dono bhaage, bomb ruka nahi', 'Teamwork makes the dream... boom'],
  ['Do Rang', 'Laal pehle', 'Galat rang, sahi maut 🎨', 'Hara pehle tha!', 'Rang andhe ho kya dono?'],
  ['Ek Saath Kudo', 'Ek ek karke', 'Ek saath dabaana tha 🤝', '2.5 second, bas itna hi', 'Sync nahi, sink ho gaye'],
  ['Purani Yaadein', 'Sab yaad hai?', 'Kaante bhi yaad, chabi bhi', 'Kela phir se 🍌', 'Bomb ne yaad dilaya'],
  ['Saath Saath', 'Gaddha nahi hai', 'Gaddha khul gaya, rishta bhi', 'Sikke ne kaata, laser ne maara', 'Sync karo, sink nahi'],
  ['Chhat Ka Pyaar', 'Upar mat dekho', 'Chhat girti hai dono pe', 'Pul pe ek hi', 'Chabi upar, dhyan neeche'],
  ['Aara Date', 'Romantic walk', 'Aara beech mein aa gaya 💔', 'Plate pe kaun ruka tha?', 'Bomb ne date cancel ki'],
  ['Kela Couple', 'Healthy couple', 'Dono phisle, ek saath 🍌', 'Do rang, ek galti', 'Sikke kisne uthaye?'],
  ['Bhari Rishta', 'Halka pul', 'Pul phir toota', 'Chhat, pul, chabi, bomb', 'Har kamra ek test'],
  ['Teen Lakeerein', 'Sab laser off', 'Laal, hara, peela, sab chalu', 'Aara + kela = 😵', 'Sync miss, kiss miss'],
  ['Lambi Yaatra', 'Thoda hi bacha', 'Chhe kamre, ek darwaza', 'Chabi bhool gaye?', 'Bomb sab yaad rakhta hai'],
  ['Shaitaan Ki Shaadi', 'Happily ever after', 'Har purana trap baraat mein aaya 😈', 'Aakhri laser, aakhri bharosa', 'Shaadi mubarak, ek aur try?'],
];

export const COOP_TEXT = Object.fromEntries(L.flatMap(([name, sign, t1, t2, t3], i) => [
  [`c${i + 1}.name`, name], [`c${i + 1}.sign`, sign], [`c${i + 1}.t1`, t1], [`c${i + 1}.t2`, t2], [`c${i + 1}.t3`, t3],
]));
