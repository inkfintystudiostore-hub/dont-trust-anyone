/**
 * WebSocket room transport client for 2-player Online Co-op powered by Cloudflare Durable Objects.
 * Mirrors 3D Ludo's resilient heartbeat + auto-reconnect + deviceId reclaim flow.
 */
import {
  clearRoomFromBrowserUrl,
  notifyParentRoomCode,
  parseRoomCodeInput,
  resolveWorkerHttpOrigin,
  resolveWorkerWsOrigin,
} from './roomCode.js';

const NAME_KEY = 'dta.coop.name';
const PID_KEY = 'dta.coop.pid';
const DID_KEY = 'dta.coop.did';
const HEARTBEAT_MS = 15_000;
const PONG_TIMEOUT_MS = 5_000;
const REJECTED_CLOSE_CODES = new Set([4003, 4004]);

let cachedPid = null;
let cachedDid = null;

function getPlayerId() {
  if (cachedPid) return cachedPid;
  try {
    const existing = sessionStorage.getItem(PID_KEY);
    if (existing) return (cachedPid = existing);
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(PID_KEY, fresh);
    return (cachedPid = fresh);
  } catch {
    return (cachedPid = `tab-${Math.random().toString(36).slice(2, 10)}`);
  }
}

function getDeviceId() {
  if (cachedDid) return cachedDid;
  try {
    const existing = localStorage.getItem(DID_KEY);
    if (existing) return (cachedDid = existing);
    const fresh = crypto.randomUUID();
    localStorage.setItem(DID_KEY, fresh);
    return (cachedDid = fresh);
  } catch {
    return (cachedDid = getPlayerId());
  }
}

export function loadCoopName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function saveCoopName(name) {
  try {
    const clean = String(name ?? '').trim().slice(0, 18);
    if (clean) localStorage.setItem(NAME_KEY, clean);
    else localStorage.removeItem(NAME_KEY);
  } catch { /* ignore */ }
}

/** Reserves an unused 9-digit co-op room code from the Worker API. */
export async function reserveCoopRoom(levelIndex = 0) {
  try {
    const res = await fetch(`${resolveWorkerHttpOrigin()}/api/rooms/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelIndex }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && /^\d{9}$/.test(data.code)) return { ok: true, code: data.code };
      if (data?.error) return { ok: false, error: data.error };
    }
  } catch {
    // Fall through to error return.
  }
  return { ok: false, error: 'Room server unavailable. Check connection and try again.' };
}

/** Opens and manages a persistent 2-player room WebSocket session. */
export function createCoopSession(handlers) {
  let socket = null;
  let activeParams = null;
  let intentionalClose = false;
  let reconnectTimer = 0;
  let heartbeatTimer = 0;
  let pongTimer = 0;
  let attempt = 0;
  let connectedOnce = false;

  const send = (msg) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  };

  const clearTimers = () => {
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
    clearTimeout(pongTimer);
    reconnectTimer = 0;
    heartbeatTimer = 0;
    pongTimer = 0;
  };

  const closeSocket = (sendLeave) => {
    clearTimers();
    if (!socket) return;
    const old = socket;
    socket = null;
    try {
      if (sendLeave && old.readyState === WebSocket.OPEN) old.send(JSON.stringify({ type: 'leave' }));
      old.close(1000, 'Client left room');
    } catch { /* ignore */ }
  };

  const open = (params) => {
    closeSocket(false);
    const cleanCode = parseRoomCodeInput(params.code);
    if (!cleanCode) {
      handlers.onError?.('Invalid 9-digit room code.');
      return;
    }
    activeParams = { ...params, code: cleanCode };
    intentionalClose = false;

    const pid = getPlayerId();
    const did = getDeviceId();
    const cleanName = (params.playerName ?? loadCoopName()).trim().slice(0, 18);
    const nameQ = cleanName ? `&name=${encodeURIComponent(cleanName)}` : '';
    const intent = params.role === 'host' ? 'create' : 'join';
    const wsUrl = `${resolveWorkerWsOrigin()}/ws/room/${cleanCode}?pid=${encodeURIComponent(pid)}&did=${encodeURIComponent(did)}&level=${params.levelIndex ?? 0}&intent=${intent}${nameQ}`;

    handlers.onStatus?.('connecting', 'Connecting to Cloudflare room…');
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      handlers.onStatus?.('offline', 'WebSocket unavailable.');
      return;
    }
    socket = ws;

    ws.addEventListener('open', () => {
      if (socket !== ws) return;
      attempt = 0;
      connectedOnce = true;
      notifyParentRoomCode(cleanCode);
      handlers.onStatus?.('connected', 'Connected to live room');
      send({ type: 'join', playerId: pid, name: cleanName || undefined, deviceId: did });
      heartbeatTimer = setInterval(() => {
        if (socket !== ws || ws.readyState !== WebSocket.OPEN) return;
        send({ type: 'ping' });
        clearTimeout(pongTimer);
        pongTimer = setTimeout(() => {
          if (socket === ws && !intentionalClose) open(activeParams);
        }, PONG_TIMEOUT_MS);
      }, HEARTBEAT_MS);
    });

    ws.addEventListener('message', (ev) => {
      if (socket !== ws) return;
      clearTimeout(pongTimer);
      pongTimer = 0;
      let data;
      try { data = JSON.parse(String(ev.data)); } catch { return; }
      switch (data.type) {
        case 'pong': break;
        case 'snapshot':
          if (activeParams) {
            activeParams.role = data.snapshot.isHost ? 'host' : 'guest';
            activeParams.levelIndex = data.snapshot.levelIndex;
          }
          handlers.onSnapshot?.(data.snapshot);
          break;
        case 'started': handlers.onStarted?.(data.levelIndex); break;
        case 'input': handlers.onGuestInput?.(data); break;
        case 'state': handlers.onStateSync?.(data.state); break;
        case 'event': handlers.onEventSync?.(data.event); break;
        case 'restart': handlers.onRestart?.(data.by); break;
        case 'emote': handlers.onEmote?.(data.fromSeat, data.emote); break;
        case 'peer_left': handlers.onPeerLeft?.(data.seat); break;
        case 'room_closed':
          intentionalClose = true;
          activeParams = null;
          connectedOnce = false;
          clearTimers();
          notifyParentRoomCode(null);
          clearRoomFromBrowserUrl();
          handlers.onRoomClosed?.(data.reason, data.message);
          break;
        case 'error': handlers.onError?.(data.message); break;
        default: break;
      }
    });

    ws.addEventListener('close', (ev) => {
      if (socket !== ws) return;
      clearTimers();
      socket = null;
      if (intentionalClose) return;
      if (REJECTED_CLOSE_CODES.has(ev.code)) {
        activeParams = null;
        connectedOnce = false;
        notifyParentRoomCode(null);
        clearRoomFromBrowserUrl();
        handlers.onStatus?.('rejected', ev.reason || 'Could not join room.');
        return;
      }
      if (!activeParams) return;
      attempt += 1;
      const delay = Math.min(8000, 900 * Math.pow(1.4, attempt - 1));
      handlers.onStatus?.('reconnecting', connectedOnce ? 'Reconnecting to room…' : 'Waking room server…');
      reconnectTimer = setTimeout(() => { if (!intentionalClose && activeParams) open(activeParams); }, delay);
    });
  };

  return {
    connect: open,
    leave() {
      intentionalClose = true;
      activeParams = null;
      connectedOnce = false;
      closeSocket(true);
      notifyParentRoomCode(null);
      clearRoomFromBrowserUrl();
    },
    isConnected: () => Boolean(socket && socket.readyState === WebSocket.OPEN),
    setName: (name) => send({ type: 'set_name', name }),
    setLevel: (levelIndex) => send({ type: 'set_level', levelIndex }),
    startMatch: (levelIndex) => send({ type: 'start', levelIndex }),
    sendInput: (inp, seq = 0) => send({
      type: 'input',
      seq,
      left: !!inp.left,
      right: !!inp.right,
      moveX: Math.round((Number(inp.moveX) || 0) * 100) / 100,
      down: !!inp.down,
      jump: !!inp.jump,
    }),
    sendState: (state) => send({ type: 'state', state }),
    sendEvent: (event) => send({ type: 'event', event }),
    sendRestart: () => send({ type: 'restart' }),
    sendEmote: (emote) => send({ type: 'emote', emote }),
  };
}
