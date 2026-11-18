import {expect, test} from '../fixtures.js';
import {owdrText, type SeedDriver} from '../fixtures/seedMyDrivers.js';

/**
 * T922: a driver one test puts into My Drivers must be gone before the next test on the same worker
 * (BUG_20261118_browser-tests-leak-my-drivers). The two tests run in order on one worker's shared page:
 * the first imports a driver the way a user does (Load File in the wizard's driver list); the second
 * looks in the library for it.
 */
const LEAKED: SeedDriver = {
  brand: 'Leak Probe', model: 'LP-922', specs: {Fs_hz: 30, Qts: 0.4, Qms: 4, Vas_m3: 0.05, Re_ohm: 6.4, Sd_m2: 0.02, Xmax_m: 0.008},
};

test.describe.configure({mode: 'serial'});

test.describe('what one test puts in My Drivers', () => {
  test('first test: imports a driver into My Drivers', async ({appPage: page}) => {
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('input[type=file]').setInputFiles({
      name: 'LP-922.owdr', mimeType: 'application/x-openisd-driver', buffer: Buffer.from(owdrText(LEAKED, '00000000-0000-4000-8000-000000009220')),
    });
    await expect(page.locator('.flash').last()).toContainText('Driver imported to My Drivers: Leak Probe LP-922');
    await modal.getByRole('button', {name: 'Cancel', exact: true}).click();
    await expect(page.locator('.overlay.open')).toHaveCount(0);
  });

  test('next test on the same worker: My Drivers does not hold it', async ({appPage: page}) => {
    await page.locator('.tb-btn[title^="Manage Drivers"]').click();
    await expect(page.locator('.driver-library .dlist')).toBeVisible();
    await expect(page.locator('.driver-library .my-ditem')).toHaveCount(0);
    await expect(page.locator('.driver-library .dlist .ditem', {hasText: 'LP-922'})).toHaveCount(0);
  });
});
