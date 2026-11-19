// DOM HUD in Inkfinity style: level name, death counter, pigeon taunts, toasts, iris wipe & map.
const $ = (id) => document.getElementById(id);
const ICO_VOL_ON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14"/></svg>';
const ICO_VOL_OFF = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
const ICO_FS_ENTER = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICO_FS_EXIT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
let tauntTimer = 0;
let toastTimer = 0;
let irisTimer = 0;
let lastFlipped = null;
let flipBadgeEl = null;
let lastCoopSnap = null;
let netStats = { p2p: false, pingMs: null };

function renderCoopPresence() {
  const el = $('coop-presence');
  if (!el) return;
  if (!lastCoopSnap || !lastCoopSnap.seats) { el.hidden = true; return; }
  el.hidden = false;
  const online = lastCoopSnap.seats.filter((s) => s.occupant === 'human' && s.connected).length;
  if (online >= 2) {
    const mode = netStats.p2p ? 'P2P' : 'Relay';
    const ping = Number.isFinite(netStats.pingMs) ? ` · ${netStats.pingMs}ms` : '';
    el.textContent = ping ? `🟢 ${mode}${ping}` : '🟢 2/2 Online';
    if (Number.isFinite(netStats.pingMs) && netStats.pingMs > 150) el.style.color = '#b91c1c';
    else if (Number.isFinite(netStats.pingMs) && netStats.pingMs >= 80) el.style.color = '#b45309';
    else el.style.color = '#1b7a4b';
  } else {
    el.textContent = '🟡 Partner Offline (30s)';
    el.style.color = '#b45309';
  }
}

export const hud = {
  show() { $('hud').hidden = false; },
  hide() { $('hud').hidden = true; hud.chatOpen(false); hud.clearPopups(); },
  clearPopups() {
    clearTimeout(tauntTimer);
    clearTimeout(toastTimer);
    $('taunt').hidden = true;
    const el = $('toast');
    el.hidden = true;
    el.className = '';
  },
  level(index, name, world = 1) {
    $('level-name').textContent = `L${index + 1}: ${name}`;
    document.body.classList.remove('world-1', 'world-2', 'world-3', 'world-4', 'world-5');
    document.body.classList.add(`world-${world}`);
  },
  deaths(n) {
    $('deaths').textContent = n;
    const pill = $('deaths').parentElement;
    pill.classList.remove('bump', 'milestone');
    void pill.offsetWidth;
    pill.classList.add(n > 0 && (n === 10 || n === 25 || n === 50) ? 'milestone' : 'bump');
  },
  taunt(text) {
    $('taunt-text').textContent = text;
    $('taunt').hidden = false;
    clearTimeout(tauntTimer);
    tauntTimer = setTimeout(() => { $('taunt').hidden = true; }, 2400);
  },
  toast(text, ms = 1400, mode = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = '';
    el.hidden = false;
    void el.offsetWidth;
    if (mode) el.className = mode;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; el.className = ''; }, ms);
  },
  flipped(on) {
    const next = Boolean(on);
    if (next === lastFlipped) return;
    lastFlipped = next;
    (flipBadgeEl ??= $('flip-badge')).hidden = !next;
  },
  doorWait(on, text) {
    const el = $('door-badge');
    if (!el) return;
    el.hidden = !on;
    if (text) el.textContent = text;
  },
  muteIcon(muted) {
    const btn = $('btn-mute');
    btn.innerHTML = muted ? ICO_VOL_OFF : ICO_VOL_ON;
    btn.setAttribute('aria-pressed', String(!!muted));
    btn.setAttribute('aria-label', muted ? 'Unmute Sound' : 'Mute Sound');
  },
  fullscreenIcon(active) {
    const el = $('btn-fullscreen');
    if (!el) return;
    const icoWrap = el.querySelector('.ico-wrap');
    if (icoWrap) icoWrap.innerHTML = active ? ICO_FS_EXIT : ICO_FS_ENTER;
    else el.innerHTML = active ? ICO_FS_EXIT : ICO_FS_ENTER;
    const lbl = el.querySelector('.fs-label');
    if (lbl) lbl.textContent = active ? 'Minimize' : 'Full';
    el.setAttribute('aria-pressed', String(!!active));
    el.setAttribute('aria-label', active ? 'Minimize to Normal Mode' : 'Enter Fullscreen');
    el.setAttribute('title', active ? 'Minimize to Normal Mode' : 'Fullscreen (Landscape)');
  },
  hideFullscreenBtn() {
    const el = $('btn-fullscreen');
    if (el) el.hidden = true;
  },
  coopControls(isCoop) {
    const leaveBtn = $('btn-leave');
    if (leaveBtn) leaveBtn.hidden = !isCoop;
    const chatBtn = $('btn-chat');
    if (chatBtn) chatBtn.hidden = !isCoop;
    const voiceBtn = $('btn-voice');
    if (voiceBtn) voiceBtn.hidden = !isCoop;
    const pres = $('coop-presence');
    if (pres && !isCoop) pres.hidden = true;
    if (!isCoop) {
      hud.chatOpen(false);
      hud.clearChat();
    }
  },
  isChatOpen() {
    const panel = $('game-chat');
    return Boolean(panel && !panel.hidden);
  },
  chatOpen(open) {
    const panel = $('game-chat');
    if (!panel) return;
    panel.hidden = !open;
    const btn = $('btn-chat');
    if (btn) btn.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) {
      const dot = $('chat-unread');
      if (dot) dot.hidden = true;
    }
  },
  chatMessage(senderName, text, isMe = false) {
    const log = $('game-chat-log');
    if (log) {
      const row = document.createElement('div');
      row.className = `chat-msg${isMe ? ' me' : ''}`;
      const b = document.createElement('b');
      b.textContent = `${senderName}:`;
      const span = document.createElement('span');
      span.textContent = text;
      row.append(b, span);
      log.appendChild(row);
      while (log.children.length > 40) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
    if (!isMe && !hud.isChatOpen()) {
      const dot = $('chat-unread');
      if (dot) dot.hidden = false;
      hud.toast(`💬 ${senderName}: ${text}`, 2800);
    }
  },
  clearChat() {
    const log = $('game-chat-log');
    if (log) log.innerHTML = '';
    const dot = $('chat-unread');
    if (dot) dot.hidden = true;
  },
  coopPresence(snap) {
    lastCoopSnap = snap;
    renderCoopPresence();
  },
  coopNetStats(stats) {
    if (stats) netStats = { ...netStats, ...stats };
    renderCoopPresence();
  },
  portraitHint(show) { $('rotate-hint').hidden = !show; },
  iris(onDone, reducedMotion = false) {
    if (reducedMotion) { onDone(); return; }
    const el = $('iris');
    clearTimeout(irisTimer);
    el.classList.add('closed');
    irisTimer = setTimeout(() => {
      onDone();
      requestAnimationFrame(() => el.classList.remove('closed'));
    }, 380);
  },
  cancelIris() {
    clearTimeout(irisTimer);
    $('iris').classList.remove('closed');
  },
  end(deaths, isGuestCoop = false) {
    $('end-deaths').textContent = deaths;
    $('again').hidden = isGuestCoop;
    $('end-map').hidden = isGuestCoop;
    $('end-wait-guest').hidden = !isGuestCoop;
    $('end-leave').hidden = !isGuestCoop;
    $('end').hidden = false;
    (isGuestCoop ? $('end-leave') : $('again')).focus();
  },
};
