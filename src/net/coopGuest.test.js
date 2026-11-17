// Guest-side co-op regressions: reconcile must not throw, real snapshots must carry trap kinds so the
// guest can interpolate them, and the guest predicts the Level Devil traps for its own player
// (visual/physics only: the host alone decides deaths).
import { describe, it, expect } from 'vitest';
import { createSnapshotBuffer, createGuestReconciler } from './coopSync.js';
import { parseLevel } from '../core/level.js';
import { createGame, step, stepPlayerLocal, exportCoopSnapshot, applyCoopSnapshot } from '../core/game.js';

const DT = 1 / 60;
const NONE = { left: false, right: false, down: false, jump: false };
const RIGHT = { left: false, right: true, down: false, jump: false };
const lvl = (rows, traps = []) => parseLevel({ name: 'GuestTest', coopOnly: true, rows, traps });
const guestTicks = (g, inp, n) => { for (let i = 0; i < n; i++) stepPlayerLocal(g, 1, inp, DT, { predictTraps: true }); };

describe('GuestReconciler', () => {
  it('does not throw when the guest drifts a little while predictions are still queued', () => {
    const g = createGame([lvl(['..........', 'P.......D.', '##########'])], 0, { coop: true });
    const rec = createGuestReconciler();
    for (let seq = 1; seq <= 10; seq++) { stepPlayerLocal(g, 1, RIGHT, DT); rec.recordPrediction(seq, g.players[1]); }
    const snap = exportCoopSnapshot(g, { ackSeq: 5 });
    snap.players[1].x += 1.2; // host saw the guest 1.2 tiles away at seq 5
    expect(() => rec.reconcile(g, snap, stepPlayerLocal, {})).not.toThrow();
  });

  it('copies size swell from the host onto the guest player', () => {
    const g = createGame([lvl(['..........', 'P.......D.', '##########'])], 0, { coop: true });
    const rec = createGuestReconciler();
    const snap = exportCoopSnapshot(g, { ackSeq: 0 });
    Object.assign(snap.players[1], { size: 2, sizeTimer: 3, halfW: 0.72, height: 1.72 });
    rec.reconcile(g, snap, stepPlayerLocal, {});
    expect(g.players[1].size).toBe(2);
    expect(g.players[1].height).toBeCloseTo(1.72);
  });
});

describe('real host snapshots', () => {
  it('carry trap kinds, so the guest interpolates moving traps between snapshots', () => {
    const g = createGame([lvl(['..................', 'P.....&.........D.', '##################'], [{ at: '&', dir: 1, range: 6, speed: 4 }])], 0, { coop: true });
    const buf = createSnapshotBuffer({ fixedDt: DT, interpDelay: 0 });
    step(g, [NONE, NONE], DT);
    const a = exportCoopSnapshot(g, { simTick: 1 });
    for (let i = 0; i < 6; i++) step(g, [NONE, NONE], DT);
    const b = exportCoopSnapshot(g, { simTick: 7 });
    expect(a.traps.find((t) => t.kind === 'saw')).toBeTruthy();
    buf.push(a, 0);
    buf.push(b, 6 * DT);
    const mid = buf.sample(3 * DT + DT); // halfway between the two snapshots
    const sx = mid.traps.find((t) => t.kind === 'saw').x;
    const ax = a.traps.find((t) => t.kind === 'saw').x;
    const bx = b.traps.find((t) => t.kind === 'saw').x;
    expect(sx).toBeGreaterThan(Math.min(ax, bx) + 1e-6);
    expect(sx).toBeLessThan(Math.max(ax, bx) - 1e-6);
  });
});

describe('guest applying host snapshots', () => {
  const rows = ['..........', 'P...FF..D.', '####..####'];
  it('resets the level on respawn, so last attempt\'s fallen floors and closed walls do not linger', () => {
    const host = createGame([lvl(rows, [{ at: 'F', near: 1.5, delay: 0 }])], 0, { coop: true });
    const guest = createGame([lvl(rows, [{ at: 'F', near: 1.5, delay: 0 }])], 0, { coop: true });
    guest.traps.filter((t) => t.kind === 'fallingFloor').forEach((t) => { t.state = 'falling'; guest.solid[t.cell] = 0; });
    guest.dead = true; // the death event arrived
    applyCoopSnapshot(guest, exportCoopSnapshot(host), { predictPlayerIndex: 1 }); // host: alive again, all idle
    expect(guest.traps.filter((t) => t.kind === 'fallingFloor').every((t) => t.state === 'idle')).toBe(true);
    expect(guest.traps.filter((t) => t.kind === 'fallingFloor').every((t) => guest.solid[t.cell] === 1)).toBe(true);
  });
  it('an older host view cannot put back a floor that already fell under the guest', () => {
    const host = createGame([lvl(rows)], 0, { coop: true });
    const guest = createGame([lvl(rows)], 0, { coop: true });
    const f = guest.traps.find((t) => t.kind === 'fallingFloor');
    f.state = 'falling'; guest.solid[f.cell] = 0;
    const snap = exportCoopSnapshot(host);
    snap.traps.push({ i: guest.traps.indexOf(f), kind: 'fallingFloor', state: 'shaking', timer: 0.2 });
    applyCoopSnapshot(guest, snap, { predictPlayerIndex: 1 });
    expect(f.state).toBe('falling');
    expect(guest.solid[f.cell]).toBe(0);
  });
});

describe('guest predicts Level Devil traps for its own player (never kills locally)', () => {
  it('rising floor lifts the guest instead of swallowing it', () => {
    const g = createGame([lvl(['..........', '..........', '..........', '..........', 'P.......D.', '###[[[####'])], 0, { coop: true });
    const p = g.players[1];
    p.x = p.prevX = 4.5; p.y = p.prevY = 1;
    guestTicks(g, NONE, 60);
    expect(p.y).toBeGreaterThan(2.5); // carried up with the floor
    expect(g.dead).toBe(false);
  });

  it('size swell grows the guest right away', () => {
    const g = createGame([lvl(['..........', '..........', '..........', 'P..{....D.', '##########'])], 0, { coop: true });
    guestTicks(g, RIGHT, 40);
    expect(g.players[1].size).toBe(2);
  });

  it('icicle and spike-swap react to the guest locally without killing it', () => {
    const g = createGame([lvl([
      '##########',
      '.....;....',
      '..........',
      'P........D',
      '##########',
    ])], 0, { coop: true });
    guestTicks(g, RIGHT, 60);
    const ice = g.traps.find((t) => t.kind === 'icicle');
    expect(ice.state).not.toBe('idle');
    expect(g.dead).toBe(false);
  });

  it('a patrolling saw keeps moving on the guest between host snapshots', () => {
    const g = createGame([lvl(['..................', 'P.....&.........D.', '##################'], [{ at: '&', dir: 1, range: 6, speed: 4 }])], 0, { coop: true });
    const saw = g.traps.find((t) => t.kind === 'saw');
    const x0 = saw.x;
    guestTicks(g, NONE, 10);
    expect(saw.x).not.toBe(x0);
  });
});
