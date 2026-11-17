import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Box3 } from 'three';
import { PHYS } from '../core/physics.js';

const EYE_MAT = new MeshStandardMaterial({ color: '#1f1916', roughness: 0.3 });
const SHINE_MAT = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 });
const EYE_GEO = new SphereGeometry(0.075, 16, 12);
const SHINE_GEO = new SphereGeometry(0.022, 8, 6);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/**
 * Momo/Mimi = Meshy body + code eyes (blink, wide surprise, velocity lag, sleepy)
 * + dt-independent squash/stretch and hilarious per-trap/death character animations.
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
  const eyes = new Group();
  const eyeList = [];
  for (const sx of [-1, 1]) {
    const eye = new Mesh(EYE_GEO, EYE_MAT);
    eye.position.set(sx * 0.14, 0, 0);
    eye.scale.set(1, 1.25, 0.55);
    const shine = new Mesh(SHINE_GEO, SHINE_MAT);
    shine.position.set(0.025, 0.035, 0.04);
    eye.add(shine);
    eyes.add(eye);
    eyeList.push(eye);
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
  let spinYaw = 0;

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
      spinYaw = 0;
      flipPivot.rotation.z = 0;
      pivot.scale.set(1, 1, 1);
      pivot.rotation.set(0, 0, 0);
      pivot.position.y = -PHYS.height * 0.5;
      eyes.scale.set(1, 1, 1);
      eyeList[0].scale.set(1, 1.25, 0.55);
      eyeList[1].scale.set(1, 1.25, 0.55);
    },
    update(p, dt, t, dead = false, alpha = 1, z = 0) {
      const rx = p.prevX + (p.x - p.prevX) * alpha;
      const ry = p.prevY + (p.y - p.prevY) * alpha;

      if (dead) {
        deathElapsed += dt;
        if (deathPose === 'crushed' || deathPose === 'boulder') {
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
        if (deathPose === 'bomb') {
          group.visible = deathElapsed < 0.5;
          group.position.set(rx, ry + deathElapsed * 7.2, z);
          pivot.rotation.set(deathElapsed * 8, deathElapsed * 18, 0);
          const sc = Math.max(0.15, 1 - deathElapsed * 1.7);
          pivot.scale.setScalar(sc);
          eyes.scale.set(1.7, 1.8, 1);
          return;
        }
        if (deathPose === 'gate' || deathPose === 'spikes' || deathPose === 'chomp' || deathPose === 'robot' || deathPose === 'ghost') {
          group.visible = deathElapsed < 0.42;
          group.position.set(rx + Math.sin(t * 95) * 0.1, ry + deathElapsed * 1.4, z);
          pivot.scale.set(1.28, 0.84, 1.28);
          pivot.rotation.set(0, 0, Math.sin(t * 70) * 0.25);
          eyes.scale.set(1.8, 1.9, 1);
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
      flipAngle += (targetFlip - flipAngle) * damp(14, dt);
      flipPivot.rotation.z = flipAngle;

      if (p.landed) squash = 0.72;
      if (p.jumped) squash = -0.72;
      squash += (0 - squash) * damp(10, dt);

      const moving = p.onGround && Math.abs(p.vx) > 0.5;
      idleTime = (!moving && p.onGround && p.stun <= 0 && p.slip <= 0 && !p.trapAnim) ? idleTime + dt : 0;
      const sitSquash = idleTime > 5 ? 0.14 : 0;
      const sleepy = idleTime > 10;

      const air = p.onGround ? 0 : Math.max(-0.26, Math.min(0.26, (p.vy * (p.gravDir ?? 1)) * 0.015));
      const sticky = (p.speedMul ?? 1) < 0.8 ? 0.18 : 0;
      const s = squash - air + sitSquash + sticky;
      const bob = moving ? Math.abs(Math.sin(t * 16)) * 0.06 : Math.sin(t * (sleepy ? 1.5 : 2.5)) * (sleepy ? 0.028 : 0.015);

      let sx = 1 + s * 0.22;
      let sy = Math.max(0.55, 1 - s * 0.28 + bob);
      let sz = 1 + s * 0.22;

      lean += ((p.vx / PHYS.move) * 0.18 - lean) * damp(10, dt);
      let rotZ = -lean;
      let targetYaw = p.face > 0 ? 0.36 : -0.36;
      const anim = p.trapAnim;

      if (anim === 'boing') {
        sx = 0.66; sy = 1.56; sz = 0.66;
        spinYaw += dt * 16;
        targetYaw = spinYaw;
        rotZ = Math.sin(t * 32) * 0.18;
      } else if (anim === 'launch') {
        sx = 0.65; sy = 1.6; sz = 0.65;
        rotZ = Math.sin(t * 28) * 0.24;
      } else if (anim === 'slip' || p.slip > 0) {
        rotZ = p.slipDir * 1.28 + Math.sin(t * 28) * 0.14;
      } else if (anim === 'pie' || (p.pieTimer ?? 0) > 0) {
        sx = 1.14; sy = 0.86; sz = 1.14;
        rotZ = Math.sin(t * 16) * 0.42;
        targetYaw += Math.sin(t * 10) * 0.45;
      } else if (anim === 'disco' || (p.danceTimer ?? 0) > 0) {
        const beat = Math.abs(Math.sin(t * 22));
        sx = 1 + beat * 0.18; sy = 0.88 + (1 - beat) * 0.22; sz = 1 + beat * 0.18;
        rotZ = Math.sin(t * 22) * 0.34;
        targetYaw += Math.sin(t * 11) * 0.55;
      } else if (anim === 'punch') {
        sx = 1.25; sy = 0.82;
        spinYaw += dt * 18;
        targetYaw = spinYaw;
      } else if (anim === 'sneeze') {
        sx = 1.28; sy = 1.12; sz = 1.28;
        rotZ = Math.sin(t * 42) * 0.5;
      } else if (anim === 'bonk' || p.stun > 0) {
        sx = 1.24; sy = 0.76; sz = 1.24;
        rotZ = Math.sin(t * 34) * 0.36;
      } else if (anim === 'flip' || p.flipped > 0) {
        rotZ += Math.sin(t * 26) * 0.24;
      } else {
        spinYaw = targetYaw;
      }

      if (Math.abs(p.magnetPull ?? 0) > 0.05) {
        rotZ -= p.magnetPull * 0.55 + Math.sin(t * 50) * 0.06;
      }

      pivot.scale.set(sx, sy, sz);
      pivot.rotation.z = rotZ;
      pivot.rotation.y += (targetYaw - pivot.rotation.y) * damp(16, dt);

      nextBlink -= dt;
      if (nextBlink <= 0) { blink = 0.12; nextBlink = 2 + Math.random() * 2.5; }
      blink = Math.max(0, blink - dt);
      surprise = Math.max(0, surprise - dt);

      const wide = surprise > 0 || anim === 'boing' || anim === 'launch' || Math.abs(p.magnetPull ?? 0) > 0.2;
      const eyeY = blink > 0 ? 0.12 : (sleepy ? 0.35 : 1 + (wide ? 0.7 : 0));
      eyes.scale.set(1 + (wide ? 0.45 : 0), eyeY, 1);
      if (anim === 'pie' || anim === 'flip' || p.flipped > 0) {
        eyeList[0].scale.set(1.2, 1.5, 0.55);
        eyeList[1].scale.set(0.85, 0.8, 0.55);
      } else {
        eyeList[0].scale.set(1, 1.25, 0.55);
        eyeList[1].scale.set(1, 1.25, 0.55);
      }
      eyes.position.x = -p.vx * 0.011;
      eyes.position.y = h * 0.6 - p.vy * 0.004;
    },
  };
}
