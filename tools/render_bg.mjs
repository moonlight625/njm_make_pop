// tools/taisei-sample.svg → data/bg/taisei-sample.png (A4 300dpi)
// 使い方: PUPPETEER_DIR=<puppeteer-core を npm install したディレクトリ> node tools/render_bg.mjs
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
const puppeteer = createRequire(path.join(process.env.PUPPETEER_DIR || process.cwd(), 'x.js'))('puppeteer-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'tools', 'taisei-sample.svg');
const out = path.join(root, 'data', 'bg', 'taisei-sample.png');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
// 210×297mm @ 96dpi = 794×1123 css px。deviceScaleFactor 3.125 で 2480×3508(300dpi)
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3.125 });
await page.goto('file://' + svg, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 794, height: 1123 } });
await browser.close();
console.log('wrote', out);
