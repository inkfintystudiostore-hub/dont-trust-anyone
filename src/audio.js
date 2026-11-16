// Procedural Web Audio synth + bouncy per-world music loop (0 KB of audio assets).
let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = 0;
let musicStep = 0;
let currentWorld = 1;

const MELODIES = {
  1: [523, 659, 784, 659, 880, 784, 659, 587], // Candy Meadow (bouncy major)
  2: [440, 523, 659, 523, 587, 494, 440, 392], // Toy Factory (playful clockwork)
  3: [392, 466, 587, 523, 466, 440, 392, 349], // Haunted Bakery (quirky minor)
  4: [494, 587, 740, 659, 587, 554, 494, 440], // Mind Games (mischievous twilight arpeggio)
  5: [587, 740, 880, 987, 880, 740, 659, 587], // Couple Co-op (warm bright duet motif)
};

export function initAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      musicGain = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      musicGain.gain.value = 0.045;
      musicGain.connect(master);
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio unavailable */ }
}

export function setMuted(m) {
  muted = !!m;
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
}

export function isMuted() { return muted; }

export function startMusic(world = 1) {
  currentWorld = world;
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running' || muted || document.visibilityState === 'hidden') return;
    const notes = MELODIES[currentWorld] ?? MELODIES[1];
    const f = notes[musicStep % notes.length];
    const bass = (musicStep % 2 === 0) ? f * 0.25 : f * 0.375;
    toneTo(musicGain, 'triangle', f, f * 0.98, 0.14, 0.55, 0);
    if (musicStep % 2 === 0) toneTo(musicGain, 'sine', bass, bass, 0.18, 0.7, 0);
    musicStep++;
  }, 210);
}

export function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = 0;
}

export function duckMusic(sec = 0.5) {
  if (!musicGain || !ctx || muted) return;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(0.01, now);
  musicGain.gain.linearRampToValueAtTime(0.045, now + sec);
}

function toneTo(dest, type, f0, f1, dur, vol = 0.15, delay = 0) {
  if (!ctx || !dest || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function tone(type, f0, f1, dur, vol = 0.15, delay = 0) {
  toneTo(master, type, f0, f1, dur, vol, delay);
}

function noiseBurst(dur, vol = 0.08, delay = 0) {
  if (!ctx || !master || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + delay);
}

export const sfx = {
  jump: () => { tone('triangle', 260, 680, 0.11, 0.11); tone('square', 340, 740, 0.08, 0.04); },
  land: () => { tone('sine', 150, 65, 0.08, 0.12); noiseBurst(0.04, 0.025); },
  death: () => { tone('sawtooth', 500, 60, 0.45, 0.12); tone('square', 900, 120, 0.2, 0.05, 0.05); },
  trap: () => { tone('triangle', 200, 900, 0.18, 0.14); tone('triangle', 900, 200, 0.18, 0.1, 0.18); },
  slip: () => tone('triangle', 760, 200, 0.28, 0.12),
  squeak: () => { tone('triangle', 980, 1480, 0.09, 0.12); tone('triangle', 1480, 620, 0.12, 0.1, 0.08); },
  chomp: () => { tone('sawtooth', 340, 85, 0.14, 0.15); noiseBurst(0.06, 0.07); },
  punch: () => { tone('square', 220, 640, 0.09, 0.12); noiseBurst(0.08, 0.09, 0.02); },
  slam: () => { tone('sawtooth', 140, 45, 0.22, 0.16); noiseBurst(0.12, 0.08); },
  sneeze: () => { tone('triangle', 420, 780, 0.08, 0.08); noiseBurst(0.22, 0.12, 0.06); },
  flip: () => { tone('sine', 420, 840, 0.12, 0.1); tone('sine', 840, 540, 0.12, 0.08, 0.09); },
  rumble: () => tone('sawtooth', 95, 65, 0.35, 0.09),
  fakeSave: () => [587, 740, 880].forEach((f, i) => tone('triangle', f, f, 0.1, 0.09, i * 0.07)),
  launch: () => { tone('sawtooth', 160, 880, 0.16, 0.13); noiseBurst(0.1, 0.07); },
  antiJump: () => { tone('square', 720, 260, 0.09, 0.12); tone('sawtooth', 320, 120, 0.12, 0.08, 0.03); },
  gift: () => { tone('triangle', 520, 1180, 0.12, 0.12); [784, 622, 466].forEach((f, i) => tone('square', f, f * 0.9, 0.08, 0.06, 0.08 + i * 0.06)); },
  key: () => [784, 988, 1319].forEach((f, i) => tone('triangle', f, f * 1.04, 0.11, 0.1, i * 0.055)),
  gateOpen: () => tone('sine', 330, 880, 0.14, 0.09),
  defused: () => [523, 659, 784, 1046, 1319].forEach((f, i) => tone('triangle', f, f, 0.1, 0.08, i * 0.05)),
  boom: () => { tone('sawtooth', 160, 32, 0.45, 0.18); noiseBurst(0.35, 0.18); },
  locked: () => { tone('square', 220, 180, 0.08, 0.08); tone('square', 170, 140, 0.1, 0.08, 0.09); },
  spring: () => { tone('triangle', 220, 1120, 0.22, 0.13); tone('sine', 440, 1320, 0.18, 0.08, 0.05); },
  pie: () => { noiseBurst(0.16, 0.15); tone('sine', 340, 140, 0.14, 0.11); },
  disco: () => [523, 659, 784, 988, 1046].forEach((f, i) => tone('square', f, f * 1.03, 0.07, 0.055, i * 0.06)),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.12, 0.07, i * 0.09)),
  babble: () => { for (let i = 0; i < 6; i++) { const f = 500 + Math.random() * 500; tone('square', f, f * 0.9, 0.05, 0.035, i * 0.06); } },
};
