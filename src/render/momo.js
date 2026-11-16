import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Box3 } from 'three';
import { PHYS } from '../core/physics.js';

/**
 * Momo = Meshy body + code eyes (blink, wide surprise, velocity lag, sleepy) + dt-independent squash/stretch.
 */
export function createMomo(bodyTemplate) {
  const group = new Group();     // world position (feet)
  const flipPivot = new Group(); // flips upside-down around body center when gravDir < 0
  flipPivot.position.y = PHYS.height * 0.5;
  group.add(flipPivot);

  const pivot = new Group();     // squash/stretch + lean, scales from feet
  pivot.position.y = -PHYS.height * 0.5;
  flipPivot.add(pivot);

  const body = bodyTemplate.clone(true);
  pivot.add(body);

  const box = new Box3().setFromObject(body);
  const h = box.max.y;
  const frontZ = box.max.z;
  const eyeMat = new MeshStandardMaterial({ color: '#1f1916', roughness: 0.3 });
  const shineMat = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 });
  const eyeGeo = new SphereGeometry(0.075, 16, 12);
  const shineGeo = new SphereGeometry(0.022, 8, 6);
  const eyes = new Group();
  for (const sx of [-1, 1]) {
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * 0.14, 0, 0);
    eye.scale.set(1, 1.25, 0.55);
    const shine = new Mesh(shineGeo, shineMat);
    shine.position.set(0.025, 0.035, 0.04);
    eye.add(shine);
    eyes.add(eye);
  }
  eyes.position.set(0, h * 0.6, frontZ * 0.92);
  pivot.add(eyes);

  let squash = 0;      // >0 squash (landing), <0 stretch
  let blink = 0;
  let nextBlink = 2;
  let surprise = 0;    // eyes go wide on traps
  let lean = 0;
  let idleTime = 0;
  let flipAngle = 0;
  let deathPose = null;
  let deathElapsed = 0;

  return {
    group,
    surprise() { surprise = 0.6; },
    onDeath(cause) { deathPose = cause; deathElapsed = 0; },
    reset() {
      deathPose = null;
      deathElapsed = 0;
      squash = 0;
      lean = 0;
      idleTime = 0;
      flipAngle = 0;
      surprise = 0;
      blink = 0;
      flipPivot.rotation.z = 0;
      pivot.scale.set(1, 1, 1);
      pivot.rotation.set(0, 0, 0);
      pivot.position.y = -PHYS.height * 0.5;
      eyes.scale.set(1, 1, 1);
    },
    update(p, dt, t, dead = false, alpha = 1, z = 0) {
      const rx = p.prevX + (p.x - p.prevX) * alpha;
      const ry = p.prevY + (p.y - p.prevY) * alpha;
      const k = (rate) => 1 - Math.exp(-rate * dt);

      if (dead) {
        deathElapsed += dt;
        if (deathPose === 'crushed') {
          group.visible = true;
          group.position.set(rx, ry, z);
          pivot.scale.set(1.55, 0.22, 1.45);
          pivot.rotation.set(0, 0, 0);
          return;
        }
        if (deathPose === 'pit') {
          group.visible = deathElapsed < 0.45;
          group.position.set(rx, ry - (p.gravDir ?? 1) * deathElapsed * 4.5, z);
          pivot.scale.set(0.68, 1.65, 0.68);
          eyes.scale.set(1.5, 1.6, 1);
          return;
        }
        group.visible = false;
        return;
      }

      if (p.atDoor) {
        group.visible = true;
        group.position.set(rx, ry + Math.abs(Math.sin(t * 7)) * 0.14, z - 0.12);
        pivot.scale.setScalar(0.86);
        pivot.rotation.set(0, 0, Math.sin(t * 6) * 0.12);
        return;
      }

      group.visible = true;
      group.position.set(rx, ry, z);

      const targetFlip = (p.gravDir ?? 1) < 0 ? Math.PI : 0;
      flipAngle += (targetFlip - flipAngle) * k(14);
      flipPivot.rotation.z = flipAngle;

      if (p.landed) squash = 0.72;
      if (p.jumped) squash = -0.72;
      squash += (0 - squash) * k(10);

      const moving = p.onGround && Math.abs(p.vx) > 0.5;
      idleTime = (!moving && p.onGround && p.stun <= 0 && p.slip <= 0) ? idleTime + dt : 0;
      const sitSquash = idleTime > 5 ? 0.14 : 0;
      const sleepy = idleTime > 10;

      const air = p.onGround ? 0 : Math.max(-0.26, Math.min(0.26, (p.vy * (p.gravDir ?? 1)) * 0.015));
      const s = squash - air + sitSquash;
      const bob = moving ? Math.abs(Math.sin(t * 16)) * 0.06 : Math.sin(t * (sleepy ? 1.5 : 2.5)) * (sleepy ? 0.028 : 0.015);
      pivot.scale.set(1 + s * 0.22, Math.max(0.55, 1 - s * 0.28 + bob), 1 + s * 0.22);

      lean += ((p.vx / PHYS.move) * 0.18 - lean) * k(10);
      pivot.rotation.z = p.slip > 0
        ? p.slipDir * 0.42 + Math.sin(t * 28) * 0.1
        : -lean + (p.stun > 0 ? Math.sin(t * 32) * 0.35 : 0);
      pivot.rotation.y += ((p.face > 0 ? 0.36 : -0.36) - pivot.rotation.y) * k(14);

      nextBlink -= dt;
      if (nextBlink <= 0) { blink = 0.12; nextBlink = 2 + Math.random() * 2.5; }
      blink = Math.max(0, blink - dt);
      surprise = Math.max(0, surprise - dt);

      const eyeY = blink > 0 ? 0.12 : (sleepy ? 0.35 : 1 + surprise * 0.8);
      eyes.scale.set(1 + surprise * 0.5, eyeY, 1);
      eyes.position.x = -p.vx * 0.011;
      eyes.position.y = h * 0.6 - p.vy * 0.004;
    },
  };
}
