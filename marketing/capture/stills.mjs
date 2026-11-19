// 4K gameplay stills for thumbnails: node stills.mjs  (needs vite on :5174)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const BASE = 'http://localhost:5174';
const OUT = fileURLToPath(new URL('../thumbnails/stills', import.meta.url));
const EXE = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
const PRELUDE = readFileSync(new URL('./prelude.js', import.meta.url), 'utf8');
const ev = (id) => JSON.parse(readFileSync(new URL(`../footage-solo/${id}.json`, import.meta.url))).eventFrame;
const levels = (process.argv[2] || '1,2,3,4,5,8,9').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
for (const level of levels) {
  const e = ev(`p${String(level).padStart(2, '0')}`); // 30fps frames; step(2) per frame
  const want = new Map([[e - 14, 'a'], [e + 3, 'b'], [e + 10, 'c']]);
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: Number(process.env.DPR || 2) });
  await ctx.addInitScript({ path: fileURLToPath(new URL('./inject.js', import.meta.url)) });
  await ctx.route(/\/src\/main\.js(\?|$)/, async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()) + '\n;window.__R = { renderer, camera, scene, momo, mimi };\n' }); });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?level=${level}`);
  await page.waitForFunction(() => window.__game && document.getElementById('loading')?.hidden, null, { timeout: 120000, polling: 300 });
  await page.evaluate(() => window.__cap.idle(10));
  if (await page.evaluate(() => !document.getElementById('menu').hidden)) await page.click('#play');
  await page.evaluate((z) => { window.__cap.cam.zoom = z; document.head.insertAdjacentHTML('beforeend', '<style>#hud,#toast,#taunt,#rotate-hint,#game-chat{opacity:0!important}</style>'); window.__cap.idle(20); }, Number(process.env.Z || 1));
  await page.evaluate((s) => window.__cap.setController(s), PRELUDE + '\nreturn [R];');
  await page.evaluate(() => window.__cap.idle(24));
  for (let i = 0; i < e + 12; i++) {
    await page.evaluate(() => window.__cap.step(2));
    if (want.has(i + 1)) await page.screenshot({ path: join(OUT, `${process.env.PRE || ''}L${level}${want.get(i + 1)}.png`) });
  }
  console.log('level', level, 'done');
  await ctx.close();
}
await browser.close();
