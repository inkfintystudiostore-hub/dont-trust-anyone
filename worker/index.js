/**
 * Cloudflare Worker + Hibernatable SQLite Durable Object room server for Don't Trust Anyone (2P Co-op).
 * Serves static Vite build via env.ASSETS and routes 9-digit co-op rooms on /api/rooms/reserve & /ws/room/:code.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  AccountDO,
  createSessionToken,
  extractBearerToken,
  resolveAuthSecret,
  validateUsername,
  verifySessionToken,
} from './auth.js';
import { FIREBASE_PROJECT_ID, verifyFirebaseIdToken } from './firebaseAuth.js';
import { handlePaymentRequest } from './payments.js';
import { PlayerWalletDO } from './walletDO.js';
import {
  ROOM_IDLE_TTL_MS,
  createRoomRecord,
  disconnectPlayer,
  getRoomCloseReason,
  handleRoomAction,
  isRoomCodeOccupied,
  isRoomExpired,
  joinRoom,
  markDisconnectedIfMissingSockets,
  nextRoomAlarmAt,
  snapshotForPlayer,
} from './roomLogic.js';

const MAX_WS_PAYLOAD_BYTES = 16384;
const FRAME_ANCESTORS_CSP =
  "frame-ancestors 'self' https://inkfinitystudio.store https://www.inkfinitystudio.store http://localhost:* http://127.0.0.1:*";
const HTML_CSP = `object-src 'none'; base-uri 'self'; ${FRAME_ANCESTORS_CSP}`;

const ALLOWED_CORS_ORIGINS = new Set([
  'https://dta.inkfinitystudio.store',
  'https://inkfinitystudio.store',
  'https://www.inkfinitystudio.store',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]);

const GUEST_ID_RE = /^guest:[a-zA-Z0-9_-]{8,58}$/;
const PUBLIC_WALLET_ROUTES = new Map([
  ['/state', 'GET'],
  ['/deduct', 'POST'],
  ['/claim-streak', 'POST'],
  ['/ad-reward', 'POST'],
]);

const rateBuckets = new Map();
function checkRateLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

async function resolveVerifiedWalletId(request, env) {
  const token = extractBearerToken(request);
  if (!token) return { ok: true, walletId: null };
  const secret = resolveAuthSecret(env, request.url);
  if (secret) {
    const session = await verifySessionToken(token, secret);
    if (session?.walletId) return { ok: true, walletId: session.walletId };
  }
  const claims = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
  if (claims?.uid) return { ok: true, walletId: `acct:${claims.uid}` };
  return { ok: false, status: 401 };
}

function randomRoomCode() {
  const min = 100_000_000;
  const max = 999_999_999;
  const span = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(min + (buf[0] % span));
}

function withCors(response, request) {
  const headers = new Headers(response.headers);
  const origin = request?.headers?.get('Origin');
  if (origin && ALLOWED_CORS_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.hostname.endsWith('.workers.dev') &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/ws/') &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      url.hostname = 'dta.inkfinitystudio.store';
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
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
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request);
      if (request.method !== 'POST') {
        return withCors(Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 }), request);
      }
      if (!checkRateLimit(`reserve:${getClientIp(request)}`, 30)) {
        return withCors(Response.json({ ok: false, error: 'Too many room requests. Please wait a minute.' }, { status: 429 }), request);
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
        if (res.status === 200) return withCors(Response.json({ ok: true, code }), request);
      }
      return withCors(Response.json({ ok: false, error: 'Could not allocate unique room code' }, { status: 503 }), request);
    }

    if (url.pathname === '/api/health') {
      return withCors(Response.json({ ok: true, service: 'dont-trust-anyone-do' }), request);
    }

    if (url.pathname.startsWith('/api/auth/')) {
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request);
      const authSecret = resolveAuthSecret(env, request.url);
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        if (!authSecret) {
          return withCors(Response.json({ ok: false, error: 'Server auth secret not configured' }, { status: 500 }), request);
        }
        const token = extractBearerToken(request);
        const session = token ? await verifySessionToken(token, authSecret) : null;
        if (!session) return withCors(Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }), request);
        const walletStub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(session.walletId));
        const walletRes = await walletStub.fetch('https://internal/state');
        const walletJson = await walletRes.json();
        return withCors(Response.json({ ok: true, account: session, wallet: walletJson.wallet }), request);
      }
      if (request.method !== 'POST') {
        return withCors(Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 }), request);
      }
      if (!checkRateLimit(`auth:${getClientIp(request)}`, 20)) {
        return withCors(Response.json({ ok: false, error: 'Too many auth attempts. Please wait a minute.' }, { status: 429 }), request);
      }
      let body = {};
      try { body = await request.json(); } catch {
        return withCors(Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }), request);
      }
      if (url.pathname === '/api/auth/firebase-sync') {
        const token = extractBearerToken(request);
        const claims = token ? await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID) : null;
        if (!claims) return withCors(Response.json({ ok: false, error: 'Invalid Firebase session' }, { status: 401 }), request);
        const walletId = `acct:${claims.uid}`;
        const accountWalletStub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(walletId));
        const guestId = typeof body.guestPlayerId === 'string' ? body.guestPlayerId.trim() : '';
        if (guestId && GUEST_ID_RE.test(guestId)) {
          const guestStub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(guestId));
          const guestStateRes = await guestStub.fetch('https://internal/state');
          const guestStateJson = await guestStateRes.json();
          if (guestStateRes.ok && guestStateJson.ok && guestStateJson.wallet) {
            const importRes = await accountWalletStub.fetch('https://internal/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wallet: guestStateJson.wallet }),
            });
            const importJson = await importRes.json();
            if (!importJson.alreadyExists) {
              await guestStub.fetch('https://internal/migrate-out', { method: 'POST' });
            }
          }
        }
        const walletRes = await accountWalletStub.fetch('https://internal/state');
        const walletJson = await walletRes.json();
        return withCors(Response.json({ ok: true, walletId, wallet: walletJson.wallet }), request);
      }

      if (!authSecret) {
        return withCors(Response.json({ ok: false, error: 'Server auth secret not configured' }, { status: 500 }), request);
      }
      const userCheck = validateUsername(String(body.username ?? ''));
      if (!userCheck.ok) return withCors(Response.json({ ok: false, error: userCheck.error }, { status: 400 }), request);
      const accountStub = env.PLAYER_ACCOUNT.get(env.PLAYER_ACCOUNT.idFromName(userCheck.normalized));

      if (url.pathname === '/api/auth/register') {
        const regRes = await accountStub.fetch('https://internal/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userCheck.username, password: body.password, displayName: body.displayName }),
        });
        const regJson = await regRes.json();
        if (!regRes.ok || !regJson.ok || !regJson.account) return withCors(Response.json(regJson, { status: regRes.status }), request);
        const token = await createSessionToken(regJson.account, authSecret);
        const walletStub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(regJson.account.walletId));
        const walletRes = await walletStub.fetch('https://internal/state');
        const walletJson = await walletRes.json();
        return withCors(Response.json({ ok: true, token, account: regJson.account, wallet: walletJson.wallet }), request);
      }

      if (url.pathname === '/api/auth/login') {
        const loginRes = await accountStub.fetch('https://internal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: body.password }),
        });
        const loginJson = await loginRes.json();
        if (!loginRes.ok || !loginJson.ok || !loginJson.account) return withCors(Response.json(loginJson, { status: loginRes.status }), request);
        const token = await createSessionToken(loginJson.account, authSecret);
        const walletStub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(loginJson.account.walletId));
        const walletRes = await walletStub.fetch('https://internal/state');
        const walletJson = await walletRes.json();
        return withCors(Response.json({ ok: true, token, account: loginJson.account, wallet: walletJson.wallet }), request);
      }

      return withCors(Response.json({ ok: false, error: 'Not found' }, { status: 404 }), request);
    }

    if (url.pathname.startsWith('/api/wallet/')) {
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request);
      const action = url.pathname.replace('/api/wallet', '');
      const expectedMethod = PUBLIC_WALLET_ROUTES.get(action);
      if (!expectedMethod) {
        return withCors(Response.json({ ok: false, error: 'Forbidden wallet route' }, { status: 403 }), request);
      }
      if (request.method !== expectedMethod) {
        return withCors(Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 }), request);
      }

      const auth = await resolveVerifiedWalletId(request, env);
      if (!auth.ok) {
        return withCors(Response.json({ ok: false, error: 'Unauthorized' }, { status: auth.status }), request);
      }

      let playerId = auth.walletId;
      if (!playerId) {
        const rawGuest = url.searchParams.get('playerId')?.trim() || '';
        if (!GUEST_ID_RE.test(rawGuest)) {
          return withCors(Response.json({ ok: false, error: 'Authentication required for account wallets' }, { status: 401 }), request);
        }
        playerId = rawGuest;
      }

      const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(playerId));
      const doRes = await stub.fetch(`https://internal${action}`, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: request.method === 'POST' ? await request.text() : undefined,
      });
      return withCors(new Response(doRes.body, { status: doRes.status, headers: { 'Content-Type': 'application/json' } }), request);
    }

    if (url.pathname.startsWith('/api/payments/razorpay/')) {
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request);
      const isWebhook = url.pathname === '/api/payments/razorpay/webhook';
      if (!isWebhook && !checkRateLimit(`pay:${getClientIp(request)}`, 20)) {
        return withCors(Response.json({ ok: false, error: 'Too many payment requests. Please wait.' }, { status: 429 }), request);
      }
      let verifiedWalletId = null;
      if (!isWebhook) {
        const auth = await resolveVerifiedWalletId(request, env);
        if (!auth.ok) {
          return withCors(Response.json({ ok: false, error: 'Unauthorized' }, { status: auth.status }), request);
        }
        verifiedWalletId = auth.walletId;
      }
      const payRes = await handlePaymentRequest(request, url, env, verifiedWalletId);
      if (payRes) return withCors(payRes, request);
    }

    const assetRes = await env.ASSETS.fetch(request);
    const contentType = assetRes.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html')) return assetRes;

    const headers = new Headers(assetRes.headers);
    headers.delete('X-Frame-Options');
    headers.set('Content-Security-Policy', HTML_CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), geolocation=(), payment=(self)');
    return new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers,
    });
  },
};

export { AccountDO, PlayerWalletDO };

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
    if (touchActivity) this.lastActivityPersistAt = now;
    await this.ctx.storage.put('room', touched);
    await this.ctx.storage.setAlarm(nextRoomAlarmAt(touched, now));
  }

  async alarm() {
    const now = Date.now();
    if (!this.room || isRoomExpired(this.room, now)) {
      const reason = getRoomCloseReason(this.room, now) ?? 'inactivity';
      const message = reason === 'partner_left'
        ? 'Partner left and did not reconnect within 30s — Room closed!'
        : reason === 'both_left'
          ? 'Both players left the game — Room closed!'
          : 'Room closed after 1 minute of inactivity.';
      const payload = JSON.stringify({ type: 'room_closed', reason, message });
      for (const sock of this.ctx.getWebSockets()) {
        try {
          if (sock.readyState === WebSocket.OPEN) sock.send(payload);
          sock.close(4004, message);
        } catch { /* ignore */ }
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
      await this.ctx.storage.setAlarm(nextRoomAlarmAt(this.room, now));
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
    const rawPid = url.searchParams.get('pid')?.trim() || '';
    const rawDid = url.searchParams.get('did')?.trim() || '';
    const playerId = rawPid.length > 0 && rawPid.length <= 64 ? rawPid : crypto.randomUUID();
    const deviceId = rawDid.length > 0 && rawDid.length <= 64 ? rawDid : undefined;
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
    const playerId = meta?.playerId ?? '';
    if (!playerId) return;

    if (parsed.type === 'ping') {
      const now = Date.now();
      const activeIds = this.getActivePlayerIds();
      activeIds.add(playerId);
      const swept = markDisconnectedIfMissingSockets(this.room, activeIds, now);
      if (swept !== this.room) {
        await this.saveRoom(swept, { touchActivity: false });
        this.broadcastSnapshots(swept);
      } else if (now - (this.lastActivityPersistAt ?? 0) > 15_000) {
        await this.saveRoom(this.room, { touchActivity: true });
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
