import { getActiveWalletId, getAuthBearerToken, subscribeAuth } from './auth.js';
import { resolveWorkerHttpOrigin } from './net/roomCode.js';
import { getCoinPack } from './shopCatalog.js';

async function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = await getAuthBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

let wallet = {
  balance: 500,
  streakDay: 0,
  lastStreakClaimAt: 0,
  vipUntil: 0,
  vipActive: false,
};

export function isVipActive() {
  return Boolean(wallet.vipActive || (wallet.vipUntil && wallet.vipUntil > Date.now()));
}

const listeners = new Set();
function notify() {
  for (const fn of listeners) fn({ ...wallet });
}

export function subscribeWallet(fn) {
  listeners.add(fn);
  fn({ ...wallet });
  return () => listeners.delete(fn);
}

export function getWalletState() {
  return { ...wallet };
}

export async function refreshWallet() {
  const playerId = encodeURIComponent(getActiveWalletId());
  try {
    const res = await fetch(`${resolveWorkerHttpOrigin()}/api/wallet/state?playerId=${playerId}`, {
      headers: await authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data?.ok && data.wallet) {
      wallet = data.wallet;
      notify();
    }
  } catch { /* ignore offline */ }
  return { ...wallet };
}

export async function claimAdReward() {
  const playerId = encodeURIComponent(getActiveWalletId());
  const res = await fetch(`${resolveWorkerHttpOrigin()}/api/wallet/ad-reward?playerId=${playerId}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const data = await res.json();
  if (res.ok && data?.ok && data.wallet) {
    wallet = data.wallet;
    notify();
  }
  return data;
}

export async function deductCoins(amount) {
  const playerId = encodeURIComponent(getActiveWalletId());
  const res = await fetch(`${resolveWorkerHttpOrigin()}/api/wallet/deduct?playerId=${playerId}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ amount }),
  });
  const data = await res.json();
  if (res.ok && data?.ok && data.wallet) {
    wallet = data.wallet;
    notify();
  }
  return data;
}

function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function buyCoinPackWithRazorpay(packId) {
  const pack = getCoinPack(packId);
  if (!pack) return { ok: false, error: 'Unknown coin pack' };

  const playerId = getActiveWalletId();
  const orderRes = await fetch(`${resolveWorkerHttpOrigin()}/api/payments/razorpay/order`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ packId: pack.id, playerId }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok || !order?.ok) {
    return { ok: false, error: order?.error || 'Could not start payment' };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    return { ok: false, error: 'Razorpay Checkout failed to load' };
  }

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Don't Trust Anyone",
      description: `${pack.coins.toLocaleString()} Coins Pack`,
      order_id: order.orderId,
      theme: { color: '#8b0d1a' },
      handler: async (resp) => {
        try {
          const verifyRes = await fetch(`${resolveWorkerHttpOrigin()}/api/payments/razorpay/verify`, {
            method: 'POST',
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              packId: pack.id,
              playerId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const verifyJson = await verifyRes.json();
          if (verifyRes.ok && verifyJson?.ok) {
            await refreshWallet();
            resolve({ ok: true, coins: pack.coins, txId: verifyJson.txId });
          } else {
            resolve({ ok: false, error: verifyJson?.error || 'Verification failed' });
          }
        } catch (err) {
          resolve({ ok: false, error: err?.message || 'Verification error' });
        }
      },
      modal: {
        ondismiss: () => resolve({ ok: false, cancelled: true }),
      },
    });
    rzp.open();
  });
}

export async function subscribeVipWithRazorpay() {
  const playerId = getActiveWalletId();
  const subRes = await fetch(`${resolveWorkerHttpOrigin()}/api/payments/razorpay/subscribe`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ playerId }),
  });
  const sub = await subRes.json();
  if (!subRes.ok || !sub?.ok) {
    return { ok: false, error: sub?.error || 'Could not start subscription' };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    return { ok: false, error: 'Razorpay Checkout failed to load' };
  }

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: sub.keyId,
      subscription_id: sub.subscriptionId,
      name: "Don't Trust Anyone",
      description: 'VIP Monthly Pass (Launch Offer ₹99/mo)',
      theme: { color: '#8b0d1a' },
      handler: async (resp) => {
        try {
          const verifyRes = await fetch(`${resolveWorkerHttpOrigin()}/api/payments/razorpay/subscribe/verify`, {
            method: 'POST',
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              playerId,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_subscription_id: resp.razorpay_subscription_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const verifyJson = await verifyRes.json();
          if (verifyRes.ok && verifyJson?.ok) {
            await refreshWallet();
            resolve({ ok: true, txId: verifyJson.txId });
          } else {
            resolve({ ok: false, error: verifyJson?.error || 'Verification failed' });
          }
        } catch (err) {
          resolve({ ok: false, error: err?.message || 'Verification error' });
        }
      },
      modal: {
        ondismiss: () => resolve({ ok: false, cancelled: true }),
      },
    });
    rzp.open();
  });
}

let lastWalletId = null;
subscribeAuth((authState) => {
  if (authState.walletId !== lastWalletId) {
    lastWalletId = authState.walletId;
    refreshWallet();
  }
});
