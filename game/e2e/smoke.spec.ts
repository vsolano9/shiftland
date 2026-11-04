// The shipped build boots, plays through real mouse input and survives a reload (docs/PLAN.md QA).
import { expect, test, type Page } from '@playwright/test';

interface Shiftland {
  controller: { index: number; session: { moves: number; solved: boolean; lv: { name: string; sol?: string[] } } };
  view: { railAnchor(p: number): { clone(): { x: number; z: number } } };
  world: { project(v: unknown): [number, number, boolean]; frames: number };
}
declare global { interface Window { __shiftland: Shiftland } }

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};

/** One solution move, dragged with the real mouse from the plate's rail anchor to the next stop. */
async function drag(page: Page, m: string) {
  const pts = await page.evaluate(m => {
    const a = window.__shiftland, p = Number(m[1]), d = ({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as Record<string, number[]>)[m[2]];
    const A = a.view.railAnchor(p), B = A.clone(); B.x += d[0]; B.z += d[1];
    return [a.world.project(A), a.world.project(B)];
  }, m);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  await page.mouse.move(pts[1][0], pts[1][1], { steps: 8 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(650);
}

test('the camera stays put while playing: a real move and an undo leave the framing alone', async ({ page }) => {
  await openLevelAt(page, '');
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  const cam = () => page.evaluate(() => { const w = window.__shiftland.world as unknown as { dist: number; focus: { x: number; z: number } }; return [w.dist, w.focus.x, w.focus.z]; });
  const same = async (a: number[]) => (await cam()).forEach((v, i) => expect(v).toBeCloseTo(a[i], 6));
  const before = await cam();
  await drag(page, sol[0]);
  await same(before);
  await page.click('#b-undo');
  await page.waitForTimeout(500);
  await same(before);
});

test('a hint from a dead end never freezes the game', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const a = window.__shiftland as unknown as { controller: { open(i: number): void }; progress: { unlocked(): boolean } };
    a.progress.unlocked = () => true;
    a.controller.open(5);
  });
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => window.__shiftland.controller.session.lv.name)).toBe('High Pasture');
  await drag(page, 'P0S'); // this first move can't be finished from: a true dead end
  expect(await page.evaluate(() => window.__shiftland.controller.session.moves)).toBe(1);
  const gap = await page.evaluate(() => new Promise<number>(done => {
    let last = performance.now(), worst = 0, n = 0;
    document.getElementById('b-hint')!.click();
    const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; if (++n < 120) requestAnimationFrame(tick); else done(worst); };
    requestAnimationFrame(tick);
  }));
  expect(gap).toBeLessThan(500); // the search took 4.3 s on the main thread before it moved to a worker
  await expect(page.locator('#hint')).toContainText(/Undo/, { timeout: 15000 });
  expect(errors).toEqual([]);
});

test('hovering a slider leaves it grabbable: the same press still takes the same plate', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const a = window.__shiftland as unknown as { controller: { open(i: number): void; move(p: number, d: number): void }; progress: { unlocked(): boolean } };
    a.progress.unlocked = () => true;
    a.controller.open(8); // Harbour Row: Codex's repro, a slider above a neighbouring plate
    a.controller.move(0, 2); a.controller.move(1, 3);
  });
  await page.waitForTimeout(2600);
  const points = await page.evaluate(() => {
    const a = window.__shiftland as unknown as { view: { markSegments(): { plate: number; a: unknown; b: unknown }[] }; world: { project(v: unknown): [number, number]; pick(x: number, y: number): number | null } };
    return a.view.markSegments().map(m => { const [ax, ay] = a.world.project(m.a), [bx, by] = a.world.project(m.b), x = (ax + bx) / 2, y = (ay + by) / 2; return { plate: m.plate, x, y, picked: a.world.pick(x, y) }; });
  });
  expect(points.length).toBeGreaterThan(1);
  for (const pt of points) {
    expect(pt.picked).toBe(pt.plate);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    const after = await page.evaluate(([x, y]) => (window.__shiftland as unknown as { world: { pick(x: number, y: number): number | null } }).world.pick(x, y), [pt.x, pt.y]);
    expect(after).toBe(pt.plate);
  }
});

test('title, first island by drag, level complete, next, map, reload keeps progress', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('./');
  await expect(page.locator('#btn-play')).toBeVisible();
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(1700); // flights run on real time, at any frame rate
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  expect(sol.length).toBeGreaterThan(0);
  await expect(page.locator('#hud-moves')).toContainText('Moves 0');
  for (const m of sol) await drag(page, m);
  await expect(page.locator('#done')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#hud-moves')).toContainText(`Moves ${sol.length}`);
  await page.click('#d-next');
  await page.waitForTimeout(1700);
  expect(await page.evaluate(() => window.__shiftland.controller.index)).toBe(1);
  await page.click('#b-map');
  await page.waitForTimeout(1300);
  await expect(page.locator('#stars-n')).toContainText('1 /');
  await page.reload();
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await expect(page.locator('#stars-n')).toContainText('1 /');
  expect(errors).toEqual([]);
});

/** Save with the first levels solved, so a level with a multi-move solution can be opened. */
async function openLevelAt(page: Page, name: string) {
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.evaluate(n => {
    const a = window.__shiftland as unknown as { progress: { unlocked: () => boolean }; pickLevel(i: number): void; levels: { name: string; par: number }[] };
    a.progress.unlocked = () => true;
    a.pickLevel(n === '' ? a.levels.findIndex(l => l.par >= 3) : a.levels.findIndex(l => l.name === n));
  }, name);
  await page.waitForTimeout(1900);
}

test('undo and restart through the buttons, Escape cancels a real drag, map and back keeps the moves', async ({ page }) => {
  const errors = errorsOf(page);
  await openLevelAt(page, '');
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  const moves = () => page.evaluate(() => window.__shiftland.controller.session.moves);
  expect(sol.length).toBeGreaterThan(1);
  // Escape during a drag commits nothing
  const pts = await page.evaluate(m => {
    const a = window.__shiftland, p = Number(m[1]), d = ({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as Record<string, number[]>)[m[2]];
    const A = a.view.railAnchor(p), B = A.clone(); B.x += d[0]; B.z += d[1];
    return [a.world.project(A), a.world.project(B)];
  }, sol[0]);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  await page.mouse.move(pts[1][0], pts[1][1], { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await moves()).toBe(0);
  // a real move, then the undo button
  await drag(page, sol[0]);
  expect(await moves()).toBe(1);
  await page.click('#b-undo');
  expect(await moves()).toBe(0);
  // moves survive a trip to the map
  await drag(page, sol[0]);
  await page.click('#b-map');
  await page.waitForTimeout(1300);
  await page.evaluate(() => (window.__shiftland as unknown as { pickLevel(i: number): void; controller: { index: number } }).pickLevel((window.__shiftland as unknown as { controller: { index: number } }).controller.index));
  await page.waitForTimeout(1700);
  expect(await moves()).toBe(1);
  // the restart button clears them
  await page.click('#b-restart');
  await page.waitForTimeout(600);
  expect(await moves()).toBe(0);
  expect(errors).toEqual([]);
});

test('reduced motion still plays: a level opens and accepts a drag', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = errorsOf(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(400);
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  await drag(page, sol[0]);
  expect(await page.evaluate(() => window.__shiftland.controller.session.moves)).toBe(1);
  expect(errors).toEqual([]);
});

test('leaving during the celebration does not bring the result panel back over the map', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(1700);
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  await drag(page, sol[0]);
  await page.keyboard.press('m');
  await page.waitForTimeout(2200);
  await expect(page.locator('#done')).toHaveClass(/hidden/);
  await expect(page.locator('#s-map')).not.toHaveClass(/hidden/);
});

test('blocked storage still plays: a private window starts, moves and finishes a level', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  const errors = errorsOf(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  await page.click('#btn-play');
  await page.waitForTimeout(1700);
  const sol = await page.evaluate(() => window.__shiftland.controller.session.lv.sol!);
  for (const m of sol) await drag(page, m);
  expect(await page.evaluate(() => window.__shiftland.controller.session.solved)).toBe(true);
  expect(errors).toEqual([]);
});

test('settings survive a reload', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  const stored = await page.evaluate(() => { const a = window.__shiftland as unknown as { settings: Record<string, unknown>; saveSettings(): void }; a.settings.music = .25; a.settings.reduced = true; a.saveSettings(); return Object.keys(localStorage); });
  expect(stored.length).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => window.__shiftland?.world.frames > 5);
  const s = await page.evaluate(() => (window.__shiftland as unknown as { settings: { music: number; reduced: boolean } }).settings);
  expect([s.music, s.reduced]).toEqual([.25, true]);
});
