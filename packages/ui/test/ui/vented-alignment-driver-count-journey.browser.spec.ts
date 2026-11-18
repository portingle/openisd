import {expect, openTab, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

/**
 * Journey (T921): a person makes a vented project with the Tang Band W5-1138SMF, sets 2 drivers on the Driver tab and
 * picks the vented Alignment on the Box tab. WinISD 0.7.0 proposes twice the volume and the same tuning
 * (winisd_research/runs/vented-picker-ndrivers-20261118/RESULT.md, C4/SC4: one driver 10.6966 L, two drivers 21.3932 L,
 * Fb 35.9002 Hz in both). It missed the defect (the vented picker used one driver's Vas whatever the count). Acts only as
 * a person does: the wizard, the tabs, the Alignment popup. No state is read or seeded.
 */

interface Skin {
  readonly name: string;
  newProject(page: Page): Promise<Locator>;
  next(page: Page): Locator;
  create(page: Page): Locator;
  volume(page: Page): Locator;
  setDrivers(page: Page, n: number): Promise<void>;
  pickAlignment(page: Page): Promise<void>;
}

const desktop: Skin = {
  name: 'desktop',
  newProject: async page => { await page.locator('.tb-btn[title*="New project"]').click(); return page.locator('.overlay.open'); },
  next: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Next', exact: true}),
  create: page => page.locator('.overlay.open .modal-footer').getByRole('button', {name: 'Create', exact: true}),
  volume: page => page.locator('#og-box-volume'),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('.tab-section.active .field', {hasText: 'Num. of drivers'}).locator('select').selectOption(String(n));
  },
  pickAlignment: async page => {
    await openTab(page, 'Box');
    await page.getByRole('button', {name: 'Alignment', exact: true}).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    await page.locator('.alignment-modal button.ok-btn').click();
    await expect(page.locator('.alignment-modal')).toBeHidden();
  },
};

const phone: Skin = {
  name: 'phone',
  newProject: async page => { await page.getByText('New project').click(); return page.locator('.mob-np-overlay'); },
  next: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.NEXT, exact: true}),
  create: page => page.locator('.mob-np-footer').getByRole('button', {name: PhoneWizardText.CREATE, exact: true}),
  volume: page => mobileFieldRow(page, 'Vb').locator('input').first(),
  setDrivers: async (page, n) => {
    await openTab(page, 'Driver');
    await page.locator('#mob-n-drivers').selectOption(String(n));
  },
  pickAlignment: async page => {
    await openTab(page, 'Box');
    await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
    await expect(page.locator('.mob-align-sheet')).toBeVisible();
    await page.locator('.mob-align-footer .mob-btn-primary', {hasText: 'Accept'}).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);
  },
};

async function litres(box: Locator): Promise<number> {
  return Number(await box.inputValue());
}

/** The person's actions up to a vented project on the Box tab, its volume the alignment's for one driver. */
async function makeProject(skin: Skin, page: Page): Promise<void> {
  const root = await skin.newProject(page);
  await expect(root).toBeVisible();
  await root.locator('input.filter').fill('W5-1138SMF');
  await root.locator('.dlist .ditem', {hasText: 'W5-1138SMF'}).first().click();
  await expect(root.locator('.preview .prev-name')).toContainText('W5-1138SMF');
  await skin.next(page).click();
  await skin.next(page).click();
  await root.locator('#np-box-type').selectOption('vented');
  await skin.next(page).click();
  await skin.next(page).click();
  await skin.create(page).click();
  await expect(root).toHaveCount(0);
  await openTab(page, 'Box');
}

async function journey(skin: Skin, page: Page): Promise<void> {
  await makeProject(skin, page);
  await skin.pickAlignment(page);
  // The wizard's first match for the name may be another test's seeded copy of the driver (shared page), so the journey
  // compares the two volumes as a person would; WinISD's absolute volumes are asserted in winisd-vented-picker-counts-drivers.test.ts.
  const oneDriver = await litres(skin.volume(page));
  expect(oneDriver, 'one driver: the alignment proposes a volume').toBeGreaterThan(1);
  await skin.setDrivers(page, 2);
  await skin.pickAlignment(page);
  await expect.poll(async () => (await litres(skin.volume(page))) / oneDriver, {message: 'two drivers: the alignment proposes twice the one-driver volume, as WinISD does (10.70 L then 21.39 L)'}).toBeCloseTo(2, 2);
}

test.describe('Journey: the vented Alignment counts the number of drivers', () => {
  test('desktop: 2 drivers then the vented Alignment proposes twice the volume', async ({appPage: page}) => {
    await journey(desktop, page);
  });

  test.describe('phone', () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

    test('phone: 2 drivers then the vented Alignment proposes twice the volume', async ({page}) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await journey(phone, page);
    });
  });
});
