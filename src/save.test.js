import { describe, it, expect } from 'vitest';
import { loadSave, saveProgress, recordWin } from './save.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

describe('save persistence', () => {
  it('keeps a known outfit and rejects unknown ones', () => {
    expect(loadSave(memoryStorage({ 'dta.save.v2': JSON.stringify({ skin: 'fairy' }) })).skin).toBe('fairy');
    expect(loadSave(memoryStorage({ 'dta.save.v2': JSON.stringify({ skin: '../x' }) })).skin).toBe('momo');
  });

  it('returns clean defaults when storage is missing or corrupt', () => {
    expect(loadSave(null)).toEqual({ unlocked: 0, bestDeaths: {}, totalDeaths: 0, muted: false, assist: false, skin: 'momo' });
    const bad = memoryStorage({ 'dta.save.v2': '{broken json' });
    expect(loadSave(bad)).toEqual({ unlocked: 0, bestDeaths: {}, totalDeaths: 0, muted: false, assist: false, skin: 'momo' });

    const poisoned = memoryStorage({
      'dta.save.v2': JSON.stringify({
        unlocked: -5,
        totalDeaths: 'NaN',
        bestDeaths: { 0: '<img src=x onerror=alert(1)>', 1: -2, 2: 4 },
      }),
    });
    expect(loadSave(poisoned)).toEqual({ unlocked: 0, bestDeaths: { 2: 4 }, totalDeaths: 0, muted: false, assist: false, skin: 'momo' });

    const arrBest = memoryStorage({ 'dta.save.v2': JSON.stringify({ bestDeaths: [1, 2] }) });
    expect(loadSave(arrBest).bestDeaths).toEqual({});
  });

  it('unlocks next level, tracks bestDeaths, and survives storage errors', () => {
    const store = memoryStorage();
    let s = loadSave(store);
    s = recordWin(s, 0, 3, 30, store);
    expect(s.unlocked).toBe(1);
    expect(s.bestDeaths[0]).toBe(3);

    s = recordWin(s, 0, 1, 30, store);
    expect(s.bestDeaths[0]).toBe(1);
    s = recordWin(s, 0, 5, 30, store);
    expect(s.bestDeaths[0]).toBe(1);

    const loaded = loadSave(store);
    expect(loaded.unlocked).toBe(1);
    expect(loaded.bestDeaths[0]).toBe(1);

    const throwing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(() => saveProgress(s, throwing)).not.toThrow();
  });
});
