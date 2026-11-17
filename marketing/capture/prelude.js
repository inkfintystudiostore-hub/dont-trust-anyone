// Runs inside the page per sim step: helpers for shot controllers (same plan shape as src/core/solutions.test.js).
const R = { right: true }, L = { left: true }, N = {};
const landedPast = (x) => (p) => p.onGround && p.x > x;
const won = (_, gg) => gg.finished;
const mv = (p, tx, jump = false, tol = 0.14) => ({ left: tx < p.x - tol, right: tx > p.x + tol, jump: !!(jump && p.onGround) });
function plan(steps) {
  const s = steps[st.i | 0];
  if (!s) { st.done = true; return N; }
  let jump = false;
  if (s.dir !== 0 && !st.j && p0.onGround && s.jumpAt && s.jumpAt(p0, g)) { jump = true; st.j = true; }
  if (s.until(p0, g, f)) { st.i = (st.i | 0) + 1; st.j = false; }
  return { right: s.dir > 0, left: s.dir < 0, jump };
}
