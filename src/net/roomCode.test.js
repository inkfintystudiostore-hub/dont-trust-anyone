import { describe, it, expect } from 'vitest';
import { formatRoomCode, parseRoomCodeInput, buildRoomShareUrl } from './roomCode.js';

describe('roomCode helpers', () => {
  it('formats 9-digit room codes as XXX-XXX-XXX', () => {
    expect(formatRoomCode('482910375')).toBe('482-910-375');
    expect(formatRoomCode('482-910-375')).toBe('482-910-375');
    expect(formatRoomCode('123')).toBe('123');
  });

  it('parses room codes from raw digits, hyphenated text, or invite URLs', () => {
    expect(parseRoomCodeInput('482910375')).toBe('482910375');
    expect(parseRoomCodeInput(' 482-910-375 ')).toBe('482910375');
    expect(parseRoomCodeInput('https://dont-trust-anyone.inkfintystudio-store.workers.dev/?room=482-910-375')).toBe('482910375');
    expect(parseRoomCodeInput('Join me! https://inkfinitystudio.store/game-room?room=482910375')).toBe('482910375');
    expect(parseRoomCodeInput('?room=12345')).toBeNull();
    expect(parseRoomCodeInput('?uid=123456789&level=5')).toBeNull();
    expect(parseRoomCodeInput('not-a-code')).toBeNull();
  });

  it('builds a valid ?room= share link preserving base origin and stripping old query params', () => {
    const link = buildRoomShareUrl('482910375', 'https://dont-trust-anyone.inkfintystudio-store.workers.dev');
    expect(link).toBe('https://dont-trust-anyone.inkfintystudio-store.workers.dev/?room=482910375');
  });
});
