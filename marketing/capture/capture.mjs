// Records real gameplay frame-by-frame (virtual 60 Hz clock, every 2nd frame saved = 30 fps).
// Usage: node capture.mjs [shotId ...]   (no args = all shots). Needs the Vite dev server (BASE env, default :5174).
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { SHOTS } = await import(process.env.SHOTS || './shots.mjs');

const BASE = process.env.BASE || 'http://localhost:5174';
const W = Number(process.env.W || 1080), H = Number(process.env.H || 1920);
const OUT = process.env.OUT || join(process.cwd(), '..', 'footage', `${W}x${H}`);
const EXE = process.env.CHROME || join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
const PRELUDE = readFileSync(new URL('./prelude.js', import.meta.url), 'utf8');
const want = process.argv.slice(2);

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const queue = SHOTS.filter((s) => !want.length || want.includes(s.id));
const tries = {};
while (queue.length) {
  const shot = queue.shift();
  let texFail = false;
  const t0 = Date.now();
  const dpr = shot.dpr ?? 1;
  const ctx = await browser.newContext({ viewport: { width: Math.round(W / dpr), height: Math.round(H / dpr) }, deviceScaleFactor: dpr });
  await ctx.addInitScript({ path: fileURLToPath(new URL('./inject.js', import.meta.url)) });
  // expose main.js module scope (renderer, camera, models) to the capture camera rig
  await ctx.route(/\/src\/main\.js(\?|$)/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + '\n;window.__R = { renderer, camera, scene, momo, mimi };\n';
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [${shot.id}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && /texture|BLOB/i.test(m.text())) texFail = true; if (m.type() === 'error') console.log(`  [${shot.id}] console: ${m.text().slice(0, 160)}`); });
  await page.goto(`${BASE}/?level=${shot.coop ? 1 : shot.level}`);
  await page.waitForFunction(() => window.__game && document.getElementById('loading')?.hidden, null, { timeout: 120000, polling: 300 });
  // let the menu settle, hide fullscreen nags
  await page.evaluate(() => window.__cap.idle(10));

  const dir = join(OUT, shot.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  const snap = async () => { await page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 }); };

  if (shot.coop) {
    await page.evaluate((i) => window.__cap.setLevel(i), shot.level - 1);
    await page.click('#open-coop');
    await page.evaluate(() => window.__cap.idle(4));
    await page.waitForFunction(() => /\d/.test(document.getElementById('coop-code')?.textContent || ''), null, { polling: 200 });
    if (shot.lobby) {
      for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__cap.idle(2)); await snap(); }
      await page.evaluate(() => window.__cap.guestJoin());
      for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__cap.idle(2)); await snap(); }
    } else {
      await page.evaluate(() => window.__cap.guestJoin());
    }
    await page.waitForSelector('#coop-start:not([disabled])');
    await page.click('#coop-start');
    if (shot.lobby) { for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__cap.idle(2)); await snap(); } }
  } else {
    const menuOpen = await page.evaluate(() => !document.getElementById('menu').hidden);
    if (menuOpen) await page.click('#play');
  }
  if (!shot.lobby) {
    await page.evaluate(([z, hud]) => {
      window.__cap.cam.zoom = z;
      if (!hud) document.head.insertAdjacentHTML('beforeend', '<style>#hud,#toast,#taunt,#rotate-hint,#game-chat{opacity:0!important}</style>');
    }, [shot.zoom ?? (shot.coop ? 2.1 : 2.2), !!shot.hud]);
    await page.evaluate((n) => window.__cap.idle(n), shot.settle ?? 20);
    await page.evaluate((src) => window.__cap.setController(src), PRELUDE + '\n' + shot.ctrl);
    const d0 = await page.evaluate(() => window.__game.deaths);
    const pre = shot.pre ?? 12;
    for (let i = 0; i < pre; i++) { await page.evaluate(() => window.__cap.idle(2)); await snap(); }
    let tail = -1;
    const maxShots = (shot.maxSec ?? 12) * 30;
    for (let i = 0; i < maxShots; i++) {
      const s = await page.evaluate(() => window.__cap.step(2));
      await snap();
      if (tail < 0 && (s.deaths >= d0 + (shot.deaths ?? 1) || s.finished || s.done)) { tail = shot.tail ?? 24; writeFileSync(join(OUT, `${shot.id}.json`), JSON.stringify({ eventFrame: n - 1, eventSec: +((n - 1) / 30).toFixed(3) })); }
      if (tail >= 0 && tail-- === 0) break;
    }
    console.log(`  ${shot.id}: deaths ${d0}->${await page.evaluate(() => window.__game.deaths)}`);
  }
  await ctx.close();
  if (texFail && (tries[shot.id] = (tries[shot.id] || 0) + 1) < 4) { console.log(`  ${shot.id}: textures failed, retrying`); queue.unshift(shot); continue; }
  const mp4 = join(OUT, `${shot.id}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(dir, '%05d.jpg'), '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-threads', '2', '-pix_fmt', 'yuv420p', mp4]);
  console.log(`${shot.id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${mp4}`);
}
await browser.close();
