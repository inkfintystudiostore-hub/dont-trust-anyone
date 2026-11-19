/**
 * Portal-agnostic rewarded & interstitial video ad adapter.
 * Uses PokiSDK, CrazyGames SDK, or Google H5 Games Ads (adBreak) when available;
 * falls back to an in-app callback for standalone web/dev.
 */

let fallbackHandler = null;
let interstitialFallbackHandler = null;

export function registerAdFallbackHandler(handler) {
  fallbackHandler = handler;
}

export function registerInterstitialFallbackHandler(handler) {
  interstitialFallbackHandler = handler;
}

function showH5RewardedAd(adBreak) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 3000);
    try {
      adBreak({
        type: 'reward',
        name: 'rewarded_coins',
        beforeReward: (showAdFn) => {
          clearTimeout(timer);
          showAdFn();
        },
        adDismissed: () => finish(false),
        adViewed: () => finish(true),
        adBreakDone: (info) => {
          clearTimeout(timer);
          if (info?.breakStatus && info.breakStatus !== 'viewed') {
            finish(false);
          }
        },
      });
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

export async function showRewardedAd() {
  if (typeof window === 'undefined') return false;

  if (window.PokiSDK?.rewardedBreak) {
    try {
      return await window.PokiSDK.rewardedBreak();
    } catch {
      return false;
    }
  }

  if (window.CrazyGames?.SDK?.ad?.requestAd) {
    try {
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      return true;
    } catch {
      return false;
    }
  }

  if (window.adBreak) {
    const ok = await showH5RewardedAd(window.adBreak);
    if (ok) return true;
  }

  if (fallbackHandler) {
    return await fallbackHandler();
  }

  return false;
}

function showH5InterstitialAd(adBreak, placementName) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 3000);
    try {
      adBreak({
        type: 'next',
        name: placementName,
        beforeAd: () => clearTimeout(timer),
        afterAd: () => finish(true),
        adBreakDone: (info) => {
          clearTimeout(timer);
          finish(info?.breakStatus === 'viewed' || info?.breakStatus === 'dismissed');
        },
      });
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

export async function showInterstitialAd(
  placementName = 'create_private_room',
  fallbackDurationSec = 5,
) {
  if (typeof window === 'undefined') return true;

  if (window.PokiSDK?.commercialBreak) {
    try {
      await window.PokiSDK.commercialBreak();
      return true;
    } catch {
      return true;
    }
  }

  if (window.CrazyGames?.SDK?.ad?.requestAd) {
    try {
      await window.CrazyGames.SDK.ad.requestAd('midgame');
      return true;
    } catch {
      return true;
    }
  }

  if (window.adBreak) {
    const shown = await showH5InterstitialAd(window.adBreak, placementName);
    if (shown) return true;
  }

  if (interstitialFallbackHandler) {
    return await interstitialFallbackHandler(fallbackDurationSec);
  }

  return true;
}
