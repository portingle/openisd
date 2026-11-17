import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {
  type BoxReadings, backAtStart, differences, expectedAfterEntry, field, openSweepProject, readAllBoxes, sweepValues,
  type SweepInput, type SweepScreen, type SweepViewport,
} from '../fixtures/dependentValues.js';
import {freshVisit, surfaceOf, visit, type SurfaceName} from '../fixtures/dependentValuesSurfaces.js';

/**
 * Dependent-value sweep, slice 3: the Driver tab, the Driver Editor and the desktop What-if panel
 * (docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md; John, 17 Nov 2026: "add more aggressive testing for this style of bug across the app").
 * Same method as slices 1 and 2: per input the steps normal, tiny, top accepted, absurdly high, absurdly low, then the original typed back; after each
 * step every box on the screens is read and must equal a fresh browser context holding only that one entry typed into the same sample
 * project; after the last step no calculated box is refused and every box is back at its start.
 *
 * Inputs found from the components, never guessed:
 * - Driver tab (OriginalShell, MobileDriverTab): desktop number of drivers, coil temperature rise, added mass, alfaVC (alpha of the coil); the phone
 *   tab has number of drivers only (Fs, Qts, Vas, Re, Xmax there are read-outs that follow the driver, read after every step).
 * - Driver Editor (DriverEditorModal; a draft that reaches the project on OK): every number box on its Parameters, Advanced and Dimensions
 *   tabs. A visit types the entry, reads all three tabs, presses OK and reads the Driver, Box, Vented and Signal screens (the Box and Signal
 *   values that follow after Apply). Each step reopens the editor.
 * - What-if panel (OriginalWhatIf, desktop only): the sheet fields, Sd, Re, Le, Xmax, Pe, Bl, Mms and the box Vb, Fb and vent length.
 *   It never changes the project: after the last step it is closed and the project screens must equal their start.
 */

type Row = {readonly label: string; readonly key: string; readonly tab: string};

const DRIVER_TAB_ROWS: readonly Row[] = [
  {label: 'Number of drivers', key: 'driver_nDrivers', tab: ''},
  {label: 'Coil temperature rise', key: 'driver_VcTempRise_K', tab: ''},
  {label: 'Added mass', key: 'driver_AddedMass_g', tab: ''},
  {label: 'alfaVC', key: 'alfaVC_per_K', tab: ''},
];
const rows = (tab: string, list: ReadonlyArray<readonly [string, string]>): Row[] => list.map(([label, key]) => ({label, key, tab}));
const EDITOR_ROWS: readonly Row[] = [
  ...rows('Parameters', [
    ['Qes', 'Qes'], ['Qms', 'Qms'], ['Qts', 'Qts'], ['Fs', 'Fs_hz'], ['Vas', 'Vas_m3'], ['Mms', 'Mms_kg'], ['Cms', 'Cms_m_per_N'], ['Rms', 'Rms_kg_per_s'],
    ['Re', 'Re_ohm'], ['BL', 'BL_Tm'], ['Dd', 'Dd_m'], ['Le', 'Le_H'], ['Sd', 'Sd_m2'], ['fLe', 'fLe_hz'], ['KLe', 'KLe_H_sqrtHz'], ['Xmax', 'Xmax_m'], ['Hc', 'Hc_m'],
    ['Hg', 'Hg_m'], ['Vd', 'Vd_m3'], ['Xlim', 'Xlim_m'], ['Pe', 'Pe_W'], ['no', 'no'], ['Znom', 'Znom_ohm'], ['USPL', 'USPL_dB'], ['SPL', 'SPL_dB'], ['numVC', 'numVC'],
    ['Peak power', 'power_peak_W'],
  ]),
  ...rows('Advanced', [
    ['alfaVC', 'alfaVC_per_K'], ['Rt', 'Rt_K_per_W'], ['Ct', 'Ct_J_per_K'], ['SPLmaxLF', 'SPLmaxLF_dB'], ['SPLmax', 'SPLmax_dB'], ['Rme', 'Rme_kg_per_s'],
    ['gamma', 'gamma_m_per_s2_A'], ['Mpow', 'Mpow_N_per_sqrtW'], ['Mcost', 'Mcost_kg_per_s'], ['EBP', 'EBP_hz'], ['Gloss', 'Gloss'],
  ]),
  ...rows('Dimensions', [['Voice coil diameter', 'Vcd_m'], ['Driver volume', 'DVol_m3'], ['Weight', 'weight_kg'], ['Depth', 'Depth_m']]),
];
const WHAT_IF_ROWS: readonly Row[] = rows('', [
  ['Fs', 'Fs_hz'], ['Vas', 'Vas_m3'], ['Qes', 'Qes'], ['Qms', 'Qms'], ['Sd', 'Sd_m2'], ['Re', 'Re_ohm'], ['Vb', 'box_Vb_l'], ['Fb', 'box_Fb_hz'], ['Vent length', 'vent_L_cm'],
  ['Le', 'Le_H'], ['Xmax', 'Xmax_m'], ['Pe', 'Pe_W'], ['Bl', 'BL_Tm'], ['Mms', 'Mms_kg'],
]);
/** The phone opens the same editor from its Driver tab; the key T/S inputs are swept there too. */
const PHONE_EDITOR_KEYS: readonly string[] = ['Qes', 'Qms', 'Qts', 'Fs_hz', 'Vas_m3', 'Re_ohm', 'BL_Tm', 'Mms_kg', 'Sd_m2', 'Xmax_m', 'Pe_W'];

const SCREEN = {
  driver: {name: 'Driver', tab: /^Driver$/},
  box: {name: 'Box', tab: /^Box$/},
  vented: {name: 'Vented', tab: /^Vented$/},
  signal: {name: 'Signal', tab: /^Signal$/},
} as const satisfies Record<string, SweepScreen>;
const DESKTOP_SCREENS: readonly SweepScreen[] = [SCREEN.driver, SCREEN.box, SCREEN.vented, SCREEN.signal];
const PHONE_SCREENS: readonly SweepScreen[] = [SCREEN.driver, SCREEN.box, SCREEN.signal];

interface Group {
  readonly title: string;
  readonly surface: SurfaceName;
  readonly viewports: readonly SweepViewport[];
  readonly rows: readonly Row[];
  readonly root: string;
}

const GROUPS: readonly Group[] = [
  {title: 'Driver tab', surface: 'driver-tab', viewports: ['desktop', 'phone'], rows: DRIVER_TAB_ROWS, root: ''},
  {title: 'Driver Editor', surface: 'editor', viewports: ['desktop', 'phone'], rows: EDITOR_ROWS, root: '.de-modal '},
  {title: 'What-if', surface: 'what-if', viewports: ['desktop'], rows: WHAT_IF_ROWS, root: '.what-if-panel '},
];

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: "<viewport> <group> <input label>". */
const KNOWN: ReadonlyMap<string, string> = new Map([]);

/** Whether a box shows the text that was typed, within the rounding of what it shows (half a unit of the last digit, or half a percent). */
function showsText(shown: string, typed: string): boolean {
  if (shown.trim() === '' || typed.trim() === '') return shown.trim() === typed.trim();
  const a = Number(shown), b = Number(typed);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return shown === typed;
  const decimals = shown.includes('.') ? shown.length - shown.indexOf('.') - 1 : 0;
  return Math.abs(a - b) <= Math.max(0.005 * Math.max(Math.abs(a), Math.abs(b)), 0.5 * 10 ** -decimals);
}

/** Plain digits for a number written with an exponent: a box takes no letter 'e'. */
function plain(text: string): string {
  return /e/i.test(text) ? Number(text).toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 20}) : text;
}

function baseUrl(): string {
  const port = process.env.OPENISD_TEST_PORT;
  return port ? `http://localhost:${port}` : 'http://localhost:4100';
}

/** Where the starting value of the input is read: the surface's own box, or the Driver tab for the tab group. */
function homeKey(group: Group, row: Row): string {
  return group.surface === 'editor' ? `Editor ${row.tab}|${row.key}#0` : group.surface === 'what-if' ? `What-if|${row.key}#0` : `Driver|${row.key}#0`;
}

for (const viewport of ['desktop', 'phone'] as const satisfies readonly SweepViewport[]) {
  for (const group of GROUPS) {
    if (!group.viewports.includes(viewport)) continue;
    const surface = surfaceOf(group.surface);
    const screens = viewport === 'desktop' ? DESKTOP_SCREENS : PHONE_SCREENS;
    const list = viewport === 'phone' && group.surface === 'editor' ? group.rows.filter(r => PHONE_EDITOR_KEYS.includes(r.key) && r.tab === 'Parameters') : group.rows;

    test.describe(`${viewport} ${group.title}: every box follows its inputs`, () => {
      for (const row of list) {
        const name = `${viewport} ${group.title} ${row.label}`;
        const locate = (page: Page) => page.locator(`${group.root}[data-field="${row.key}"] :is(input[data-numinput], select):visible`).first();
        const input: SweepInput = {label: row.label, field: field(row.key), screen: group.title, locate};

        test(`${row.label}: normal, tiny, top, absurdly high, absurdly low, back`, async ({appPage: page, browser}) => {
          test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
          await openSweepProject(page, viewport, 'vented');

          const start = await visit(page, viewport, surface, input, row.tab, screens, null);
          // With the What-if closed again, the project screens as they are before any entry: the What-if must leave them so.
          const startClosed = await readAllBoxes(page, viewport, screens);
          const home = [...start.inner, ...start.outer].find(r => r.key === homeKey(group, row));
          if (home === undefined) throw new Error(`${row.label}: no box ${homeKey(group, row)} on the screen at the start`);
          const original = home.value;
          const startedCalculated = home.calculated;

          // The values to type: a count list offers only its own options; a number box gets the five steps.
          await surface.open(page, viewport);
          await surface.show(page, row.tab);
          const options = await locate(page).evaluate(el => el instanceof HTMLSelectElement ? [...el.options].map(o => o.value) : []);
          await surface.leave(page);
          // A box that starts blank (the datasheet gave no value) is swept from 1, so the normal and tiny entries are real values.
          const swept = sweepValues(input, original.trim() === '' ? '1' : original);
          // A field whose limit is the largest number there is (most driver T/S fields) would be typed as 1.79769e+308: a box takes no letter 'e', so the
          // entry reverts with no refusal mark and is not something a person can type. For these the "top" is a plain huge entry (1e9) and the
          // "absurd high" 1e30, both inside the limit. Every step is written in plain digits for the same reason.
          const unbounded = input.field.limits.max >= 1e100;
          const v = unbounded ? {...swept, top: '1000000000', high: '1000000000000000000000000000000'} : swept;
          const steps: ReadonlyArray<readonly [string, string]> = options.length > 0
            ? options.filter(o => o !== original).map(o => [`option ${o}`, o] as const)
            : [['normal', v.normal], ['tiny', v.tiny], ['top', v.top], ['high', v.high], ['low', v.low]].map(([step, text]) => [step!, plain(text!)] as const);

          let accepted = start;
          for (const [step, text] of steps) {
            const live = await visit(page, viewport, surface, input, row.tab, screens, text);
            const typed = await freshVisit(browser, baseUrl(), viewport, 'vented', surface, input, row.tab, screens, text);
            const refusedInner = typed.inner.some(r => r.refused);
            const refusedOuter = typed.outer.some(r => r.refused);
            // A box refuses an entry in one of two ways: it stays marked bad with the typed text, or it goes back to the value it held before
            // (the editor does this: Xmax 5000 puts 9.25 back, and the box is not marked). Either leaves the last accepted entry in force.
            const typedHome = [...typed.inner, ...typed.outer].find(r => r.key === homeKey(group, row));
            const reverted = !refusedInner && !refusedOuter && typedHome !== undefined && !showsText(typedHome.value, text) && typedHome.value === original;
            const refused = refusedInner || refusedOuter || reverted;
            const expectedInner = reverted ? accepted.inner : expectedAfterEntry(typed.inner, accepted.inner);
            // A refused entry on the surface leaves the project as the last accepted entry made it; one refused on a project screen shows there.
            const expectedOuter: BoxReadings = reverted ? accepted.outer : refusedOuter ? expectedAfterEntry(typed.outer, accepted.outer) : refusedInner ? accepted.outer : typed.outer;
            if (!refused) accepted = typed;
            const innerDiffs = differences(expectedInner, live.inner, 'exact', true);
            await expect.poll(async () => [...innerDiffs, ...differences(expectedOuter, await readAllBoxes(page, viewport, screens), 'exact', true)],
              {message: `${row.label} typed ${step} (${text}): every box must show what a fresh project shows`, timeout: 20_000}).toEqual([]);
          }

          const back = await visit(page, viewport, surface, input, row.tab, screens, original);
          const fresh = await freshVisit(browser, baseUrl(), viewport, 'vented', surface, input, row.tab, screens, original);
          const innerProblems = backAtStart(start.inner, fresh.inner, back.inner, startedCalculated);
          await expect.poll(async () => [...innerProblems, ...backAtStart(start.outer, fresh.outer, await readAllBoxes(page, viewport, screens), startedCalculated)],
            {message: `${row.label} typed back to ${original}: no calculated box refused, every box back to its start`, timeout: 20_000}).toEqual([]);

          if (group.surface === 'what-if') {
            await surface.leave(page);
            await expect.poll(async () => differences(startClosed, await readAllBoxes(page, viewport, screens), 'exact', true),
              {message: `${row.label}: after the What-if is closed the project screens must be as they were (the What-if never changes the project)`, timeout: 20_000}).toEqual([]);
          }
        });
      }
    });
  }
}
