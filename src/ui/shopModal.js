import { COIN_PACKS, VIP_SUBSCRIPTION } from '../shopCatalog.js';
import { showRewardedAd } from '../adAdapter.js';
import {
  buyCoinPackWithRazorpay,
  claimAdReward,
  isVipActive,
  refreshWallet,
  subscribeVipWithRazorpay,
  subscribeWallet,
} from '../wallet.js';

let modalEl = null;

export function openShopModal(initialMessage = '') {
  if (!modalEl) {
    modalEl = document.createElement('section');
    modalEl.id = 'shop-modal';
    modalEl.className = 'overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Coin Shop & VIP Pass');
    modalEl.innerHTML = `
      <div class="card" style="max-width:440px;text-align:left;">
        <div class="map-head" style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <h2 style="margin:0;">Shop & VIP</h2>
            <span class="pill coin-pill" style="pointer-events:none;">
              <span>🪙</span><span id="shop-balance">500</span>
            </span>
          </div>
          <button id="shop-close" class="pill btn-pill" type="button" aria-label="Close">✕</button>
        </div>

        <div id="shop-vip-card" style="background:linear-gradient(135deg,#fff6d6 0%,#ffe0ea 100%);border:2px solid #8b0d1a;border-radius:16px;padding:14px;margin-bottom:12px;color:#1f1916;box-shadow:0 8px 20px rgba(139,13,26,.12);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="font-size:16px;">👑 ${VIP_SUBSCRIPTION.name}</strong>
            <span style="background:#8b0d1a;color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;letter-spacing:.03em;">${VIP_SUBSCRIPTION.badge}</span>
          </div>
          <ul style="margin:8px 0 12px;padding-left:18px;font-size:12.5px;line-height:1.5;font-weight:600;">
            ${VIP_SUBSCRIPTION.perks.map((p) => `<li>${p}</li>`).join('')}
          </ul>
          <button id="shop-vip-btn" class="btn" type="button" style="width:100%;margin:0;">
            Unlock VIP · <s style="opacity:.7;font-weight:500;">${VIP_SUBSCRIPTION.regularInrLabel}</s> ${VIP_SUBSCRIPTION.launchInrLabel}
          </button>
        </div>

        <button id="shop-free-ad" class="btn ghost" type="button" style="width:100%;margin-bottom:10px;">
          🎬 Watch Video Ad for +150 Coins
        </button>

        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.65;margin:4px 0 6px;">Coin Packs</div>
        <div id="shop-packs" style="display:grid;gap:8px;"></div>
        <p id="shop-status" style="font-size:12.5px;font-weight:600;min-height:18px;margin:10px 0 0;text-align:center;color:#8b0d1a;"></p>
      </div>
    `;
    document.body.appendChild(modalEl);

    const closeBtn = modalEl.querySelector('#shop-close');
    const balanceEl = modalEl.querySelector('#shop-balance');
    const statusEl = modalEl.querySelector('#shop-status');
    const freeAdBtn = modalEl.querySelector('#shop-free-ad');
    const packsEl = modalEl.querySelector('#shop-packs');
    const vipBtn = modalEl.querySelector('#shop-vip-btn');

    closeBtn.addEventListener('click', () => { modalEl.hidden = true; });
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.hidden = true; });

    vipBtn.addEventListener('click', async () => {
      if (isVipActive()) return;
      statusEl.textContent = 'Opening Razorpay Subscription…';
      const res = await subscribeVipWithRazorpay();
      if (res.ok) {
        statusEl.textContent = 'VIP Pass activated! +10,000 coins & all perks unlocked!';
      } else if (res.cancelled) {
        statusEl.textContent = 'Subscription cancelled.';
      } else {
        statusEl.textContent = res.error || 'Subscription failed.';
      }
    });

    for (const pack of COIN_PACKS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.style.cssText = `display:flex;justify-content:space-between;align-items:center;background:${pack.accent};color:#1f1916;margin:0;border:1.5px solid rgba(31,25,22,.16);`;
      btn.innerHTML = `<span>🪙 <strong>${pack.coins.toLocaleString()}</strong> Coins ${pack.badge ? `<small style="background:rgba(255,255,255,.7);padding:1px 6px;border-radius:999px;font-size:10px;margin-left:4px;">${pack.badge}</small>` : ''}</span><strong style="background:#fff;padding:3px 10px;border-radius:999px;font-size:13px;">${pack.inrLabel}</strong>`;
      btn.addEventListener('click', async () => {
        statusEl.textContent = 'Opening Razorpay Checkout…';
        const res = await buyCoinPackWithRazorpay(pack.id);
        if (res.ok) {
          statusEl.textContent = `Added +${res.coins.toLocaleString()} coins!`;
        } else if (res.cancelled) {
          statusEl.textContent = 'Payment cancelled.';
        } else {
          statusEl.textContent = res.error || 'Payment failed.';
        }
      });
      packsEl.appendChild(btn);
    }

    freeAdBtn.addEventListener('click', async () => {
      statusEl.textContent = 'Loading rewarded ad…';
      const ok = await showRewardedAd();
      if (!ok) {
        statusEl.textContent = 'No rewarded ad available right now.';
        return;
      }
      const rewardRes = await claimAdReward();
      if (rewardRes?.ok) {
        statusEl.textContent = `+${rewardRes.reward ?? 150} coins added!`;
      } else {
        statusEl.textContent = rewardRes?.error || 'Could not claim ad reward.';
      }
    });

    subscribeWallet((w) => {
      balanceEl.textContent = (w.balance ?? 0).toLocaleString();
      if (w.vipActive) {
        vipBtn.disabled = true;
        vipBtn.textContent = '👑 VIP Active (All Perks Unlocked)';
      } else {
        vipBtn.disabled = false;
        vipBtn.innerHTML = `Unlock VIP · <s style="opacity:.7;font-weight:500;">${VIP_SUBSCRIPTION.regularInrLabel}</s> ${VIP_SUBSCRIPTION.launchInrLabel}`;
      }
    });
  }

  modalEl.querySelector('#shop-status').textContent = initialMessage || '';
  refreshWallet();
  modalEl.hidden = false;
}
