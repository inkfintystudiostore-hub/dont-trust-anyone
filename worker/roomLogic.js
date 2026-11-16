/**
 * Authoritative 2-player Co-op room state machine shared between DontTrustRoomDO and Vitest.
 * Manages host (Momo) + guest (Mimi) seats, device reclaim on refresh, level selection, and relay permissions.
 */
export const ROOM_IDLE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LEVEL_INDEX = 34;

function sanitizeName(raw) {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 18);
  return cleaned.length > 0 ? cleaned : undefined;
}

function clampLevelIndex(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL_INDEX, Math.floor(n)));
}

export function createRoomRecord(code, levelIndex = 0, now = Date.now()) {
  return {
    code,
    levelIndex: clampLevelIndex(levelIndex),
    started: false,
    hostId: '',
    lastActiveAt: now,
    seats: [
      { seat: 0, role: 'host', character: 'momo', occupant: 'open', playerId: null, playerName: undefined, connected: false },
      { seat: 1, role: 'guest', character: 'mimi', occupant: 'open', playerId: null, playerName: undefined, connected: false },
    ],
    seatDeviceIds: {},
  };
}

export function isRoomExpired(record, now = Date.now()) {
  if (!record) return false;
  if (!record.lastActiveAt) return false;
  return now - record.lastActiveAt > ROOM_IDLE_TTL_MS;
}

export function isRoomCodeOccupied(record, now = Date.now()) {
  return Boolean(record && !isRoomExpired(record, now));
}

export function joinRoom(record, playerId, rawName, now = Date.now(), deviceId) {
  const playerName = sanitizeName(rawName);
  const seats = record.seats.map((s) => ({ ...s }));
  const seatDeviceIds = { ...(record.seatDeviceIds ?? {}) };
  let hostId = record.hostId;

  // 1. Existing session playerId reconnect
  let idx = seats.findIndex((s) => s.playerId === playerId);

  // 2. Persistent deviceId reclaim (page reload on same browser)
  if (idx < 0 && deviceId) {
    const claimedSeat = seats.findIndex((s) => seatDeviceIds[s.seat] === deviceId && !s.connected);
    if (claimedSeat >= 0) idx = claimedSeat;
  }

  // 3. Reclaim disconnected open/dropped seat or join open seat
  if (idx < 0) {
    idx = seats.findIndex((s) => s.occupant === 'open');
  }
  if (idx < 0 && !record.started) {
    idx = seats.findIndex((s) => !s.connected);
  }
  if (idx < 0) {
    return record; // Room full (2/2 humans)
  }

  seats[idx] = {
    ...seats[idx],
    occupant: 'human',
    playerId,
    playerName: playerName ?? seats[idx].playerName,
    connected: true,
  };
  if (idx === 0) hostId = playerId;
  if (deviceId) seatDeviceIds[idx] = deviceId;

  return {
    ...record,
    hostId,
    seats,
    seatDeviceIds,
    lastActiveAt: now,
  };
}

export function disconnectPlayer(record, playerId, now = Date.now()) {
  const idx = record.seats.findIndex((s) => s.playerId === playerId);
  if (idx < 0) return record;
  const seats = record.seats.map((s, i) => (i === idx ? { ...s, connected: false } : s));
  return { ...record, seats, lastActiveAt: now };
}

export function markDisconnectedIfMissingSockets(record, activePlayerIds, now = Date.now()) {
  let changed = false;
  const seats = record.seats.map((s) => {
    if (s.occupant === 'human' && s.connected && s.playerId && !activePlayerIds.has(s.playerId)) {
      changed = true;
      return { ...s, connected: false };
    }
    return s;
  });
  return changed ? { ...record, seats, lastActiveAt: now } : record;
}

export function snapshotForPlayer(record, playerId) {
  const seatObj = record.seats.find((s) => s.playerId === playerId) ?? null;
  return {
    code: record.code,
    levelIndex: record.levelIndex,
    started: record.started,
    seats: record.seats.map((s) => ({
      seat: s.seat,
      role: s.role,
      character: s.character,
      occupant: s.occupant,
      playerName: s.playerName ?? (s.seat === 0 ? 'Momo (Host)' : 'Mimi (P2)'),
      connected: s.connected,
    })),
    yourSeat: seatObj ? seatObj.seat : null,
    isHost: Boolean(seatObj && seatObj.seat === 0),
  };
}

export function handleRoomAction(record, playerId, msg, now = Date.now()) {
  const seatIndex = record.seats.findIndex((s) => s.playerId === playerId);
  const noop = { record, persist: false, broadcastSnapshots: false, relayToOthers: [], broadcast: [] };
  if (seatIndex < 0) return noop;

  switch (msg.type) {
    case 'set_name': {
      const name = sanitizeName(msg.name);
      const seats = record.seats.map((s, i) => (i === seatIndex ? { ...s, playerName: name } : s));
      return {
        record: { ...record, seats, lastActiveAt: now },
        persist: true,
        broadcastSnapshots: true,
        relayToOthers: [],
        broadcast: [],
      };
    }
    case 'set_level': {
      if (seatIndex !== 0) {
        return { ...noop, reply: { type: 'error', message: 'Only the Host can change the level.' } };
      }
      const next = { ...record, levelIndex: clampLevelIndex(msg.levelIndex), lastActiveAt: now };
      return { record: next, persist: true, broadcastSnapshots: true, relayToOthers: [], broadcast: [] };
    }
    case 'start': {
      if (seatIndex !== 0) {
        return { ...noop, reply: { type: 'error', message: 'Only the Host can start the co-op match.' } };
      }
      const bothReady = record.seats.every((s) => s.occupant === 'human' && s.connected);
      if (!bothReady) {
        return { ...noop, reply: { type: 'error', message: 'Waiting for Player 2 (Mimi) to join.' } };
      }
      const levelIndex = msg.levelIndex !== undefined ? clampLevelIndex(msg.levelIndex) : record.levelIndex;
      const next = { ...record, levelIndex, started: true, lastActiveAt: now };
      return {
        record: next,
        persist: true,
        broadcastSnapshots: true,
        relayToOthers: [],
        broadcast: [{ type: 'started', levelIndex }],
      };
    }
    case 'input': {
      // Only Guest (seat 1) streams remote player input to Host (seat 0).
      if (seatIndex !== 1 || !record.started) return noop;
      const payload = {
        type: 'input',
        seq: Number(msg.seq) || 0,
        left: !!msg.left,
        right: !!msg.right,
        down: !!msg.down,
        jump: !!msg.jump,
      };
      return { record, persist: false, broadcastSnapshots: false, relayToOthers: [payload], broadcast: [] };
    }
    case 'state': {
      // Only Host (seat 0) pushes authoritative simulation snapshots.
      if (seatIndex !== 0 || !record.started || !msg.state) return noop;
      return {
        record,
        persist: false,
        broadcastSnapshots: false,
        relayToOthers: [{ type: 'state', state: msg.state }],
        broadcast: [],
      };
    }
    case 'event': {
      // Only Host (seat 0) broadcasts canonical simulation events (death, win, trap, doorWait, respawn).
      if (seatIndex !== 0 || !record.started || !msg.event) return noop;
      const next = msg.event?.type === 'win' && Number.isFinite(msg.event.nextLevel)
        ? { ...record, levelIndex: clampLevelIndex(msg.event.nextLevel), lastActiveAt: now }
        : record;
      return {
        record: next,
        persist: next !== record,
        broadcastSnapshots: false,
        relayToOthers: [{ type: 'event', event: msg.event }],
        broadcast: [],
      };
    }
    case 'restart': {
      if (!record.started) return noop;
      return {
        record: { ...record, lastActiveAt: now },
        persist: false,
        broadcastSnapshots: false,
        relayToOthers: [{ type: 'restart', by: seatIndex }],
        broadcast: [],
      };
    }
    case 'emote': {
      const code = sanitizeName(msg.emote) ?? 'wave';
      return {
        record,
        persist: false,
        broadcastSnapshots: false,
        relayToOthers: [{ type: 'emote', fromSeat: seatIndex, emote: code }],
        broadcast: [],
      };
    }
    case 'leave': {
      const seats = record.seats.map((s, i) => (
        i === seatIndex
          ? { ...s, occupant: 'open', playerId: null, playerName: undefined, connected: false }
          : s
      ));
      const seatDeviceIds = { ...(record.seatDeviceIds ?? {}) };
      delete seatDeviceIds[seatIndex];
      const next = { ...record, seats, seatDeviceIds, started: false, lastActiveAt: now };
      return {
        record: next,
        persist: true,
        broadcastSnapshots: true,
        relayToOthers: [],
        broadcast: [{ type: 'peer_left', seat: seatIndex }],
      };
    }
    default:
      return noop;
  }
}
