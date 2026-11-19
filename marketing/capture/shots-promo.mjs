// Solo "unpredictable" promo: hold-right Momo walking happily into each level's first betrayal.
const ids = [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 22, 23, 24, 26, 28, 29, 31, 33, 34];
export const SHOTS = ids.map((level) => ({ id: `p${String(level).padStart(2, '0')}`, level, maxSec: 11, tail: 30, ctrl: 'return [R];' }));
