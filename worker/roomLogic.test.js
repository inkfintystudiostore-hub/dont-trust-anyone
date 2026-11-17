import { describe, it, expect } from 'vitest';
import {
  ROOM_IDLE_TTL_MS,
  DISCONNECT_CLOSE_GRACE_MS,
  createRoomRecord,
  joinRoom,
  disconnectPlayer,
  handleRoomAction,
  snapshotForPlayer,
  isRoomExpired,
  getRoomCloseReason,
} from './roomLogic.js';

describe('worker 2-player co-op room state machine', () => {
  it('assigns host (Momo) and guest (Mimi), rejects a 3rd player, and allows deviceId reclaim', () => {
    let room = createRoomRecord('482910375', 0, 1000);
    room = joinRoom(room, 'p1', 'HostBro', 1000, 'dev-1');
    room = joinRoom(room, 'p2', 'MimiSis', 1100, 'dev-2');
    expect(room.seats[0]).toMatchObject({ role: 'host', character: 'momo', playerId: 'p1', playerName: 'HostBro', connected: true });
    expect(room.seats[1]).toMatchObject({ role: 'guest', character: 'mimi', playerId: 'p2', playerName: 'MimiSis', connected: true });

    // 3rd distinct device rejected cleanly
    const after3 = joinRoom(room, 'p3', 'Intruder', 1200, 'dev-3');
    expect(after3.seats.some((s) => s.playerId === 'p3')).toBe(false);

    // P2 disconnects and refreshes page with new session pid but same deviceId -> reclaims seat 1
    const offline = disconnectPlayer(room, 'p2', 1300);
    expect(offline.seats[1].connected).toBe(false);
    const rejoined = joinRoom(offline, 'p2-tab2', 'MimiBack', 1400, 'dev-2');
    expect(rejoined.seats[1]).toMatchObject({ playerId: 'p2-tab2', playerName: 'MimiBack', connected: true });
  });

  it('requires both players connected for host to start, and blocks guest from starting or changing level', () => {
    let room = createRoomRecord('482910375', 30, 1000);
    room = joinRoom(room, 'p1', 'Aryan', 1000, 'dev-1');

    // Only 1 player -> start fails politely
    const rSolo = handleRoomAction(room, 'p1', { type: 'start', levelIndex: 30 }, 1050);
    expect(rSolo.record.started).toBe(false);
    expect(rSolo.reply?.type).toBe('error');

    // Guest joins -> Guest tries to start -> denied
    room = joinRoom(room, 'p2', 'Riya', 1100, 'dev-2');
    const rGuestStart = handleRoomAction(room, 'p2', { type: 'start', levelIndex: 31 }, 1150);
    expect(rGuestStart.record.started).toBe(false);
    expect(rGuestStart.reply?.type).toBe('error');

    // Co-op rooms ALWAYS start at Level 1 (index 0) and unlock forward level by level together
    const rSkip = handleRoomAction(room, 'p1', { type: 'set_level', levelIndex: 41 }, 1200);
    expect(rSkip.record.levelIndex).toBe(0);
    const rStart = handleRoomAction(rSkip.record, 'p1', { type: 'start', levelIndex: 35 }, 1250);
    expect(rStart.record.started).toBe(true);
    expect(rStart.record.levelIndex).toBe(0);
    expect(rStart.record.maxLevelIndex).toBe(0);
    expect(rStart.broadcastSnapshots).toBe(true);
    expect(snapshotForPlayer(rStart.record, 'p1').yourSeat).toBe(0);
    expect(snapshotForPlayer(rStart.record, 'p2').yourSeat).toBe(1);

    // Clearing levels sequentially unlocks forward progress all the way up to L42 (index 41)
    let progressed = rStart.record;
    for (let nxt = 1; nxt <= 41; nxt++) {
      progressed = handleRoomAction(progressed, 'p1', { type: 'event', event: { type: 'win', nextLevel: nxt } }, 1250 + nxt).record;
    }
    expect(progressed.maxLevelIndex).toBe(41);
    const rJump42 = handleRoomAction(progressed, 'p1', { type: 'set_level', levelIndex: 41 }, 1400);
    expect(rJump42.record.levelIndex).toBe(41);
  });

  it('enforces relay authority: only guest relays input (including analog moveX), only host relays state and events', () => {
    let room = createRoomRecord('482910375', 35, 1000);
    expect(room.levelIndex).toBe(0);
    room = joinRoom(room, 'p1', 'P1', 1000, 'dev-1');
    room = joinRoom(room, 'p2', 'P2', 1100, 'dev-2');
    room = handleRoomAction(room, 'p1', { type: 'start', levelIndex: 35 }, 1200).record;

    // Guest spoofing state -> dropped cleanly
    const spoof = handleRoomAction(room, 'p2', { type: 'state', state: { dead: false } }, 1300);
    expect(spoof.relayToOthers).toHaveLength(0);

    // Host sending state -> relayed to Guest
    const hostState = handleRoomAction(room, 'p1', { type: 'state', state: { levelIndex: 0, dead: true } }, 1350);
    expect(hostState.relayToOthers).toHaveLength(1);
    expect(hostState.relayToOthers[0].type).toBe('state');

    // Guest sending analog joystick input -> relayed & clamped [-1..1]
    const guestIn = handleRoomAction(room, 'p2', { type: 'input', left: false, right: true, moveX: 0.65, down: false, jump: true }, 1400);
    expect(guestIn.relayToOthers).toHaveLength(1);
    expect(guestIn.relayToOthers[0]).toMatchObject({ type: 'input', right: true, moveX: 0.65, jump: true });

    // Host trying to send guest-input -> ignored
    const hostIn = handleRoomAction(room, 'p1', { type: 'input', right: true }, 1450);
    expect(hostIn.relayToOthers).toHaveLength(0);

    // Fallback moveX when digital left/right sent without moveX
    const legacyRight = handleRoomAction(room, 'p2', { type: 'input', left: false, right: true, down: false, jump: false }, 1460);
    expect(legacyRight.relayToOthers[0].moveX).toBe(1);

    // Host leaving clears hostId cleanly so seat 0 can be reclaimed by a fresh host
    const afterHostLeave = handleRoomAction(room, 'p1', { type: 'leave' }, 1500);
    expect(afterHostLeave.record.hostId).toBe('');
    expect(afterHostLeave.record.started).toBe(false);
  });

  it('expires idle rooms after 1 minute (ROOM_IDLE_TTL_MS) and disconnected rooms after 30s', () => {
    expect(ROOM_IDLE_TTL_MS).toBe(60_000);
    expect(DISCONNECT_CLOSE_GRACE_MS).toBe(30_000);

    let room = createRoomRecord('482910375', 0, 1000);
    expect(isRoomExpired(room, 1000 + 60_000 - 1)).toBe(false);
    expect(isRoomExpired(room, 1000 + 60_000 + 1)).toBe(true);
    expect(getRoomCloseReason(room, 1000 + 60_000 + 1)).toBe('inactivity');

    room = joinRoom(room, 'p1', 'Momo', 2000, 'd1');
    room = joinRoom(room, 'p2', 'Mimi', 2100, 'd2');
    room = disconnectPlayer(room, 'p2', 3000);
    expect(room.disconnectCloseAt).toBe(3000 + 30_000);
    expect(isRoomExpired(room, 3000 + 29_999)).toBe(false);
    expect(isRoomExpired(room, 3000 + 30_000)).toBe(true);
    expect(getRoomCloseReason(room, 3000 + 30_000)).toBe('partner_left');

    // Rejoining within 30s clears disconnectCloseAt
    const rejoined = joinRoom(room, 'p2', 'Mimi', 5000, 'd2');
    expect(rejoined.disconnectCloseAt).toBeNull();
    expect(isRoomExpired(rejoined, 5000 + 40_000)).toBe(false);

    // Both disconnect -> 'both_left' after 30s
    let bothOff = disconnectPlayer(rejoined, 'p1', 10_000);
    bothOff = disconnectPlayer(bothOff, 'p2', 11_000);
    expect(getRoomCloseReason(bothOff, 10_000 + 30_000)).toBe('both_left');
  });

  it('relays sanitized co-op chat messages and ignores blank ones', () => {
    let room = createRoomRecord('482910375', 0, 1000);
    room = joinRoom(room, 'p1', 'HostBro', 1000, 'dev-1');
    room = joinRoom(room, 'p2', 'MimiSis', 1100, 'dev-2');

    const blank = handleRoomAction(room, 'p1', { type: 'chat', text: '   \n  ' }, 1200);
    expect(blank.relayToOthers).toHaveLength(0);

    const longText = 'a'.repeat(150);
    const sent = handleRoomAction(room, 'p2', { type: 'chat', text: `  ${longText}  ` }, 1300);
    expect(sent.relayToOthers).toHaveLength(1);
    expect(sent.relayToOthers[0]).toMatchObject({
      type: 'chat',
      fromSeat: 1,
      senderName: 'MimiSis',
      text: 'a'.repeat(120),
      at: 1300,
    });
  });
});
