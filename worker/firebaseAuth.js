export const FIREBASE_PROJECT_ID = 'inkfinitystudios-d2cb8';
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwkCache = null;

function base64UrlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeJwtJson(segment) {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(segment));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function validateFirebaseClaims(payload, projectId, nowSec = Math.floor(Date.now() / 1000)) {
  const issExpected = `https://securetoken.google.com/${projectId}`;
  if (payload.aud !== projectId) return null;
  if (payload.iss !== issExpected) return null;
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    exp: payload.exp,
    iat: payload.iat,
  };
}

async function getGooglePublicKey(kid) {
  const now = Date.now();
  if (jwkCache && jwkCache.expiresAt > now) {
    const hit = jwkCache.keys.get(kid);
    if (hit) return hit;
  }

  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) return null;

  const cacheControl = res.headers.get('Cache-Control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 300_000;

  const data = await res.json();
  const keyMap = new Map();
  for (const jwk of data.keys ?? []) {
    const keyId = jwk?.kid;
    if (!keyId) continue;
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      keyMap.set(keyId, cryptoKey);
    } catch {
      // Skip unsupported keys.
    }
  }

  jwkCache = { keys: keyMap, expiresAt: now + maxAgeMs };
  return keyMap.get(kid) ?? null;
}

export async function verifyFirebaseIdToken(
  token,
  projectId = FIREBASE_PROJECT_ID,
  nowSec = Math.floor(Date.now() / 1000),
) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;

  const header = decodeJwtJson(headerSeg);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    return null;
  }

  const payload = decodeJwtJson(payloadSeg);
  if (!payload) return null;

  const claims = validateFirebaseClaims(payload, projectId, nowSec);
  if (!claims) return null;

  const key = await getGooglePublicKey(header.kid);
  if (!key) return null;

  const signedBytes = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  const sigBytes = base64UrlToBytes(sigSeg);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    sigBytes,
    signedBytes,
  );
  return valid ? claims : null;
}
