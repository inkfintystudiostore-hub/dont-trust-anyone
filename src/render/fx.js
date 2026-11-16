import { InstancedMesh, PlaneGeometry, SphereGeometry, MeshBasicMaterial, Object3D, Color, DoubleSide } from 'three';

const COLORS = ['#8b0d1a', '#ff8fb0', '#8fdcc0', '#ffd84d', '#a98bd6', '#fff1e3'];
const N = 90;

/**
 * Confetti burst for deaths (Momo pops, nothing gory). Fixed pool, no per-frame allocation.
 * @example
 * const fx = createConfetti(); scene.add(fx.mesh);
 * fx.burst(x, y); fx.update(dt); // every frame
 */
export function createConfetti() {
  const mesh = new InstancedMesh(new PlaneGeometry(0.09, 0.14), new MeshBasicMaterial({ side: DoubleSide }), N);
  mesh.frustumCulled = false;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), rot = new Float32Array(N * 2);
  const life = new Float32Array(N);
  const dummy = new Object3D();
  const c = new Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, c.set(COLORS[i % COLORS.length]));
  hideAll();

  function hideAll() {
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < N; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    mesh,
    burst(x, y) {
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
        pos[i * 3] = x; pos[i * 3 + 1] = y + 0.5; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = Math.abs(Math.sin(a)) * sp + 3; vel[i * 3 + 2] = (Math.random() - 0.5) * 4;
        rot[i * 2] = Math.random() * 6; rot[i * 2 + 1] = (Math.random() - 0.5) * 20;
        life[i] = 1 + Math.random() * 0.6;
      }
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] -= dt;
        vel[i * 3 + 1] -= 18 * dt;
        vel[i * 3] *= 1 - dt * 1.5;
        for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
        rot[i * 2] += rot[i * 2 + 1] * dt;
        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.rotation.set(rot[i * 2], rot[i * 2] * 0.7, 0);
        dummy.scale.setScalar(life[i] > 0 ? Math.min(1, life[i] * 2) : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Fixed pool of soft dust puffs for landings, jumps and slides (zero per-frame allocations). */
export function createDust() {
  const M = 16;
  const mesh = new InstancedMesh(new SphereGeometry(0.11, 8, 6), new MeshBasicMaterial({ color: '#fffbf7', transparent: true, opacity: 0.72 }), M);
  mesh.frustumCulled = false;
  const pos = new Float32Array(M * 3), vel = new Float32Array(M * 3), life = new Float32Array(M);
  const dummy = new Object3D();
  let cursor = 0;

  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  for (let i = 0; i < M; i++) mesh.setMatrixAt(i, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;

  return {
    mesh,
    burst(x, y, count = 6, vxBias = 0) {
      for (let k = 0; k < count; k++) {
        const i = (cursor++) % M;
        pos[i * 3] = x + (Math.random() - 0.5) * 0.4;
        pos[i * 3 + 1] = y + 0.08;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        vel[i * 3] = (Math.random() - 0.5) * 2.6 + vxBias;
        vel[i * 3 + 1] = 0.8 + Math.random() * 1.4;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
        life[i] = 0.28 + Math.random() * 0.16;
      }
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < M; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] -= dt;
        for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
        vel[i * 3] *= Math.max(0, 1 - dt * 5);
        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.scale.setScalar(life[i] > 0 ? life[i] * 2.5 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Fixed pool of drifting pastel bokeh motes for atmospheric depth (zero per-frame allocations). */
export function createAmbientMotes() {
  const K = 28;
  const mesh = new InstancedMesh(new SphereGeometry(0.06, 6, 5), new MeshBasicMaterial({ color: '#fff8ec', transparent: true, opacity: 0.45 }), K);
  mesh.frustumCulled = false;
  const base = new Float32Array(K * 3);
  const phase = new Float32Array(K);
  for (let i = 0; i < K; i++) {
    base[i * 3] = (Math.random() - 0.5) * 24;
    base[i * 3 + 1] = 0.5 + Math.random() * 9;
    base[i * 3 + 2] = -0.8 - Math.random() * 6.5;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const dummy = new Object3D();
  return {
    mesh,
    update(time, camX) {
      for (let i = 0; i < K; i++) {
        const p = phase[i];
        const wx = camX + ((((base[i * 3] + time * 0.25 - camX + 12) % 24) + 24) % 24) - 12;
        const wy = base[i * 3 + 1] + Math.sin(time * 0.9 + p) * 0.45;
        dummy.position.set(wx, wy, base[i * 3 + 2]);
        dummy.scale.setScalar(0.55 + Math.sin(time * 1.6 + p) * 0.35);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
