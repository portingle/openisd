/**
 * Issue 522 (John, 16 Nov 2026): "the define passive radiator button on the pr popup doesn't work at all".
 * It used to close the popup and swap a blank radiator into the project with no editor and no question.
 * Now it opens an editor on a NEW blank radiator, its name box focused; the project's radiator stays until
 * OK; OK files it in My passive radiators like a new driver (picking it is what uses it); Cancel changes nothing. Both skins and the New Project wizard's radiator step.
 * bugs/BUG_20261115_define-passive-radiator-button-does-nothing.md
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const LOADED = 'ASP190';

async function loadRadiator(page: Page, opener: () => Promise<void>) {
  await opener();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
  await expect(page.locator('.pr-filter')).toHaveCount(0);
}

function suite(skin: 'desktop' | 'phone') {
  const name = skin === 'desktop' ? '#og-pr-name' : '#mob-pr-name';
  const select = (page: Page) => skin === 'desktop'
    ? page.locator('.edit-btn[title^="Browse bundled"]')
    : page.getByRole('button', {name: 'Select PR'});
  const open = async (page: Page) => { await select(page).click(); await page.locator('.pr-filter').waitFor(); };

  test.beforeEach(async ({appPage: page}) => {
    if (skin === 'phone') {
      await page.setViewportSize({width: 374, height: 705});
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
    await loadRadiator(page, () => open(page));
    await expect(page.locator(name)).toHaveValue(new RegExp(LOADED));
  });

  test('Define opens an editor on a blank radiator with its name focused; the project keeps its radiator', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await expect(editor).toBeVisible();
    await expect(editor.locator('#pr-define-name')).toBeFocused();
    await expect(editor.locator('#pr-define-name')).toHaveValue('');
    await expect(editor.locator('#pr-define-fs')).toHaveValue('');
    await expect(editor.getByRole('button', {name: 'OK'})).toBeDisabled();
    await expect(page.locator(name)).toHaveValue(new RegExp(LOADED));
    await editor.getByRole('button', {name: 'Cancel'}).click();
  });

  test('Cancel leaves the project and the library popup as they were', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-define-name').fill('Half typed');
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.pr-filter')).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(page.locator(name)).toHaveValue(new RegExp(LOADED));
  });

  test('OK files the new radiator in the library and leaves the project\'s radiator alone, as a new driver does', async ({appPage: page}) => {
    await open(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-define-name').fill('My new PR');
    await editor.locator('#pr-define-fs').fill('21');
    await editor.locator('#pr-define-vas').fill('60');
    await editor.locator('#pr-define-fs').press('Tab');
    await expect(editor.locator('#pr-define-vas')).toHaveValue('60.00');   // a typed figure stays in its box
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.pr-lib-item', {hasText: 'My new PR'})).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(page.locator(name)).toHaveValue(new RegExp(LOADED));
    await open(page);
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'My new PR'}).click();
    await expect(page.locator(name)).toHaveValue('My new PR');
  });
}

test.describe('desktop', () => { suite('desktop'); });

test.describe('phone', () => { suite('phone'); });

test.describe('wizard step', () => {
  test.beforeEach(async ({appPage: page}) => {
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('.dlist .ditem').first().click();
    await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
    await modal.locator('button', {hasText: 'Next'}).click();
    await modal.getByLabel('Box type').selectOption('box-passive-radiator');
    await modal.locator('button', {hasText: 'Next'}).click();
  });

  test('Define opens the editor; Cancel keeps the radiator chosen, OK files the new one in the library only', async ({appPage: page}) => {
    await page.locator('#np-pr-select').click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: LOADED}).first().click();
    await page.locator('.overlay.open .modal-footer').getByRole('button', {name: /Back/}).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(new RegExp(LOADED));

    await page.locator('#np-pr-select').click();
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await expect(editor.locator('#pr-define-name')).toBeFocused();
    await editor.getByRole('button', {name: 'Cancel'}).click();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(page.locator('#np-pr-name')).toHaveValue(new RegExp(LOADED));

    await page.locator('#np-pr-select').click();
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    await editor.locator('#pr-define-name').fill('Wizard PR');
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(page.locator('.pr-lib-item', {hasText: 'Wizard PR'})).toBeVisible();
    await expect(page.locator('#np-pr-name')).toHaveValue(new RegExp(LOADED));
    await page.getByRole('button', {name: 'Done'}).click();
  });
});
