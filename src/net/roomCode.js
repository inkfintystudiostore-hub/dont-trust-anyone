/**
 * Helpers for 9-digit friend room codes, shareable ?room= invite links, and Worker origin resolution.
 */

export const ROOM_CODE_LENGTH = 9;
export const DEFAULT_WORKER_ORIGIN = 'https://dont-trust-anyone.inkfintystudio-store.workers.dev';

const TRUSTED_EMBED_ORIGINS = new Set([
  'https://inkfinitystudio.store',
  'https://www.inkfinitystudio.store',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/** Groups a 9-digit numeric code into readable 3-3-3 triplets (e.g. 482-910-375). */
export function formatRoomCode(code) {
  const clean = String(code ?? '').replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH);
  if (clean.length !== ROOM_CODE_LENGTH) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

/** Extracts a valid 9-digit room code from raw/hyphenated text or any ?room= invite URL. */
export function parseRoomCodeInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const queryStart = trimmed.indexOf('?');
  if (queryStart >= 0 || /(?:^|&)room=/i.test(trimmed)) {
    const rawQuery = queryStart >= 0 ? trimmed.slice(queryStart + 1).split('#')[0] : trimmed;
    const queryStr = rawQuery.split(/\s+/)[0] ?? rawQuery;
    try {
      const roomParam = new URLSearchParams(queryStr).get('room');
      if (roomParam) {
        const digits = roomParam.replace(/\D/g, '');
        return digits.length === ROOM_CODE_LENGTH ? digits : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  const roomQueryMatch = trimmed.match(/[?&]room=([^&#\s]+)/i);
  if (roomQueryMatch) {
    let decoded = roomQueryMatch[1];
    try { decoded = decodeURIComponent(decoded); } catch { /* ignore */ }
    const digits = decoded.replace(/\D/g, '');
    return digits.length === ROOM_CODE_LENGTH ? digits : null;
  }

  const digitsOnly = trimmed.replace(/[\s\-]/g, '');
  if (/^\d{9}$/.test(digitsOnly)) return digitsOnly;

  const embedded = trimmed.match(/\b(\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/);
  if (embedded) {
    const clean = embedded[1].replace(/\D/g, '');
    return clean.length === ROOM_CODE_LENGTH ? clean : null;
  }
  return null;
}

/** Returns public base URL used for shareable ?room= invite links. */
export function resolveShareBaseUrl() {
  const configured = import.meta.env?.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin;
    }
    const path = window.location.pathname && window.location.pathname !== '/'
      ? window.location.pathname.replace(/\/+$/, '')
      : '';
    return `${window.location.origin}${path}`;
  }
  return DEFAULT_WORKER_ORIGIN;
}

/** Builds clean full-screen ?room= invite link. */
export function buildRoomShareUrl(code, baseUrl = resolveShareBaseUrl()) {
  const cleanCode = parseRoomCodeInput(code);
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  if (cleanCode) url.searchParams.set('room', cleanCode);
  return url.toString();
}

/** Resolves HTTP base origin for Cloudflare Worker /api/rooms/reserve requests. */
export function resolveWorkerHttpOrigin() {
  const custom = import.meta.env?.VITE_WS_URL?.trim();
  if (custom) {
    return custom.replace(/\/+$/, '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (window.location.port === '5173' && !params.has('localworker')) {
      return DEFAULT_WORKER_ORIGIN;
    }
    return window.location.origin;
  }
  return DEFAULT_WORKER_ORIGIN;
}

/** Resolves WebSocket origin for Cloudflare Durable Object room transport (/ws/room/:code). */
export function resolveWorkerWsOrigin() {
  const http = resolveWorkerHttpOrigin();
  return http.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
}

/** Resolves validated parent page URL when embedded inside inkfinitystudio.store/game-room. */
export function resolveEmbeddedParentUrl() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('parentUrl')?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!TRUSTED_EMBED_ORIGINS.has(parsed.origin)) return null;
    const cleanPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '';
    return { baseUrl: `${parsed.origin}${cleanPath}`, origin: parsed.origin };
  } catch {
    return null;
  }
}

export function notifyParentRoomCode(code) {
  if (typeof window === 'undefined' || window.parent === window) return;
  const parent = resolveEmbeddedParentUrl();
  if (!parent) return;
  try {
    window.parent.postMessage({ type: 'dont-trust-anyone:room', code }, parent.origin);
  } catch {
    // Ignore cross-origin restrictions.
  }
}

export function clearRoomFromBrowserUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('room')) return;
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Ignore history API restrictions.
  }
}
