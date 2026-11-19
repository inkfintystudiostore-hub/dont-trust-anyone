import { getCoinPack, VIP_SUBSCRIPTION } from '../src/shopCatalog.js';

const GLOBAL_LEDGER_ID = '__global_tx_ledger__';

async function claimGlobalTx(env, txId, playerId) {
  if (!env.PLAYER_WALLET || !txId) return { ok: true };
  const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(GLOBAL_LEDGER_ID));
  const res = await stub.fetch('https://internal/claim-tx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId, playerId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, ...data };
}

async function getCachedVipPlanId(env) {
  if (!env.PLAYER_WALLET) return null;
  const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(GLOBAL_LEDGER_ID));
  const res = await stub.fetch('https://internal/vip-plan');
  const data = await res.json();
  return data?.planId ?? null;
}

async function setCachedVipPlanId(env, planId) {
  if (!env.PLAYER_WALLET || !planId) return;
  const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(GLOBAL_LEDGER_ID));
  await stub.fetch('https://internal/vip-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
}

async function activateServerVip(env, playerId, subscriptionId, txId) {
  if (!env.PLAYER_WALLET || !playerId) throw new Error('Missing wallet binding or playerId');
  const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(playerId));
  const res = await stub.fetch('https://internal/activate-vip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId, txId, bonusCoins: VIP_SUBSCRIPTION.bonusCoins }),
  });
  if (!res.ok) throw new Error('Failed to activate VIP on wallet');
}

async function cancelServerVip(env, playerId) {
  if (!env.PLAYER_WALLET || !playerId) return;
  try {
    const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(playerId));
    await stub.fetch('https://internal/cancel-vip', { method: 'POST' });
  } catch { /* non-fatal */ }
}

async function creditServerWallet(env, playerId, coins, txId) {
  if (!env.PLAYER_WALLET || !playerId || coins <= 0) throw new Error('Invalid credit parameters');
  const stub = env.PLAYER_WALLET.get(env.PLAYER_WALLET.idFromName(playerId));
  const res = await stub.fetch('https://internal/credit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: coins, txId }),
  });
  if (!res.ok) throw new Error('Failed to credit wallet');
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyRazorpaySignature(orderId, paymentId, signatureHex, secret) {
  if (!orderId || !paymentId || !signatureHex || !secret) return false;
  const expectedHex = await hmacSha256Hex(`${orderId}|${paymentId}`, secret);
  return timingSafeEqualHex(expectedHex, signatureHex.toLowerCase());
}

export async function verifyRazorpayWebhookSignature(rawBody, signatureHex, webhookSecret) {
  if (!rawBody || !signatureHex || !webhookSecret) return false;
  const expectedHex = await hmacSha256Hex(rawBody, webhookSecret);
  return timingSafeEqualHex(expectedHex, signatureHex.toLowerCase());
}

export async function handlePaymentRequest(request, url, env, verifiedPlayerId = null) {
  if (url.pathname === '/api/payments/razorpay/order' && request.method === 'POST') {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return Response.json(
        {
          ok: false,
          configured: false,
          error: 'Razorpay is not configured on this server (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).',
        },
        { status: 501 },
      );
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const pack = getCoinPack(body.packId);
    if (!pack) {
      return Response.json({ ok: false, error: 'Unknown coin pack' }, { status: 400 });
    }
    const targetPlayerId = verifiedPlayerId || (typeof body.playerId === 'string' && body.playerId.startsWith('guest:') ? body.playerId.slice(0, 64) : '');
    if (!targetPlayerId) {
      return Response.json({ ok: false, error: 'Valid playerId or session required' }, { status: 401 });
    }

    const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pack.inrPaise,
        currency: 'INR',
        notes: {
          packId: pack.id,
          coins: String(pack.coins),
          playerId: targetPlayerId,
        },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok || !order.id) {
      return Response.json(
        { ok: false, error: order.error?.description ?? 'Razorpay order creation failed' },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      orderId: order.id,
      amount: order.amount ?? pack.inrPaise,
      currency: order.currency ?? 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      packId: pack.id,
      coins: pack.coins,
    });
  }

  if (url.pathname === '/api/payments/razorpay/verify' && request.method === 'POST') {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return Response.json({ ok: false, configured: false, error: 'Razorpay not configured' }, { status: 501 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const pack = getCoinPack(body.packId);
    if (!pack || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      return Response.json({ ok: false, error: 'Missing payment verification fields' }, { status: 400 });
    }

    const valid = await verifyRazorpaySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
      env.RAZORPAY_KEY_SECRET,
    );
    if (!valid) {
      return Response.json({ ok: false, error: 'Invalid Razorpay signature' }, { status: 400 });
    }

    // Fetch authoritative order details from Razorpay to prevent packId/amount tampering.
    const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(body.razorpay_order_id)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!orderRes.ok) {
      return Response.json({ ok: false, error: 'Could not verify Razorpay order status' }, { status: 502 });
    }
    const order = await orderRes.json();
    if (
      order.status !== 'paid' ||
      order.amount !== pack.inrPaise ||
      order.currency !== 'INR' ||
      (order.notes?.packId && order.notes.packId !== pack.id)
    ) {
      return Response.json({ ok: false, error: 'Order amount or pack mismatch' }, { status: 400 });
    }

    const targetPlayerId = verifiedPlayerId || order.notes?.playerId || (typeof body.playerId === 'string' && body.playerId.startsWith('guest:') ? body.playerId.slice(0, 64) : '');
    if (!targetPlayerId) {
      return Response.json({ ok: false, error: 'Valid playerId or session required' }, { status: 401 });
    }
    if (order.notes?.playerId && targetPlayerId !== order.notes.playerId) {
      return Response.json({ ok: false, error: 'Order belongs to a different account' }, { status: 403 });
    }

    const claim = await claimGlobalTx(env, body.razorpay_payment_id, targetPlayerId);
    if (!claim.ok) {
      return Response.json({ ok: false, error: claim.error || 'Payment already redeemed' }, { status: claim.status || 409 });
    }

    await creditServerWallet(env, targetPlayerId, pack.coins, body.razorpay_payment_id);
    return Response.json({ ok: true, txId: body.razorpay_payment_id, packId: pack.id, coins: pack.coins });
  }

  if (url.pathname === '/api/payments/razorpay/subscribe' && request.method === 'POST') {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return Response.json(
        { ok: false, configured: false, error: 'Razorpay is not configured on this server.' },
        { status: 501 },
      );
    }
    let body = {};
    try { body = await request.json(); } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const targetPlayerId = verifiedPlayerId || (typeof body.playerId === 'string' && body.playerId.startsWith('guest:') ? body.playerId.slice(0, 64) : '');
    if (!targetPlayerId) {
      return Response.json({ ok: false, error: 'Valid playerId or session required' }, { status: 401 });
    }

    const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    let planId = env.RAZORPAY_VIP_PLAN_ID || (await getCachedVipPlanId(env));
    if (!planId) {
      const planRes = await fetch('https://api.razorpay.com/v1/plans', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: 'monthly',
          interval: 1,
          item: {
            name: `${VIP_SUBSCRIPTION.name} (Launch Offer)`,
            amount: VIP_SUBSCRIPTION.launchInrPaise,
            currency: 'INR',
            description: 'Unlocks Custom Characters, All Solo Levels, Voice Chat & 10,000 Coins/mo',
          },
        }),
      });
      const planJson = await planRes.json();
      if (!planRes.ok || !planJson.id) {
        return Response.json({ ok: false, error: planJson.error?.description ?? 'Failed to create Razorpay plan' }, { status: 502 });
      }
      planId = planJson.id;
      await setCachedVipPlanId(env, planId);
    }

    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 120,
        customer_notify: 1,
        notes: {
          type: VIP_SUBSCRIPTION.id,
          playerId: targetPlayerId,
        },
      }),
    });
    const subJson = await subRes.json();
    if (!subRes.ok || !subJson.id) {
      return Response.json({ ok: false, error: subJson.error?.description ?? 'Subscription creation failed' }, { status: 502 });
    }
    return Response.json({
      ok: true,
      subscriptionId: subJson.id,
      keyId: env.RAZORPAY_KEY_ID,
      amount: VIP_SUBSCRIPTION.launchInrPaise,
      currency: 'INR',
    });
  }

  if (url.pathname === '/api/payments/razorpay/subscribe/verify' && request.method === 'POST') {
    if (!env.RAZORPAY_KEY_SECRET) {
      return Response.json({ ok: false, configured: false, error: 'Razorpay not configured' }, { status: 501 });
    }
    let body = {};
    try { body = await request.json(); } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) {
      return Response.json({ ok: false, error: 'Missing subscription verification fields' }, { status: 400 });
    }
    const expectedHex = await hmacSha256Hex(
      `${body.razorpay_payment_id}|${body.razorpay_subscription_id}`,
      env.RAZORPAY_KEY_SECRET,
    );
    if (!timingSafeEqualHex(expectedHex, String(body.razorpay_signature).toLowerCase())) {
      return Response.json({ ok: false, error: 'Invalid Razorpay subscription signature' }, { status: 400 });
    }
    const targetPlayerId = verifiedPlayerId || (typeof body.playerId === 'string' && body.playerId.startsWith('guest:') ? body.playerId.slice(0, 64) : '');
    if (!targetPlayerId) {
      return Response.json({ ok: false, error: 'Valid playerId or session required' }, { status: 401 });
    }
    const claim = await claimGlobalTx(env, body.razorpay_payment_id, targetPlayerId);
    if (!claim.ok) {
      return Response.json({ ok: false, error: claim.error || 'Subscription payment already redeemed' }, { status: claim.status || 409 });
    }
    await activateServerVip(env, targetPlayerId, body.razorpay_subscription_id, body.razorpay_payment_id);
    return Response.json({ ok: true, txId: body.razorpay_payment_id, subscriptionId: body.razorpay_subscription_id });
  }

  if (url.pathname === '/api/payments/razorpay/webhook' && request.method === 'POST') {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      return Response.json({ ok: false, configured: false, error: 'RAZORPAY_WEBHOOK_SECRET not configured' }, { status: 501 });
    }
    const signature = request.headers.get('x-razorpay-signature') ?? '';
    const rawBody = await request.text();
    const valid = await verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
    if (!valid) {
      return Response.json({ ok: false, error: 'Invalid webhook signature' }, { status: 400 });
    }
    let eventName = 'unknown';
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed.event) eventName = parsed.event;
      const entity = parsed.payload?.payment?.entity;
      if ((eventName === 'payment.captured' || eventName === 'order.paid') && entity?.id) {
        const pack = getCoinPack(entity.notes?.packId);
        if (pack && entity.notes?.playerId) {
          const claim = await claimGlobalTx(env, entity.id, entity.notes.playerId);
          if (claim.ok) {
            await creditServerWallet(env, entity.notes.playerId, pack.coins, entity.id);
          }
        }
      }
      const subEntity = parsed.payload?.subscription?.entity;
      if ((eventName === 'subscription.activated' || eventName === 'subscription.charged') && subEntity?.notes?.playerId) {
        const txId = entity?.id ?? `${eventName}:${subEntity.id}`;
        const claim = await claimGlobalTx(env, txId, subEntity.notes.playerId);
        if (claim.ok) {
          await activateServerVip(env, subEntity.notes.playerId, subEntity.id, txId);
        }
      } else if ((eventName === 'subscription.cancelled' || eventName === 'subscription.halted') && subEntity?.notes?.playerId) {
        await cancelServerVip(env, subEntity.notes.playerId);
      }
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    return Response.json({ ok: true, received: eventName });
  }

  return null;
}
