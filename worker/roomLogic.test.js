import { describe, it, expect } from 'vitest';
import {
  ROOM_IDLE_TTL_MS,
  createRoomRecord,
  joinRoom,
  disconnectPlayer,
  handleRoomAction,
  snapshotForPlayer,
  isRoomExpired,
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

    // Host picks L33 (index 32) and starts -> broadcasts start + snapshots
    const rLevel = handleRoomAction(room, 'p1', { type: 'set_level', levelIndex: 32 }, 1200);
    expect(rLevel.record.levelIndex).toBe(32);
    const rStart = handleRoomAction(rLevel.record, 'p1', { type: 'start', levelIndex: 32 }, 1250);
    expect(rStart.record.started).toBe(true);
    expect(rStart.broadcastSnapshots).toBe(true);
    expect(snapshotForPlayer(rStart.record, 'p1').yourSeat).toBe(0);
    expect(snapshotForPlayer(rStart.record, 'p2').yourSeat).toBe(1);
  });

  it('enforces relay authority: only guest relays input, only host relays state and events', () => {
    let room = createRoomRecord('482910375', 0, 1000);
    room = joinRoom(room, 'p1', 'P1', 1000, 'dev-1');
    room = joinRoom(room, 'p2', 'P2', 1100, 'dev-2');
    room = handleRoomAction(room, 'p1', { type: 'start', levelIndex: 0 }, 1200).record;

    // Guest spoofing state -> dropped cleanly
    const spoof = handleRoomAction(room, 'p2', { type: 'state', state: { dead: false } }, 1300);
    expect(spoof.relayToOthers).toHaveLength(0);

    // Host sending state -> relayed to Guest
    const hostState = handleRoomAction(room, 'p1', { type: 'state', state: { levelIndex: 0, dead: true } }, 1350);
    expect(hostState.relayToOthers).toHaveLength(1);
    expect(hostState.relayToOthers[0].type).toBe('state');

    // Guest sending input -> relayed to Host
    const guestIn = handleRoomAction(room, 'p2', { type: 'input', left: false, right: true, down: false, jump: true }, 1400);
    expect(guestIn.relayToOthers).toHaveLength(1);
    expect(guestIn.relayToOthers[0]).toMatchObject({ type: 'input', right: true, jump: true });

    // Host trying to send guest-input -> ignored
    const hostIn = handleRoomAction(room, 'p1', { type: 'input', right: true }, 1450);
    expect(hostIn.relayToOthers).toHaveLength(0);
  });

  it('expires idle rooms after ROOM_IDLE_TTL_MS', () => {
    const room = createRoomRecord('482910375', 0, 1000);
    expect(isRoomExpired(room, 1000 + ROOM_IDLE_TTL_MS - 1)).toBe(false);
    expect(isRoomExpired(room, 1000 + ROOM_IDLE_TTL_MS + 1)).toBe(true);
  });
});
