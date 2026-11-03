import { expect, test } from '@playwright/test';

// Nov 4 exit check (docs/PLAN.md): the built dist loads over HTTP with no console errors and sees every level.
test('dist loads over HTTP and loads all levels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('#app')).toHaveText(/Shiftland: 14 levels loaded \(14 unsolved at start\)/);
  // the stuck-check worker loads from the built bundle (relative base) and proves the Mind the Village dead end
  // after five superseded searches of the slowest state (~1-2 s each), without waiting behind them (Codex chain 5)
  const worker = page.locator('#worker');
  await expect(worker).toHaveText('stuck worker: dead end found');
  expect(Number(await worker.getAttribute('data-ms'))).toBeLessThan(1000);
  expect(await worker.getAttribute('data-workers')).toBe('6');
  expect(errors).toEqual([]);
});
