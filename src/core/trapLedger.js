/**
 * Trap ledger: where each trap kind debuts and where it comes back. Used by tests to enforce the
 * callback rule (traps from low levels must return in higher levels, never easier).
 *
 * @example
 * const led = trapLedger(LEVELS.filter((l) => !l.coopOnly));
 * led.get('fallingFloor') // { debut: 0, levels: [0, 4, 9, ...] }
 */
export const IGNORED_KINDS = new Set(['runningDoor']); // door behaviour, not a placeable trap

// Parameter direction that makes a trap harder: -1 = smaller is harder, +1 = bigger is harder.
export const HARDER = {
  hiddenSpikes: { delay: -1, radius: 1 },
  crusher: { delay: -1, slamSpeed: 1 },
  boulder: { speed: 1 },
  pieCannon: { speed: 1, cooldown: -1 },
  conveyor: { speed: 1 },
  saw: { speed: 1 },
  icicle: { delay: -1 },
  risingFloor: { speed: 1, delay: -1 },
  closingWall: { delay: -1 },
  sizeSwell: { duration: 1 },
  bananaPeel: { speed: 1 },
  bomb: { fuse: -1 },
  weightBridge: { delay: -1 },
};

/**
 * Traps as a player counts them: touching cells of one kind are one trap (a conveyor strip, a fake
 * bridge), and a door that runs away counts as one.
 * @example trapCount(parseLevel({ name: 'x', rows: ['P.S.CC.D', '########'] })) // 2
 */
export function trapCount(level) {
  const defs = level.trapDefs.filter((t) => t.kind !== 'runningDoor');
  let n = level.trapDefs.length > defs.length ? 1 : 0;
  const seen = new Set();
  for (const t of defs) {
    if (seen.has(t)) continue;
    n++;
    seen.add(t);
    const stack = [t];
    while (stack.length) {
      const a = stack.pop();
      for (const b of defs) {
        if (!seen.has(b) && b.kind === a.kind && Math.abs(b.cx - a.cx) <= 1 && Math.abs(b.cy - a.cy) <= 1) { seen.add(b); stack.push(b); }
      }
    }
  }
  return n;
}

/** Trap target for level i of n: 5 on the first level rising to 12 on the last (user request 17 Nov). */
export const trapTarget = (i, n) => 5 + Math.round((7 * i) / Math.max(1, n - 1));

/** Map kind -> { debut, levels } over a level list (indices into that list). */
export function trapLedger(levels) {
  const led = new Map();
  levels.forEach((l, i) => {
    for (const kind of new Set(l.trapDefs.map((t) => t.kind))) {
      if (IGNORED_KINDS.has(kind)) continue;
      if (!led.has(kind)) led.set(kind, { debut: i, levels: [] });
      led.get(kind).levels.push(i);
    }
  });
  return led;
}

/** Hardest value of `param` for `kind` in a level, by HARDER direction (undefined if absent). */
export function hardest(level, kind, param) {
  const dir = HARDER[kind]?.[param];
  if (!dir) return undefined;
  const vals = level.trapDefs.filter((t) => t.kind === kind && Number.isFinite(t[param])).map((t) => t[param]);
  if (!vals.length) return undefined;
  return dir > 0 ? Math.max(...vals) : Math.min(...vals);
}

/** Returns a list of human-readable rule violations (empty = ledger is healthy). */
export function ledgerViolations(levels, { minAppearances = 3, maxGap = 8, lateWindow = 10, debutCutoff = 35, firstStrict = 5 } = {}) {
  const led = trapLedger(levels);
  const out = [];
  const n = levels.length;
  for (const [kind, { debut, levels: at }] of led) {
    if (at.length < minAppearances) out.push(`${kind}: only ${at.length} levels (${at.map((i) => i + 1)})`);
    for (let k = 1; k < at.length; k++) {
      if (at[k] - at[k - 1] > maxGap) out.push(`${kind}: gap L${at[k - 1] + 1} -> L${at[k] + 1}`);
    }
    if (debut < debutCutoff && !at.some((i) => i >= n - lateWindow)) out.push(`${kind}: never returns in the last ${lateWindow} levels`);
    for (const param of Object.keys(HARDER[kind] ?? {})) {
      const base = hardest(levels[debut], kind, param);
      if (base === undefined) continue;
      for (const i of at) {
        if (i === debut || levels[i].breather) continue;
        const v = hardest(levels[i], kind, param);
        if (v !== undefined && HARDER[kind][param] * (v - base) < -1e-9) out.push(`${kind}.${param} easier at L${i + 1} (${v}) than debut L${debut + 1} (${base})`);
      }
    }
  }
  levels.forEach((l, i) => {
    if (i < firstStrict) return;
    let debuts = 0, callbacks = 0;
    for (const kind of new Set(l.trapDefs.map((t) => t.kind))) {
      if (IGNORED_KINDS.has(kind)) continue;
      if (led.get(kind).debut === i) debuts++;
      else callbacks++;
    }
    if (debuts > 1) out.push(`L${i + 1}: ${debuts} debuts (max 1)`);
    if (callbacks < 1) out.push(`L${i + 1}: no callback trap`);
  });
  return out;
}
