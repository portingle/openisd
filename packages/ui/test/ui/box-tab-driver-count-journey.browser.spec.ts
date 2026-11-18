import {expect, openTab, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

/**
 * Journey (T904): a person makes a closed-box project with the Tang Band W5-1138SMF, types a box volume, changes the
 * Num. of drivers on the Driver tab and reads the Box tab again. WinISD's figures (winisd_research runs/nd-1/53_nd4_vb4.48_boxtab.png):
 * one driver in 4.48 L reads Qtc 0.719, Fsc 67.23; four drivers in 4.48 L read Qtc 1.085, Fsc 107.38; four drivers in
 * 17.92 L (four times the volume) read the one-driver figures again. It missed T901's defect (the Box tab's sealed
 * Fsc and Qtc ignored the number of drivers). Acts only as a person does: the wizard, typing, the tabs. No state is read or seeded.
 * Project losses stay at the defaults (Ql 10, Qa 100, Rs 0.1 ohm), which these figures assume.
 */

interface Skin {
  readonly name: string;
  newProject(page: Page): Promise<Locator>;
  next(page: Page): Locator;
  create(page: Page): Locator;
  volume(page: Page): Locator;
  fsc(page: Page): Locator;
  qtc(page: Page): Locator;
  setDrivers(page: Page, n: number): Promise<void>;
}

const desktop: Skin = {
  name: 'desktop',
  newProject: async page => { await page.locator('.tb-btn[title*="New project"]').click(); return page.locator('.overlay.open'); },
  next: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Next', exact: true}),
  create: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Create', exact: true}),
  volume: page => page.locator('#og-box-volume'),
  fsc: page => page.locator('#og-box-resonance'),
  qtc: page => page.locator('#og-box-qtc'),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('.tab-section.active .field', {hasText: 'Num. of drivers'}).locator('select').selectOption(String(n));
  },
};

const phone: Skin = {
  name: 'phone',
  newProject: async page => { await page.getByText('New project').click(); return page.locator('.mob-np-overlay'); },
  next: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.NEXT, exact: true}),
  create: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.CREATE, exact: true}),
  volume: page => mobileFieldRow(page, 'Vb').locator('input').first(),
  fsc: page => mobileFieldRow(page, 'Fsc').locator('input').first(),
  qtc: page => mobileFieldRow(page, 'Qtc').locator('input').first(),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('#mob-n-drivers').selectOption(String(n));
  },
};

async function number(box: Locator): Promise<number> {
  return Number(await box.inputValue());
}

async function expectReadout(skin: Skin, page: Page, qtc: number, fsc: number, when: string): Promise<void> {
  await openTab(page, 'Box');
  await expect.poll(async () => number(skin.qtc(page)), {message: `${when}: Qtc`}).toBeCloseTo(qtc, 3);
  expect.soft(await number(skin.fsc(page)), `${when}: Fsc`).toBeCloseTo(fsc, 1);
}

async function journey(skin: Skin, page: Page): Promise<void> {
  const root = await skin.newProject(page);
  await expect(root).toBeVisible();
  await root.locator('input.filter').fill('W5-1138SMF');
  await root.locator('.dlist .ditem', {hasText: 'W5-1138SMF'}).first().click();
  await expect(root.locator('.preview .prev-name')).toContainText('W5-1138SMF');
  await skin.next(page).click();
  await skin.next(page).click();
  await root.locator('#np-box-type').selectOption('sealed');
  await skin.next(page).click();
  await skin.next(page).click();
  await skin.create(page).click();
  await expect(root).toHaveCount(0);

  await openTab(page, 'Box');
  await skin.volume(page).fill('4.48');
  await skin.volume(page).press('Tab');
  await expectReadout(skin, page, 0.719, 67.23, 'one driver, 4.48 L');

  await skin.setDrivers(page, 4);
  await expectReadout(skin, page, 1.085, 107.38, 'four drivers, 4.48 L');

  await skin.volume(page).fill('17.92');
  await skin.volume(page).press('Tab');
  await expectReadout(skin, page, 0.719, 67.23, 'four drivers, 17.92 L');
}

test.describe('Journey: the Box tab reads the number of drivers', () => {
  test('desktop: 1 driver, then 4 in the same volume, then 4 in four times the volume', async ({appPage: page}) => {
    await journey(desktop, page);
  });

  test.describe('phone', () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

    test('phone: 1 driver, then 4 in the same volume, then 4 in four times the volume', async ({page}) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await journey(phone, page);
    });
  });
});
