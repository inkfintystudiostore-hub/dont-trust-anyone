import { describe, it, expect } from 'vitest';
import { parseLevel } from './level.js';
import { LEVELS } from '../levels.js';

describe('all 62 levels across worlds 1-5', () => {
  it('has all 62 levels (Worlds 1-4 + World 5 Couples Co-op)', () => {
    expect(LEVELS.length).toBe(62);
    expect(LEVELS.slice(0, 12).every((l) => l.world === 1)).toBe(true);
    expect(LEVELS.slice(12, 24).every((l) => l.world === 2)).toBe(true);
    expect(LEVELS.slice(24, 36).every((l) => l.world === 3)).toBe(true);
    expect(LEVELS.slice(36, 47).every((l) => l.world === 4)).toBe(true);
    expect(LEVELS.slice(47, 62).every((l) => l.world === 5 && l.coopOnly)).toBe(true);
  });

  it.each(LEVELS.map((l, i) => [i + 1, l]))('level %i parses with start, door and same-width rows', (_, level) => {
    expect(level.start).toBeTruthy();
    expect(level.door).toBeTruthy();
    expect(level.W).toBeGreaterThan(20);
    expect(level.tiles.length).toBe(level.W * level.H);
  });

  it('running doors have a target', () => {
    for (const l of LEVELS) for (const t of l.trapDefs) if (t.kind === 'runningDoor') expect(t.to).toBeTruthy();
  });

  it('throws if a runningDoor stop marker is missing or collides with a trap char', () => {
    expect(() => parseLevel({
      name: 'bad',
      rows: ['P.D..', '#####'],
      traps: [{ at: 'D', runTo: ['Z'] }],
    })).toThrow(/missing.*marker/i);
  });
});
