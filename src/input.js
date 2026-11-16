// Keyboard + touch buttons + gamepad -> one shared input object (read every frame, never reallocated).
export const input = { left: false, right: false, down: false, jump: false, restart: false };
const pad = { left: false, right: false, down: false, jump: false, restart: false };
const keys = { left: false, right: false, down: false, jump: false, restart: false };
const touch = { left: false, right: false, down: false, jump: false, restart: false };

/** Call once per frame. Standard mapping: d-pad / left stick move, down fast-fall, A (0) jump, Start (9) restart. */
export function pollGamepad() {
  const gp = navigator.getGamepads?.()[0];
  pad.left = pad.right = pad.down = pad.jump = pad.restart = false;
  if (gp) {
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    pad.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
    pad.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
    pad.down = ay > 0.5 || !!gp.buttons[13]?.pressed;
    pad.jump = !!gp.buttons[0]?.pressed || !!gp.buttons[12]?.pressed;
    pad.restart = !!gp.buttons[9]?.pressed;
  }
  for (const k in input) input[k] = keys[k] || pad[k] || touch[k];
  return pad.jump || pad.restart;
}

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyR: 'restart',
};

export function bindInput(onFirstInput) {
  let first = true;
  const kick = () => { if (first) { first = false; onFirstInput?.(); } };
  addEventListener('keydown', (e) => {
    const k = KEYS[e.code];
    if (!k) return;
    if (e.target.closest?.('button') && e.code === 'Space') return; // let Space press focused menu buttons
    e.preventDefault();
    keys[k] = true;
    kick();
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = touch[k] = false; });

  const padEl = document.getElementById('touch');
  if (matchMedia('(pointer: coarse)').matches) { padEl.hidden = false; document.body.classList.add('touch'); }
  const activeDirs = new Map();
  const btnL = padEl.querySelector('[data-k="left"]');
  const btnR = padEl.querySelector('[data-k="right"]');
  const syncDirs = () => {
    let l = false, r = false;
    for (const v of activeDirs.values()) { if (v === 'left') l = true; else if (v === 'right') r = true; }
    touch.left = l; touch.right = r;
    btnL?.classList.toggle('on', l); btnR?.classList.toggle('on', r);
  };
  for (const b of padEl.querySelectorAll('button')) {
    const k = b.dataset.k;
    if (k === 'left' || k === 'right') {
      const pickDir = (x, y) => {
        const hit = document.elementFromPoint(x, y)?.closest?.('#touch button[data-k]');
        if (hit?.dataset.k === 'left' || hit?.dataset.k === 'right') return hit.dataset.k;
        if (btnL && btnR) {
          const mid = (btnL.getBoundingClientRect().right + btnR.getBoundingClientRect().left) * 0.5;
          return x <= mid ? 'left' : 'right';
        }
        return k;
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        activeDirs.set(e.pointerId, pickDir(e.clientX, e.clientY));
        syncDirs();
        kick();
      });
      b.addEventListener('pointermove', (e) => {
        if (!activeDirs.has(e.pointerId)) return;
        activeDirs.set(e.pointerId, pickDir(e.clientX, e.clientY));
        syncDirs();
      });
      const clearDir = (e) => { activeDirs.delete(e.pointerId); syncDirs(); };
      b.addEventListener('pointerup', clearDir);
      b.addEventListener('pointercancel', clearDir);
    } else {
      const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle('on', v); if (v) kick(); };
      b.addEventListener('pointerdown', on(true));
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, on(false));
    }
  }
}
