import type {Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {readSampleProject} from '../fixtures/sampleProject.js';
import {openISDProjectSessionJsonSchema} from '../../../design/domain/openisdSchema.js';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {OLD_BASKET_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const skins = [
  {name: 'desktop', async closeAir(page: Page) { await page.locator('.project-nav li', {hasText: /^Box$/}).click(); }, ventField: '#og-vent-length', filterField: '.filter-edit-body input', lossField: '#og-losses-whole-ql', airField: '#og-air-temperature', async editAir(page: Page) {
    await page.locator('.project-nav li', {hasText: /^Advanced$/}).click();
    await page.locator('#og-air-temperature').fill('410');
    await page.locator('#og-air-temperature').press('Tab');
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  }, async open(page: Page, path: string) { await page.goto('/'); await openAProject(page, path); }},
  {name: 'phone', async closeAir(page: Page) { await page.getByRole('button', {name: 'Close', exact: true}).last().click(); }, ventField: '#mob-vent-vent-length_m', filterField: '.mob-fcard-body input', lossField: '#mob-losses-whole-ql', airField: '#mob-air-temperature', async editAir(page: Page) {
    await page.getByRole('button', {name: 'Menu'}).click();
    await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
    await page.locator('#mob-air-temperature').fill('410');
    await page.locator('#mob-air-temperature').press('Tab');
    await page.getByRole('button', {name: 'Close', exact: true}).last().click();
  }, async open(page: Page, path: string) {
    await page.setViewportSize({width: 390, height: 844});
    await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page, path);
  }},
] as const;

for (const skin of skins) {
  test(`${skin.name}: footer opens problems and goes to the driver field`, async ({page}, testInfo) => {
    await skin.open(page, OLD_BASKET_PROJECT_OWPR);
    const footer = page.getByRole('button', {name: /\d+ problems?/});
    await expect(footer).toBeVisible();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    await expect(list).toHaveCount(0);
    await testInfo.attach('problems-footer', {body: await page.screenshot(), contentType: 'image/png'});
    await footer.click();
    await expect(list).toBeVisible();
    await testInfo.attach('problems-list', {body: await page.screenshot(), contentType: 'image/png'});
    const problem = list.locator('li').filter({hasText: /basket/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(list).toHaveCount(0);
    const editor = page.locator('.de-modal');
    await expect(editor).toBeVisible();
    await expect(editor.locator('[data-de-tab="Dimensions"]')).toBeVisible();
    await expect(editor.locator('[data-field-key="Basket_m"] input')).toBeFocused();
  });
}

for (const skin of skins) {
  test(`${skin.name}: a box loss problem opens its field`, async ({page}, testInfo) => {
    const raw: unknown = JSON.parse(readSampleProject().toString('utf8'));
    const session = openISDProjectSessionJsonSchema.parse(raw);
    session.saved.box.boxType = 'sealed';
    session.saved.box.sealed.volume_m3 = 0.01;
    session.saved.box.sealed.losses.Ql = 0;
    const path = testInfo.outputPath('zero-box-leakage.owpr');
    writeFileSync(path, JSON.stringify(session));
    await skin.open(page, path);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: /leakage.*(greater|zero)/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(page.locator(skin.lossField)).toBeFocused();
  });
}

for (const skin of skins) {
  test(`${skin.name}: an air problem returns to Advanced`, async ({page}) => {
    await skin.open(page, OLD_BASKET_PROJECT_OWPR);
    await skin.editAir(page);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: /temperature/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(page.locator(skin.airField)).toBeFocused();
    await page.locator(skin.airField).fill('293.15');
    await page.locator(skin.airField).press('Tab');
    await skin.closeAir(page);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    await expect(page.getByRole('dialog', {name: 'Project problems'}).locator('li').filter({hasText: /temperature/i})).toHaveCount(0);
  });
}

for (const skin of skins) {
  test(`${skin.name}: a radiator figure problem opens the radiator editor`, async ({page}, testInfo) => {
    const raw: unknown = JSON.parse(readSampleProject().toString('utf8'));
    const session = openISDProjectSessionJsonSchema.parse(raw);
    session.saved.box.boxType = 'box-passive-radiator';
    session.saved.box.passiveRadiator.volume_m3 = 0.01;
    session.saved.box.passiveRadiator.component.specs['passive-radiator'].Mms_kg = {state: 'E', value: 0.1};
    const path = testInfo.outputPath('radiator-disagreement.owpr');
    writeFileSync(path, JSON.stringify(session));
    await skin.open(page, path);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: /Passive radiator: Fs: Fs differs/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    const editor = page.getByRole('dialog', {name: "Edit Project's Passive Radiator"});
    await expect(editor).toBeVisible();
    await expect(editor.locator('input:focus')).toBeVisible();
  });
}

for (const skin of skins) {
  test(`${skin.name}: a filter problem opens the affected filter`, async ({page}, testInfo) => {
    const sample = readSampleProject().toString('utf8');
    const withFilter = sample.replace(/"filters": \[\]/, '"filters": [{"id": "00000000-0000-4000-0001-0000000009f1", "type": "peakHighpass", "enabled": true, "fpk": 50, "gainPk": -6}]');
    expect(withFilter).not.toBe(sample);
    const path = testInfo.outputPath('negative-filter.owpr');
    writeFileSync(path, withFilter);
    await skin.open(page, path);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: /negative peak gain/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(page.locator(skin.filterField).first()).toBeFocused();
  });
}

for (const skin of skins) {
  test(`${skin.name}: a vent problem goes to the vent field`, async ({page}, testInfo) => {
    const raw: unknown = JSON.parse(readSampleProject().toString('utf8'));
    const session = openISDProjectSessionJsonSchema.parse(raw);
    session.saved.box.vented.vent.diameter_m = {state: 'E', value: 0};
    const path = testInfo.outputPath('zero-vent-diameter.owpr');
    writeFileSync(path, JSON.stringify(session));
    await skin.open(page, path);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: /vent length cannot be calculated/i}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(page.locator(skin.ventField)).toBeFocused();
  });
}

test('phone: the problems footer remains available in Advanced', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, OLD_BASKET_PROJECT_OWPR);
  await page.getByRole('button', {name: 'Menu'}).click();
  await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  const footer = page.getByRole('button', {name: /\d+ problems?/});
  await expect(footer).toBeVisible();
  await footer.click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const basket = list.locator('li').filter({hasText: /basket/i}).first();
  await basket.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('.de-modal [data-field-key="Basket_m"] input')).toBeFocused();
});
