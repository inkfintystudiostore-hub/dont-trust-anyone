// Injected before the game loads: a virtual clock (deterministic 60 Hz stepping) and a fake room server
// so 2-player levels can be recorded from the host view without the Cloudflare worker.
(() => {
  let now = 0;
  let queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};

  // ---- fake room server ----
  const seats = (guestOn) => [
    { seat: 0, role: 'host', character: 'momo', occupant: 'human', playerName: 'Momo', connected: true },
    { seat: 1, role: 'guest', character: 'mimi', occupant: guestOn ? 'human' : 'open', playerName: 'Mimi', connected: guestOn },
  ];
  const room = { code: '482915736', levelIndex: 0, guestOn: false, started: false };
  const snap = () => ({ code: room.code, levelIndex: room.levelIndex, maxLevelIndex: room.levelIndex, started: room.started,
    seats: seats(room.guestOn), yourSeat: 0, isHost: true, disconnectCloseAt: null });
  let sock = null;
  class FakeWS extends EventTarget {
    constructor(url) {
      super(); this.url = url; this.readyState = 0; sock = this;
      Promise.resolve().then(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); });
    }
    _emit(obj) { const e = new MessageEvent('message', { data: JSON.stringify(obj) }); this.dispatchEvent(e); }
    send(raw) {
      const m = JSON.parse(raw);
      if (m.type === 'ping') this._emit({ type: 'pong' });
      else if (m.type === 'join') this._emit({ type: 'snapshot', snapshot: snap() });
      else if (m.type === 'start') { room.started = true; this._emit({ type: 'started', levelIndex: room.levelIndex }); }
    }
    close() { this.readyState = 3; }
  }
  FakeWS.OPEN = 1; FakeWS.CONNECTING = 0; FakeWS.CLOSED = 3;
  window.WebSocket = FakeWS;
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts) => String(url).includes('/api/rooms/reserve')
    ? Promise.resolve(new Response(JSON.stringify({ ok: true, code: room.code }), { headers: { 'Content-Type': 'application/json' } }))
    : realFetch(url, opts);

  // ---- capture API ----
  const KEY = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space' };
  let held = { left: false, right: false, jump: false };
  let lastGuest = '';
  let ctrl = null;
  let st = {};
  let f = 0;
  const setKeys = (inp) => {
    for (const k of ['left', 'right', 'jump']) {
      const want = !!inp?.[k];
      if (want !== held[k]) {
        held[k] = want;
        window.dispatchEvent(new KeyboardEvent(want ? 'keydown' : 'keyup', { code: KEY[k], bubbles: true }));
      }
    }
  };
  // In-engine punch-in: zoom the real camera and keep the hero(es) centred, so vertical footage stays crisp.
  const cam = { zoom: 1, cx: null, cy: null, k: 0.14, yBias: 0.06 };
  const patchRenderer = () => {
    const R = window.__R;
    if (!R || R.patched) return;
    R.patched = true;
    const orig = R.renderer.render.bind(R.renderer);
    const V = R.camera.position.constructor;
    const a = new V(), b = new V();
    R.renderer.render = (scene, camera) => {
      if (cam.zoom > 1.001 && camera === R.camera) {
        camera.clearViewOffset();
        R.momo.group.getWorldPosition(a);
        if (R.mimi.group.visible) { R.mimi.group.getWorldPosition(b); a.add(b).multiplyScalar(0.5); }
        a.y += 0.4;
        a.project(camera);
        const W = innerWidth, H = innerHeight;
        const tx = (a.x * 0.5 + 0.5) * W, ty = (-a.y * 0.5 + 0.5) * H - cam.yBias * H;
        if (cam.cx === null || Math.hypot(tx - cam.cx, ty - cam.cy) > W * 0.6) { cam.cx = tx; cam.cy = ty; }
        cam.cx += (tx - cam.cx) * cam.k; cam.cy += (ty - cam.cy) * cam.k;
        const w = W / cam.zoom, h = H / cam.zoom;
        const ox = Math.max(0, Math.min(W - w, cam.cx - w / 2)), oy = Math.max(0, Math.min(H - h, cam.cy - h / 2));
        camera.setViewOffset(W, H, ox, oy, w, h);
      }
      orig(scene, camera);
    };
  };
  const frame = (dtMs) => {
    patchRenderer();
    now += dtMs;
    const q = queue; queue = [];
    for (const cb of q) cb(now);
  };
  window.__cap = {
    room,
    cam,
    guestJoin() { room.guestOn = true; sock?._emit({ type: 'snapshot', snapshot: snap() }); },
    setLevel(i) { room.levelIndex = i; },
    idle(n = 1) { for (let i = 0; i < n; i++) frame(1000 / 60); },
    setController(src) { ctrl = new Function('p0', 'p1', 'g', 'f', 'st', src); st = {}; f = 0; },
    step(n = 2) {
      let ev = null;
      for (let i = 0; i < n; i++) {
        const g = window.__game;
        if (ctrl && g) {
          const out = ctrl(g.players[0], g.players[1], g, f, st) || [];
          setKeys(out[0]);
          if (g.coop && sock) {
            const gi = out[1] || {};
            const sig = `${+!!gi.left}${+!!gi.right}${+!!gi.jump}`;
            if (sig !== lastGuest) {
              lastGuest = sig;
              const mx = gi.right ? 1 : gi.left ? -1 : 0;
              sock._emit({ type: 'input', left: !!gi.left, right: !!gi.right, moveX: mx, down: false, jump: !!gi.jump });
            }
          }
          f++;
        }
        frame(1000 / 60);
      }
      const g = window.__game;
      return g ? { deaths: g.deaths, finished: g.finished, dead: g.dead, f, x: g.player.x, y: g.player.y,
        x1: g.players[1]?.x, done: !!st.done } : null;
    },
  };
})();
