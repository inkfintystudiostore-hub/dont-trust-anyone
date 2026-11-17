// Callback rule: traps from low levels come back in higher levels, regularly, and never easier.
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../levels.js';
import { ledgerViolations, trapLedger } from './trapLedger.js';
import { parseLevel } from './level.js';

const solo = LEVELS.filter((l) => !l.coopOnly);
const coop = LEVELS.filter((l) => l.coopOnly);
const COOP_RULES = { minAppearances: 3, maxGap: 6, lateWindow: 5, debutCutoff: 10, firstStrict: 6 };

describe('co-op trap ledger', () => {
  it('has no rule violations (co-op puzzles and solo traps both come back)', () => {
    expect(ledgerViolations(coop, COOP_RULES)).toEqual([]);
  });
  it('co-op levels get longer', () => {
    expect(coop[coop.length - 1].W).toBeGreaterThanOrEqual(coop[0].W * 3);
  });
});

describe('solo trap ledger', () => {
  it('has no rule violations', () => {
    expect(ledgerViolations(solo)).toEqual([]);
  });
  it('every trap kind used solo appears in at least 3 levels', () => {
    for (const [, { levels }] of trapLedger(solo)) expect(levels.length).toBeGreaterThanOrEqual(3);
  });
  it('levels get longer: the finale is at least 5x the first level', () => {
    expect(solo[solo.length - 1].W).toBeGreaterThanOrEqual(solo[0].W * 5);
  });
  it('flags a trap that never comes back and a parameter that gets easier', () => {
    const mk = (name, row, traps = []) => parseLevel({ name, rows: ['P' + row + 'D', '#'.repeat(row.length + 2)], traps });
    const levels = [
      mk('a', '..S..', [{ at: 'S', delay: 0.1 }]),
      mk('b', '..S..', [{ at: 'S', delay: 0.2 }]),
      mk('c', '..C..'),
    ];
    const v = ledgerViolations(levels, { minAppearances: 2, firstStrict: 99 });
    expect(v.some((s) => s.includes('hiddenSpikes.delay easier'))).toBe(true);
    expect(v.some((s) => s.startsWith('chompCoin: only 1'))).toBe(true);
  });
});
