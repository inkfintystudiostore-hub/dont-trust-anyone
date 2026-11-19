import { DurableObject } from 'cloudflare:workers';
import {
  hashPassword,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './authHelpers.js';

export {
  createSessionToken,
  extractBearerToken,
  hashPassword,
  normalizeUsername,
  resolveAuthSecret,
  validatePassword,
  validateUsername,
  verifyPassword,
  verifySessionToken,
} from './authHelpers.js';

function toPublicAccount(acc) {
  return {
    accountId: acc.accountId,
    username: acc.username,
    displayName: acc.displayName,
    walletId: acc.walletId,
    createdAt: acc.createdAt,
  };
}

export class AccountDO extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const existing = await this.ctx.storage.get('account');

    if (url.pathname === '/me' && request.method === 'GET') {
      if (!existing) {
        return Response.json({ ok: false, error: 'Account not found' }, { status: 404 });
      }
      return Response.json({ ok: true, account: toPublicAccount(existing) });
    }

    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    if (url.pathname === '/register') {
      if (existing) {
        return Response.json({ ok: false, error: 'That username is already taken.' }, { status: 409 });
      }
      const userCheck = validateUsername(String(body.username ?? ''));
      if (!userCheck.ok) {
        return Response.json({ ok: false, error: userCheck.error }, { status: 400 });
      }
      const passCheck = validatePassword(String(body.password ?? ''));
      if (!passCheck.ok) {
        return Response.json({ ok: false, error: passCheck.error }, { status: 400 });
      }
      const rawDisplay = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 18) : '';
      const displayName = rawDisplay || userCheck.username.slice(0, 18);
      const accountId = crypto.randomUUID();
      const { hash, salt } = await hashPassword(passCheck.password);
      const created = {
        accountId,
        username: userCheck.username,
        displayName,
        walletId: `acct:${accountId}`,
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
      };
      await this.ctx.storage.put('account', created);
      return Response.json({ ok: true, account: toPublicAccount(created) });
    }

    if (url.pathname === '/login') {
      if (!existing) {
        return Response.json({ ok: false, error: 'Invalid username or password.' }, { status: 401 });
      }
      const password = String(body.password ?? '');
      if (!password) {
        return Response.json({ ok: false, error: 'Password is required.' }, { status: 400 });
      }
      const valid = await verifyPassword(password, existing.salt, existing.passwordHash);
      if (!valid) {
        return Response.json({ ok: false, error: 'Invalid username or password.' }, { status: 401 });
      }
      return Response.json({ ok: true, account: toPublicAccount(existing) });
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
}
