// All levels: solo L1-L47 (src/levels/solo.js) then couples co-op L48-L62 (src/levels/coop.js).
// Format: see src/core/level.js and src/levels/compose.js. Text fields are i18n keys (src/i18n.js).
import { parseLevel } from './core/level.js';
import { SOLO_RAW } from './levels/solo.js';
import { COOP_RAW } from './levels/coop.js';

export const RAW_LEVELS = [...SOLO_RAW, ...COOP_RAW];
export const LEVELS = RAW_LEVELS.map(parseLevel);
export const GENERIC_TAUNTS = ['taunt.1', 'taunt.2', 'taunt.3', 'taunt.4', 'taunt.5'];
