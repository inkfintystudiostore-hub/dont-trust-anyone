import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, googleProvider } from './firebase.js';
import { resolveWorkerHttpOrigin } from './net/roomCode.js';

const TOKEN_KEY = 'dta.auth.token';
const GUEST_WALLET_KEY = 'dta.wallet.guestId';

function getGuestWalletId() {
  try {
    let id = localStorage.getItem(GUEST_WALLET_KEY);
    if (!id) {
      id = `guest:${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_WALLET_KEY, id);
    }
    return id;
  } catch {
    return 'guest:local';
  }
}

let state = {
  user: null,
  token: null,
  walletId: getGuestWalletId(),
  loading: false,
  error: null,
};

const listeners = new Set();
function notify() {
  for (const fn of listeners) fn({ ...state });
}

export function subscribeAuth(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getAuthState() {
  return { ...state };
}

export function getActiveWalletId() {
  return state.walletId;
}

export async function getAuthBearerToken() {
  if (state.token) return state.token;
  const fbUser = firebaseAuth.currentUser;
  if (fbUser) {
    try {
      return await fbUser.getIdToken();
    } catch {
      return null;
    }
  }
  return null;
}

async function apiPost(path, body, bearerToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  const res = await fetch(`${resolveWorkerHttpOrigin()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export async function loginWithGoogle() {
  state.loading = true;
  state.error = null;
  notify();
  try {
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await cred.user.getIdToken();
    const guestId = getGuestWalletId();
    const res = await apiPost('/api/auth/firebase-sync', { guestPlayerId: guestId }, idToken);
    if (!res?.ok) throw new Error(res?.error || 'Firebase sync failed');
    state.user = {
      accountId: cred.user.uid,
      username: cred.user.email || cred.user.uid,
      displayName: cred.user.displayName || 'Player',
      walletId: res.walletId,
      provider: 'google',
    };
    state.walletId = res.walletId;
    state.loading = false;
    notify();
    return { ok: true, wallet: res.wallet };
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Google sign-in failed';
    notify();
    return { ok: false, error: state.error };
  }
}

export async function loginWithPassword(username, password) {
  state.loading = true;
  state.error = null;
  notify();
  try {
    const res = await apiPost('/api/auth/login', { username, password });
    if (!res?.ok) throw new Error(res?.error || 'Login failed');
    try { localStorage.setItem(TOKEN_KEY, res.token); } catch { /* ignore */ }
    state.token = res.token;
    state.user = res.account;
    state.walletId = res.account.walletId;
    state.loading = false;
    notify();
    return { ok: true, wallet: res.wallet };
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Login failed';
    notify();
    return { ok: false, error: state.error };
  }
}

export async function registerWithPassword(username, password, displayName) {
  state.loading = true;
  state.error = null;
  notify();
  try {
    const res = await apiPost('/api/auth/register', { username, password, displayName });
    if (!res?.ok) throw new Error(res?.error || 'Registration failed');
    try { localStorage.setItem(TOKEN_KEY, res.token); } catch { /* ignore */ }
    state.token = res.token;
    state.user = res.account;
    state.walletId = res.account.walletId;
    state.loading = false;
    notify();
    return { ok: true, wallet: res.wallet };
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Registration failed';
    notify();
    return { ok: false, error: state.error };
  }
}

export async function logoutAuth() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  try { await signOut(firebaseAuth); } catch { /* ignore */ }
  state.user = null;
  state.token = null;
  state.walletId = getGuestWalletId();
  state.error = null;
  notify();
}

export async function restoreAuthSession() {
  try {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      const res = await fetch(`${resolveWorkerHttpOrigin()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${saved}` },
      });
      const data = await res.json();
      if (res.ok && data?.ok && data.account) {
        state.token = saved;
        state.user = data.account;
        state.walletId = data.account.walletId;
        notify();
        return;
      }
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* ignore */ }

  onAuthStateChanged(firebaseAuth, async (fbUser) => {
    if (!fbUser || state.token) return;
    try {
      const idToken = await fbUser.getIdToken();
      const res = await apiPost('/api/auth/firebase-sync', { guestPlayerId: getGuestWalletId() }, idToken);
      if (res?.ok) {
        state.user = {
          accountId: fbUser.uid,
          username: fbUser.email || fbUser.uid,
          displayName: fbUser.displayName || 'Player',
          walletId: res.walletId,
          provider: 'google',
        };
        state.walletId = res.walletId;
        notify();
      }
    } catch { /* ignore */ }
  });
}
