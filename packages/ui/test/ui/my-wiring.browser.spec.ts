import {readFileSync} from 'node:fs';
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, openTab, test} from '../fixtures.js';
import {numInputByLabel} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * "Coil wiring" (QO907, issue 512), both skins. Dayton MX6-22 states "all specifications measured
 * with voice coils wired in series": Re 4.7 Ω, BL 12.3 T·m (published). Wired in parallel that is
 * Re 4.7 / 4 = 1.175 Ω and BL 12.3 / 2 = 6.15 T·m, and the 1 W drive voltage V = √(1 W · (Re + Rs))
 * with Rs 0.1 Ω falls from √4.8 = 2.19 V to √1.275 = 1.13 V. The Bliesma W137A-854-4 (3 coils)
 * states no wiring, so the choice is disabled with the reason.
 */
const MX6_22 = readFileSync('packages/ui/public/drivers/dayton-audio/mx6-22.json');
const W137A = readFileSync('packages/ui/public/drivers/bliesma/w137a-854-4.json');
const RSS265HO = readFileSync('packages/ui/public/drivers/dayton-audio/rss265ho-44.json');
const RSS315HO = readFileSync('packages/ui/public/drivers/dayton-audio/rss315ho-44.json');
const CE28M = readFileSync('packages/ui/public/drivers/dayton-audio/ce28m-4.json');

async function selectDriver(page: Page, file: Buffer): Promise<void> {
  await page.locator('.driver-library input[type="file"]').setInputFiles({name: 'driver.owdr', mimeType: 'application/json', buffer: file});
  await expect(page.locator('.driver-library .preview')).toBeVisible();
  await page.locator('.driver-library .use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
}

const DESKTOP = {open: async (page: Page) => { await page.goto('/'); await openAProject(page); await page.locator('.project-nav li', {hasText: 'Driver'}).click(); await page.getByRole('button', {name: 'Select Driver'}).click(); }, select: '#og-coil-wiring', volts: 'input voltage'};
const PHONE = {open: async (page: Page) => { await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page); await page.locator('.mob-tab', {hasText: 'Driver'}).click(); await page.getByText('Select driver').click(); }, select: '#mob-coil-wiring', volts: 'Volts'};

for (const [skin, skinName] of [[DESKTOP, 'desktop'], [PHONE, 'phone']] as const) {
  test(`${skinName}: the measured wiring shows, Coil wiring defaults to it, and parallel converts the figures the amplifier side uses`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, MX6_22);
    await expect(page.getByText('Measured wiring')).toHaveCount(0);
        await expect(page.locator(skin.select)).toHaveValue('series');
    // John, QO942.c12 and QO943.c4: the control is "Coil wiring" on both skins; "Connection" is WinISD's own word and is no OpenISD label.
    await expect(page.locator(skinName === 'phone' ? 'label[for="mob-coil-wiring"]' : 'label[for="og-coil-wiring"]')).toHaveText('Coil wiring');
    await expect(page.getByTestId('coil-wiring-figures')).toHaveText('2 coils · Re 4.70 Ω · BL 12.30 Tm');
    await openTab(page, 'Signal');
    const volts = numInputByLabel(page, skin.volts);
    await expect(volts).toHaveValue(/^2\.19/);

    await openTab(page, 'Driver');
    await page.locator(skin.select).selectOption('parallel');
    await expect(page.getByTestId('coil-wiring-figures')).toHaveText('2 coils · Re 1.175 Ω · BL 6.15 Tm');
    await openTab(page, 'Signal');
    await expect(volts).toHaveValue(/^1\.1[23]/);
  });

  test(`${skinName}: a parallel-measured driver (RSS265HO-44, 1.6 Ω, 9.39 Tm, wiring stated on the maker's product page) rewired in series: Re x 4 = 6.4 Ω, BL x 2 = 18.78 Tm`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, RSS265HO);
    await expect(page.getByText('Measured wiring')).toHaveCount(0);
    await page.locator(skin.select).selectOption('series');
    await expect(page.getByTestId('coil-wiring-figures')).toHaveText('2 coils · Re 6.40 Ω · BL 18.78 Tm');
  });

  // John, QO942.c9: "don't show datasheet setting outside the driver editor". The Driver tab names no datasheet wiring word
  // for a driver whose wiring is stated (MX6-22, RSS265HO-44) or inferred (RSS315HO-44), before or after a change.
  test(`${skinName}: the Driver tab holds no datasheet-wiring word, before and after a change of wiring`, async ({page}) => {
    const NO_DATASHEET_WORD = /as published|stated|inferred|measured|datasheet/i;
    for (const [file, other] of [[MX6_22, 'parallel'], [RSS315HO, 'parallel'], [RSS265HO, 'series']] as const) {
      await skin.open(page);
      await selectDriver(page, file);
      const tab = page.locator(skinName === 'phone' ? '.mob-classic' : '.tab-section.active');
      await expect(page.getByTestId('coil-wiring-figures')).toBeVisible();
      expect(await tab.innerText()).not.toMatch(NO_DATASHEET_WORD);
      await page.locator(skin.select).selectOption(other);
      expect(await tab.innerText()).not.toMatch(NO_DATASHEET_WORD);
      await expect(page.getByTestId('coil-wiring-figures')).toHaveText(/^2 coils · Re /);
    }
  });

  test(`${skinName}: a driver that does not state its wiring shows no wiring block at all`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, W137A);
    await expect(page.getByText('Measured wiring')).toHaveCount(0);
    await expect(page.locator(skin.select)).toHaveCount(0);
    await expect(page.getByTestId('coil-wiring-figures')).toHaveCount(0);
    await expect(page.getByText('Coil wiring', {exact: true})).toHaveCount(0);
  });

}

// WinISD greys its coil-wiring box with one coil (observed, winisd_research runs/nd-1; read in the code: enabled only when
// numVC > 1). The desktop skin replicates that screen; the phone shows nothing. QO941.
test('desktop: a driver with no coil count: the control is there, greyed, reading Parallel', async ({page}) => {
  await DESKTOP.open(page);
  await selectDriver(page, CE28M);
  await expect(page.locator(DESKTOP.select)).toBeDisabled();
  await expect(page.locator(DESKTOP.select)).toHaveValue('parallel');
  await expect(page.getByTestId('coil-wiring-figures')).toHaveCount(0);
});

test('phone: a driver with no coil count: no control', async ({page}) => {
  await PHONE.open(page);
  await selectDriver(page, CE28M);
  await expect(page.locator(PHONE.select)).toHaveCount(0);
});
