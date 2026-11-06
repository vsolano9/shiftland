// Records press/gif-frames: the first island's push by a real drag, from the production build, with each frame's time.
// Then: python scripts/gif.py turns them into press/push.gif. Usage: npm run build, node scripts/gif.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), PORT = 4338, out = resolve(tmpdir(), 'shiftland-gif-frames');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (let tries = 0; ; tries++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch (err) { if (tries > 60) throw err; await new Promise(done => setTimeout(done, 500)); } }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); // recorded large and scaled down by gif.py: at 640x360 the phone layout's panels stood over the goat
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 60_000 });
  await page.click('#btn-play');
  await page.waitForFunction(() => { const a = window.__shiftland; return a.screen === 'level' && !a.world.flying && a.busyUntil === 0; }, undefined, { timeout: 15_000 });
  await page.waitForTimeout(2000);
  const m = await page.evaluate(() => window.__shiftland.controller.session.lv.sol[0]);
  const [a, b] = await page.evaluate(m => { const w = window.__shiftland, q = Number(m[1]), d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]], A = w.view.railAnchor(q), B = A.clone(); B.x += d[0]; B.z += d[1]; return [w.world.project(A), w.world.project(B)]; }, m);
  const times = []; let n = 0;
  const snap = async () => { await page.screenshot({ path: `${out}/${String(n++).padStart(3, '0')}.png` }); times.push(Date.now()); };
  for (let i = 0; i < 6; i++) await snap();
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); await snap(); }
  await snap(); await snap();
  await page.mouse.up();
  for (let i = 0; i < 40; i++) await snap();
  writeFileSync(`${out}/times.json`, JSON.stringify(times));
  console.log(out, n, 'frames', times[times.length - 1] - times[0], 'ms');
} finally { await browser.close(); server.kill(); }
