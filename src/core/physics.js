/**
 * Platformer physics for one player AABB against a tile grid. Single-thread only, no allocations.
 * Player: x = centre, y = feet. Cells are 1x1 with integer corners; `isSolid(cx, cy)` decides.
 *
 * @example
 * const p = { x: 1.5, y: 2, vx: 0, vy: 0, onGround: false, coyote: 0, jumpBuf: 0 };
 * const hit = { bonkCx: -1, bonkCy: -1 };
 * movePlayer(p, 1, true, 1 / 60, (cx, cy) => cy < 1, hit);
 */
export const PHYS = {
  halfW: 0.36,
  height: 0.86,
  move: 6.5,
  accelGround: 60,
  accelAir: 35,
  airReverseAccel: 58,
  gravity: 40,
  jump: 14.4, // ~2.6 tiles
  maxFall: 22,
  coyote: 0.1,
  jumpBuffer: 0.12,
};
const EPS = 1e-4;

/** dir: -1..1, jumpPressed: true only on the frame the key goes down. Fills hit.bonk* (ceiling) / hit.wall* (side). */
export function movePlayer(p, dir, jumpPressed, dt, isSolid, hit) {
  hit.bonkCx = -1;
  hit.bonkCy = -1;
  hit.wallCx = -1;
  hit.wallCy = -1;
  p.jumped = false;
  p.landed = false;

  const gDir = p.gravDir ?? 1;
  const hw = p.halfW ?? PHYS.halfW, ht = p.height ?? PHYS.height; // per-player size (size swell)
  const target = dir * PHYS.move * (p.speedMul ?? 1) + (p.beltVx ?? 0);
  const reversingAir = !p.onGround && dir !== 0 && p.vx * dir < 0;
  const accelRate = p.onGround ? PHYS.accelGround : (reversingAir ? PHYS.airReverseAccel : PHYS.accelAir);
  const accel = accelRate * dt;
  p.vx += Math.max(-accel, Math.min(accel, target - p.vx));

  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  p.jumpBuf = jumpPressed ? PHYS.jumpBuffer : Math.max(0, p.jumpBuf - dt);
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = PHYS.jump * (p.jumpMul ?? 1) * gDir;
    p.jumpBuf = 0;
    p.coyote = 0;
    p.jumped = true;
  }
  p.vy = Math.max(-PHYS.maxFall, Math.min(PHYS.maxFall, p.vy - PHYS.gravity * dt * gDir));

  // horizontal
  p.x += p.vx * dt;
  const y0 = Math.floor(p.y + EPS), y1 = Math.floor(p.y + ht - EPS);
  if (p.vx > 0) {
    const cx = Math.floor(p.x + hw);
    for (let cy = y0; cy <= y1; cy++) if (isSolid(cx, cy)) { p.x = cx - hw - EPS; p.vx = 0; hit.wallCx = cx; hit.wallCy = cy; break; }
  } else if (p.vx < 0) {
    const cx = Math.floor(p.x - hw);
    for (let cy = y0; cy <= y1; cy++) if (isSolid(cx, cy)) { p.x = cx + 1 + hw + EPS; p.vx = 0; hit.wallCx = cx; hit.wallCy = cy; break; }
  }

  // vertical
  const wasGround = p.onGround;
  p.y += p.vy * dt;
  p.onGround = false;
  const x0 = Math.floor(p.x - hw + EPS), x1 = Math.floor(p.x + hw - EPS);
  if (p.vy * gDir <= 0) {
    const cy = gDir > 0 ? Math.floor(p.y) : Math.floor(p.y + ht);
    for (let cx = x0; cx <= x1; cx++) if (isSolid(cx, cy)) {
      p.y = gDir > 0 ? cy + 1 : cy - ht;
      p.vy = 0;
      p.onGround = true;
      break;
    }
  } else {
    const cy = gDir > 0 ? Math.floor(p.y + ht) : Math.floor(p.y);
    for (let cx = x0; cx <= x1; cx++) if (isSolid(cx, cy)) {
      p.y = gDir > 0 ? cy - ht - EPS : cy + 1 + EPS;
      p.vy = 0;
      hit.bonkCx = cx;
      hit.bonkCy = cy;
      break;
    }
  }
  p.landed = p.onGround && !wasGround;
}

/** True if the player box overlaps [ax0,ax1]x[ay0,ay1]. */
export function overlaps(p, ax0, ay0, ax1, ay1) {
  return p.x + (p.halfW ?? PHYS.halfW) > ax0 && p.x - (p.halfW ?? PHYS.halfW) < ax1 && p.y + (p.height ?? PHYS.height) > ay0 && p.y < ay1;
}
