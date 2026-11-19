import { describe, it, expect } from 'vitest';
import { encodeFastPacket, decodeFastPacket } from './binaryCodec.js';

describe('binaryCodec', () => {
  it('round-trips net_ping and net_pong in 9 bytes', () => {
    const ping = { type: 'net_ping', t: 123456.789 };
    const pingBuf = encodeFastPacket(ping);
    expect(pingBuf).toBeInstanceOf(ArrayBuffer);
    expect(pingBuf.byteLength).toBe(9);
    expect(decodeFastPacket(pingBuf)).toEqual(ping);

    const pong = { type: 'net_pong', t: 987654.321 };
    const pongBuf = encodeFastPacket(pong);
    expect(pongBuf.byteLength).toBe(9);
    expect(decodeFastPacket(pongBuf)).toEqual(pong);
  });

  it('round-trips input packets with optional redundant history', () => {
    const msg = {
      type: 'input',
      seq: 42,
      input: { left: false, right: true, jump: true, action: false, down: true },
    };
    const buf = encodeFastPacket(msg);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(7);
    expect(decodeFastPacket(buf)).toEqual(msg);

    const withHistory = {
      ...msg,
      history: [
        { left: false, right: true, jump: false, action: false, down: false },
        { left: true, right: false, jump: false, action: false, down: false },
        { left: false, right: false, jump: false, action: false, down: false },
      ],
    };
    const histBuf = encodeFastPacket(withHistory);
    expect(histBuf.byteLength).toBe(10);
    expect(decodeFastPacket(histBuf)).toEqual(withHistory);
  });

  it('round-trips guest_state packets in 26 bytes', () => {
    const msg = {
      type: 'guest_state',
      state: {
        simTick: 1200,
        ackSeq: 41,
        x: 12.5,
        y: -3.25,
        vx: 4.5,
        vy: -8.75,
        grounded: true,
        dead: false,
        facing: -1,
      },
    };
    const buf = encodeFastPacket(msg);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(26);
    const decoded = decodeFastPacket(buf);
    expect(decoded.type).toBe('guest_state');
    expect(decoded.state.simTick).toBe(1200);
    expect(decoded.state.ackSeq).toBe(41);
    expect(decoded.state.x).toBeCloseTo(12.5, 4);
    expect(decoded.state.y).toBeCloseTo(-3.25, 4);
    expect(decoded.state.vx).toBeCloseTo(4.5, 4);
    expect(decoded.state.vy).toBeCloseTo(-8.75, 4);
    expect(decoded.state.grounded).toBe(true);
    expect(decoded.state.dead).toBe(false);
    expect(decoded.state.facing).toBe(-1);
  });

  it('returns null for unsupported message types so caller falls back to JSON', () => {
    expect(encodeFastPacket({ type: 'state', state: { traps: [] } })).toBeNull();
    expect(encodeFastPacket(null)).toBeNull();
    expect(decodeFastPacket(new ArrayBuffer(0))).toBeNull();
  });
});
