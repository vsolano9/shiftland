// Things a person does that the solve-through tests don't: real keys, a panel opened and closed from a standing start,
// asking a creature, messages replacing each other, and a dead end's delayed warning (docs/qa.md).
import { expect, test, type Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SL = 'window.__shiftland';
const state = (page: Page) => page.evaluate(`(() => {
  const c = ${SL}.controller, s = c.session, el = id => document.getElementById(id);
  return { index: c.index, moves: s.moves, solved: s.solved, selected: c.selected, hint: el('hint').textContent, hintOff: el('hint').classList.contains('off'),
    blurbOff: el('blurb').classList.contains('off'), settings: !el('settings').classList.contains('hidden'), stuck: !el('stuck').classList.contains('hidden-el'), sol: s.lv.sol };
})()`) as Promise<{ index: number; moves: number; solved: boolean; selected: number | null; hint: string; hintOff: boolean; blurbOff: boolean; settings: boolean; stuck: boolean; sol: string[] }>;

async function start(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.waitForFunction(`${SL} && ${SL}.world.frames > 5`, undefined, { timeout: 60_000 });
  await page.evaluate(`${SL}.progress.unlocked = () => true`);
  await page.click('#btn-play');
  await page.waitForTimeout(500);
  return errors;
}
async function open(page: Page, i: number) {
  await page.evaluate(`${SL}.controller.open(${i})`);
  await page.waitForTimeout(2500);
}

test('keys alone solve an island, then restart, undo, hint and map', async ({ page }) => {
  const errors = await start(page);
  await open(page, 8); // Salt Point
  const { sol } = await state(page);
  const arrow: Record<string, string> = { N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft' };
  for (const m of sol) {
    await page.keyboard.press(String(Number(m[1]) + 1));
    await page.waitForTimeout(100);
    await page.keyboard.press(arrow[m[2]]);
    await page.waitForTimeout(700);
  }
  let s = await state(page);
  expect(s.solved).toBe(true);
  expect(s.moves).toBe(sol.length);
  await page.waitForTimeout(2200);
  await page.keyboard.press('r');
  await page.waitForTimeout(800);
  s = await state(page);
  expect([s.moves, s.solved]).toEqual([0, false]);
  await expect(page.locator('#done')).toBeHidden();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect((await state(page)).selected).not.toBeNull();
  await page.keyboard.press('1');
  await page.keyboard.press(arrow[sol[0][2]]);
  await page.waitForTimeout(600);
  const moved = (await state(page)).moves;
  // The rail stays up on the selected plate: once the move has settled it must sit on the plate, not where the plate was
  const railGap = () => page.evaluate(`(() => {
    const v = ${SL}.view, p = v.railPlate, a = v.railAnchor(p), o = v.railParts.stops[v.lv.maxTravel + (v.state.off?.[p] ?? 0)].position;
    return Math.max(Math.abs(a.x - v.ox - o.x), Math.abs(a.z - v.oz - o.z));
  })()`) as Promise<number>;
  expect(await railGap()).toBeLessThan(.01);
  await page.keyboard.press('z');
  await page.waitForTimeout(600);
  expect((await state(page)).moves).toBe(Math.max(0, moved - 1));
  expect(await railGap()).toBeLessThan(.01); // and after an Undo too (playtest 4 P7)
  await page.keyboard.press('h');
  await page.waitForTimeout(1500);
  expect((await state(page)).hintOff).toBe(false);
  expect(errors).toEqual([]);
});

test('settings opened and closed five times cost nothing, and the next drag still works', async ({ page }) => {
  const errors = await start(page);
  await open(page, 8);
  for (let k = 0; k < 5; k++) {
    await page.click('#b-set');
    await expect(page.locator('#settings')).toBeVisible();
    await page.click('#s-close');
    await expect(page.locator('#settings')).toBeHidden();
  }
  expect((await state(page)).moves).toBe(0);
  const pts = await page.evaluate(`(() => {
    const a = ${SL}, m = a.controller.session.lv.sol[0], d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]], A = a.view.railAnchor(Number(m[1])), B = A.clone();
    B.x += d[0]; B.z += d[1];
    return [a.world.project(A), a.world.project(B)];
  })()`) as number[][];
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  await page.mouse.move(pts[1][0], pts[1][1], { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  expect((await state(page)).moves).toBe(1);
  expect(errors).toEqual([]);
});

test('a nudge says drag further, a short confident drag moves, and a hint names its plate until Restart', async ({ page }) => {
  const errors = await start(page);
  await open(page, 8);
  const drag = async (cells: number, back = false) => {
    const pts = await page.evaluate(`(() => {
      const a = ${SL}, m = a.controller.session.lv.sol[0], d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[m[2]], A = a.view.railAnchor(Number(m[1])), B = A.clone();
      B.x += d[0] * ${cells}; B.z += d[1] * ${cells};
      return [a.world.project(A), a.world.project(B)];
    })()`) as number[][];
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    await page.mouse.move(pts[1][0], pts[1][1], { steps: 6 });
    if (back) await page.mouse.move(pts[0][0], pts[0][1], { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  const dismiss = () => page.evaluate(`document.getElementById('hint').classList.add('off')`);
  await drag(.2);
  let s = await state(page);
  expect([s.moves, s.hintOff]).toEqual([0, false]);
  expect(s.hint).toContain('Drag further');
  await page.waitForTimeout(2500);
  expect((await state(page)).hintOff).toBe(false); // still readable 2.6 s on
  await dismiss();
  await drag(.7, true); // out to a stop and back: a choice, not a failed nudge
  s = await state(page);
  expect(s.moves).toBe(0);
  expect(s.hintOff).toBe(true);
  await drag(.45);
  await page.waitForTimeout(500);
  expect((await state(page)).moves).toBe(1);
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  await page.keyboard.press('h');
  await page.waitForTimeout(1500);
  s = await state(page);
  expect(s.hintOff).toBe(false);
  expect(s.hint).toMatch(/^Try the (coral|gold|violet|rust) plate with the (stripes|dots|zigzags|checks)\./);
  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  expect((await state(page)).hintOff).toBe(true);
  expect(await page.evaluate(`${SL}.view.railHint`)).toBe(0);
  expect(errors).toEqual([]);
});

test('no two sliders sit side by side, and each knob grabs its own plate', async ({ page }) => {
  const errors = await start(page);
  const levels = await page.evaluate(`${SL}.levels.length`) as number;
  for (let i = 0; i < levels; i++) {
    await page.evaluate(`${SL}.controller.open(${i})`);
    await page.waitForTimeout(350);
    const bad = await page.evaluate(`(() => {
      const a = ${SL}, v = a.view, w = a.world;
      w.finishFly?.();
      return v.marks.filter(k => k.grab).map(k => { const q = k.m.position.clone(); q.x += v.ox; q.z += v.oz; const [x, y] = w.project(q); return { plate: k.plate, picks: w.pick(x, y) }; }).filter(k => k.picks !== k.plate);
    })()`);
    expect(bad, `island ${i + 1}`).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('a creature answers when tapped and no move is spent', async ({ page }) => {
  const errors = await start(page);
  await open(page, 5); // High Pasture
  const at = await page.evaluate(`(() => {
    const a = ${SL}, c = a.view.creatures.find(c => c.kind === 'goat'), v = a.view.worldPos(a.controller.session.state.objs[c.goalIndex].cell);
    v.y += .4;
    return a.world.project(v);
  })()`) as number[];
  await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.moves).toBe(0);
  expect(s.hintOff).toBe(false);
  expect(s.hint).toContain('goat');
  expect(errors).toEqual([]);
});

test('a newer message is not cut short by an older one, and the note comes back', async ({ page }) => {
  const errors = await start(page);
  await open(page, 5);
  await page.click('.chip');
  await page.waitForTimeout(250);
  const chip = (await state(page)).hint;
  expect(chip.length).toBeGreaterThan(10);
  await page.waitForTimeout(800);
  await page.click('#b-hint');
  await page.waitForTimeout(1500);
  let s = await state(page);
  expect(s.hint).not.toBe(chip);
  await page.waitForTimeout(3000); // past the first hint's own display would be 5 s: still showing
  expect((await state(page)).hintOff).toBe(false);
  await page.click('#hud-tl');
  await page.waitForTimeout(250);
  expect((await state(page)).blurbOff).toBe(false);
  await page.waitForTimeout(4400);
  expect((await state(page)).blurbOff).toBe(true);
  await page.click('#b-restart');
  await page.waitForTimeout(400);
  s = await state(page);
  expect(s.blurbOff).toBe(false);
  expect(errors).toEqual([]);
});

test('a dead end warns after a quiet wait, and Undo clears it', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await start(page);
  await open(page, 17); // Anchor Rock: P0E is a proven dead end
  await page.evaluate(`${SL}.controller.move(0, 1)`);
  await page.waitForTimeout(2500);
  expect((await state(page)).stuck).toBe(false); // proved by now, and still quiet
  await page.waitForTimeout(6000);
  expect((await state(page)).stuck).toBe(true);
  await page.click('#b-undo', { force: true }); // it pulses, so it never counts as stable
  await page.waitForTimeout(600);
  expect((await state(page)).stuck).toBe(false);
  expect(errors).toEqual([]);
});
