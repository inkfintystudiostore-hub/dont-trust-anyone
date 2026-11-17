// Keyboard + virtual analog joystick + touch buttons + gamepad -> one shared input object.
export const input = { left: false, right: false, moveX: 0, down: false, jump: false, restart: false };
const pad = { left: false, right: false, moveX: 0, down: false, jump: false, restart: false };
const keys = { left: false, right: false, down: false, jump: false, restart: false };
const touch = { left: false, right: false, moveX: 0, down: false, jump: false, restart: false };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let resetTouchFn = () => {};
let jumpLatched = false;

/** Clears any active virtual joystick or touch button hold (e.g., on modal/menu transitions). */
export function clearTouchInput() {
  resetTouchFn();
}

/** Call once per frame. Standard mapping: d-pad / left stick move, down fast-fall, A (0) jump, Start (9) restart. */
export function pollGamepad() {
  const gp = navigator.getGamepads?.()[0];
  pad.left = pad.right = pad.down = pad.jump = pad.restart = false;
  pad.moveX = 0;
  if (gp) {
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    pad.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
    pad.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
    pad.moveX = Math.abs(ax) > 0.16 ? clamp(ax, -1, 1) : (gp.buttons[15]?.pressed ? 1 : gp.buttons[14]?.pressed ? -1 : 0);
    pad.down = ay > 0.5 || !!gp.buttons[13]?.pressed;
    pad.jump = !!gp.buttons[0]?.pressed || !!gp.buttons[12]?.pressed;
    pad.restart = !!gp.buttons[9]?.pressed;
  }
  input.left = keys.left || pad.left || touch.left;
  input.right = keys.right || pad.right || touch.right;
  input.down = keys.down || pad.down || touch.down;
  input.jump = keys.jump || pad.jump || touch.jump || jumpLatched;
  jumpLatched = false;
  input.restart = keys.restart || pad.restart || touch.restart;
  const keyMove = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  input.moveX = keyMove !== 0 ? keyMove : (Math.abs(touch.moveX) > 0.01 ? touch.moveX : pad.moveX);
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
  const padEl = document.getElementById('touch');
  const joyZone = document.getElementById('joy-zone');
  const joyBase = document.getElementById('joy-base');
  const joyKnob = document.getElementById('joy-knob');
  const joyDownHint = document.getElementById('joy-down-hint');

  let joyPointerId = null;
  let joyCx = 0;
  let joyCy = 0;
  const btnPointers = new Map();

  const enableTouchUI = () => {
    if (!padEl) return;
    padEl.hidden = false;
    document.body.classList.add('touch');
  };
  if (matchMedia('(pointer: coarse)').matches) enableTouchUI();

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') enableTouchUI();
  }, { passive: true });

  resetTouchFn = () => {
    joyPointerId = null;
    btnPointers.clear();
    touch.left = touch.right = touch.down = touch.jump = touch.restart = false;
    touch.moveX = 0;
    if (joyKnob) joyKnob.style.transform = '';
    joyZone?.classList.remove('active');
    joyDownHint?.classList.remove('on');
    for (const b of padEl?.querySelectorAll('button') ?? []) b.classList.remove('on');
  };

  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const k = KEYS[e.code];
    if (!k) return;
    if (e.target.closest?.('button') && e.code === 'Space') return; // let Space press focused menu buttons
    e.preventDefault();
    if (k === 'jump' && !keys.jump) jumpLatched = true;
    keys[k] = true;
    kick();
  });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    resetTouchFn();
  });

  if (joyZone && joyBase && joyKnob) {
    const maxRadius = 42;
    const deadzone = 0.14;

    const updateStick = (clientX, clientY) => {
      let dx = clientX - joyCx;
      let dy = clientY - joyCy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        const s = maxRadius / dist;
        dx *= s;
        dy *= s;
      }
      joyKnob.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;

      const nx = dx / maxRadius;
      const ny = dy / maxRadius;
      const magX = Math.abs(nx) <= deadzone ? 0 : Math.min(1, (Math.abs(nx) - deadzone) / 0.62);
      touch.moveX = magX === 0 ? 0 : Math.sign(nx) * magX;
      touch.left = touch.moveX < -0.05;
      touch.right = touch.moveX > 0.05;
      touch.down = ny > 0.68 && ny > Math.abs(nx) * 0.75;
      joyDownHint?.classList.toggle('on', touch.down);
    };

    const resetStick = (e) => {
      if (e?.pointerId !== undefined && e.pointerId !== joyPointerId) return;
      joyPointerId = null;
      touch.moveX = 0;
      touch.left = touch.right = touch.down = false;
      joyKnob.style.transform = '';
      joyZone.classList.remove('active');
      joyDownHint?.classList.remove('on');
    };

    joyZone.addEventListener('pointerdown', (e) => {
      if (joyPointerId !== null) return;
      e.preventDefault();
      enableTouchUI();
      joyPointerId = e.pointerId;
      const rect = joyBase.getBoundingClientRect();
      joyCx = rect.left + rect.width * 0.5;
      joyCy = rect.top + rect.height * 0.5;
      joyZone.setPointerCapture?.(e.pointerId);
      joyZone.classList.add('active');
      updateStick(e.clientX, e.clientY);
      kick();
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });
    joyZone.addEventListener('pointerup', resetStick);
    joyZone.addEventListener('pointercancel', resetStick);
    joyZone.addEventListener('lostpointercapture', resetStick);
  }

  for (const b of padEl?.querySelectorAll('button[data-k]') ?? []) {
    const k = b.dataset.k;
    if (!(k in touch)) continue;
    b.addEventListener('pointerdown', (e) => {
      if (btnPointers.has(k)) return;
      e.preventDefault();
      enableTouchUI();
      btnPointers.set(k, e.pointerId);
      b.setPointerCapture?.(e.pointerId);
      if (k === 'jump') jumpLatched = true;
      touch[k] = true;
      b.classList.add('on');
      kick();
    });
    const release = (e) => {
      if (btnPointers.get(k) !== e.pointerId) return;
      btnPointers.delete(k);
      touch[k] = false;
      b.classList.remove('on');
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
  }
}
