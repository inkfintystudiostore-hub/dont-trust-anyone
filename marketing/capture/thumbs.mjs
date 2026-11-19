// Renders thumbnail templates to 4K PNG layers: node thumbs.mjs [A,B,C] [yt,ig45,sq,story]
// Output: marketing/thumbnails/out/<design>_<ratio>_<layer>.png  (full / bg / top / guide)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const EXE = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
const TPL = pathToFileURL(fileURLToPath(new URL('../thumbnails/template.html', import.meta.url))).href;
const OUT = fileURLToPath(new URL('../thumbnails/out', import.meta.url));
const SIZE = { yt: [1920, 1080], ig45: [1080, 1350], sq: [1080, 1080], story: [1080, 1920] };
const designs = (process.argv[2] || 'A,B,C').split(','), ratios = (process.argv[3] || 'yt,ig45,sq,story').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true });
for (const r of ratios) {
  const [w, h] = SIZE[r];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  for (const d of designs) for (const layer of ['full', 'bg', 'top', 'guide']) {
    await page.goto(`${TPL}?d=${d}&r=${r}&layer=${layer}`, { waitUntil: 'domcontentloaded' });
    if (!(await page.evaluate(() => window.ready))) throw new Error('font not loaded');
    await page.screenshot({ path: join(OUT, `${d}_${r}_${layer}.png`), omitBackground: layer === 'top' });
  }
  await page.close();
  console.log(r, 'done');
}
await browser.close();
