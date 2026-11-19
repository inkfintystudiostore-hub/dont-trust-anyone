/**
 * PWA installation & Service Worker registration.
 * Captures `beforeinstallprompt` for one-click install on supported browsers,
 * and provides an Add-to-Home-Screen guide modal on iOS / unsupported browsers.
 */

export function isStandaloneMode(win = window) {
  if (!win) return false;
  if (win.navigator?.standalone === true) return true;
  if (typeof win.matchMedia === 'function') {
    if (win.matchMedia('(display-mode: standalone)').matches) return true;
    if (win.matchMedia('(display-mode: fullscreen)').matches) return true;
  }
  return false;
}

export function isIosUserAgent(ua = '') {
  return /iphone|ipad|ipod/i.test(ua);
}

export function getInstallPlatform(win = window) {
  if (isStandaloneMode(win)) return 'installed';
  const ua = win?.navigator?.userAgent || '';
  if (isIosUserAgent(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function initPwa({ onInstalled } = {}) {
  const installBtn = document.getElementById('install-app');
  const helpModal = document.getElementById('install-help');
  const helpClose = document.getElementById('install-help-close');
  const helpTitle = document.getElementById('install-help-title');
  const helpSteps = document.getElementById('install-help-steps');

  let deferredPrompt = null;

  const updateInstallVisibility = () => {
    if (!installBtn) return;
    installBtn.hidden = isStandaloneMode(window);
  };

  const openHelpModal = () => {
    if (!helpModal || !helpTitle || !helpSteps) return;
    const platform = getInstallPlatform(window);
    if (platform === 'ios') {
      helpTitle.textContent = 'Add to Home Screen (iPhone / iPad)';
      helpSteps.innerHTML =
        '<li>Tap the <strong>Share</strong> button (square with up arrow) in Safari.</li>' +
        '<li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>' +
        '<li>Tap <strong>Add</strong> — launch the game right from your home screen!</li>';
    } else if (platform === 'android') {
      helpTitle.textContent = 'Install App on Android';
      helpSteps.innerHTML =
        '<li>Open your browser menu (<strong>⋮</strong> in Chrome).</li>' +
        '<li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>' +
        '<li>Confirm <strong>Install</strong> to add it to your home screen!</li>';
    } else {
      helpTitle.textContent = 'Install Desktop Browser App';
      helpSteps.innerHTML =
        '<li>Click the <strong>Install</strong> icon (⊕ / monitor) in your browser address bar, or open the browser menu (<strong>⋮</strong> / <strong>⋯</strong>).</li>' +
        '<li>Select <strong>Install Don\'t Trust Anyone</strong> (or <strong>Add to Home screen / Dock</strong>).</li>' +
        '<li>Launch it anytime like a standalone app!</li>';
    }
    helpModal.hidden = false;
    helpClose?.focus();
  };

  const closeHelpModal = () => {
    if (!helpModal) return;
    helpModal.hidden = true;
    installBtn?.focus();
  };

  updateInstallVisibility();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn && !isStandaloneMode(window)) {
      installBtn.hidden = false;
      installBtn.dataset.ready = 'native';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
    if (helpModal) helpModal.hidden = true;
    onInstalled?.();
  });

  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPrompt = null;
          installBtn.hidden = true;
        }
      } catch {
        // Ignore if prompt was dismissed or unavailable
      }
      return;
    }
    openHelpModal();
  });

  helpClose?.addEventListener('click', closeHelpModal);
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelpModal();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
