import { describe, it, expect } from 'vitest';
import {
  createSessionToken,
  resolveAuthSecret,
  validatePassword,
  verifySessionToken,
} from './authHelpers.js';
import { verifyRazorpaySignature, verifyRazorpayWebhookSignature } from './payments.js';
import { createRoomRecord, handleRoomAction, joinRoom } from './roomLogic.js';

describe('worker security hardening', () => {
  it('enforces 8+ character passwords', () => {
    expect(validatePassword('123456').ok).toBe(false);
    expect(validatePassword('1234567').ok).toBe(false);
    expect(validatePassword('12345678').ok).toBe(true);
  });

  it('fails closed on missing AUTH_SECRET in production and allows localhost dev fallback', async () => {
    expect(resolveAuthSecret({}, 'https://dta.inkfinitystudio.store/api/auth/login')).toBeNull();
    const localSecret = resolveAuthSecret({}, 'http://localhost:8787/api/auth/login');
    expect(typeof localSecret).toBe('string');
    expect(localSecret.length).toBeGreaterThanOrEqual(32);

    const token = await createSessionToken(
      { accountId: 'a1', username: 'momo', displayName: 'Momo', walletId: 'acct:a1' },
      'prod-secret-123',
      1000,
    );
    expect(await verifySessionToken(token, 'prod-secret-123', 2000)).toMatchObject({
      accountId: 'a1',
      walletId: 'acct:a1',
    });
    expect(await verifySessionToken(token, null, 2000)).toBeNull();
    expect(await verifySessionToken(token, 'wrong-secret', 2000)).toBeNull();
  });

  it('verifies Razorpay payment & webhook HMAC signatures', async () => {
    const secret = 'test_rzp_secret';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('order_1|pay_1'));
    const sigHex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(await verifyRazorpaySignature('order_1', 'pay_1', sigHex, secret)).toBe(true);
    expect(await verifyRazorpaySignature('order_1', 'pay_2', sigHex, secret)).toBe(false);
    expect(await verifyRazorpayWebhookSignature('order_1|pay_1', sigHex, secret)).toBe(true);
    expect(await verifyRazorpayWebhookSignature('tampered', sigHex, secret)).toBe(false);
  });

  it('rejects malformed state, event, and rtc_signal payloads in roomLogic', () => {
    let room = createRoomRecord('123456789', 0, 1000);
    room = joinRoom(room, 'p1', 'Host', 1000, 'd1');
    room = joinRoom(room, 'p2', 'Guest', 1100, 'd2');
    room = handleRoomAction(room, 'p1', { type: 'start' }, 1200).record;

    expect(handleRoomAction(room, 'p1', { type: 'state', state: ['not-an-object'] }, 1300).relayToOthers).toHaveLength(0);
    expect(handleRoomAction(room, 'p2', { type: 'guest_state', state: 'bad' }, 1300).relayToOthers).toHaveLength(0);
    expect(handleRoomAction(room, 'p1', { type: 'event', event: { noType: true } }, 1300).relayToOthers).toHaveLength(0);
    expect(handleRoomAction(room, 'p1', { type: 'rtc_signal', signal: { foo: 'bar' } }, 1300).relayToOthers).toHaveLength(0);
    expect(handleRoomAction(room, 'p1', { type: 'rtc_signal', signal: { candidate: { candidate: 'c' } } }, 1300).relayToOthers).toHaveLength(1);
  });
});
