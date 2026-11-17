/**
 * Co-op netcode synchronization helpers:
 * 1. SnapshotBuffer: Entity interpolation + bounded dead-reckoning for remote player & traps.
 * 2. GuestReconciler: Input history replay + smooth visual error decay for zero-lag local prediction.
 */

const DEFAULT_FIXED_DT = 1 / 60;
const DEFAULT_INTERP_DELAY = 0.038; // 38 ms (~2.3 ticks at 60 Hz)
const DEFAULT_MAX_EXTRAP = 0.12;   // 120 ms max dead-reckoning on packet delay
const MAX_HISTORY = 180;           // 3 seconds at 60 Hz
// traps whose position moves continuously and is smoothed between host snapshots
const MOVING_KINDS = new Set(['boulder', 'saw', 'mimicRobot', 'booGhost']);
// of those, the ones the guest does NOT simulate itself (saw is predicted locally, see game.js)
const REMOTE_MOVING = new Set(['boulder', 'mimicRobot', 'booGhost']);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolatePlayer(a, b, t) {
  if (!a || !b) return b ?? a;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist > 2.5) return { ...b };
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    vx: lerp(a.vx, b.vx, t),
    vy: lerp(a.vy, b.vy, t),
  };
}

function interpolateTrap(a, b, t) {
  if (!a || !b) return b ?? a;
  const out = { ...b };
  if (Number.isFinite(a.offsetY) && Number.isFinite(b.offsetY) && Math.abs(b.offsetY - a.offsetY) < 3) {
    out.offsetY = lerp(a.offsetY, b.offsetY, t);
  }
  if (Number.isFinite(a.x) && Number.isFinite(b.x) && Math.abs(b.x - a.x) < 2.5) {
    out.x = lerp(a.x, b.x, t);
  }
  if (Number.isFinite(a.y) && Number.isFinite(b.y) && Math.abs(b.y - a.y) < 2.5) {
    out.y = lerp(a.y, b.y, t);
  }
  if (Number.isFinite(a.ext) && Number.isFinite(b.ext) && Math.abs(b.ext - a.ext) < 2) {
    out.ext = lerp(a.ext, b.ext, t);
  }
  return out;
}

function interpolateDoor(a, b, t) {
  if (!a || !b) return b ?? a;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist > 3) return { ...b };
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/**
 * Buffers timestamped Host snapshots on the Guest and samples smoothly interpolated
 * remote state at (estimatedServerTime - interpDelay) on every render frame.
 */
export function createSnapshotBuffer(opts = {}) {
  const fixedDt = opts.fixedDt ?? DEFAULT_FIXED_DT;
  const interpDelay = opts.interpDelay ?? DEFAULT_INTERP_DELAY;
  const maxExtrap = opts.maxExtrap ?? DEFAULT_MAX_EXTRAP;

  let buffer = [];
  let clockOffset = null;
  let fallbackTick = 0;

  return {
    reset() {
      buffer = [];
      clockOffset = null;
      fallbackTick = 0;
    },

    size() {
      return buffer.length;
    },

    push(snap, localTime) {
      if (!snap) return;
      const tick = Number.isFinite(snap.simTick) ? snap.simTick : ++fallbackTick;
      const serverTime = tick * fixedDt;

      // Discard out-of-order stale snapshots older than the newest we already have by > 0.5s
      if (buffer.length > 0) {
        const last = buffer[buffer.length - 1];
        if (tick === last.tick) {
          buffer[buffer.length - 1] = { tick, serverTime, snap };
          return;
        }
        if (tick < last.tick) {
          // If Host restarted/wrapped simTick (e.g. new match), reset buffer
          if (last.tick - tick > 30) {
            buffer = [];
            clockOffset = null;
          } else {
            return;
          }
        }
      }

      const sampleOffset = serverTime - localTime;
      if (clockOffset === null || Math.abs(sampleOffset - clockOffset) > 0.25) {
        clockOffset = sampleOffset;
      } else {
        // Gentle EWMA tracks clock drift without jittering renderTime
        clockOffset += (sampleOffset - clockOffset) * 0.12;
      }

      buffer.push({ tick, serverTime, snap });
      if (buffer.length > 48) {
        buffer.splice(0, buffer.length - 48);
      }
    },

    sample(localTime) {
      if (buffer.length === 0 || clockOffset === null) return null;
      const renderTime = localTime + clockOffset - interpDelay;

      // Trim snapshots that are far behind renderTime (keep at least 2 when available)
      while (buffer.length > 2 && buffer[1].serverTime <= renderTime) {
        buffer.shift();
      }

      if (renderTime <= buffer[0].serverTime) {
        return { ...buffer[0].snap, _interpolated: false, _extrapolated: false };
      }

      // Find bracketing pair [a, b]
      for (let i = 0; i < buffer.length - 1; i++) {
        const a = buffer[i];
        const b = buffer[i + 1];
        if (renderTime >= a.serverTime && renderTime <= b.serverTime) {
          const span = b.serverTime - a.serverTime;
          const t = span > 1e-6 ? Math.max(0, Math.min(1, (renderTime - a.serverTime) / span)) : 1;
          const sa = a.snap;
          const sb = b.snap;
          // Do not interpolate across level changes or respawns
          if (sa.levelIndex !== sb.levelIndex || (sa.dead && !sb.dead)) {
            return { ...sb, _interpolated: false, _extrapolated: false };
          }
          const players = Array.isArray(sb.players) && sb.players[0]
            ? [interpolatePlayer(sa.players?.[0], sb.players[0], t)]
            : sb.players;
          const traps = Array.isArray(sb.traps)
            ? sb.traps.map((tb) => (MOVING_KINDS.has(tb?.kind) ? interpolateTrap(sa.traps?.find((x) => x.i === tb.i), tb, t) : tb))
            : sb.traps;
          const door = interpolateDoor(sa.door, sb.door, t);
          return {
            ...sb,
            players,
            traps,
            door,
            _interpolated: true,
            _extrapolated: false,
          };
        }
      }

      // Beyond latest buffered snapshot -> bounded dead-reckoning for remote player
      const latest = buffer[buffer.length - 1];
      const dtExtrap = Math.min(maxExtrap, Math.max(0, renderTime - latest.serverTime));
      const snap = latest.snap;
      if (dtExtrap <= 0 || snap.dead || !Array.isArray(snap.players)) {
        return { ...snap, _interpolated: false, _extrapolated: false };
      }
      const players = snap.players.map((p, idx) => {
        if (idx !== 0 || p.atDoor) return p;
        return {
          ...p,
          x: p.x + p.vx * dtExtrap,
          y: p.y + p.vy * dtExtrap,
        };
      });
      return { ...snap, players, _interpolated: false, _extrapolated: true };
    },
  };
}

/**
 * Applies ONLY smoothly interpolated remote positions (Host player, moving traps, door)
 * without overwriting authoritative game.dead, game.time, levelIndex, or local Guest player.
 */
export function applyInterpolatedRemoteVisuals(game, interpSnap) {
  if (!game || !interpSnap || game.dead || interpSnap.dead) return;
  if (interpSnap.levelIndex !== game.levelIndex) return;

  const p0 = game.players?.[0];
  const src0 = interpSnap.players?.[0];
  if (p0 && src0) {
    p0.x = src0.x;
    p0.y = src0.y;
    p0.vx = src0.vx;
    p0.vy = src0.vy;
    p0.prevX = src0.x;
    p0.prevY = src0.y;
  }

  if (interpSnap.door && game.door) {
    game.door.x = interpSnap.door.x;
    game.door.y = interpSnap.door.y;
  }

  if (Array.isArray(interpSnap.traps) && Array.isArray(game.traps)) {
    for (let idx = 0; idx < interpSnap.traps.length; idx++) {
      const src = interpSnap.traps[idx];
      const ti = Number.isInteger(src?.i) ? src.i : idx;
      const dst = game.traps[ti];
      if (!dst || !src || !REMOTE_MOVING.has(dst.kind)) continue;
      if (Number.isFinite(src.x)) {
        dst.x = src.x;
        dst.prevX = src.x;
        if (Number.isFinite(src.y)) {
          dst.y = src.y;
          dst.prevY = src.y;
        }
      }
    }
  }
}

/**
 * Records Guest local predicted state per sequence ID and reconciles against Host snapshots
 * by comparing Host's state at ackSeq against Guest's recorded prediction at that same ackSeq.
 * This eliminates frame-phase jitter and smooths real divergences without rubber-banding.
 */
export function createGuestReconciler() {
  let predictions = [];
  let visErrX = 0;
  let visErrY = 0;

  return {
    reset() {
      predictions = [];
      visErrX = 0;
      visErrY = 0;
    },

    recordPrediction(seq, p) {
      if (!p) return;
      predictions.push({
        seq,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        onGround: !!p.onGround,
      });
      if (predictions.length > MAX_HISTORY) {
        predictions.splice(0, predictions.length - MAX_HISTORY);
      }
    },

    reconcile(game, snap, _stepLocalFn, { respawned = false } = {}) {
      const p1 = game.players?.[1];
      const src1 = snap?.players?.[1];
      if (!p1 || !src1) return;

      const ackSeq = Number(snap.ackSeq) || 0;

      if (respawned || game.dead || src1.atDoor) {
        Object.assign(p1, src1);
        p1.prevX = src1.x;
        p1.prevY = src1.y;
        p1.jumped = false;
        p1.landed = false;
        predictions = [];
        visErrX = 0;
        visErrY = 0;
        return;
      }

      // Sync Host-authoritative status effects immediately onto local player
      p1.gravDir = src1.gravDir;
      p1.stun = src1.stun;
      p1.slip = src1.slip;
      p1.slipDir = src1.slipDir;
      p1.flipped = src1.flipped;
      p1.beltVx = src1.beltVx ?? 0;
      p1.speedMul = src1.speedMul ?? 1;
      p1.pieTimer = src1.pieTimer;
      p1.danceTimer = src1.danceTimer;
      p1.magnetPull = src1.magnetPull;
      p1.trapAnim = src1.trapAnim;
      p1.trapAnimTimer = src1.trapAnimTimer;
      // size swell can be triggered by the host's view of the guest too
      // ...but a swell the guest predicted itself is kept until the host hears about it
      const keepLocalSwell = src1.size === 1 && p1.size !== 1 && p1.sizeTimer > 0.2;
      if (Number.isFinite(src1.size) && !keepLocalSwell) {
        p1.size = src1.size;
        p1.sizeTimer = src1.sizeTimer;
        p1.halfW = src1.halfW;
        p1.height = src1.height;
      }

      if (ackSeq <= 0) return;

      // Find Guest's recorded prediction at the exact ackSeq Host confirmed
      const idx = predictions.findIndex((entry) => entry.seq === ackSeq);
      if (idx < 0) {
        // Fallback if ackSeq was evicted or not recorded yet: prune older entries
        predictions = predictions.filter((entry) => entry.seq > ackSeq);
        const rawErr = Math.hypot(src1.x - p1.x, src1.y - p1.y);
        if (rawErr > 2.5) {
          Object.assign(p1, src1);
          p1.prevX = src1.x;
          p1.prevY = src1.y;
          visErrX = 0;
          visErrY = 0;
        }
        return;
      }

      const pred = predictions[idx];
      // Prune all predictions up to and including ackSeq
      predictions.splice(0, idx + 1);

      const dx = src1.x - pred.x;
      const dy = src1.y - pred.y;
      const err = Math.hypot(dx, dy);
      const airborne = !p1.onGround || !src1.onGround;
      const deadzone = airborne ? 0.45 : 0.30;

      if (err < deadzone) {
        // Within normal network/jump-timing tolerance: keep local prediction untouched
        return;
      }

      if (err >= 4.0) {
        // Major teleport/desync (e.g. doorBluff / portal): snap to Host
        Object.assign(p1, src1);
        p1.prevX = src1.x;
        p1.prevY = src1.y;
        predictions = [];
        visErrX = 0;
        visErrY = 0;
        return;
      }

      // Client-authoritative co-op: only snap/blend velocity if Host stunned/slipped Guest.
      // (No position correction here: a leftover correction loop used undefined vars and threw on
      // every drifting snapshot, which aborted the guest's respawn/level-change handling.)
      if (src1.stun > 0 || src1.slip > 0) {
        p1.vx = src1.vx;
        p1.vy = src1.vy;
        p1.onGround = src1.onGround;
      }
    },

    decayError(dt) {
      if (visErrX === 0 && visErrY === 0) return;
      const k = Math.exp(-16 * Math.max(0, dt));
      visErrX *= k;
      visErrY *= k;
      if (Math.abs(visErrX) < 0.002) visErrX = 0;
      if (Math.abs(visErrY) < 0.002) visErrY = 0;
    },

    getVisualOffset() {
      return { x: visErrX, y: visErrY };
    },

    historyLength() {
      return predictions.length;
    },
  };
}
