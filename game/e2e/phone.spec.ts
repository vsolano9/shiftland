// A phone held in the hand: two fingers, a turn of the wrist, and the action row under the thumb (phone playtest, docs/qa.md).
import { expect, test, type CDPSession, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const SL = 'window.__shiftland';
const moves = (page: Page) => page.evaluate(`${SL}.controller.session.moves`) as Promise<number>;

async function start(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.waitForFunction(`${SL} && ${SL}.world.frames > 5`, undefined, { timeout: 60_000 });
  await page.evaluate(`${SL}.progress.unlocked = () => true`);
  await page.tap('#btn-play');
  await page.waitForTimeout(2200);
  return errors;
}
const touch = (cdp: CDPSession, type: string, pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) } as never);
/** Screen points of a plate's rail handle and of one cell along a solution move. */
const railOf = (page: Page, m: string) => page.evaluate(`(() => {
  const a = ${SL}, v = a.view, m = ${JSON.stringify(m)}, D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]], A = v.railAnchor(Number(m[1])), B = A.clone();
  B.x += D[0]; B.z += D[1];
  return { a: a.world.project(A), b: a.world.project(B) };
})()`) as Promise<{ a: [number, number]; b: [number, number] }>;
async function swipe(cdp: CDPSession, page: Page, a: [number, number], b: [number, number]) {
  await touch(cdp, 'touchStart', [a]);
  for (let k = 1; k <= 6; k++) { await touch(cdp, 'touchMove', [[a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6]]); await page.waitForTimeout(25); }
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(700);
}
const firstMove = (page: Page) => page.evaluate(`${SL}.controller.session.lv.sol[0]`) as Promise<string>;

test('a pinch spends no move, and a one-finger drag still works after it', async ({ page, context }) => {
  const errors = await start(page);
  const cdp = await context.newCDPSession(page);
  const r = await railOf(page, await firstMove(page));
  // both fingers land on the board, one of them on the rail
  await touch(cdp, 'touchStart', [r.a, [r.a[0] + 50, r.a[1] + 10]]);
  for (let k = 1; k <= 6; k++) { await touch(cdp, 'touchMove', [[r.a[0] - k * 12, r.a[1] - k * 6], [r.a[0] + 50 + k * 12, r.a[1] + 10 + k * 6]]); await page.waitForTimeout(25); }
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(600);
  expect(await moves(page)).toBe(0);
  await swipe(cdp, page, r.a, r.b);
  expect(await moves(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('Restart stands apart from Undo, and Undo takes it back', async ({ page, context }) => {
  const errors = await start(page);
  await page.evaluate(`${SL}.controller.open(8)`); // two goals, several moves
  await page.waitForTimeout(2500);
  const cdp = await context.newCDPSession(page);
  const boxes = await page.evaluate(`['b-restart', 'b-undo', 'b-hint'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })`) as number[][];
  expect(boxes[1][0] - boxes[0][1]).toBeGreaterThan(200); // a thumb's slip can't reach it
  for (const b of boxes) expect(b[1] - b[0]).toBeGreaterThanOrEqual(44);
  const r = await railOf(page, await firstMove(page));
  await swipe(cdp, page, r.a, r.b);
  expect(await moves(page)).toBe(1);
  await page.tap('#b-restart');
  await page.waitForTimeout(300);
  expect(await moves(page)).toBe(0);
  await expect(page.locator('#hint')).toContainText('Undo brings');
  await page.tap('#b-undo');
  await page.waitForTimeout(600);
  expect(await moves(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('a swipe on the water is not a move, even just after one', async ({ page, context }) => {
  const errors = await start(page);
  await page.evaluate(`${SL}.controller.open(8)`);
  await page.waitForTimeout(2500);
  const cdp = await context.newCDPSession(page);
  const r = await railOf(page, await firstMove(page));
  await swipe(cdp, page, r.a, r.b);
  await swipe(cdp, page, [195, 170], [290, 200]);
  expect(await moves(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('a thumb landing just off a plate still grabs it', async ({ page, context }) => {
  const errors = await start(page);
  const cdp = await context.newCDPSession(page);
  const m = await firstMove(page), r = await railOf(page, m);
  // a point on the water 5 px past the plate's edge, with only this plate within a thumb's reach
  const off = await page.evaluate(`(() => {
    const w = ${SL}.world, plate = ${Number(m[1])}, A = ${JSON.stringify(r.a)};
    for (let k = 0; k < 16; k++) {
      const ca = Math.cos(k * Math.PI / 8), sa = Math.sin(k * Math.PI / 8);
      let d = 0; while (d < 400 && w.pick(A[0] + ca * d, A[1] + sa * d) === plate) d += 2;
      const x = A[0] + ca * (d + 5), y = A[1] + sa * (d + 5);
      if (w.pick(x, y) !== null || x < 20 || y < 200 || x > 370 || y > 700) continue;
      let only = true;
      for (const q of [7, 14]) for (let j = 0; j < 8; j++) { const h = w.pick(x + Math.cos(j * Math.PI / 4) * q, y + Math.sin(j * Math.PI / 4) * q); if (h !== null && h !== plate) only = false; }
      if (only) return [x, y];
    }
    return null;
  })()`) as [number, number] | null;
  expect(off).not.toBeNull();
  await swipe(cdp, page, off!, [off![0] + r.b[0] - r.a[0], off![1] + r.b[1] - r.a[1]]);
  expect(await moves(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('a reload puts the player back on the same board', async ({ page, context }) => {
  const errors = await start(page);
  const cdp = await context.newCDPSession(page);
  await page.evaluate(`${SL}.controller.open(8)`);
  await page.waitForTimeout(2500);
  const r = await railOf(page, await firstMove(page));
  await swipe(cdp, page, r.a, r.b);
  const before = await page.evaluate(`[...${SL}.controller.session.state.plate].join()`);
  await page.evaluate(`for (let i = 0; i < 6; i++) ${SL}.progress.complete(i, 1, 1)`); // a player who really got here: the test's unlock doesn't outlive the reload
  await page.reload();
  await page.waitForFunction(`${SL} && ${SL}.world.frames > 5`, undefined, { timeout: 60_000 });
  await page.evaluate(`${SL}.progress.unlocked = () => true`);
  await page.tap('#btn-play'); // Play goes straight back to an unfinished run
  await page.waitForTimeout(2200);
  await expect(page.locator('#hint')).toContainText('where you left off');
  expect(await page.evaluate(`[${SL}.controller.index, ${SL}.controller.session.moves]`)).toEqual([8, 1]);
  expect(await page.evaluate(`[...${SL}.controller.session.state.plate].join()`)).toBe(before);
  expect(errors).toEqual([]);
});

test('the map follows a turn of the phone, both ways, with every pin on its island', async ({ page }) => {
  const errors = await start(page);
  await page.tap('#b-map');
  await page.waitForTimeout(2400);
  const check = async (w: number, h: number) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(700);
    const r = await page.evaluate(`(() => {
      const a = ${SL}, pins = [...document.querySelectorAll('.pin')];
      return { pins: pins.length, on: pins.filter(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }).length,
        far: pins.filter((e, i) => { const r = e.getBoundingClientRect(), [x, y] = a.world.project(a.world.mapAnchors(a.world.views[i]).pin); return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) > 6; }).length };
    })()`) as { pins: number; on: number; far: number };
    expect(r.on).toBe(r.pins);
    expect(r.far).toBe(0);
  };
  await check(844, 390);
  await check(390, 844);
  await check(844, 390);
  await page.tap('#m-back');
  await page.waitForTimeout(1800);
  await page.tap('#btn-play'); // nothing solved yet, so Play opens the first island
  await page.waitForTimeout(2200);
  await page.setViewportSize({ width: 390, height: 844 }); // turned while on an island, the map catches up when it opens
  await page.waitForTimeout(500);
  await page.tap('#b-map');
  await page.waitForTimeout(2400);
  await check(390, 844);
  expect(errors).toEqual([]);
});
