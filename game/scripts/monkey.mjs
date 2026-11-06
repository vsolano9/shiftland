// Random real input on the production build, with checks after each step: no script error, the board matches the
// session once settled, nothing of a hint outlives it, no drag left held. Usage: npm run build, then
// node scripts/monkey.mjs [steps] [seed] [WxH]. Exits 1 on the first broken check, naming the step and the last inputs.
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const steps = Number(process.argv[2] ?? 400), seed = Number(process.argv[3] ?? 1), [W, H] = (process.argv[4] ?? '1280x720').split('x').map(Number);
const PORT = 4350 + (seed % 20);
let r = seed >>> 0;
const rnd = () => { r = (r + 0x6D2B79F5) >>> 0; let t = r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
let serverGone = false, failed = '';
server.on('exit', () => { serverGone = true; });
const browser = await (process.env.FULLPLAY_BROWSER === 'firefox' ? firefox.launch() : chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })).catch(err => { server.kill(); throw err; });
try {
  for (let tries = 0; ; tries++) {
    if (serverGone) throw new Error(`port ${PORT} is taken`);
    try { await fetch(`http://localhost:${PORT}/`); break; } catch (err) { if (tries > 60) throw err; await new Promise(done => setTimeout(done, 500)); }
  }
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5, undefined, { timeout: 90000 });
  await page.evaluate(() => { window.__shiftland.progress.unlocked = () => true; });
  await page.click('#btn-play'); await page.waitForTimeout(1500);
  const count = await page.evaluate(() => window.__shiftland.world.views.length);
  const trail = [];
  const knob = () => page.evaluate(([u, w]) => { const a = window.__shiftland, v = a.view, m = v.markSegments(); if (!m.length) return null; const s = m[Math.floor(u * m.length)], A = s.a.clone().lerp(s.b, .5), d = [[0, -1], [1, 0], [0, 1], [-1, 0]][Math.floor(w * 4)], B = A.clone(); B.x += d[0]; B.z += d[1]; return [a.world.project(A), a.world.project(B)]; }, [rnd(), rnd()]); // from the seed, so a failure replays
  const drag = async (hold, thenEsc) => {
    const k = await knob(); const a = k ? k[0] : [rnd() * W, rnd() * H], b = k ? k[1] : [rnd() * W, rnd() * H];
    await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 4 });
    if (hold) await page.waitForTimeout(hold);
    if (thenEsc) await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  const actions = {
    drag: () => drag(0), dragHold: () => drag(200), dragEsc: () => drag(120, true),
    hint: () => page.keyboard.press('h'), hint2: async () => { await page.keyboard.press('h'); await page.waitForTimeout(1100); await page.keyboard.press('h'); },
    undo: () => page.keyboard.press('z'), restart: () => page.keyboard.press('r'), map: () => page.keyboard.press('m'), esc: () => page.keyboard.press('Escape'),
    tab: () => page.keyboard.press('Tab'), arrow: () => page.keyboard.press(pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])),
    click: () => page.mouse.click(rnd() * W, rnd() * H), wait: () => page.waitForTimeout(600),
    open: () => page.evaluate(i => window.__shiftland.controller.open(i), Math.floor(rnd() * count)),
    enter: () => page.keyboard.press('Enter'), blur: () => page.evaluate(() => window.dispatchEvent(new Event('blur'))),
    settings: async () => { await page.evaluate(() => document.getElementById('s-reduced')?.click()); },
  };
  const names = Object.keys(actions), weights = { drag: 8, hint: 3, hint2: 3, undo: 3, open: 2, wait: 2, dragEsc: 2, dragHold: 2, arrow: 3 };
  const bag = names.flatMap(n => Array(weights[n] ?? 1).fill(n));
  for (let i = 0; i < steps; i++) {
    const act = pick(bag);
    trail.push(act); if (trail.length > 12) trail.shift();
    await actions[act]();
    await page.waitForTimeout(act === 'open' || act === 'map' ? 300 : 90);
    if (errors.length) throw new Error(`step ${i} ${act}: ${errors[0]} | ${trail.join(' ')}`);
    if (i % 8 === 7 || i === steps - 1) { // settled checks
      await page.waitForTimeout(1200);
      const bad = await page.evaluate(() => {
        const a = window.__shiftland, v = a.view, s = a.controller.session, out = [];
        if (a.drag) out.push('a drag is still held');
        if (a.screen !== 'level') return out;
        if (a.world.flying) return out;
        if (v.state.plate.join() !== s.state.plate.join() || v.state.elev.join() !== s.state.elev.join()) out.push('the board differs from the session');
        if (v.railHint && !a.handMove && v.railDir) out.push(`an arrow with no hand (hintLevel ${a.hintLevel})`);
        if (a.hintLevel === 0 && a.handLean) out.push('the plate leans with no hint');
        if (!a.drag && v.dragPlate !== null && !a.leaning) out.push(`plate ${v.dragPlate} still offset`);
        if (!s.solved && !document.getElementById('done').classList.contains('hidden') && !a.completeTimer) out.push('the win card is up on an unsolved board');
        return out;
      });
      if (bad.length) throw new Error(`step ${i}: ${bad.join('; ')} | ${trail.join(' ')}`);
    }
    if (i % 100 === 99) console.log(`step ${i + 1}`, await page.evaluate(() => { const a = window.__shiftland; return JSON.stringify({ screen: a.screen, island: a.controller.index + 1, moves: a.controller.session.moves, geometries: a.world.renderer?.info?.memory?.geometries, heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6) }); }));
  }
  console.log(`${steps} steps, seed ${seed}, ${W}x${H}: 0 errors, all checks held`);
} catch (err) {
  failed = err.message;
} finally {
  await browser.close();
  server.kill();
}
if (failed) { console.error(`FAILED: ${failed}`); process.exit(1); }
