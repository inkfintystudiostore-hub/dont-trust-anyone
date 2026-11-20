// Outfits for the hero. Same faceless body; eyes are drawn by code (momo.js) at `eyeY` (fraction of height).
// h = model height in world units (hair/wings add height, so costumes get a little more room).
export const SKINS = [
  { id: 'momo', name: 'Momo', tag: 'Original', h: 0.95, eyeY: 0.6 },
  { id: 'naruto', name: 'Shinobi', tag: 'Ninja', h: 1.05, eyeY: 0.62 },
  { id: 'gojo', name: 'Void Mage', tag: 'Sorcerer', h: 1.05, eyeY: 0.66, eyeColor: '#7fd8ff' },
  { id: 'goku', name: 'Super Fighter', tag: 'Martial Artist', h: 1.1, eyeY: 0.5 },
  { id: 'doraemon', name: 'Robo-Cat', tag: 'Future Cat', h: 0.95, eyeY: 0.62 },
  { id: 'princess', name: 'Princess', tag: 'Royal', h: 1.05, eyeY: 0.55 },
  { id: 'dumpling', name: 'Dumpling', tag: 'Yummy', h: 0.95, eyeY: 0.62 },
  { id: 'fairy', name: 'Fairy', tag: 'Magic', h: 1, eyeY: 0.56 },
];

export const SKIN_IDS = new Set(SKINS.map((s) => s.id));
export const getSkin = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];
