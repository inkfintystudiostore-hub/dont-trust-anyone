const KEY = 'dta.save.v1';

function defaultSave() {
  return { unlocked: 0, bestDeaths: {}, totalDeaths: 0, muted: false, assist: false };
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function sanitizeBestDeaths(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number.NaN;
    if (/^\d+$/.test(k) && Number.isFinite(n) && n >= 0) clean[k] = Math.floor(n);
  }
  return clean;
}

export function loadSave(storage) {
  const s = getStorage(storage);
  if (!s) return defaultSave();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const unlocked = Number(parsed?.unlocked);
    const total = Number(parsed?.totalDeaths);
    return {
      unlocked: Number.isFinite(unlocked) && unlocked >= 0 ? Math.floor(unlocked) : 0,
      bestDeaths: sanitizeBestDeaths(parsed?.bestDeaths),
      totalDeaths: Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0,
      muted: !!parsed?.muted,
      assist: !!parsed?.assist,
    };
  } catch {
    return defaultSave();
  }
}

export function saveProgress(state, storage) {
  const s = getStorage(storage);
  if (!s) return;
  try { s.setItem(KEY, JSON.stringify(state)); } catch { /* ignore private-mode quota errors */ }
}

export function recordWin(state, levelIndex, levelDeaths, totalLevels, storage) {
  const prevBest = state.bestDeaths[levelIndex];
  const safeDeaths = Number.isFinite(levelDeaths) && levelDeaths >= 0 ? Math.floor(levelDeaths) : 0;
  const nextBest = Number.isFinite(prevBest) ? Math.min(prevBest, safeDeaths) : safeDeaths;
  const next = {
    ...state,
    unlocked: Math.min(totalLevels - 1, Math.max(state.unlocked, levelIndex + 1)),
    bestDeaths: { ...state.bestDeaths, [levelIndex]: nextBest },
  };
  saveProgress(next, storage);
  return next;
}
