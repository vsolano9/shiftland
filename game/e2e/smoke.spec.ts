import { expect, test } from '@playwright/test';

// Nov 4 exit check (docs/PLAN.md): the built dist loads over HTTP with no console errors and sees every level.
test('dist loads over HTTP and loads all levels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('#app')).toHaveText(/Shiftland: 14 levels loaded \(14 unsolved at start\)/);
  // the stuck-check worker loads from the built bundle (relative base) and proves the Mind the Village dead end
  await expect(page.locator('#worker')).toHaveText('stuck worker: dead end found');
  expect(errors).toEqual([]);
});
