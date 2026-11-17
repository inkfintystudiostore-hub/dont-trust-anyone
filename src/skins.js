// Outfits for the hero. Same faceless body; eyes are drawn by code (momo.js) at `eyeY` (fraction of height).
// h = model height in world units (hair/wings add height, so costumes get a little more room).
export const SKINS = [
  { id: 'momo', name: 'Momo', tag: 'Original', h: 0.95, eyeY: 0.6 },
  { id: 'naruto', name: 'Naruto', tag: 'Ninja', h: 1.05, eyeY: 0.5 },
  { id: 'gojo', name: 'Gojo', tag: 'Sorcerer', h: 1.05, eyeY: 0.5 },
  { id: 'goku', name: 'Goku', tag: 'Saiyan', h: 1.1, eyeY: 0.5 },
  { id: 'doraemon', name: 'Doraemon', tag: 'Robot cat', h: 0.95, eyeY: 0.62 },
  { id: 'princess', name: 'Princess', tag: 'Royal', h: 1.05, eyeY: 0.55 },
  { id: 'dumpling', name: 'Dumpling', tag: 'Yummy', h: 0.95, eyeY: 0.62 },
  { id: 'fairy', name: 'Fairy', tag: 'Magic', h: 1, eyeY: 0.56 },
];

export const SKIN_IDS = new Set(SKINS.map((s) => s.id));
export const getSkin = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];
