/**
 * A project is open with unsaved edits and another device edits the same saved project: sync keeps both.
 * The pulled version keeps the name; the user's edits stay open as "<name> (conflict, <day>, <device>)".
 * A visible notice names both projects, on both skins (John, 18 Nov 2026, QO946.c245: the conflict copy
 * of an open project was made without telling the user which project was which).
 * Real sync and Drive client over an emulated Drive.
 */
import type {Page} from '@playwright/test';
import {formatDay} from '@openisd/design/fields';
import {dirtyFocusedDesign, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {connectedToDrive, iPhoneEdit} from './fixtures/driveConnected.js';

const NOTICE = 'Project "sample-project" kept both: yours and the copy from iPhone.';
const COPY_NAME = `sample-project (conflict, ${formatDay(new Date())}, `;

/** The project is saved and reaches Drive; the feedback prompt a save brings is dismissed as a person would. */
async function savedToDrive(page: Page, drive: DriveEmulator, save: () => Promise<void>): Promise<void> {
  await save();
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
  await expect(page.getByTestId('feedback-backdrop')).toBeVisible();
  await page.keyboard.press('Escape');
}

test('desktop: the conflict copy of an open project comes with a notice naming both projects', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await savedToDrive(page, drive, () => page.locator('.tb-btn[title^="Save - "]').click());
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');

  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await page.locator('.cloud-modal-x').click();
  const notice = page.locator('.cloud-conflict-notice');
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toContainText(`Yours is now "${COPY_NAME}`);
});

test('mobile: the conflict copy of an open project comes with a notice naming both projects', async ({page}) => {
  await forceMobileSkin(page);
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await savedToDrive(page, drive, () => tapMobileMenuItem(page, /^Save$/));
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');

  await tapMobileMenuItem(page, 'Cloud sync');
  await page.locator('.mob-dlg button', {hasText: 'Sync now'}).click();
  await page.locator('.mob-dlg').getByRole('button', {name: /^(Close|OK|✕)$/}).last().click();
  const notice = page.locator('.mob-conflict-banner');
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toContainText(`Yours is now "${COPY_NAME}`);
});

test('desktop: the notice goes once the user has viewed the conflict and opened the copy', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await savedToDrive(page, drive, () => page.locator('.tb-btn[title^="Save - "]').click());
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await page.locator('.cloud-modal-x').click();
  await expect(page.locator('.cloud-conflict-notice')).toContainText(NOTICE);

  // View, then open the copy: the conflict leaves the list.
  await page.locator('.cloud-conflict-notice button', {hasText: 'View'}).click();
  await page.locator('.cloud-modal .cloud-sync-conflict-open-btn').click();
  await expect(page.locator('.cloud-conflict-notice')).toHaveCount(0);
});
