// Cross-browser safe fullscreen + default landscape lock helpers (standalone & embedded).
import { resolveEmbeddedParentUrl } from '../net/roomCode.js';

let parentFullscreen = false;
const listeners = new Set();

function notifyListeners() {
  const active = isInFullscreen();
  for (const cb of listeners) cb(active);
}

function postParentFullscreen(action) {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const parent = resolveEmbeddedParentUrl();
  if (!parent) return false;
  try {
    window.parent.postMessage({ type: 'dont-trust-anyone:fullscreen', action }, parent.origin);
    return true;
  } catch {
    return false;
  }
}

export async function lockLandscapeDefault() {
  if (typeof screen === 'undefined' || !screen.orientation?.lock) return false;
  try {
    await screen.orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  if (typeof screen === 'undefined' || !screen.orientation?.unlock) return;
  try {
    screen.orientation.unlock();
  } catch {
    // Ignore unsupported platforms (e.g. desktop / iOS Safari).
  }
}

export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function isInFullscreen() {
  if (getFullscreenElement() || parentFullscreen) return true;
  if (typeof window !== 'undefined' && window.self !== window.top && typeof screen !== 'undefined') {
    return window.innerHeight >= screen.height - 8 && window.innerWidth >= screen.width - 8;
  }
  return false;
}

export function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  if (resolveEmbeddedParentUrl()) return true;
  const el = document.documentElement;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;
  return !!(enabled && (el?.requestFullscreen || el?.webkitRequestFullscreen));
}

export async function requestGameFullscreen(
  target = typeof document !== 'undefined' ? document.documentElement : null,
  { lockLandscape = true } = {},
) {
  if (!target) return false;
  if (getFullscreenElement()) {
    if (lockLandscape) await lockLandscapeDefault();
    return true;
  }
  const el = target;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;
  if (enabled && (el.requestFullscreen || el.webkitRequestFullscreen)) {
    try {
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await el.requestFullscreen();
        }
      } else {
        el.webkitRequestFullscreen();
      }
      if (lockLandscape) await lockLandscapeDefault();
      notifyListeners();
      return true;
    } catch {
      // Fall through to embedded parent container fullscreen/theater fallback.
    }
  }
  if (postParentFullscreen('enter')) {
    if (lockLandscape) await lockLandscapeDefault();
    parentFullscreen = true;
    notifyListeners();
    return true;
  }
  return false;
}

export async function exitGameFullscreen() {
  if (typeof document === 'undefined') return false;
  unlockOrientation();
  let exited = false;
  if (getFullscreenElement()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      exited = true;
    } catch {
      // Continue to parent bridge reset.
    }
  }
  if (parentFullscreen || window.parent !== window) {
    postParentFullscreen('exit');
    parentFullscreen = false;
    exited = true;
  }
  notifyListeners();
  return exited;
}

export async function toggleGameFullscreen(target) {
  if (isInFullscreen()) {
    await exitGameFullscreen();
    return false;
  }
  return requestGameFullscreen(target);
}

export function subscribeFullscreenChange(callback) {
  if (typeof document === 'undefined') return () => {};
  listeners.add(callback);
  const onDocChange = () => {
    if (!getFullscreenElement() && !parentFullscreen) unlockOrientation();
    notifyListeners();
  };
  const onMessage = (event) => {
    const parent = resolveEmbeddedParentUrl();
    if (!parent || event.origin !== parent.origin) return;
    const msg = event.data;
    if (msg && msg.type === 'dont-trust-anyone:fullscreen-state') {
      parentFullscreen = !!msg.active;
      notifyListeners();
    }
  };
  document.addEventListener('fullscreenchange', onDocChange);
  document.addEventListener('webkitfullscreenchange', onDocChange);
  window.addEventListener('message', onMessage);
  return () => {
    listeners.delete(callback);
    document.removeEventListener('fullscreenchange', onDocChange);
    document.removeEventListener('webkitfullscreenchange', onDocChange);
    window.removeEventListener('message', onMessage);
  };
}
