// DOM HUD in Inkfinity style: level name, death counter, pigeon taunts, toasts, iris wipe & map.
const $ = (id) => document.getElementById(id);
const ICO_VOL_ON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14"/></svg>';
const ICO_VOL_OFF = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
const ICO_FS_ENTER = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICO_FS_EXIT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
let tauntTimer = 0;
let toastTimer = 0;
let irisTimer = 0;

export const hud = {
  show() { $('hud').hidden = false; },
  hide() { $('hud').hidden = true; hud.clearPopups(); },
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
  flipped(on) { $('flip-badge').hidden = !on; },
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
    if (el) {
      el.innerHTML = active ? ICO_FS_EXIT : ICO_FS_ENTER;
      el.setAttribute('aria-pressed', String(!!active));
      el.setAttribute('aria-label', active ? 'Exit Fullscreen' : 'Enter Fullscreen');
    }
  },
  hideFullscreenBtn() {
    const el = $('btn-fullscreen');
    if (el) el.hidden = true;
  },
  coopControls(isCoop) {
    const leaveBtn = $('btn-leave');
    if (leaveBtn) leaveBtn.hidden = !isCoop;
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
