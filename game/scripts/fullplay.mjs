// Plays the production build from a clean save to the ending through real input: every island at par by
// dragging its knob, every card's button pressed. The check behind R3 and R7 in docs/release.md.
// Usage: npm run build, then node scripts/fullplay.mjs [mouse|touch|keys] [WxH] [screenshot dir]; FULLPLAY_BROWSER=firefox for Firefox
// Reading the game's state is allowed (where a knob is, the solver's line); changing it isn't.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'mouse', [W, H] = (process.argv[3] ?? (mode === 'touch' ? '390x844' : '1280x720')).split('x').map(Number), shots = process.argv[4];
const PORT = 4332 + (mode === 'touch' ? (W < H ? 1 : 2) : 0); // a run per shape can go at once
if (shots) mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
let failed = '', serverGone = false;
server.on('exit', () => { serverGone = true; }); // --strictPort: an older server on this port would otherwise answer, and the play would be of its build
const started = Date.now();
const browser = await (process.env.FULLPLAY_BROWSER === 'firefox' ? firefox.launch() : chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })).catch(err => { server.kill(); throw err; });
try {
  for (let tries = 0; ; tries++) {
    if (serverGone) throw new Error(`port ${PORT} is taken: stop what is on it`);
    try { await fetch(`http://localhost:${PORT}/`); break; } catch (err) {
      if (tries > 60) throw err;
      await new Promise(done => setTimeout(done, 500));
    }
  }
  await new Promise(done => setTimeout(done, 300));
  if (serverGone) throw new Error(`port ${PORT} is taken: stop what is on it`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = mode === 'touch' ? await context.newCDPSession(page) : null;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });

  const press = async selector => {
    const b = await page.locator(selector).boundingBox();
    if (!b) throw new Error(`${selector} isn't on screen`);
    if (mode === 'touch') await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const drag = async ([ax, ay], [bx, by]) => {
    const steps = 8;
    if (mode === 'touch') {
      await touch('touchStart', [[ax, ay]]);
      for (let k = 1; k <= steps; k++) { await touch('touchMove', [[ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps]]); await page.waitForTimeout(16); }
      await page.waitForTimeout(80);
      await touch('touchEnd', []);
    } else {
      await page.mouse.move(ax, ay); await page.mouse.down();
      await page.mouse.move(bx, by, { steps });
      await page.waitForTimeout(80);
      await page.mouse.up();
    }
  };
  const ready = i => page.waitForFunction(i => { const a = window.__shiftland; return a.screen === 'level' && a.controller.index === i && !a.world.flying && a.busyUntil === 0; }, i, { timeout: 15000 });

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 90000 });
  await page.waitForTimeout(800);
  await press('#btn-play'); // a first play goes straight into the first island

  const count = await page.evaluate(() => window.__shiftland.world.views.length);
  for (let i = 0; i < count; i++) {
    await ready(i);
    await page.waitForTimeout(400);
    const lv = await page.evaluate(() => { const l = window.__shiftland.controller.session.lv; return { name: l.name, sol: l.sol, par: l.sol.length }; });
    for (let n = 0; n < lv.sol.length; n++) {
      if (mode === 'keys') { // a digit picks the plate; each move takes the second arrow nearest its way, so both are proven across a play with the e2e's first
        await page.keyboard.press(String(Number(lv.sol[n][1]) + 1));
        await page.keyboard.press({ N: 'ArrowRight', E: 'ArrowDown', S: 'ArrowLeft', W: 'ArrowUp' }[lv.sol[n][2]]);
        await page.waitForFunction(n => window.__shiftland.controller.session.moves === n + 1, n, { timeout: 4000 }).catch(() => { throw new Error(`${lv.name}: key move ${n + 1} (${lv.sol[n]}) did not register`); });
        await page.waitForTimeout(650);
        continue;
      }
      const pts = await page.evaluate(m => {
        // the knob a player sees: the rail's own anchor rides higher, and only means this plate while its rail is on show
        const a = window.__shiftland, p = Number(m[1]), s = a.view.markSegments().find(k => k.plate === p), A = s.a.clone().lerp(s.b, .5), B = A.clone(), d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]];
        B.x += d[0]; B.z += d[1];
        return [a.world.project(A), a.world.project(B)];
      }, lv.sol[n]);
      await drag(pts[0], pts[1]);
      await page.waitForFunction(n => window.__shiftland.controller.session.moves === n + 1, n, { timeout: 4000 }).catch(() => { throw new Error(`${lv.name}: move ${n + 1} (${lv.sol[n]}) did not register`); });
      await page.waitForTimeout(650);
    }
    await page.waitForFunction(() => window.__shiftland.controller.session.solved, undefined, { timeout: 4000 }).catch(() => { throw new Error(`${lv.name}: the par line did not solve it`); });
    await page.waitForFunction(() => { const d = document.getElementById('done'); return !d.classList.contains('hidden') && getComputedStyle(d).visibility !== 'hidden'; }, undefined, { timeout: 8000 });
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => { const c = window.__shiftland.controller.session; return { moves: c.moves, solved: c.solved }; });
    if (shots) await page.screenshot({ path: `${shots}/${String(i + 1).padStart(2, '0')}.png` });
    console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(16)} par ${lv.par} moves ${s.moves} solved`);
    if (mode === 'keys') await page.keyboard.press('Enter'); else await press('#d-next');
  }
  await page.waitForFunction(() => window.__shiftland.screen === 'ending', undefined, { timeout: 15000 }).catch(() => { throw new Error('the last card did not lead to the ending'); });
  await page.waitForTimeout(1500);
  if (shots) await page.screenshot({ path: `${shots}/ending.png` });
  const saved = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('shiftland.progress.v1')).levels; const v = Object.values(l); return { solved: v.filter(x => x.solved).length, stars: v.filter(x => x.stars).length }; });
  console.log(`${mode} ${W}x${H}: ${saved.solved} of ${count} solved, ${saved.stars} stars, ending reached, ${Math.round((Date.now() - started) / 1000)} s, errors ${JSON.stringify(errors)}`);
  if (saved.solved !== count || saved.stars !== count || errors.length) failed = 'totals or errors';
} catch (err) {
  failed = err.message;
} finally {
  await browser.close();
  server.kill();
}
if (failed) { console.error(`FAILED: ${failed}`); process.exit(1); }
