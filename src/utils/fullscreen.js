// Cross-browser safe fullscreen helpers for desktop, mobile, and embedded iframes.

export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function isInFullscreen() {
  if (getFullscreenElement()) return true;
  if (typeof window !== 'undefined' && window.self !== window.top && typeof screen !== 'undefined') {
    return window.innerHeight >= screen.height - 8 && window.innerWidth >= screen.width - 8;
  }
  return false;
}

export function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;
  return !!(enabled && (el?.requestFullscreen || el?.webkitRequestFullscreen));
}

export async function requestGameFullscreen(target = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!target || isInFullscreen() || !isFullscreenSupported()) return false;
  try {
    if (target.requestFullscreen) {
      try {
        await target.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        await target.requestFullscreen();
      }
      return true;
    }
    if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function exitGameFullscreen() {
  if (typeof document === 'undefined' || !isInFullscreen()) return false;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function toggleGameFullscreen(target) {
  if (isInFullscreen()) return !(await exitGameFullscreen());
  return requestGameFullscreen(target);
}

export function subscribeFullscreenChange(callback) {
  if (typeof document === 'undefined') return () => {};
  const notify = () => callback(isInFullscreen());
  document.addEventListener('fullscreenchange', notify);
  document.addEventListener('webkitfullscreenchange', notify);
  return () => {
    document.removeEventListener('fullscreenchange', notify);
    document.removeEventListener('webkitfullscreenchange', notify);
  };
}
