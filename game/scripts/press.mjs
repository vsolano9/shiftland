// Renders the itch screenshots from the production build with real mouse input, so the numbers and
// island count on them match the game. Run `npm run press` (it builds first); writes to ../press.
// Also renders the page theme's banner.png and embed-splash.png.
// Not rendered here: cover.png and push.gif carry no island number or count.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '../press');
const PORT = 4331;
const levels = JSON.parse(readFileSync(resolve(root, 'src/levels/levels.json'), 'utf8'));
const indexOf = name => {
  const i = levels.findIndex(l => l.name === name);
  if (i < 0) throw new Error(`no island named ${name}`);
  return i;
};

const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'ignore' });
for (let tries = 0; ; tries++) {
  try { await fetch(`http://localhost:${PORT}/`); break; } catch (err) {
    if (tries > 60) { server.kill(); throw err; }
    await new Promise(done => setTimeout(done, 500));
  }
}
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function drag(page, m) {
  const pts = await page.evaluate(m => {
    const a = window.__shiftland, p = Number(m[1]), d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]];
    const s = a.view.markSegments().find(k => k.plate === p), A = s.a.clone().lerp(s.b, .5), B = A.clone();
    B.x += d[0]; B.z += d[1];
    return [a.world.project(A), a.world.project(B)];
  }, m);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  await page.mouse.move(pts[1][0], pts[1][1], { steps: 8 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (save) await page.addInitScript(s => localStorage.setItem('shiftland.progress.v1', s), JSON.stringify(save));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 60_000 });
  await page.click('#btn-play');
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

/** Solves the named island through real drags and shoots the settled panel. */
async function settled(name, file) {
  const { ctx, page, errors } = await fresh();
  await page.evaluate(i => {
    const a = window.__shiftland;
    a.progress.unlocked = () => true;
    a.controller.open(i);
  }, indexOf(name));
  await page.waitForTimeout(2500);
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol);
  for (const m of sol) await drag(page, m);
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => { const c = window.__shiftland.controller; return { solved: c.session.solved, moves: c.session.moves, q: window.__shiftland.world.quality }; });
  if (!st.solved) throw new Error(`${name} not solved: ${JSON.stringify(st)}`);
  await page.screenshot({ path: resolve(out, file) });
  console.log(file, name, JSON.stringify(st), 'errors', errors.length);
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

/** The map part way through a real run: the first twelve islands done. */
async function map(file) {
  const save = { v: 1, levels: {} };
  levels.slice(0, 12).forEach((l, i) => { save.levels[l.name] = { solved: true, best: l.par, stars: i === 8 ? 0 : 1 }; });
  const { ctx, page, errors } = await fresh(save); // Play lands on the map
  await page.waitForTimeout(5000);
  await page.screenshot({ path: resolve(out, file) });
  console.log(file, 'quality', await page.evaluate(() => window.__shiftland.world.quality), 'errors', errors.length);
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

/** The itch page's banner: the real logo on the real sea, top strip of the title scene. */
async function banner(file) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: `#s-title > *:not(#logo) { display: none !important; }
    #logo { position: fixed !important; left: 170px !important; top: 14px !important; margin: 0 !important; transform: none !important; width: 576px !important; height: 192px !important; }` });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(out, file), clip: { x: 0, y: 0, width: 1920, height: 200 } });
  console.log(file);
  await ctx.close();
}

/** What sits behind itch's Run game button: the title scene with no interface. */
async function splash(file) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: '#ui { visibility: hidden !important; }' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(out, file) });
  console.log(file);
  await ctx.close();
}

try {
  await banner('banner.png');
  await splash('embed-splash.png');
  await settled('Wishing Well', 'shot2-desert.png');
  await settled('Frost Line', 'shot3-tundra.png');
  await map('shot4-map.png');
} finally {
  await browser.close();
  server.kill();
}
