// DOM HUD in Inkfinity style: level name, death counter, pigeon taunts, toasts, iris wipe & map.
const $ = (id) => document.getElementById(id);
const ICO_VOL_ON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14"/></svg>';
const ICO_VOL_OFF = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
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
    document.body.classList.remove('world-1', 'world-2', 'world-3', 'world-4');
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
  muteIcon(muted) { $('btn-mute').innerHTML = muted ? ICO_VOL_OFF : ICO_VOL_ON; },
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
  end(deaths) { $('end-deaths').textContent = deaths; $('end').hidden = false; },
};
