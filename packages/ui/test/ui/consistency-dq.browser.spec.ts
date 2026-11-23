/**
 * The consistency-group DQ mark — workspace ledger QP18 and openisd ledger QO13's sibling
 * QO12, one mechanism for both rulings:
 *
 *   "show a dq next to any field in a group that has lost consistency"          (QP18)
 *   "if this causes dq error then please add dq note at side of affected fields" (QO12)
 *
 * What these tests pin: the mark lands on EVERY member of the group, it carries a tooltip
 * naming the group and the size of the disagreement, a consistent driver has none, and it
 * blocks nothing.
 */
import {expect, openAProject, openDriverEditor, test} from '../fixtures.js';
import {owdrText} from '../fixtures/seedMyDrivers.js';
import type {Page} from '@playwright/test';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE_OWPR = COMPLETE_DRIVER_PROJECT_OWPR;

// Mms typed as 30 g on the demo driver — the exact repro recorded in QO12. Fs stays entered
// at 37 Hz, Cms stays computed from Vas and Sd, and the three can no longer be reconciled:
// Fs implied by Mms and Cms is ~26.6 Hz.
const IMPOSSIBLE_MMS_G = '30';

async function openWhatIf(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE_OWPR);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  await expect(page.locator('.what-if-panel')).toBeVisible();
}

const whatIfField = (page: Page, label: string) =>
  page.locator('.what-if-panel .what-if-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

async function openEditorParameters(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE_OWPR);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
}

const editorField = (page: Page, label: string) =>
  page.locator('.de-modal .de-fld', { has: page.locator('label', { hasText: new RegExp(`^${label}\\b`) }) });

// ── The driver editor ─────────────────────────────────────────────────────────────────────
test('driver editor: an inconsistent group marks every one of its members, with an actionable tooltip', async ({ page }) => {
  await openEditorParameters(page);

  // The demo driver reconciles, so nothing is marked to begin with — a mark on every driver
  // would be wallpaper, and the whole point is that it means something.
  for (const f of ['Fs', 'Mms', 'Cms']) {
    await expect(editorField(page, f).locator('.ui-field-dq-btn')).toHaveCount(0);
  }

  const mms = editorField(page, 'Mms').locator('input').first();
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  // Fs, Mms AND Cms — the group is the unit, not the field that was typed.
  for (const f of ['Fs', 'Mms', 'Cms']) {
    await expect(editorField(page, f).locator('.ui-field-dq-btn')).toHaveCount(1);
  }

  // The tooltip names the group and how far out it is; "inconsistent" alone is not actionable.
  const note = await editorField(page, 'Fs').locator('.ui-field-dq-btn').getAttribute('title');
  expect(note).toMatch(/^Conflicts with other values: Fs differs by [0-9.]+%\. Using Mms and Cms gives [0-9.]+ Hz\. The box shows [0-9.]+ Hz\./);
  expect(note).toContain('Fix any incorrect value. To recalculate a value from the remaining inputs, empty its box.');

  // A field outside the group is NOT marked.
  await expect(editorField(page, 'Re').locator('.ui-field-dq-btn')).toHaveCount(0);

  // Nothing is blocked — the ruling was a mark, not a gate.
  await expect(page.locator('.de-modal .de-footer button:has-text("OK")')).toBeEnabled();
  await expect(page.locator('.de-modal .de-footer').getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
});

// ── The Original skin's docked What-if panel ──────────────────────────────────────────────
// A typed Mms moves Fs, Qes, Qms, Qts and SPL (whatIfMoves.ts), so the group stays consistent and no mark appears.
test('What-if: a typed Mms moves Fs, so no mark appears and the group stays consistent', async ({ page }) => {
  await openWhatIf(page);

  await expect(page.locator('.what-if-panel .ui-field-dq-btn')).toHaveCount(0);
  const fsBefore = await whatIfField(page, 'Fs').locator('input').inputValue();

  const mms = whatIfField(page, 'Mms').locator('input');
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  await expect(whatIfField(page, 'Fs').locator('input')).not.toHaveValue(fsBefore);
  await expect(page.locator('.what-if-panel .ui-field-dq-btn')).toHaveCount(0);
});

// A typed Fs below the field's limits is refused by the rule (whatIfMoves.ts returns no moves), and the box still carries the alert icon with the range as its reason.
const REFUSED_FS = '0.0001';

test('What-if: a refused Fs keeps its alert icon, which opens the range reason and closes again', async ({ page }) => {
  await openWhatIf(page);

  await expect(page.locator('.what-if-panel .ui-field-dq-btn')).toHaveCount(0);

  const fs = whatIfField(page, 'Fs').locator('input');
  await fs.click();
  await fs.press('Control+a');
  await fs.pressSequentially(REFUSED_FS);
  await fs.blur();

  const mark = whatIfField(page, 'Fs').locator('.ui-field-dq-btn');
  await expect(mark).toHaveCount(1);
  await expect(whatIfField(page, 'Re').locator('.ui-field-dq-btn')).toHaveCount(0);

  const note = whatIfField(page, 'Fs').locator('.ui-field-note');
  await expect(note).toBeHidden();
  await mark.click();
  await expect(note).toBeVisible();
  await expect(note).toContainText(/below its minimum/);

  // The note is a popup: it is read inside the window, never off its edge.
  const inside = await note.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
  });
  expect(inside).toBe(true);

  await mark.click();
  await expect(note).toBeHidden();

  // Emptying the box withdraws the entry and the icon goes.
  await fs.click();
  await fs.press('Control+a');
  await fs.press('Delete');
  await fs.blur();
  await expect(page.locator('.what-if-panel .ui-field-dq-btn')).toHaveCount(0);
});

test('chart failure lists the missing circuit values returned by the sweep', async ({ page }) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_OWPR);

  // The user swaps in a driver file that carries no electrical or mechanical values.
  await openDriverEditor(page);
  await page.locator('.de-modal input[type=file]').setInputFiles({
    name: 'blank.owdr', mimeType: 'application/x-openisd-driver',
    buffer: Buffer.from(owdrText({ brand: 'Blank', model: 'Driver', specs: {} }, '00000000-0000-4000-8000-0000000000b1')),
  });
  await page.locator('.de-footer button.pri', { hasText: 'OK' }).click();
  await page.locator('.de-body').waitFor({ state: 'hidden' });

  const chartMessage = page.locator('.gmsg');
  await expect(chartMessage).toBeVisible();
  await expect(chartMessage).toContainText('cone area (Sd)');
  await expect(chartMessage).toContainText('coil resistance (Re)');
  await expect(chartMessage).toContainText('force factor (BL)');
  await expect(chartMessage).toContainText('compliance (Cms)');
  await expect(chartMessage).toContainText('moving mass (Mms)');
  await expect(chartMessage).toContainText('mechanical resistance (Rms)');
  await expect(chartMessage).not.toContainText('Simulation produced no usable values');
});
