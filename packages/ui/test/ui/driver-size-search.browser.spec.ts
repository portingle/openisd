/**
 * Search by size (issue 516, John 14 Nov 2026): a size chip row filters the driver library by the
 * class worked out from Sd. The class is for searching only, so wherever a row shows it, it says
 * "from Sd" and never reads as the maker's nominal size. Both skins.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const DERIVED_5 = '≈ 5 in (from Sd)';

/** The test catalogue holds 16 drivers; three have an Sd that gives the 5 in class. */
async function expectOnlySize5Listed(page: Page): Promise<void> {
  const rows = page.locator('.dlist .ditem:not(.my-ditem)');
  await expect(rows.first()).toBeVisible();
  await expect(rows).toHaveCount(3);
  for (const label of await rows.locator('.dsize').allTextContents()) expect(label).toBe(DERIVED_5);
  await expect(rows.locator('.dsize')).toHaveCount(await rows.count());
}

test('desktop: the 5 in size chip narrows the library to drivers whose Sd gives that class', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  const all = await page.locator('.dlist .ditem:not(.my-ditem)').count();
  await page.locator('.size-row .zchip', {hasText: /^5$/}).click();
  await expectOnlySize5Listed(page);
  expect(await page.locator('.dlist .ditem:not(.my-ditem)').count()).toBeLessThan(all);
  await expect(page.locator('.filters-on-pill', {hasText: 'from Sd'})).toBeVisible();
  await page.locator('.filters-on .filters-clear').click();
  await expect(page.locator('.size-row .zchip.active')).toHaveCount(0);
});

test('phone: the 5 in size chip, inside Filters, narrows the library and the rows say from Sd', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Select driver').click();
  await page.locator('.dl-filters-toggle').click();
  await page.locator('.size-row .zchip', {hasText: /^5$/}).click();
  await expectOnlySize5Listed(page);
  await expect(page.locator('.dl-filters-toggle')).toContainText('(1)');
});
