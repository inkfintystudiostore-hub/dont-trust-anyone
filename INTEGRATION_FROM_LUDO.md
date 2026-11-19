# Integration Guide: Porting Monetization, AdSense, Login & Bots from `d:\3D LUDO`

This document maps out how to port the **Monetization**, **AdSense / Rewarded Ads**, **Login / Auth**, and **Bot** systems from `d:\3D LUDO` (React + TypeScript) into **Don't Trust Anyone** (`C:\Users\user\DONT TRUST ANYONE`, Vanilla JS + Three.js + Vite + Cloudflare Workers).

---

## 1. Architecture Differences
* **`d:\3D LUDO`**: React + TypeScript (`.tsx` / `.ts`), Zustand stores, Cloudflare Workers (`wrangler.toml`, `worker/*.ts`).
* **`Don't Trust Anyone`**: Vanilla JS (`.js`), Three.js, Vite, Cloudflare Workers (`wrangler.toml`, `worker/index.js`, `worker/roomLogic.js`).
* **Strategy**: Port the **Cloudflare Worker Durable Objects & API routes** to `.js` in `worker/`, and port the **client stores & UI** to plain `.js` modules + vanilla DOM modals matching `src/ui/lobby.js` and `src/style.css`.

---

## 2. Monetization & Wallet (Razorpay + `WalletDO`)

### Source files in `d:\3D LUDO`
* `src/engine/shopCatalog.ts` — INR coin packs (`starter`: 2,500 / ₹79, `popular`: 15,000 / ₹399, `mega`: 40,000 / ₹799).
* `worker/payments.ts` — `/api/payments/razorpay/order`, HMAC-SHA256 signature verification (`verifyRazorpaySignature`, `verifyRazorpayWebhookSignature`), and `PLAYER_WALLET` crediting.
* `worker/walletDO.ts` — `WalletDO` Durable Object for server-side coin balance & transaction idempotency.
* `src/engine/walletStore.ts` & `src/ui/CoinShopModal.tsx` — Client wallet state & shop UI.

### Steps for `Don't Trust Anyone`
1. **Worker**:
   * Port `worker/walletDO.ts` → `worker/walletDO.js` and `worker/payments.ts` → `worker/payments.js`.
   * Add `PLAYER_WALLET` Durable Object binding + migration in `wrangler.toml`.
   * Route `/api/payments/razorpay/*` and `/api/wallet/*` in `worker/index.js`.
   * Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in Wrangler secrets.
2. **Client**:
   * Port `shopCatalog.ts` → `src/shopCatalog.js` and `walletStore.ts` → `src/wallet.js`.
   * Create a vanilla DOM shop modal `src/ui/shopModal.js` to buy coin packs or unlock skins (`src/skins.js`) / level skips.

---

## 3. AdSense & Rewarded Ads

### Source files in `d:\3D LUDO`
* `public/ads.txt` — `google.com, pub-9649669731732434, DIRECT, f08c47fec0942fa0`
* `src/ui/AdBannerBars.tsx` — Top/bottom banner bars with `<ins className="adsbygoogle">` and Inkfinity Studio promo fallback when `adSlotId` is unset.
* `src/engine/adAdapter.ts` & `src/ui/RewardedAdOverlay.tsx` — `showRewardedAd()` supporting `PokiSDK`, `CrazyGames`, Google H5 Games Ads (`adBreak`), and a custom UI fallback.

### Steps for `Don't Trust Anyone`
1. Copy `d:\3D LUDO\public\ads.txt` → `public/ads.txt`.
2. Add the Google AdSense `<script>` tag to `index.html`.
3. Port `src/engine/adAdapter.ts` → `src/adAdapter.js` (remove the dev shortcut `return true` for production, or wire a DOM rewarded-ad overlay `src/ui/rewardedAdOverlay.js` for free skips/coins).
4. Add `src/ui/adBanners.js` for top/bottom banner bars with your AdSense `adSlotId`s.

---

## 4. Login & Auth System (`AccountDO` + Firebase + Session Tokens)

### Source files in `d:\3D LUDO`
* `worker/auth.ts` — `AccountDO` Durable Object (`/register`, `/login`, `/me`).
* `worker/authHelpers.ts` — Salted password hashing (`hashPassword`, `verifyPassword`) and bearer session tokens (`createSessionToken`, `verifySessionToken`).
* `worker/firebaseAuth.ts` — Firebase ID token verification.
* `src/engine/authStore.ts`, `src/engine/firebase.ts`, `src/ui/AuthModal.tsx` — Client auth state & modal.

### Steps for `Don't Trust Anyone`
1. **Worker**:
   * Port `worker/auth.ts`, `worker/authHelpers.ts`, and `worker/firebaseAuth.ts` to `.js` in `worker/`.
   * Add `ACCOUNT_DO` Durable Object binding + migration in `wrangler.toml`.
   * Route `/api/auth/*` in `worker/index.js`.
2. **Client**:
   * Port `src/engine/authStore.ts` → `src/auth.js` and build a vanilla DOM login/register modal `src/ui/authModal.js`.
   * Link authenticated accounts to `acct:<accountId>` in `src/wallet.js` so coins/skins sync across devices.

---

## 5. Bot Implementations

### Source files in `d:\3D LUDO`
* `src/engine/botNames.ts` — `generateRandomPlayerName` (90% pan-India, 10% international; 70% first name, 30% full name), `pickUniqueBotNames`, and `pickBotEmote`.

### Steps for `Don't Trust Anyone`
1. Port `src/engine/botNames.ts` → `src/botNames.js`.
2. Use `pickUniqueBotNames` in `src/ui/lobby.js` / `worker/roomLogic.js` when populating co-op or lobby bots.
