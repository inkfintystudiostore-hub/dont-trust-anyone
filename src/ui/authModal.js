import {
  getAuthState,
  loginWithGoogle,
  logoutAuth,
  subscribeAuth,
} from '../auth.js';

let modalEl = null;

const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5Z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7Z"/><path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 10.9 0 13s.6 4 1.6 5.9l3.7-4.1Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.3 7.4 24 12 24Z"/></svg>`;

export function openAuthModal() {
  if (!modalEl) {
    modalEl = document.createElement('section');
    modalEl.id = 'auth-modal';
    modalEl.className = 'overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Google Account');
    modalEl.innerHTML = `
      <div class="card" style="max-width:380px;">
        <div class="map-head">
          <h2>Account</h2>
          <button id="auth-close" class="pill btn-pill" type="button" aria-label="Close">✕</button>
        </div>
        <p class="sub" style="margin:6px 0 14px;">Sign in with Google to sync your coins, VIP pass, and progress across devices.</p>
        <div id="auth-logged-in" hidden>
          <div style="background:#fff4ec;border:1px solid #ecd6c8;border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-weight:800;font-size:15px;" id="auth-user-name"></div>
            <div style="font-size:12px;opacity:.72;margin-top:2px;" id="auth-user-email"></div>
          </div>
          <button id="auth-logout" class="btn ghost" type="button" style="width:100%;">Sign Out</button>
        </div>
        <div id="auth-logged-out">
          <button id="auth-google" class="btn" type="button" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#1f1916;border:1.5px solid #d9c9bb;box-shadow:0 2px 8px rgba(31,25,22,.08);">
            ${GOOGLE_ICON}
            <span>Continue with Google</span>
          </button>
          <p id="auth-error" style="color:#c92a2a;font-size:12px;min-height:18px;margin:10px 0 0;text-align:center;"></p>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    const closeBtn = modalEl.querySelector('#auth-close');
    const googleBtn = modalEl.querySelector('#auth-google');
    const logoutBtn = modalEl.querySelector('#auth-logout');
    const errEl = modalEl.querySelector('#auth-error');

    closeBtn.addEventListener('click', () => { modalEl.hidden = true; });
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.hidden = true; });

    googleBtn.addEventListener('click', async () => {
      errEl.textContent = '';
      googleBtn.disabled = true;
      const res = await loginWithGoogle();
      googleBtn.disabled = false;
      if (res.ok) modalEl.hidden = true;
      else errEl.textContent = res.error || 'Google sign-in failed';
    });

    logoutBtn.addEventListener('click', async () => {
      await logoutAuth();
      modalEl.hidden = true;
    });

    subscribeAuth((st) => {
      const loggedInBox = modalEl.querySelector('#auth-logged-in');
      const loggedOutBox = modalEl.querySelector('#auth-logged-out');
      const nameEl = modalEl.querySelector('#auth-user-name');
      const emailEl = modalEl.querySelector('#auth-user-email');
      if (st.user) {
        loggedInBox.hidden = false;
        loggedOutBox.hidden = true;
        nameEl.textContent = st.user.displayName || 'Player';
        emailEl.textContent = st.user.username || '';
      } else {
        loggedInBox.hidden = true;
        loggedOutBox.hidden = false;
      }
      if (st.error) errEl.textContent = st.error;
    });
  }

  const cur = getAuthState();
  modalEl.querySelector('#auth-error').textContent = cur.error || '';
  modalEl.hidden = false;
}
