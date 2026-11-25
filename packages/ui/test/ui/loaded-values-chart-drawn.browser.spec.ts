/**
 * A project file whose stated values no design can use opens with those values as written, and the charts
 * are drawn from working values with a warning note instead of going blank.
 */
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync} from 'node:fs';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import type {Page} from '@playwright/test';

const fixture = (name: string): string => fileURLToPath(new URL(`../fixtures/loadedWpr/${name}`, import.meta.url));

const chartBlocked = (page: Page) => page.locator('.gmsg', {has: page.getByText(/Can.t plot/)});

async function expectChartDrawn(page: Page, note: RegExp): Promise<void> {
  await expect(page.locator('.gwarn').first()).toHaveAttribute('title', note);
  await expect(page.locator('canvas').first()).toBeVisible();
}

test.describe('loaded values no design can use', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
  });

  test('sealed leakage Ql 0 draws the SPL chart with a note', async ({page}) => {
    await openAProject(page, fixture('p1_sealed_Ql0.wpr'));
    await expectChartDrawn(page, /Leakage Ql must be greater than zero\. Charts are calculated using 10\./);
    await expect(chartBlocked(page)).toHaveCount(0);
  });

  test('saved invalid driver count and series resistance keep a chart with named working values', async ({page}, testInfo) => {
    const source = readFileSync(fixture('p1_sealed_Ql0.wpr'), 'utf8')
      .replace('Qlr=0', 'Qlr=10')
      .replace('Nd=1', 'Nd=0')
      .replace('Rg=0.1', 'Rg=-2');
    const path = testInfo.outputPath('invalid-driver-inputs.wpr');
    writeFileSync(path, source);
    await openAProject(page, path);
    await expectChartDrawn(page, /Num\. of drivers must be at least 1\. Charts are calculated using 1\./);
    await expect(page.locator('.gwarn').first()).toHaveAttribute('title', /Series resistance must not be negative\. Charts are calculated using 0 Ω\./);
    await expect(chartBlocked(page)).toHaveCount(0);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await expect(page.locator('#og-ndrivers')).toHaveValue('0');
    await page.locator('.project-nav li', {hasText: 'Signal'}).click();
    await expect(page.locator('.ui-field', {hasText: 'Series resistance'}).locator('input')).toHaveValue(/^-2(\.0+)?$/);
  });

  test('passive-radiator count 0 draws the chart with a note', async ({page}) => {
    await openAProject(page, fixture('p2_pr_count0.wpr'));
    await expectChartDrawn(page, /Num\. of PRs must be at least 1\. Charts are calculated using 1\./);
    await expect(chartBlocked(page)).toHaveCount(0);
  });

  test('passive-radiator Fs 0 draws the chart with a note', async ({page}) => {
    await openAProject(page, fixture('p3_pr_Fs0.wpr'));
    await expectChartDrawn(page, /placeholder radiator/);
    await expect(chartBlocked(page)).toHaveCount(0);
  });

  test('passive-radiator count 0 is shown as 0, with its mark', async ({page}) => {
    await openAProject(page, fixture('p2_pr_count0.wpr'));
    await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
    await expect(page.locator('#og-pr-count')).toHaveValue('0');
    await expect(page.locator('.ui-field', {has: page.locator('#og-pr-count')}).locator('.ui-field-dq-btn')).toHaveCount(1);
  });

  test('vented tuning 0 beside a saved port length keeps the 0 Hz with its mark and notes the working tuning', async ({page}) => {
    await openAProject(page, fixture('p4_vented_tuning0_len0.2.wpr'));
    await expect(page.locator('#og-fb-target')).toHaveValue(/^0(\.0+)?$/);
    await expect(page.locator('#og-fb-target-field .ui-field-dq-btn')).toHaveCount(1);
    await expectChartDrawn(page, /Charts are calculated using the port length/);
    await expect(chartBlocked(page)).toHaveCount(0);
  });

  test('a port end correction the list does not offer is shown as the file states it, and the length follows it', async ({page}) => {
    await openAProject(page, fixture('p5b_w5_vented_38Hz_len0_endcorr0.85.wpr'));
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    const select = page.locator('select', {has: page.locator('option', {hasText: '2 flanges'})}).first();
    await expect(select).toHaveValue('0.85');
  });
});

test.describe('loaded values no design can use, phone width', () => {
  test.use({viewport: PIXEL_9});

  test('passive-radiator Fs 0 and the blank Mms show their marks on the Box tab', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, fixture('p3_pr_Fs0.wpr'));
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await expect(mobileFieldRow(page, 'Fpr').locator('.ui-field-dq-btn').first()).toBeVisible();
    await expect(mobileFieldRow(page, 'Mms').locator('.ui-field-dq-btn').first()).toBeVisible();
  });
});
