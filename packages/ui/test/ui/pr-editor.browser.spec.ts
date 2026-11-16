/**
 * The passive-radiator editor (John, 16 Nov 2026 11:05 UTC, QO946.c115): "I want an editor for the pr, it must have the fields
 * the current editor has, it must have a save to my prs option as well as ok and cancel, the numbers must disappear from the
 * mobile box page but remain on the desktop as per now as that is more WinISD like, I still want the select pr popup and in the
 * select popup to have a button to the new pr popup".
 * One editor, both skins: the radiator's own figures (name, Vas, Qms, Fs, Sd, Mms, Cms, Rms, Xmax), OK / Cancel / Save to My PRs.
 * The build choices (count, added mass, tuning) stay on the project's page (QO946.c38) and are not in the editor.
 * Define new passive radiator (in the Select popup): pr-define.browser.spec.ts.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const LOADED = 'ASP190';
const EDITOR = 'Edit passive radiator';
const FIGURES = ['vas', 'qms', 'fs', 'sd', 'mms', 'cms', 'rms', 'xmax'] as const;

function suite(skin: 'desktop' | 'phone') {
  const select = (page: Page) => skin === 'desktop'
    ? page.locator('.edit-btn[title^="Browse bundled"]')
    : page.getByRole('button', {name: 'Select PR'});
  const openEditor = async (page: Page): Promise<Locator> => {
    await page.locator(skin === 'desktop' ? '#og-pr-edit' : '#mob-pr-edit').click();
    const editor = page.getByRole('dialog', {name: EDITOR});
    await expect(editor).toBeVisible();
    return editor;
  };
  /** The project's radiator name, as its page shows it. */
  const projectName = (page: Page) => skin === 'desktop' ? page.locator('#og-pr-name') : page.locator('#mob-pr-edit');
  const expectProjectName = async (page: Page, text: RegExp | string) => {
    if (skin === 'desktop') await expect(projectName(page)).toHaveValue(text);
    else await expect(projectName(page)).toContainText(text);
  };

  test.beforeEach(async ({appPage: page}) => {
    if (skin === 'phone') {
      await page.setViewportSize({width: 390, height: 844});
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-tab', {hasText: 'Box'}).click();
      await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    } else {
      await page.goto('/');
      await openAProject(page);
      await page.locator('select#og-box-type').selectOption('box-passive-radiator');
      await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    }
    await select(page).click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
    await expect(page.locator('.pr-filter')).toHaveCount(0);
    await expectProjectName(page, new RegExp(LOADED));
  });

  test('the editor holds every radiator figure and the name, with OK, Cancel and Save to My PRs, and no build choice', async ({appPage: page}) => {
    const editor = await openEditor(page);
    await expect(editor.locator('#pr-editor-name')).toHaveValue(new RegExp(LOADED));
    for (const f of FIGURES) await expect(editor.locator(`#pr-editor-${f}`)).toBeVisible();
    await expect(editor.locator('#pr-editor-fs')).not.toHaveValue('');
    await expect(editor.getByRole('button', {name: 'OK'})).toBeEnabled();
    await expect(editor.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(editor.getByRole('button', {name: 'Save to My PRs'})).toBeEnabled();
    await expect(editor.getByText(/Number of|Added mass|Fp/)).toHaveCount(0);
  });

  test('OK applies the edits to the project\'s radiator', async ({appPage: page}) => {
    let editor = await openEditor(page);
    await editor.locator('#pr-editor-name').fill('Edited radiator');
    await editor.locator('#pr-editor-xmax').fill('17');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(editor).toHaveCount(0);
    await expectProjectName(page, 'Edited radiator');
    if (skin === 'desktop') await expect(page.locator('#og-pr-xmax')).toHaveValue(/^17/);
    editor = await openEditor(page);
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(/^17/);
    await expect(editor.locator('#pr-editor-name')).toHaveValue('Edited radiator');
  });

  test('Cancel discards the edits', async ({appPage: page}) => {
    let editor = await openEditor(page);
    const before = await editor.locator('#pr-editor-xmax').inputValue();
    await editor.locator('#pr-editor-name').fill('Thrown away');
    await editor.locator('#pr-editor-xmax').fill('42');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await expect(editor).toHaveCount(0);
    await expectProjectName(page, new RegExp(LOADED));
    editor = await openEditor(page);
    await expect(editor.locator('#pr-editor-xmax')).toHaveValue(before);
  });

  test('Save to My PRs files the radiator in My passive radiators and says so; the project changes only on OK', async ({appPage: page}) => {
    const editor = await openEditor(page);
    await editor.locator('#pr-editor-name').fill('Kept in my PRs');
    await editor.getByRole('button', {name: 'Save to My PRs'}).click();
    await expect(editor.getByRole('status')).toContainText('Kept in my PRs');
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await expectProjectName(page, new RegExp(LOADED));
    await select(page).click();
    await expect(page.locator('.pr-lib-item', {hasText: 'Kept in my PRs'})).toBeVisible();
  });
}

test.describe('desktop', () => {
  suite('desktop');

  test('the Passive Radiator page keeps its figures, WinISD-like, with an Edit button beside Select', async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('select#og-box-type').selectOption('box-passive-radiator');
    await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    for (const id of ['#og-pr-vas', '#og-pr-qms', '#og-pr-fs', '#og-pr-mms', '#og-pr-cms', '#og-pr-rms', '#og-pr-count', '#og-pr-madd']) {
      await expect(page.locator(id)).toBeVisible();
    }
    await expect(page.locator('#og-pr-edit')).toBeVisible();
  });
});

test.describe('phone', () => {
  suite('phone');

  test('the Box tab shows the radiator by name, without its figures; the build choices stay', async ({appPage: page}) => {
    const box = page.locator('.mob-csection', {has: page.locator('#mob-pr-edit')});
    await expect(page.locator('#mob-pr-edit')).toContainText(LOADED);
    for (const label of [/^Vas/, /^Qms/, /^Sd/, /^Mms/, /^Cms/, /^Rms/, /^Xmax/]) {
      await expect(box.locator('label', {hasText: label})).toHaveCount(0);
    }
    await expect(page.locator('#mob-pr-name')).toHaveCount(0);
    await expect(page.locator('#mob-pr-count')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Select PR'})).toBeVisible();
  });
});
