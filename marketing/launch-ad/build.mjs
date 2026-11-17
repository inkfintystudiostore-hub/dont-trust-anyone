// Generates index.html + compositions/*.html from the edit list below (one place to retime the film).
// Run: node build.mjs   (copies footage from ../footage/1080x1920 into assets/footage and reads each shot's death time)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FOOT = '../footage/1080x1920';
mkdirSync('assets/footage', { recursive: true });
mkdirSync('compositions', { recursive: true });

// Death/event time inside each source clip (seconds). Read from capture JSON, else derived from frame count.
const TAIL = { c: 30, s: 24 };
function eventSec(id) {
  const j = `${FOOT}/${id}.json`;
  if (existsSync(j)) return JSON.parse(readFileSync(j, 'utf8')).eventSec;
  const n = Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', `${FOOT}/${id}.mp4`]).toString().trim());
  return +((n - 1 - ({ s01_door: 45 }[id] ?? TAIL[id[0]])) / 30).toFixed(3);
}
function clipLen(id) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${FOOT}/${id}.mp4`]).toString().trim());
}
const used = new Set();
const src = (id) => { used.add(id); return `assets/footage/${id}.mp4`; };

// ---------- shared look ----------
const CSS = `
  #root { position: absolute; inset: 0; overflow: hidden; font-family: 'Outfit', sans-serif; color: #1f1916; }
  .cam { position: absolute; inset: 0; transform-origin: 50% 58%; }
  .cam video, .cam img { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }
  .ttl { position: absolute; z-index: 3; left: 90px; right: 90px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; }
  .ln { display: inline-block; background: #fffbf7; border: 3px solid #eadad0; border-radius: 40px; padding: 14px 34px 20px;
        font-weight: 900; letter-spacing: -0.02em; line-height: 0.98; box-shadow: 0 12px 0 rgba(31,25,22,.18); }
  .ln.ink { background: #1f1916; border-color: #1f1916; color: #fffbf7; }
  .w { display: inline-block; white-space: pre; }
  .acc { color: #8b0d1a; }
  .ln.ink .acc { color: #ff9fb0; }
  .pillsm { display: inline-block; background: #fffbf7; border: 3px solid #eadad0; border-radius: 999px; padding: 12px 30px 15px;
            font-weight: 800; font-size: 50px; letter-spacing: -0.01em; box-shadow: 0 8px 0 rgba(31,25,22,.16); }
`;

// title: lines = [["word","*accent"...], ...]; enter 'now' (already there at start) | 'words' | 'slam'
function title(id, start, dur, lines, { y = 330, size = 104, enter = 'words', ink = false, exit = true, small = false } = {}) {
  const html = `<div id="${id}" class="ttl clip" data-start="${start}" data-duration="${dur}" style="top:${y}px">` +
    lines.map((ws, li) => `<div class="${small ? 'pillsm' : 'ln'}${ink ? ' ink' : ''}" id="${id}-l${li}" style="${small ? '' : `font-size:${size}px`}">` +
      ws.map((w, wi) => `<span class="w${w.startsWith('*') ? ' acc' : ''}" id="${id}-w${li}-${wi}">${w.replace(/^\*/, '')}${wi < ws.length - 1 ? ' ' : ''}</span>`).join('') +
      `</div>`).join('') + `</div>`;
  let js = '';
  const words = lines.flatMap((ws, li) => ws.map((_, wi) => `#${id}-w${li}-${wi}`));
  const boxes = lines.map((_, li) => `#${id}-l${li}`);
  if (enter === 'words') {
    js += `tl.fromTo(${JSON.stringify(boxes.join(','))}, {scale:0.7, opacity:0}, {scale:1, opacity:1, duration:0.22, ease:'back.out(2.2)', stagger:0.12}, ${start});\n`;
    lines.forEach((ws, li) => ws.forEach((_, wi) => {
      js += `tl.fromTo('#${id}-w${li}-${wi}', {opacity:0, filter:'blur(8px)'}, {opacity:1, filter:'blur(0px)', duration:0.13, ease:'power4.out'}, ${+(start + li * 0.12 + wi * 0.06).toFixed(3)});\n`;
    }));
  } else if (enter === 'slam') {
    js += `tl.fromTo(${JSON.stringify(boxes.join(','))}, {scale:1.35, opacity:0}, {scale:1, opacity:1, duration:0.18, ease:'expo.out', stagger:0.1}, ${start});\n`;
  }
  if (exit) js += `tl.to(${JSON.stringify(boxes.join(','))}, {opacity:0, filter:'blur(6px)', duration:0.12, ease:'power2.in'}, ${+(start + dur - 0.13).toFixed(3)});\n`;
  return { html, js };
}

// video shot inside a scene: plays source so that its event (death) lands at `hit` (scene time)
function shot(sid, id, at, dur, hit, { punch = true, rate = 1 } = {}) {
  const ev = eventSec(id);
  const mediaStart = hit == null ? 0 : Math.max(0, +(ev - (hit - at) * rate).toFixed(3));
  const cam = `${sid}-cam-${id}`;
  const html = `<div class="cam" id="${cam}"><video id="${sid}-v-${id}" class="clip" data-start="${at}" data-duration="${dur}" data-media-start="${mediaStart}"${rate !== 1 ? ` data-playback-rate="${rate}"` : ''} src="${src(id)}" muted playsinline></video></div>`;
  let js = `tl.set('#${cam}', {scale:1}, 0);\n`;
  if (punch && hit != null) js += `tl.to('#${cam}', {scale:1.11, duration:0.07, ease:'power2.out'}, ${hit}).to('#${cam}', {scale:1.05, duration:0.35, ease:'power3.out'});\n`;
  return { html, js, hitAbs: hit };
}

function scene(id, dur, parts, { bg = 'transparent', extraCss = '' } = {}) {
  const body = parts.map((p) => p.html).join('\n    ');
  const js = parts.map((p) => p.js).join('');
  writeFileSync(`compositions/${id}.html`, `<template>
  <style>${CSS}
    #root { background: ${bg}; }${extraCss}
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${dur}">
    ${body}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${js}    window.__timelines["${id}"] = tl;
  </script>
</template>
`);
  return { id, dur };
}
const raw = (html, js = '') => ({ html, js });

// ================= THE EDIT =================
const scenes = [];
const deaths = []; // absolute times the skull counter ticks
const add = (start, sc) => scenes.push({ ...sc, start });

// 1. HOOK 0.0-2.9: both die on L37
{
  const T = 0, D = 2.9;
  add(T, scene('hook', D, [
    shot('hook', 'c37_bomb', 0, D, 1.7),
    title('hook-a', 0, 1.72, [['Ye', 'game'], ['*dost', 'ke', 'saath'], ['mat', 'khelna.']], { enter: 'now', size: 100, y: 455 }),
    title('hook-b', 1.72, 1.18, [['Ek', 'mara', 'to'], ['*DONO', 'marte', 'hain']], { enter: 'slam', size: 112, exit: false, y: 455 }),
  ]));
  deaths.push(T + 1.7);
}
// 2. RELEASE GAG 2.9-4.9
{
  const T = 2.9, D = 2.0;
  add(T, scene('release', D, [
    shot('release', 'c36_release', 0, D, 1.4),
    title('release-a', 0.08, 1.9, [['Bas', '1', 'second'], ['*ruk', 'na…']], { size: 104, y: 455 }),
  ]));
  deaths.push(T + 1.4);
}
// 3. CO-OP MONTAGE 4.9-8.9, cut on each death
{
  const T = 4.9, each = 1.0;
  const list = [
    ['c38_laser', ['Button', 'chhoda?'], ['*Laser', 'chalu!']],
    ['c39_squad', ['Ek', 'mara?'], ['*Dono', 'gaye!']],
    ['c40_ghost', ['Nazar', 'hati?'], ['*Bhoot', 'aaya!']],
    ['c41_rocket', ['Floor', 'bana'], ['*rocket!']],
  ];
  const parts = [];
  list.forEach(([id, l1, l2], i) => {
    const at = +(i * each).toFixed(3);
    parts.push(shot('mont', id, at, each, +(at + 0.7).toFixed(3)));
    parts.push(title(`mont-t${i}`, at + 0.03, each - 0.03, [l1, l2], { small: true, y: 460, enter: 'slam' }));
    deaths.push(+(T + at + 0.7).toFixed(3));
  });
  add(T, scene('montage', +(list.length * each).toFixed(3), parts));
}
// 4. "Galti uski. Maut DONO ki." 8.9-10.4 on crimson, last co-op frame as a still that shrinks
{
  const T = 8.9, D = 1.5;
  const ev = eventSec('c41_rocket');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ev + 0.15), '-i', `${FOOT}/c41_rocket.mp4`, '-frames:v', '1', '-q:v', '2', 'assets/still_c41.jpg']);
  add(T, scene('galti', D, [
    raw(`<div id="galti-card" class="cam" style="transform-origin:50% 50%"><img id="galti-img" class="clip" data-start="0" data-duration="${D}" src="assets/still_c41.jpg"></div>`,
      `tl.fromTo('#galti-card', {scale:1, rotation:0, y:0}, {scale:0.56, rotation:-4, y:330, duration:0.42, ease:'power3.inOut'}, 0);
tl.fromTo('#galti-img', {borderRadius:0, outline:'0px solid #fffbf7'}, {borderRadius:36, outline:'22px solid #fffbf7', duration:0.42, ease:'power3.inOut'}, 0);\n`),
    title('galti-t', 0.3, 1.2, [['Galti', 'uski.'], ['Maut', '*DONO', 'ki.']], { enter: 'slam', size: 124, y: 300 }),
  ], { bg: '#8b0d1a' }));
}
// 5. SOLO 10.4-16.4: "Akele khel loge?" then the solo death montage
{
  const T = 10.4;
  const parts = [];
  parts.push(shot('solo', 's01_fall', 0, 2.2, 1.93));
  parts.push(title('solo-a', 0.06, 1.85, [['Akele', 'khel'], ['*loge?']], { size: 124, y: 455 }));
  parts.push(title('solo-b', 1.97, 0.95, [['Level', '1', 'hai', 'bhai.'], ['*LEVEL', '*1.']], { small: true, y: 460, enter: 'slam' }));
  deaths.push(+(T + 1.93).toFixed(3));
  const list = [
    ['s01_door', null, null],
    ['s02_bonk', ['Sign', 'ne'], ['*jhooth', 'bola']],
    ['s06_banana', ['Weeeee…'], ['*splat']],
    ['s08_coin', ['Lalach', 'buri'], ['*bala', 'hai']],
    ['s09_fakewin', ['Jashn', 'jaldi'], ['mana', '*liya']],
  ];
  let at = 2.2;
  const each = 0.76;
  list.forEach(([id, l1, l2], i) => {
    const door = id === 's01_door'; // door starts running at its event: show the run, no death punch
    parts.push(shot('solo', id, +at.toFixed(3), each, +(at + (door ? 0.15 : 0.5)).toFixed(3), { punch: !door }));
    if (l1) parts.push(title(`solo-t${i}`, +(at + 0.03).toFixed(3), each - 0.03, [l1, l2], { small: true, y: 460, enter: 'slam' }));
    if (id !== 's01_door') deaths.push(+(T + at + 0.5).toFixed(3));
    at += each;
  });
  add(T, scene('solo', +at.toFixed(3), parts));
}
// 6. SLAM CARDS 16.4-19.4
{
  const T = 16.4;
  const cards = [
    ['#fffbf7', false, [['*Floor'], ['jhooth', 'bolta', 'hai.']], 0.8],
    ['#1f1916', true, [['*Sign', 'bhi.']], 0.45],
    ['#fffbf7', false, [['*Darwaza', 'bhi.']], 0.5],
    ['#8b0d1a', true, [['Aur', '*DOST?']], 0.55],
    ['#1f1916', true, [['Sabse'], ['*pehle.']], 0.7],
  ];
  const parts = [];
  let at = 0;
  cards.forEach(([bg, ink, lines, d], i) => {
    parts.push(raw(`<div id="slam-bg${i}" class="clip" data-start="${+at.toFixed(3)}" data-duration="${d}" style="position:absolute;inset:0;background:${bg}"></div>`));
    parts.push(title(`slam-t${i}`, +at.toFixed(3), d, lines, { enter: 'slam', size: 136, y: 640, ink, exit: false }));
    at += d;
  });
  add(T, scene('slams', +at.toFixed(3), parts));
}
// 7. LOBBY 19.4-22.4 (real room UI, then the match starts)
{
  const T = 19.4, D = 3.0;
  add(T, scene('lobby', D, [
    raw(`<div class="cam" id="lobby-cam" style="transform-origin:50% 100%"><video id="lobby-v" class="clip" data-start="0" data-duration="${D}" data-media-start="0" src="${src('c_lobby')}" muted playsinline></video></div>`,
      `tl.fromTo('#lobby-cam', {scale:0.72}, {scale:0.76, duration:${D}, ease:'none'}, 0);\n`),
    title('lobby-a', 0.05, 0.95, [['Link', '*bhejo.']], { size: 110, y: 300, enter: 'slam' }),
    title('lobby-b', 1.0, 1.0, [['Dost', '*aaya.']], { size: 110, y: 300, enter: 'slam' }),
    title('lobby-c', 2.0, 1.0, [['Dosti', '*gayi.']], { size: 110, y: 300, enter: 'slam', exit: false }),
  ]));
}
// 8. WORLD MONTAGE 22.4-26.0
{
  const T = 22.4;
  const ids = ['s12_crusher', 's14_boulder', 's23_ghostbridge', 's29_bakery', 's33_robot', 'c42_finale'];
  const each = 0.55;
  const parts = ids.map((id, i) => shot('world', id, +(i * each).toFixed(3), each, +(i * each + 0.42).toFixed(3), { punch: false }));
  const lastEnd = +(ids.length * each).toFixed(3);
  parts.push(title('world-a', 0.1, 3.5, [['*42', 'Levels']], { size: 132, y: 300, enter: 'slam', exit: false }));
  parts.push(title('world-b', 1.0, 2.6, [['*5', 'Worlds']], { size: 132, y: 470, enter: 'slam', exit: false }));
  parts.push(title('world-c', 2.0, 1.6, [['*0', 'Bharosa']], { size: 132, y: 640, enter: 'slam', exit: false }));
  add(T, scene('world', 3.6, parts));
}
// 9. END CARD 26.0-30.0
{
  const T = 26.0, D = 4.0;
  const word = (id, txt, y, size) => `<div id="${id}" class="endw" style="top:${y}px;font-size:${size}px">${txt}</div>`;
  add(T, scene('endcard', D, [
    raw(`<div id="end-bg" class="clip" data-start="0" data-duration="${D}" style="position:absolute;inset:0;background:#fffbf7"></div>
    <div id="end-duo-card"><video id="end-duo" class="clip" data-start="0" data-duration="3.85" data-media-start="0" src="${src('e_duo')}" muted playsinline></video></div>
    <div id="end-mark" class="clip" data-start="0" data-duration="${D}" style="position:absolute;inset:0">
      ${word('end-w1', "DON'T", 300, 160)}${word('end-w2', 'TRUST', 462, 160)}
      <div id="end-w3" class="endw" style="top:624px;font-size:160px"><span id="end-any">ANY</span><span id="end-o" style="display:inline-block">O</span><span>NE</span></div>
      <div id="end-url" class="endsub" style="top:835px"><span class="endpill">inkfinitystudio.store/game-room</span></div>
      <div id="end-free" class="endsub" style="top:935px">Free · Browser mein · Koi download nahi</div>
      <div id="end-cta" class="endsub" style="top:1015px;color:#8b0d1a;font-weight:900;font-size:56px">Us dost ko tag karo<br>jo tumhe marwayega</div>
    </div>`,
      `tl.fromTo('#end-duo-card', {y:420}, {y:0, duration:0.5, ease:'expo.out'}, 0);
tl.fromTo('#end-w1,#end-w2,#end-w3', {scale:1.5, opacity:0}, {scale:1, opacity:1, duration:0.2, ease:'expo.out', stagger:0.2}, 0.1);
tl.to('#end-o', {y:1400, rotation:28, duration:0.55, ease:'power3.in'}, 1.0);
tl.fromTo('#end-url', {scale:0.6, opacity:0}, {scale:1, opacity:1, duration:0.24, ease:'back.out(2.2)'}, 1.45);
tl.fromTo('#end-free', {opacity:0, filter:'blur(8px)'}, {opacity:1, filter:'blur(0px)', duration:0.18, ease:'power4.out'}, 1.6);
tl.fromTo('#end-cta', {opacity:0, filter:'blur(8px)'}, {opacity:1, filter:'blur(0px)', duration:0.2, ease:'power4.out'}, 1.75);\n`),
  ], { extraCss: `
    .endw { position:absolute; left:0; right:0; text-align:center; font-weight:900; letter-spacing:-0.04em; line-height:1; color:#1f1916; }
    #end-w3 { color:#8b0d1a; }
    .endsub { position:absolute; left:110px; right:110px; text-align:center; font-weight:700; font-size:36px; color:#1f1916; line-height:1.12; }
    .endpill { display:inline-block; background:#1f1916; color:#fffbf7; border-radius:999px; padding:14px 34px 18px; font-weight:800; font-size:42px; }
    #end-duo-card { position:absolute; left:40px; right:40px; top:1200px; height:680px; border-radius:48px; overflow:hidden; border:4px solid #eadad0; }
    #end-duo { position:absolute; left:-40px; top:-1020px; width:1080px; height:1920px; object-fit:cover; }` }));
}
deaths.sort((a, b) => a - b);

// ================= SKULL COUNTER (overlay, gameplay stretches only) =================
{
  const D = 16.4;
  const n = deaths.length;
  const nums = Array.from({ length: n + 1 }, (_, i) => `<b id="cnt-n${i}" class="cnum" style="opacity:${i === 0 ? 1 : 0}">${i}</b>`).join('');
  let js = `tl.fromTo('#cnt-pill', {scale:0.6, opacity:0}, {scale:1, opacity:1, duration:0.22, ease:'back.out(2.2)'}, 0.05);\n`;
  deaths.forEach((t, i) => {
    js += `tl.set('#cnt-n${i}', {opacity:0}, ${t}); tl.set('#cnt-n${i + 1}', {opacity:1}, ${t});\n`;
    js += `tl.fromTo('#cnt-pill', {scale:1.35}, {scale:1, duration:0.3, ease:'back.out(2.5)', immediateRender:false}, ${t});\n`;
  });
  // hide over the crimson "Galti" card and keep for the solo part
  js += `tl.to('#cnt-pill', {opacity:0, duration:0.1}, 8.9); tl.to('#cnt-pill', {opacity:1, duration:0.1}, 10.4);\n`;
  writeFileSync('compositions/counter.html', `<template>
  <style>
    #root { position:absolute; inset:0; pointer-events:none; }
    #cnt-pill { position:absolute; top:300px; left:50%; margin-left:-150px; width:300px; height:120px; display:flex; align-items:center; justify-content:center; gap:16px;
      background:#fffbf7; border:3px solid #eadad0; border-radius:999px; box-shadow:0 10px 0 rgba(31,25,22,.18); }
    #cnt-pill svg { width:66px; height:66px; fill:none; stroke:#1f1916; stroke-width:2.2; stroke-linecap:round; }
    .cnums { position:relative; width:120px; height:96px; }
    .cnum { position:absolute; left:0; top:0; font:800 86px/96px 'JetBrains Mono', monospace; color:#8b0d1a; }
  </style>
  <div id="root" data-composition-id="counter" data-width="1080" data-height="1920" data-duration="${D}">
    <div id="cnt-pill" class="clip" data-start="0" data-duration="${D}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="11" r="7"/><path d="M9 18v3M12 18v3M15 18v3"/><circle cx="9.5" cy="11" r="1" fill="#1f1916" stroke="none"/><circle cx="14.5" cy="11" r="1" fill="#1f1916" stroke="none"/></svg>
      <div class="cnums">${nums}</div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${js}    window.__timelines["counter"] = tl;
  </script>
</template>
`);
}

// ================= ROOT =================
const total = 30;
for (const id of used) copyFileSync(`${FOOT}/${id}.mp4`, `assets/footage/${id}.mp4`);
const hosts = scenes.map((s, i) => `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${i % 2 ? 2 : 1}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:1"></div>`).join('\n');
writeFileSync('index.html', `<!doctype html>
<html lang="hi" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #ffd1dc; }
      #root { width: 100%; height: 100%; position: relative; font-family: 'Outfit', sans-serif; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
${hosts}
      <div id="counter" data-composition-id="counter" data-composition-src="compositions/counter.html" data-start="0" data-duration="16.4" data-track-index="3" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:5"></div>
<!--AUDIO-->
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
// ================= SOUND =================
// Each cue: [absolute time the picture hits, sfx file, extra gain]. The clip starts so its measured peak lands 1 frame after.
const SFX = { // peak seconds and integrated LUFS from `hyperframes audio --json`
  'bass-impact': [0.101, -17.8], 'cartoon-boing': [0.139, -37.5], 'cartoon-explosion': [0.119, -4.6], 'cartoon-spring': [0.04, -38.5],
  'coin-pickup': [0.0, -23], 'electric-zap': [2.488, -12.3], 'notification-pop': [0.111, -20.3], 'party-horn': [0.126, -26.3],
  'punch-hit': [0.218, -24.9], 'record-scratch': [0.75, -8.6], 'slide-whistle-down': [0.329, -27.5], 'ui-click': [0.221, -48.5], 'whoosh': [0.649, -15.5],
};
const D = (i) => deaths[i];
const cues = [
  [D(0), 'punch-hit'], [D(0) + 0.05, 'record-scratch', 0.6],
  [D(1), 'electric-zap'],
  [D(2), 'electric-zap'], [D(3), 'cartoon-explosion'], [D(4), 'punch-hit'], [D(5), 'cartoon-spring'], [D(5) + 0.05, 'punch-hit'],
  [9.2, 'bass-impact'],
  [12.0, 'slide-whistle-down', 0.8], [D(6), 'punch-hit'],
  [12.75, 'cartoon-boing'], [D(7), 'punch-hit'], [D(8) - 0.35, 'slide-whistle-down', 0.7], [D(8), 'punch-hit'],
  [D(9), 'coin-pickup'], [D(9) + 0.06, 'punch-hit'], [D(10) - 0.45, 'party-horn', 0.8], [D(10), 'punch-hit'],
  [16.4, 'bass-impact'], [17.2, 'punch-hit', 1.3], [17.65, 'bass-impact', 0.8], [18.15, 'punch-hit', 1.3], [18.7, 'bass-impact'],
  [19.45, 'ui-click', 0.8], [20.4, 'notification-pop'], [21.4, 'ui-click', 0.8],
  [22.5, 'bass-impact', 0.8], [23.4, 'punch-hit', 1.2], [24.4, 'bass-impact'],
  [26.1, 'punch-hit'], [26.3, 'punch-hit'], [26.5, 'bass-impact'], [27.0, 'slide-whistle-down'], [27.55, 'punch-hit'], [27.47, 'notification-pop'],
];
const fr = 1 / 30;
const clipLenOf = (name) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `assets/sfx/${name}.mp3`]).toString().trim());
const audioTags = cues.map(([t, name, g = 1], i) => {
  const [peak, lufs] = SFX[name];
  let start = +(t + fr - peak).toFixed(3);
  let mediaStart = 0;
  if (start < 0) { mediaStart = -start; start = 0; }
  if (name === 'electric-zap') { mediaStart = +(peak - 0.15).toFixed(3); start = +(t + fr - 0.15).toFixed(3); }
  const vol = Math.min(3.9, Math.max(0.05, Math.pow(10, (-21 - lufs) / 20) * g)).toFixed(2);
  return `      <audio id="sfx${i}" class="clip" data-start="${start}" data-duration="${Math.min(1.2, +(clipLenOf(name) - mediaStart - 0.01).toFixed(3))}" data-media-start="${mediaStart}" data-volume="${vol}" data-track-index="${10 + (i % 3)}" src="assets/sfx/${name}.mp3"></audio>`;
}).join('\n');
// ================= VOICES (local Kokoro: Momo = hm_psi, Mimi = hf_alpha; lines in VO_SCRIPT.md) =================
// [file, start, cut-at (absolute, or null = play to end), integrated LUFS]
const VO = [
  ['v01', 0.12, 1.70, -17.6], ['v02', 1.78, null, -14.3], ['v03', 3.3, 4.32, -17], ['v04', 4.38, null, -12.2],
  ['v05', 5.4, null, -15.4], ['v06', 7.7, null, -15.8], ['v07', 9.0, null, -16.8], ['v09', 10.95, 12.33, -16.8],
  ['v10', 12.5, null, -14.8], ['v11', 14.75, 16.42, -17.5], ['v12', 19.5, null, -17.1], ['v13', 21.8, null, -13.1],
  ['v14', 26.05, null, -14.3], ['v15', 27.35, null, -17.3],
];
const voTags = VO.map(([f, t, cut, lufs]) => {
  const len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `assets/vo/${f}.wav`]).toString().trim());
  const dur = +((cut ? Math.min(cut, t + len) : t + len) - t - 0.01).toFixed(3);
  const vol = Math.min(3.9, Math.pow(10, (-17 - lufs) / 20)).toFixed(2);
  return `      <audio id="vo-${f}" class="clip" data-start="${t}" data-duration="${dur}" data-volume="${vol}"${cut ? ' data-fade-out="0.04"' : ''} data-track-index="20" src="assets/vo/${f}.wav"></audio>`;
}).join('\n');
writeFileSync('index.html', readFileSync('index.html', 'utf8').replace('<!--AUDIO-->', audioTags + '\n' + voTags));

console.log('scenes:', scenes.map((s) => `${s.id}@${s.start}+${s.dur}`).join('  '));
console.log('deaths:', deaths.join(', '));
