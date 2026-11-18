import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {connectedToDrive} from './fixtures/driveConnected.js';

/**
 * The phone header's project name takes one line when it fits (T899, John 18 Nov 2026: production 7.0.960 showed
 * "AS168-9-470 closed" on one line at 390 x 844, the test site wrapped it onto two). With Cloud sync on, the cloud badge
 * narrows the name's cell. A name that does not fit keeps the three-line rule (T735) and an ellipsis inside the cell.
 */
test.use({viewport: {width: 390, height: 844}});

/** Lines the header name occupies, and whether its box or its text spill out of the name's cell. */
async function nameLines(page: import('@playwright/test').Page): Promise<{lines: number; spillsRight: boolean}> {
  return page.locator('.mob-project-title').evaluate(el => {
    const text = el.querySelector('.mob-project-title-text')!;
    const cell = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(text);
    // Lines the clamp hides still have boxes: count the ones inside the cell.
    const rects = Array.from(range.getClientRects()).filter(r => r.bottom <= cell.bottom + 0.5);
    const lines = new Set(rects.map(r => Math.round(r.top))).size;
    const right = Math.max(...rects.map(r => r.right));
    return {lines, spillsRight: right > cell.right + 0.5};
  });
}

test('with Cloud sync on, "AS168-9-470 closed" shows on one line in the header', async ({page}) => {
  await forceMobileSkin(page);
  await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page, undefined, 'AS168-9-470 closed.owpr');
  await expect(page.locator('.mob-header-sync')).toBeVisible();
  const m = await nameLines(page);
  expect(m.lines).toBe(1);
  expect(m.spillsRight).toBe(false);
});

test('a name too long for three lines ends in an ellipsis inside the cell', async ({page}) => {
  await forceMobileSkin(page);
  await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page, undefined, 'AS168-9-470 closed with a very long prototype description that cannot fit three lines at all.owpr');
  const m = await nameLines(page);
  expect(m.lines).toBe(3);
  expect(m.spillsRight).toBe(false);
  // The room for the ellipsis is there (a name that fits one line has none).
  await expect(page.locator('.mob-project-title-text')).toHaveCSS('padding-right', '12px');
});
