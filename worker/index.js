/**
 * Cloudflare Worker + Hibernatable SQLite Durable Object room server for Don't Trust Anyone (2P Co-op).
 * Serves static Vite build via env.ASSETS and routes 9-digit co-op rooms on /api/rooms/reserve & /ws/room/:code.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  ROOM_IDLE_TTL_MS,
  createRoomRecord,
  disconnectPlayer,
  handleRoomAction,
  isRoomCodeOccupied,
  isRoomExpired,
  joinRoom,
  markDisconnectedIfMissingSockets,
  snapshotForPlayer,
} from './roomLogic.js';

const MAX_WS_PAYLOAD_BYTES = 16384;
const FRAME_ANCESTORS_CSP =
  "frame-ancestors 'self' https://inkfinitystudio.store https://www.inkfinitystudio.store http://localhost:* http://127.0.0.1:*";

function randomRoomCode() {
  const min = 100_000_000;
  const max = 999_999_999;
  const span = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(min + (buf[0] % span));
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/ws\/room\/(\d{9})$/);

    if (roomMatch) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const code = roomMatch[1];
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      return stub.fetch(request);
    }

    if (url.pathname === '/api/rooms/reserve') {
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
      if (request.method !== 'POST') {
        return withCors(Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 }));
      }
      let levelIndex = 0;
      let candidate = null;
      try {
        const body = await request.json();
        if (Number.isFinite(body?.levelIndex)) levelIndex = Math.max(0, Math.floor(body.levelIndex));
        if (typeof body?.code === 'string' && /^\d{9}$/.test(body.code)) candidate = body.code;
      } catch {
        // Use defaults if empty JSON body.
      }
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = attempt === 0 && candidate ? candidate : randomRoomCode();
        const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
        const res = await stub.fetch(`https://internal/reserve?code=${code}&level=${levelIndex}`, { method: 'POST' });
        if (res.status === 200) return withCors(Response.json({ ok: true, code }));
      }
      return withCors(Response.json({ ok: false, error: 'Could not allocate unique room code' }, { status: 503 }));
    }

    if (url.pathname === '/api/health') {
      return withCors(Response.json({ ok: true, service: 'dont-trust-anyone-do' }));
    }

    const assetRes = await env.ASSETS.fetch(request);
    const contentType = assetRes.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html')) return assetRes;

    const headers = new Headers(assetRes.headers);
    headers.delete('X-Frame-Options');
    headers.set('Content-Security-Policy', FRAME_ANCESTORS_CSP);
    return new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers,
    });
  },
};

export class DontTrustRoomDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get('room');
      if (saved && !isRoomExpired(saved)) this.room = saved;
      else if (saved) await this.ctx.storage.deleteAll();
    });
  }

  getActivePlayerIds(excludeSocket) {
    const active = new Set();
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === excludeSocket || sock.readyState !== WebSocket.OPEN) continue;
      const meta = sock.deserializeAttachment();
      if (meta?.playerId && !meta.leftExplicitly) active.add(meta.playerId);
    }
    return active;
  }

  async saveRoom(next, { touchActivity = true } = {}) {
    const now = Date.now();
    const touched = { ...next, lastActiveAt: touchActivity ? now : (next.lastActiveAt ?? now) };
    this.room = touched;
    await this.ctx.storage.put('room', touched);
    await this.ctx.storage.setAlarm(touched.lastActiveAt + ROOM_IDLE_TTL_MS);
  }

  async alarm() {
    const now = Date.now();
    if (!this.room || isRoomExpired(this.room, now)) {
      for (const sock of this.ctx.getWebSockets()) {
        try { sock.close(1000, 'Room expired after inactivity'); } catch { /* ignore */ }
      }
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    const activeIds = this.getActivePlayerIds();
    const swept = markDisconnectedIfMissingSockets(this.room, activeIds, now);
    if (swept !== this.room) {
      await this.saveRoom(swept, { touchActivity: false });
      this.broadcastSnapshots(swept);
    } else {
      await this.ctx.storage.setAlarm(this.room.lastActiveAt + ROOM_IDLE_TTL_MS);
    }
  }

  broadcast(msg) {
    const raw = JSON.stringify(msg);
    for (const sock of this.ctx.getWebSockets()) {
      if (sock.readyState === WebSocket.OPEN) sock.send(raw);
    }
  }

  relayToOthers(senderWs, msg) {
    const raw = JSON.stringify(msg);
    for (const sock of this.ctx.getWebSockets()) {
      if (sock !== senderWs && sock.readyState === WebSocket.OPEN) sock.send(raw);
    }
  }

  broadcastSnapshots(record) {
    for (const sock of this.ctx.getWebSockets()) {
      if (sock.readyState !== WebSocket.OPEN) continue;
      const meta = sock.deserializeAttachment();
      const pid = meta?.playerId ?? '';
      sock.send(JSON.stringify({ type: 'snapshot', snapshot: snapshotForPlayer(record, pid) }));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (this.room && isRoomExpired(this.room)) {
      this.room = null;
      await this.ctx.storage.deleteAll();
    }

    if (url.pathname === '/reserve') {
      const code = url.searchParams.get('code') ?? '000000000';
      const levelIndex = Number(url.searchParams.get('level') ?? 0);
      if (isRoomCodeOccupied(this.room)) {
        return Response.json({ ok: false, error: 'code_in_use' }, { status: 409 });
      }
      await this.saveRoom(createRoomRecord(code, levelIndex));
      return Response.json({ ok: true, code });
    }

    const codeMatch = url.pathname.match(/(\d{9})$/);
    const code = codeMatch?.[1] ?? '000000000';
    const playerId = url.searchParams.get('pid')?.trim() || crypto.randomUUID();
    const deviceId = url.searchParams.get('did')?.trim() || undefined;
    const playerName = url.searchParams.get('name') ?? undefined;
    const intent = url.searchParams.get('intent');
    const levelIndex = Number(url.searchParams.get('level') ?? 0);

    if (!this.room && intent === 'join') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.send(JSON.stringify({ type: 'error', message: 'Room not found or ended. Ask your friend for a new code!' }));
      server.close(4004, 'Room not found or has ended');
      return new Response(null, { status: 101, webSocket: client });
    }

    if (!this.room) {
      this.room = createRoomRecord(code, levelIndex);
    }

    const now = Date.now();
    const activeIds = this.getActivePlayerIds();
    activeIds.add(playerId);
    const swept = markDisconnectedIfMissingSockets(this.room, activeIds, now);
    const updated = joinRoom(swept, playerId, playerName, now, deviceId);

    if (!updated.seats.some((s) => s.playerId === playerId)) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.send(JSON.stringify({ type: 'error', message: 'This 2-player room is already full!' }));
      server.close(4003, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId });

    await this.saveRoom(updated);
    queueMicrotask(() => {
      this.broadcastSnapshots(updated);
      if (updated.started && server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({ type: 'started', levelIndex: updated.levelIndex }));
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, rawMessage) {
    if (!this.room) return;
    if (isRoomExpired(this.room)) {
      await this.alarm();
      return;
    }
    const text = typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage);
    if (text.length > MAX_WS_PAYLOAD_BYTES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Payload too large.' }));
      return;
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON.' }));
      return;
    }

    const meta = ws.deserializeAttachment();
    const playerId = parsed.type === 'join' ? parsed.playerId : (meta?.playerId ?? '');
    if (!playerId) return;

    if (parsed.type === 'ping') {
      const now = Date.now();
      const activeIds = this.getActivePlayerIds();
      activeIds.add(playerId);
      const swept = markDisconnectedIfMissingSockets(this.room, activeIds, now);
      if (swept !== this.room) {
        await this.saveRoom(swept, { touchActivity: false });
        this.broadcastSnapshots(swept);
      }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (parsed.type === 'leave') {
      ws.serializeAttachment({ playerId, leftExplicitly: true });
    }

    const result = handleRoomAction(this.room, playerId, parsed, Date.now());
    if (parsed.type === 'leave' && result.record.seats.every((s) => s.occupant === 'open')) {
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }

    if (result.persist) await this.saveRoom(result.record);
    else this.room = result.record;

    if (result.reply && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(result.reply));
    for (const msg of result.relayToOthers) this.relayToOthers(ws, msg);
    for (const msg of result.broadcast) this.broadcast(msg);
    if (result.broadcastSnapshots) this.broadcastSnapshots(result.record);
  }

  async handleDisconnectSocket(ws) {
    const meta = ws.deserializeAttachment();
    if (!meta?.playerId || !this.room || meta.leftExplicitly) return;
    const activeIds = this.getActivePlayerIds(ws);
    if (activeIds.has(meta.playerId)) return;
    const next = disconnectPlayer(this.room, meta.playerId);
    await this.saveRoom(next);
    this.broadcastSnapshots(next);
  }

  async webSocketClose(ws, code, reason) {
    await this.handleDisconnectSocket(ws);
    if (code === 1000 || (code >= 3000 && code <= 4999)) {
      try { ws.close(code, reason); } catch { /* ignore */ }
    }
  }

  async webSocketError(ws, error) {
    console.error('DontTrustRoomDO WebSocket error:', error);
    await this.handleDisconnectSocket(ws);
  }
}
