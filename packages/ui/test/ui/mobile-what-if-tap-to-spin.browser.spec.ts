import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {SheetMode} from '@openisd/design/fields';
import type {Locator, Page} from '@playwright/test';

/**
 * The phone What-if sheet's number boxes (John, 11 Nov 2026, QO536: "the numpad coming up on the
 * mobile what if is inconvenient"): a quick tap on a digit picks it for the ▲▼ and the sideways
 * drag and opens no keypad; a press held half a second switches that box to typing with the
 * decimal keypad; leaving the box puts it back. A hint under the title says so until it is used.
 * Tune keeps tap-to-type.
 */
test.use({hasTouch: true, isMobile: true, viewport: {width: 374, height: 705}});

/** The centre of the digit at `index` in the box's own font, in page pixels. */
async function digitCentre(box: Locator, index: number): Promise<{x: number; y: number}> {
  return box.evaluate((el, i) => {
    if (!(el instanceof HTMLInputElement)) throw new Error('not an input');
    const style = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx === null) throw new Error('no canvas');
    ctx.font = style.font;
    const r = el.getBoundingClientRect();
    const left = r.left + el.clientLeft + parseFloat(style.paddingLeft);
    const free = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - ctx.measureText(el.value).width;
    const origin = style.textAlign === 'right' || style.textAlign === 'end' ? free : style.textAlign === 'center' ? free / 2 : 0;
    const x = left + origin + (ctx.measureText(el.value.slice(0, i)).width + ctx.measureText(el.value.slice(0, i + 1)).width) / 2;
    return {x, y: r.top + r.height / 2};
  }, index);
}

/** A finger tap on the middle of `target`. */
async function tapOn(page: Page, target: Locator): Promise<void> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('not on screen');
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

async function openSheet(page: Page, name: 'What-if' | 'Tune'): Promise<Locator> {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: `Open ${name}`}).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toHaveAttribute('aria-label', name);
  return sheet;
}

test('What-if: a tap picks a digit with no keypad, ▲ spins it, a held press types, leaving goes back', async ({page}) => {
  const sheet = await openSheet(page, 'What-if');
  const hint = sheet.locator('.mob-sheet-hint');
  await expect(hint).toHaveText(SheetMode.TAP_SPIN_HINT);
  const row = sheet.locator('.ui-field').filter({has: page.locator('.ui-field-label', {hasText: /^Fs$/})});
  const box = row.locator('input');
  await expect(box).toHaveAttribute('inputmode', 'none');
  await box.scrollIntoViewIfNeeded();

  // A quick tap on the first digit: it is marked for spinning, the box asks for no keypad.
  const before = Number(await box.inputValue());
  const first = await digitCentre(box, 0);
  await page.touchscreen.tap(first.x, first.y);
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute('inputmode', 'none');
  await expect(row.locator('.num-mark-underline')).toHaveText((await box.inputValue())[0]!);

  // ▲ spins that digit: the first digit of a two-digit Fs moves the value by ten.
  await tapOn(page, row.locator('.num-stepper-btn[title="Increase"]'));
  await expect.poll(async () => Number(await box.inputValue())).toBeCloseTo(before + 10, 6);
  await expect(hint, 'stays while this sheet is open, so the rows never move under the finger').toBeVisible();

  // A press held for the hold time switches the box to typing: the decimal keypad, the whole number selected.
  await page.clock.install();
  const at = await digitCentre(box, 0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: at.x, y: at.y, id: 1}]});
  await page.clock.runFor(SheetMode.HOLD_TO_TYPE_MS + 100);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await expect(box).toHaveAttribute('inputmode', 'decimal');
  await expect(box).toBeFocused();
  const value = await box.inputValue();
  expect(await box.evaluate(el => el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null)).toEqual([0, value.length]);

  // Leaving the box (a tap on the sheet's title) puts it back to tap mode.
  await tapOn(page, sheet.locator('.mob-band-title'));
  await expect(box).not.toBeFocused();
  await expect(box).toHaveAttribute('inputmode', 'none');

  // Used once: the hint is gone from the next opening.
  await tapOn(page, sheet.locator('.mob-sheet-close'));
  await tapOn(page, page.getByRole('button', {name: 'Open What-if'}));
  await expect(sheet).toHaveAttribute('aria-label', 'What-if');
  await expect(hint).toHaveCount(0);
});

test('Tune keeps tap-to-type and shows no hint', async ({page}) => {
  const sheet = await openSheet(page, 'Tune');
  await expect(sheet.locator('.mob-sheet-hint')).toHaveCount(0);
  await expect(sheet.locator('input[data-numinput]').first()).toHaveAttribute('inputmode', 'decimal');
});
