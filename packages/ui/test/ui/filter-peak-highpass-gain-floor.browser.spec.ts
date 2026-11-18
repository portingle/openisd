/**
 * The Peaking 2nd order highpass Peak mag (Gpk) box stops at 0 dB when typing (John, 18 Nov 2026,
 * QO951.c9: "UI should not allow and maths should do what you said anyway"). A user's journey on
 * each shell: add the filter, type -6 dB, read the note saying why. Nothing is stored (ruling "b",
 * bugs/archive/BUG_20261005_no-common-ui-field-component.md): the filter keeps its 6 dB, draws its
 * curve, and Esc puts 6 back in the box. 0 dB is accepted.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const NOTE = /^Gpk is below its minimum — enter a value between 0\.00 and 60\.00 dB\. A 2nd-order high-pass cannot peak below its flat level\.$/;

function gpkField(scope: Locator): Locator {
  return scope.locator('.ui-field').filter({has: scope.page().locator('label').filter({hasText: /^Gpk$/})});
}

async function expectNotClipped(page: Page, note: Locator): Promise<void> {
  await expect(note).toBeVisible();
  const box = (await note.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await note.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
}

async function typeMinusSixThenZero(page: Page, scope: Locator): Promise<void> {
  const field = gpkField(scope);
  const box = field.locator('input');
  await fillAndCommit(box, '-6');
  await expect(box).toHaveValue('-6');
  await expect(box).toHaveClass(/inp-bad/);
  const note = field.locator('.ui-field-note');
  await expect(note).toHaveText(NOTE);
  await expectNotClipped(page, note);
  await expect(scope.locator('.filter-issue'), 'nothing negative was stored, so the engine has nothing to say').toHaveCount(0);

  await box.focus();
  await box.press('Escape');
  await expect(box).toHaveValue('6.00');
  await expect(box).not.toHaveClass(/inp-bad/);

  await fillAndCommit(box, '0');
  await expect(box).not.toHaveClass(/inp-bad/);
  await expect(field.locator('.ui-field-note')).toHaveCount(0);
  await expect(scope.locator('.filter-issue')).toHaveCount(0);
}

test('desktop: typing -6 into a Peak HP Gpk box is refused with a note saying why; 0 is accepted', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Filters'}).click();
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ Peak HP'}).click();
  await typeMinusSixThenZero(page, panel);
});

test('phone: typing -6 into a Peak HP Gpk box is refused with a note saying why; 0 is accepted', async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Filters'}).click();
  await page.getByText('+ Peak HP', {exact: true}).click();
  await typeMinusSixThenZero(page, page.locator('.mob-fcard'));
});
