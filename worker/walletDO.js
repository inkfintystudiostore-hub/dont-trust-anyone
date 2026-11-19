import { DurableObject } from 'cloudflare:workers';

export const STARTING_COINS = 500;
export const FREE_SPIN_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const MAX_AD_SPINS_PER_DAY = 5;
export const MAX_RESCUES_PER_DAY = 3;
export const RESCUE_COINS = 150;
export const STREAK_REWARDS = [100, 150, 200, 300, 400, 600, 1000];

function todayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function defaultWallet(now = Date.now()) {
  const day = todayKey(now);
  return {
    balance: STARTING_COINS,
    lastFreeSpinAt: 0,
    adSpinsUsedToday: 0,
    adSpinsDayKey: day,
    lastStreakClaimAt: 0,
    streakDay: 0,
    rescueUsedToday: 0,
    rescueDayKey: day,
    vipUntil: 0,
    subscriptionId: null,
    creditedTxs: [],
  };
}

function publicWallet(w, now = Date.now()) {
  const vipUntil = Number(w.vipUntil ?? 0);
  return {
    balance: w.balance,
    lastFreeSpinAt: w.lastFreeSpinAt,
    adSpinsUsedToday: w.adSpinsUsedToday,
    adSpinsDayKey: w.adSpinsDayKey,
    lastStreakClaimAt: w.lastStreakClaimAt,
    streakDay: w.streakDay,
    rescueUsedToday: w.rescueUsedToday,
    rescueDayKey: w.rescueDayKey,
    vipUntil,
    vipActive: vipUntil > now,
    subscriptionId: w.subscriptionId ?? null,
  };
}

export class PlayerWalletDO extends DurableObject {
  async load(now = Date.now()) {
    const saved = await this.ctx.storage.get('wallet');
    const day = todayKey(now);
    if (!saved) {
      const fresh = defaultWallet(now);
      await this.ctx.storage.put('wallet', fresh);
      return fresh;
    }
    if (saved.adSpinsDayKey !== day) {
      saved.adSpinsDayKey = day;
      saved.adSpinsUsedToday = 0;
    }
    if (saved.rescueDayKey !== day) {
      saved.rescueDayKey = day;
      saved.rescueUsedToday = 0;
    }
    return saved;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === '/claim-tx' && request.method === 'POST') {
      let txBody = {};
      try { txBody = await request.json(); } catch { /* ignore */ }
      const txId = typeof txBody.txId === 'string' ? txBody.txId.trim() : '';
      if (!txId || txId.length > 128) {
        return Response.json({ ok: false, error: 'Invalid txId' }, { status: 400 });
      }
      const key = `tx:${txId}`;
      const existing = await this.ctx.storage.get(key);
      if (existing) {
        return Response.json({ ok: false, duplicate: true, error: 'Transaction already redeemed' }, { status: 409 });
      }
      await this.ctx.storage.put(key, {
        playerId: typeof txBody.playerId === 'string' ? txBody.playerId.slice(0, 80) : '',
        at: now,
      });
      return Response.json({ ok: true, claimed: true });
    }

    if (url.pathname === '/vip-plan') {
      if (request.method === 'GET') {
        const planId = await this.ctx.storage.get('vip_plan_id');
        return Response.json({ ok: true, planId: planId ?? null });
      }
      if (request.method === 'POST') {
        let planBody = {};
        try { planBody = await request.json(); } catch { /* ignore */ }
        const planId = typeof planBody.planId === 'string' ? planBody.planId.trim() : '';
        if (planId) await this.ctx.storage.put('vip_plan_id', planId);
        return Response.json({ ok: true, planId });
      }
    }

    if (url.pathname === '/import' && request.method === 'POST') {
      const existing = await this.ctx.storage.get('wallet');
      if (existing) {
        return Response.json({ ok: true, alreadyExists: true, wallet: publicWallet(existing) });
      }
      let body = {};
      try {
        body = await request.json();
      } catch {
        // Ignore invalid JSON and fall back to default wallet.
      }
      const fresh = defaultWallet(now);
      const src = body.wallet;
      if (src && typeof src.balance === 'number' && Number.isFinite(src.balance) && src.balance >= 0) {
        fresh.balance = Math.floor(src.balance);
        if (typeof src.lastFreeSpinAt === 'number' && Number.isFinite(src.lastFreeSpinAt)) {
          fresh.lastFreeSpinAt = src.lastFreeSpinAt;
        }
        if (typeof src.adSpinsDayKey === 'string') {
          fresh.adSpinsDayKey = src.adSpinsDayKey;
        }
        if (typeof src.adSpinsUsedToday === 'number' && Number.isFinite(src.adSpinsUsedToday)) {
          fresh.adSpinsUsedToday = Math.max(0, Math.floor(src.adSpinsUsedToday));
        }
        if (typeof src.lastStreakClaimAt === 'number' && Number.isFinite(src.lastStreakClaimAt)) {
          fresh.lastStreakClaimAt = src.lastStreakClaimAt;
        }
        if (typeof src.streakDay === 'number' && Number.isFinite(src.streakDay)) {
          fresh.streakDay = Math.max(0, Math.min(6, Math.floor(src.streakDay)));
        }
        if (typeof src.rescueDayKey === 'string') {
          fresh.rescueDayKey = src.rescueDayKey;
        }
        if (typeof src.rescueUsedToday === 'number' && Number.isFinite(src.rescueUsedToday)) {
          fresh.rescueUsedToday = Math.max(0, Math.floor(src.rescueUsedToday));
        }
      }
      await this.ctx.storage.put('wallet', fresh);
      return Response.json({ ok: true, wallet: publicWallet(fresh) });
    }

    const wallet = await this.load(now);

    if (url.pathname === '/state' && request.method === 'GET') {
      return Response.json({ ok: true, wallet: publicWallet(wallet) });
    }

    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    if (url.pathname === '/migrate-out') {
      wallet.balance = 0;
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, wallet: publicWallet(wallet) });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body allowed for actions without payload.
    }

    if (url.pathname === '/credit') {
      const amount = Math.floor(Number(body.amount ?? 0));
      const txId = typeof body.txId === 'string' ? body.txId.trim() : '';
      if (!Number.isFinite(amount) || amount <= 0) {
        return Response.json({ ok: false, error: 'Invalid credit amount' }, { status: 400 });
      }
      if (txId && wallet.creditedTxs.includes(txId)) {
        return Response.json({ ok: true, duplicate: true, wallet: publicWallet(wallet) });
      }
      wallet.balance += amount;
      if (txId) {
        wallet.creditedTxs = [...wallet.creditedTxs.slice(-99), txId];
      }
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, wallet: publicWallet(wallet) });
    }

    if (url.pathname === '/deduct') {
      const amount = Math.floor(Number(body.amount ?? 0));
      if (!Number.isFinite(amount) || amount < 0) {
        return Response.json({ ok: false, error: 'Invalid deduct amount' }, { status: 400 });
      }
      if (wallet.balance < amount) {
        return Response.json({ ok: false, error: 'Insufficient coins', wallet: publicWallet(wallet) }, { status: 400 });
      }
      wallet.balance -= amount;
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, wallet: publicWallet(wallet) });
    }

    if (url.pathname === '/ad-reward') {
      if (wallet.adSpinsUsedToday >= MAX_AD_SPINS_PER_DAY) {
        return Response.json(
          { ok: false, error: `Daily ad reward limit reached (${MAX_AD_SPINS_PER_DAY}/day).`, wallet: publicWallet(wallet, now) },
          { status: 429 },
        );
      }
      wallet.adSpinsUsedToday += 1;
      wallet.balance += RESCUE_COINS;
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, reward: RESCUE_COINS, wallet: publicWallet(wallet, now) });
    }

    if (url.pathname === '/claim-streak') {
      const day = todayKey(now);
      if (wallet.lastStreakClaimAt > 0 && todayKey(wallet.lastStreakClaimAt) === day) {
        return Response.json({ ok: false, error: 'Already claimed today' }, { status: 400 });
      }
      const missedDay = wallet.lastStreakClaimAt > 0 && now - wallet.lastStreakClaimAt > 48 * 60 * 60 * 1000;
      const idx = missedDay ? 0 : wallet.streakDay % STREAK_REWARDS.length;
      const reward = STREAK_REWARDS[idx];
      wallet.balance += reward;
      wallet.lastStreakClaimAt = now;
      wallet.streakDay = (idx + 1) % STREAK_REWARDS.length;
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, reward, wallet: publicWallet(wallet, now) });
    }

    if (url.pathname === '/activate-vip') {
      const txId = typeof body.txId === 'string' ? body.txId.trim() : '';
      const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : null;
      const bonusCoins = Math.max(0, Math.floor(Number(body.bonusCoins ?? 10000)));
      if (txId && wallet.creditedTxs.includes(txId)) {
        return Response.json({ ok: true, duplicate: true, wallet: publicWallet(wallet, now) });
      }
      const monthMs = 32 * 24 * 60 * 60 * 1000;
      const base = Math.max(now, Number(wallet.vipUntil ?? 0));
      wallet.vipUntil = base + monthMs;
      if (subscriptionId) wallet.subscriptionId = subscriptionId;
      if (bonusCoins > 0) wallet.balance += bonusCoins;
      if (txId) wallet.creditedTxs = [...wallet.creditedTxs.slice(-99), txId];
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, wallet: publicWallet(wallet, now) });
    }

    if (url.pathname === '/cancel-vip') {
      wallet.vipUntil = 0;
      await this.ctx.storage.put('wallet', wallet);
      return Response.json({ ok: true, wallet: publicWallet(wallet, now) });
    }

    return Response.json({ ok: false, error: 'Unknown wallet route' }, { status: 404 });
  }
}
