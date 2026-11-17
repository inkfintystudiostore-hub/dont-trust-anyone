// Host + guest over a fake 100 ms link, wired like main.js: host simulates and sends snapshots every
// 2 ticks + events; guest predicts its own player, applies snapshots, sends its position back.
// Checks the guest's world matches the host's after a death and respawn, and nothing throws.
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../levels.js';
import { createGame, step, stepPlayerLocal, exportCoopSnapshot, applyCoopSnapshot } from '../core/game.js';
import { createGuestReconciler } from './coopSync.js';

const DT = 1 / 60;
const LAG = 6; // ticks each way

function runLink(level, guestInputs, hostInputs, ticks) {
  const host = createGame([level], 0, { coop: true });
  const guest = createGame([level], 0, { coop: true });
  const rec = createGuestReconciler();
  const toGuest = [];
  const toHost = [];
  let seq = 0;
  let deaths = 0;
  for (let tick = 0; tick < ticks; tick++) {
    // network delivery
    while (toGuest.length && toGuest[0].at <= tick) {
      const m = toGuest.shift();
      if (m.kind === 'event' && m.ev.type === 'death') { guest.dead = true; deaths++; }
      if (m.kind === 'snap') {
        const { respawned } = applyCoopSnapshot(guest, m.snap, { predictPlayerIndex: 1, skipPredictPlayer: true, snapAlpha: 1 });
        rec.reconcile(guest, m.snap, stepPlayerLocal, { respawned });
      }
    }
    while (toHost.length && toHost[0].at <= tick) {
      const st = toHost.shift().st;
      const p1 = host.players[1];
      if (!host.dead && !p1.atDoor && Math.hypot(st.x - p1.x, st.y - p1.y) < 5) { p1.x = st.x; p1.y = st.y; p1.vx = st.vx; p1.vy = st.vy; }
    }
    // guest predicts
    const gin = guestInputs(guest.players[1], tick);
    stepPlayerLocal(guest, 1, gin, DT, { predictTraps: true });
    rec.recordPrediction(++seq, guest.players[1]);
    if (tick % 2 === 0) { const p = guest.players[1]; toHost.push({ at: tick + LAG, st: { x: p.x, y: p.y, vx: p.vx, vy: p.vy } }); }
    // host simulates
    const evs = step(host, [hostInputs(host.players[0], tick), gin], DT);
    for (const ev of evs) toGuest.push({ at: tick + LAG, kind: 'event', ev: { ...ev } });
    if (tick % 2 === 0 || evs.length) toGuest.push({ at: tick + LAG, kind: 'snap', snap: exportCoopSnapshot(host, { simTick: tick, ackSeq: seq }) });
  }
  return { host, guest, deaths };
}

describe('co-op over a laggy link', () => {
  it('after a death and respawn the guest sees the same floors and traps as the host', () => {
    // C2: pit that opens as you approach, then the weight bridge. Both run right: they die at the pit.
    const level = LEVELS.find((l) => l.name === 'c2.name');
    const right = () => ({ right: true });
    const idle = () => ({});
    // run into the pit, then stand still long enough to respawn and settle
    const { host, guest, deaths } = runLink(level, (p, t) => (t < 240 ? right() : idle()), (p, t) => (t < 240 ? right() : idle()), 480);
    expect(deaths).toBeGreaterThan(0);
    expect(host.dead).toBe(false);
    expect(guest.dead).toBe(false);
    expect(Array.from(guest.solid)).toEqual(Array.from(host.solid));
    const states = (g) => g.traps.map((t) => `${t.kind}:${t.state}:${t.active}:${t.triggered}`);
    expect(states(guest)).toEqual(states(host));
  });

  it('a whole co-op level replay runs on the link without exceptions', () => {
    const level = LEVELS.find((l) => l.name === 'c4.name'); // icicle + banana + bomb
    expect(() => runLink(level, () => ({ right: true }), () => ({ right: true }), 600)).not.toThrow();
  });
});
