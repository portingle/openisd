import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const scenarios = [
  {name: 'desktop', async signal(page: Page) { await page.locator('.project-nav li', {hasText: 'Signal'}).click(); }, warning: '#og-pr-excursion-advice', count: '#og-pr-count', async open(page: Page) {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: 'Signal'}).click();
    await page.getByLabel('System input power', {exact: true}).fill('10');
    await page.getByLabel('System input power', {exact: true}).press('Tab');
    await page.locator('.project-nav li', {hasText: 'Box'}).click();
    await page.locator('#og-box-type').selectOption('box-passive-radiator');
    await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    await page.locator('#og-pr-edit').click();
  }},
  {name: 'phone', async signal(page: Page) { await page.locator('.mob-tab', {hasText: 'Signal'}).click(); }, warning: '#mob-pr-excursion-advice', count: '#mob-pr-count', async open(page: Page) {
    await page.setViewportSize({width: 390, height: 844});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Signal'}).click();
    await page.getByLabel('Power', {exact: true}).fill('10');
    await page.getByLabel('Power', {exact: true}).press('Tab');
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('#mob-pr-edit').click();
  }},
] as const;

for (const scenario of scenarios) {
  test(`${scenario.name}: the radiator warning follows a changed Xmax`, async ({appPage: page}, testInfo) => {
    await scenario.open(page);
    const editor = page.getByRole('dialog', {name: "Edit Project's Passive Radiator"});
    await editor.getByRole('tab', {name: 'Parameters'}).click();
    await editor.locator('#pr-editor-xmax').fill('4');
    await editor.locator('#pr-editor-xmax').press('Tab');
    await editor.getByRole('button', {name: 'OK', exact: true}).click();
    const warning = page.locator(scenario.warning);
    await expect(warning).toContainText('exceeds Xmax');
    await expect(warning).toContainText('10 W signal and current filters');
    await expect(warning).toContainText('signal power');
    const count = page.locator(scenario.count);
    await expect(count).toBeVisible();
    const countRow = page.locator('.ui-field', {has: count});
    await expect(countRow.locator('.ui-field-dq-btn')).toBeVisible();
    await warning.scrollIntoViewIfNeeded();
    await testInfo.attach('radiator-warning', {body: await page.screenshot(), contentType: 'image/png'});
    await scenario.signal(page);
    await page.getByRole('button', {name: /\d+ problems?/}).click();
    const list = page.getByRole('dialog', {name: 'Project problems'});
    const problem = list.locator('li').filter({hasText: 'exceeds Xmax'}).first();
    await expect(problem).toBeVisible();
    await problem.getByRole('button', {name: 'Go to'}).click();
    await expect(count).toBeFocused();
  });
}
