import { describe, it, expect } from 'vitest';
import { createSnapshotBuffer, createGuestReconciler, applyInterpolatedRemoteVisuals } from './coopSync.js';
import { parseLevel } from '../core/level.js';
import { createGame, step, stepPlayerLocal, exportCoopSnapshot } from '../core/game.js';

const DT = 1 / 60;
const NONE = { left: false, right: false, down: false, jump: false };
const RIGHT = { left: false, right: true, down: false, jump: false };

const lvl = (opts) => parseLevel({ name: 'SyncTest', ...opts });

describe('SnapshotBuffer adaptive delay & jitter', () => {
  const snap = (tick) => ({ simTick: tick, levelIndex: 0, dead: false, players: [{ x: tick * 0.01, y: 0, vx: 0.6, vy: 0 }], traps: [] });

  it('renders smoothly through late packets and stays within one tick at 60 Hz', () => {
    const buf = createSnapshotBuffer({ fixedDt: DT });
    let prev = null;
    for (let tick = 1; tick <= 120; tick++) {
      const jitter = tick % 5 === 0 ? 0.03 : 0; // every 5th packet arrives 30 ms late
      buf.push(snap(tick), tick * DT + jitter);
      if (tick < 30) continue;
      const x = buf.sample(tick * DT + 0.002).players[0].x;
      if (prev !== null) expect(x - prev).toBeLessThan(0.02); // never jumps more than ~2 ticks of motion
      expect(x).toBeGreaterThanOrEqual(prev ?? 0);
      prev = x;
    }
  });
});

describe('SnapshotBuffer entity interpolation & dead reckoning', () => {
  it('interpolates remote player and moving traps smoothly between Host snapshots', () => {
    const buf = createSnapshotBuffer({ fixedDt: DT, interpDelay: 0.04, maxExtrap: 0.12 });

    buf.push({
      simTick: 60,
      levelIndex: 0,
      dead: false,
      players: [{ x: 1.0, y: 1.0, vx: 6.0, vy: 0, atDoor: false }],
      traps: [{ kind: 'boulder', x: 2.0, y: 1.0 }],
      door: { x: 10, y: 1 },
    }, 1.0);

    buf.push({
      simTick: 66,
      levelIndex: 0,
      dead: false,
      players: [{ x: 1.6, y: 1.0, vx: 6.0, vy: 0, atDoor: false }],
      traps: [{ kind: 'boulder', x: 3.2, y: 1.0 }],
      door: { x: 10, y: 1 },
    }, 1.1);

    // At localTime = 1.09, renderTime = 1.09 + 0 - 0.04 = 1.05 (midpoint between simTick 60=1.00s and 66=1.10s)
    const mid = buf.sample(1.09);
    expect(mid._interpolated).toBe(true);
    expect(mid.players[0].x).toBeCloseTo(1.3, 4);
    expect(mid.traps[0].x).toBeCloseTo(2.6, 4);
  });

  it('performs bounded dead-reckoning when packets are delayed and clamps at maxExtrap', () => {
    const buf = createSnapshotBuffer({ fixedDt: DT, interpDelay: 0.04, maxExtrap: 0.10 });

    buf.push({
      simTick: 60,
      levelIndex: 0,
      dead: false,
      players: [{ x: 2.0, y: 1.0, vx: 5.0, vy: 0, atDoor: false }],
      traps: [],
    }, 1.0);

    // localTime = 1.10 -> renderTime = 1.06 (0.06s past simTick 60 = 1.00s) -> x = 2.0 + 5.0 * 0.06 = 2.3
    const ext = buf.sample(1.10);
    expect(ext._extrapolated).toBe(true);
    expect(ext.players[0].x).toBeCloseTo(2.3, 4);

    // localTime = 1.50 -> clamped to maxExtrap = 0.10s -> x = 2.0 + 5.0 * 0.10 = 2.5
    const clamped = buf.sample(1.50);
    expect(clamped._extrapolated).toBe(true);
    expect(clamped.players[0].x).toBeCloseTo(2.5, 4);
  });

  it('does not interpolate across level transitions or respawns', () => {
    const buf = createSnapshotBuffer({ fixedDt: DT, interpDelay: 0.04 });

    buf.push({
      simTick: 60,
      levelIndex: 0,
      dead: true,
      players: [{ x: 8.0, y: 1.0, vx: 0, vy: 0, atDoor: false }],
      traps: [],
    }, 1.0);

    buf.push({
      simTick: 66,
      levelIndex: 0,
      dead: false,
      players: [{ x: 0.5, y: 1.0, vx: 0, vy: 0, atDoor: false }],
      traps: [],
    }, 1.1);

    const sampled = buf.sample(1.09);
    expect(sampled._interpolated).toBe(false);
    expect(sampled.players[0].x).toBeCloseTo(0.5, 4);
  });
});

describe('GuestReconciler prediction-at-seq & smooth divergence blending', () => {
  it('produces zero correction when Host state at ackSeq matches Guest prediction at ackSeq (even with high RTT)', () => {
    const level = lvl({ rows: ['..................', 'P...............D.', '##################'] });
    const host = createGame([level], 0, { coop: true });
    const guest = createGame([level], 0, { coop: true });
    const reconciler = createGuestReconciler();

    // Guest predicts 12 ticks of running right (simulating ~200ms RTT ahead of Host)
    for (let seq = 1; seq <= 12; seq++) {
      stepPlayerLocal(guest, 1, RIGHT, DT);
      reconciler.recordPrediction(seq, guest.players[1]);
    }
    const predictedX = guest.players[1].x;

    // Host has processed up to seq = 6
    for (let i = 0; i < 6; i++) step(host, [NONE, RIGHT], DT);
    const snap = exportCoopSnapshot(host, { simTick: 6, ackSeq: 6 });

    reconciler.reconcile(guest, snap, stepPlayerLocal);

    // Remaining 6 predictions kept; Guest's current position is completely untouched (zero pull-back)
    expect(reconciler.historyLength()).toBe(6);
    expect(guest.players[1].x).toBeCloseTo(predictedX, 4);
  });

  it('does not pull Guest back during normal movement, and snaps on major desync (>= 4.0)', () => {
    const level = lvl({ rows: ['..................', 'P...............D.', '##################'] });
    const host = createGame([level], 0, { coop: true });
    const guest = createGame([level], 0, { coop: true });
    const reconciler = createGuestReconciler();

    for (let seq = 1; seq <= 10; seq++) {
      stepPlayerLocal(guest, 1, RIGHT, DT);
      reconciler.recordPrediction(seq, guest.players[1]);
    }
    const beforeX = guest.players[1].x;

    // Small divergence (< 4.0): Guest is NOT pulled backwards
    const snapSmall = exportCoopSnapshot(host, { simTick: 10, ackSeq: 10 });
    reconciler.reconcile(guest, snapSmall, stepPlayerLocal);
    expect(guest.players[1].x).toBeCloseTo(beforeX, 4);

    // Major teleport (>= 4.0): Guest snaps cleanly to Host
    guest.players[1].x = 8.0;
    const snapFar = exportCoopSnapshot(host, { simTick: 11, ackSeq: 10 });
    reconciler.reconcile(guest, snapFar, stepPlayerLocal);
    expect(guest.players[1].x).toBeCloseTo(host.players[1].x, 4);
  });

  it('applyInterpolatedRemoteVisuals updates Host & traps without overwriting game.dead or Guest player', () => {
    const level = lvl({ rows: ['..................', 'P...............D.', '##################'] });
    const guest = createGame([level], 0, { coop: true });
    guest.players[1].x = 7.5;
    guest.dead = false;

    applyInterpolatedRemoteVisuals(guest, {
      levelIndex: 0,
      dead: false,
      players: [
        { x: 2.2, y: 1.0, vx: 6.0, vy: 0 },
        { x: 1.0, y: 1.0, vx: 0, vy: 0 },
      ],
      traps: [],
      door: { x: 16, y: 1 },
    });

    expect(guest.players[0].x).toBeCloseTo(2.2, 4);
    expect(guest.players[1].x).toBeCloseTo(7.5, 4);
  });
});

describe('snapshot buffer under jitter', () => {
  // 60 Hz host, packets arrive with random 0-30 ms extra delay (in order): the view must keep interpolating
  it('keeps interpolating instead of extrapolating when packets jitter', () => {
    const buf = createSnapshotBuffer({ fixedDt: 1 / 60 });
    const mk = (tick) => ({ simTick: tick, levelIndex: 0, players: [{ x: tick * 0.1, y: 0, vx: 6, vy: 0 }], traps: [], door: null });
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const arrivals = [];
    let last = 0;
    for (let tick = 0; tick < 300; tick++) {
      last = Math.max(last, tick / 60 + 0.03 + rnd() * 0.03);
      arrivals.push({ at: last, tick });
    }
    let ai = 0;
    let extrap = 0;
    let frames = 0;
    for (let t = 0.1; t < 4.5; t += 1 / 60) {
      while (ai < arrivals.length && arrivals[ai].at <= t) buf.push(mk(arrivals[ai++].tick), t);
      const s = buf.sample(t);
      if (t > 1 && s) { frames++; if (s._extrapolated) extrap++; }
    }
    expect(extrap / frames).toBeLessThan(0.05);
  });
});
