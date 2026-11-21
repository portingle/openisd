/**
 * The driver array against physics rules and WinISD captures, over every box type x number of drivers x wiring x loading
 * (standard, Iso-Barik) x the Advanced switches the sweep reads (John, 20 Nov 2026 00:52, board card test-guardrails:
 * "All of A-G: build every guardrail on the card, the physics-law combination test (B) first"; plan
 * docs/plans/PLAN_20261119_TEST_STRATEGY.md option B). The rules, why each holds and why each tolerance is what it is:
 * the driver-array guardrail task notes (tasks/T939.yml). A rule that fails is a fault in the engine: it is written as the right expectation under
 * `it.fails` naming its bug file, never loosened.
 *
 * Each box starts from its WinISD fixture; the project turns it into the engine's sweep job and the test varies the job.
 * Switches are combined pairwise: all off, all on and each one on alone covers every pair of switches in all four
 * on/off states. The whole set runs once per circuit model.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {FixedAir} from '../../engine/air.js';
import type {DriverWiring} from '../../engine/array/driverWiring.js';
import type {CircuitModel, Filter, MaxCurvesResult, SweepParams, SweepResult} from '../../engine/types.js';
import type {SweepDriver} from '../../engine/solverTypes.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import type {SweepJob} from '../../domain/project/projectSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import inductanceCaptures from '../fixtures/winisd-isobarik-inductance/charts.json';
import {WINISD_ISOBARIK_ND1_ISO_CAPTURE as CAPTURE_PAIR, type WinIsdPlottedPoint} from '../fixtures/winisdIsobarikNd1IsoCapture.js';
import {WINISD_ISOBARIK_ND1_STD_CAPTURE as CAPTURE_ONE} from '../fixtures/winisdIsobarikNd1StdCapture.js';

const engine = createEngine();
const TEST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(TEST_DIR, 'winisd', 'fixtures');

/** 1e-9 dB on levels, 1e-9 relative on linear values, 1e-9 rad on phase, 1e-9 s on group delay: the two sides of each rule
 *  differ only by rounding of the scaled box values carried through the solve (about 1e-11 at worst), far below 0.1 dB. */
const DB_TOL = 1e-9;
const REL_TOL = 1e-9;
const RAD_TOL = 1e-9;
/** Group delay is plotted in ms: 1e-9 s. */
const GD_TOL_MS = 1e-6;
/** The silence mark the engine draws for a pressure of exactly 0. */
const SILENCE_DB = -200;

/** Loud enough that every box drives the W5 past its Xmax somewhere, so the Xmax-limited rules are not vacuous. */
const DRIVE_V = 20;
const GRID = {fmin: 5, fmax: 2000, N: 160};

interface BoxCase { readonly label: string; readonly wpr: string }
const BOXES: readonly BoxCase[] = [
  {label: 'sealed', wpr: 'sealed-w5-nd2'},
  {label: 'vented', wpr: 'vented-w5-nd2'},
  {label: 'passive radiator', wpr: 'pr-w5-1'},
  {label: '4th-order bandpass', wpr: 'bp4-w5-1'},
  {label: '6th-order bandpass', wpr: 'bp6-w5-1'},
  {label: 'ABC', wpr: 'abc-w5-1'},
];

/** One driver's job, from the fixture as WinISD saved it, with the "Two-BL driver" switch ticked so the typed BL is in it. */
function baseJob(wpr: string, grid: FrequencyGrid): SweepJob {
  const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${wpr}.wpr`), 'utf8'));
  if (project === null) throw new Error(`${wpr}: ${JSON.stringify(errors)}`);
  project.nDrivers.set(1);
  project.loading.set('standard');
  project.winisdDriverModel.set(true);
  const plan = project.sweepPlan(grid);
  if (plan.kind !== 'ready') throw new Error(`${wpr}: sweep blocked: ${JSON.stringify(plan.issues)}`);
  return plan.job;
}

const FILTERS: readonly Filter[] = [
  {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707},
  {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 300, Q: 0.707},
];

/** Every two-state setting the sweep reads, and what its "on" state is. */
const SWITCHES = {
  winisdOneDriverImpedance: (p: SweepParams): SweepParams => ({...p, winisdOneDriverImpedance: true}),
  winisdVaModel: (p: SweepParams): SweepParams => ({...p, winisdVaModel: true}),
  winisdWrapPhase: (p: SweepParams): SweepParams => ({...p, winisdWrapPhase: true}),
  winisdFlatModel: (p: SweepParams): SweepParams => ({...p, winisdFlatModel: true}),
  winisdAbcIntraPortVelocity: (p: SweepParams): SweepParams => ({...p, winisdAbcIntraPortVelocity: true}),
  winisdPrNprResonance: (p: SweepParams): SweepParams => ({...p, winisdPrNprResonance: true}),
  winisdBesselHighpass: (p: SweepParams): SweepParams => ({...p, winisdBesselHighpass: true}),
  winisdAbcGroupDelay: (p: SweepParams): SweepParams => ({...p, winisdAbcGroupDelay: true}),
  winisdTlPortNoEndCorrection: (p: SweepParams): SweepParams => ({...p, winisdTlPortNoEndCorrection: true}),
  rgAtDriverSide: (p: SweepParams): SweepParams => ({...p, rgAtDriverSide: true}),
  tlPortModel: (p: SweepParams): SweepParams => ({...p, tlPortModel: true}),
  forceFlatResponse: (p: SweepParams): SweepParams => ({...p, forceFlatResponse: true}),
  seriesResistance: (p: SweepParams): SweepParams => ({...p, Rs: 0.5}),
  coilHeating: (p: SweepParams): SweepParams => ({...p, vcTempRise: 40, alfaVC: 0.00393}),
  addedMass: (p: SweepParams): SweepParams => ({...p, driverAddedMass: 0.003}),
  filters: (p: SweepParams): SweepParams => ({...p, filters: [...FILTERS]}),
} as const;
type SwitchName = keyof typeof SWITCHES | 'twoBlDriver';
const SWITCH_NAMES: readonly SwitchName[] = [...Object.keys(SWITCHES).filter((k): k is keyof typeof SWITCHES => k in SWITCHES), 'twoBlDriver'];

function allOff(p: SweepParams): SweepParams {
  return {...p, winisdOneDriverImpedance: false, winisdVaModel: false, winisdWrapPhase: false, winisdFlatModel: false,
    winisdAbcIntraPortVelocity: false, winisdPrNprResonance: false, winisdBesselHighpass: false, winisdAbcGroupDelay: false,
    winisdTlPortNoEndCorrection: false, rgAtDriverSide: false, tlPortModel: false, forceFlatResponse: false, Rs: 0,
    vcTempRise: 0, alfaVC: 0, driverAddedMass: 0, filters: []};
}

/** A combination: which switches are on, and the circuit model. */
interface Row { readonly name: string; readonly on: ReadonlySet<SwitchName>; readonly circuitModel: CircuitModel }

const CIRCUIT_MODELS: readonly CircuitModel[] = ['winisd', 'gyrator', 'winisdGyrator'];
const ROWS: readonly Row[] = CIRCUIT_MODELS.flatMap((circuitModel): Row[] => [
  {name: `${circuitModel}, all off`, on: new Set<SwitchName>(), circuitModel},
  {name: `${circuitModel}, all on`, on: new Set<SwitchName>(SWITCH_NAMES), circuitModel},
  ...SWITCH_NAMES.map((s): Row => ({name: `${circuitModel}, ${s} only`, on: new Set<SwitchName>([s]), circuitModel})),
]);

interface Setup { readonly driver: SweepDriver; readonly Le_H: number | undefined; readonly box: SweepJob['box']; readonly P: SweepParams }

function setupOf(job: SweepJob, row: Row): Setup {
  let P: SweepParams = allOff({...job.sweep, air: new FixedAir(job.air), eg: DRIVE_V, nDrivers: 1, loading: 'standard',
    driverWiring: 'parallel', circuitModel: row.circuitModel});
  for (const s of row.on) if (s !== 'twoBlDriver') P = SWITCHES[s](P);
  const driver: SweepDriver = row.on.has('twoBlDriver') ? job.driver : {...job.driver, winisdBL_Tm: null};
  return {driver, Le_H: job.Le_H, box: job.box, P};
}

/** The box scaled by `k`: every chamber volume, port area and radiator count. Port lengths, and so tunings, unchanged. */
function boxTimes(P: SweepParams, k: number): SweepParams {
  return {...P, Vb: P.Vb * k, ...(P.Vf !== undefined ? {Vf: P.Vf * k} : {}), ...(P.Sp !== undefined ? {Sp: P.Sp * k} : {}),
    ...(P.Spr !== undefined ? {Spr: P.Spr * k} : {}), ...(P.SpIntra !== undefined ? {SpIntra: P.SpIntra * k} : {}),
    ...(P.prNum !== undefined ? {prNum: P.prNum * k} : {})};
}

function sweep(s: Setup, P: SweepParams): SweepResult {
  const r = engine.simulation.sweep(s.driver, s.Le_H, s.box, P);
  if (r.values === null) throw new Error(`sweep refused: ${JSON.stringify(r.issues)}`);
  return r.values;
}

function maxCurves(s: Setup, P: SweepParams): MaxCurvesResult {
  const r = engine.simulation.maxCurves(s.driver, s.Le_H, s.box, {...P, eg: 2.83});
  if (r.values === null) throw new Error(`maxCurves refused: ${JSON.stringify(r.issues)}`);
  return r.values;
}

/** The worst miss of one curve against its expectation, as a message, or null when every point is inside the tolerance. */
type Check = (got: readonly number[], want: readonly number[]) => string | null;

function worst(got: readonly number[], want: readonly number[], miss: (g: number, w: number) => number, tol: number, unit: string): string | null {
  if (got.length !== want.length) return `length ${got.length} against ${want.length}`;
  let at = -1, size = 0;
  for (let i = 0; i < got.length; i++) {
    const m = miss(got[i], want[i]);
    if (!(m <= tol) && !(m <= size)) { at = i; size = Number.isNaN(m) ? Infinity : m; }
  }
  return at < 0 ? null : `point ${at}: got ${got[at]}, want ${want[at]} (off by ${size} ${unit})`;
}

const levelPlus = (gain: number): Check => (got, want) =>
  worst(got, want.map((w) => w === SILENCE_DB ? w : w + gain), (g, w) => Math.abs(g - w), DB_TOL, 'dB');
const relativeMiss = (g: number, w: number): number => Math.abs(g - w) / Math.max(Math.abs(w), Number.MIN_VALUE);
const times = (k: number): Check => (got, want) =>
  worst(got, want.map((w) => w * k), relativeMiss, REL_TOL, 'relative');
const sameLinear = times(1);
const angleMiss = (turn: number) => (g: number, w: number): number => { const d = Math.abs(g - w) % turn; return Math.min(d, turn - d); };
/** Phase in radians, compared modulo one turn. */
const samePhase: Check = (got, want) => worst(got, want, angleMiss(2 * Math.PI), RAD_TOL, 'rad');
/** Impedance phase is plotted in degrees: the same 1e-9 rad. */
const samePhaseDeg: Check = (got, want) => worst(got, want, angleMiss(360), RAD_TOL * 180 / Math.PI, 'deg');
const sameDelay: Check = (got, want) => worst(got, want, (g, w) => Math.abs(g - w), GD_TOL_MS, 'ms');

/** Which part of a rule an expectation belongs to, so a fault in one part leaves the others a hard gate:
 *  `pressure` the array's complex pressure and Xmax-limited SPL; `impedance` the Iso-Barik pair's impedance; `response` the rest. */
type Group = 'response' | 'pressure' | 'impedance';

interface Expectation { readonly name: string; readonly group: Group; readonly got: readonly number[] | null; readonly want: readonly number[] | null; readonly check: Check }

interface Miss { readonly group: Group; readonly text: string }

function misses(expectations: readonly Expectation[]): Miss[] {
  return expectations.flatMap((e): Miss[] => {
    if (e.got === null || e.want === null) return e.got === e.want ? [] : [{group: e.group, text: `${e.name}: one side has no curve`}];
    const m = e.check(e.got, e.want);
    return m === null ? [] : [{group: e.group, text: `${e.name}: ${m}`}];
  });
}

const response = (text: string): Miss => ({group: 'response', text});
const prefixed = (prefix: string) => (m: Miss): Miss => ({group: m.group, text: `${prefix}: ${m.text}`});

const real = (h: SweepResult['H']): number[] => h.map((c) => c.re);
const imag = (h: SweepResult['H']): number[] => h.map((c) => c.im);

/** R1: N drivers in parallel in N x the box against one driver in the box, as each of the N sees it. */
function arrayAgainstOne(n: number, array: SweepResult, one: SweepResult, oneDriverImpedance: boolean, impedanceScale: number): Expectation[] {
  const gain = 20 * Math.log10(n);
  return [
    {name: 'SPL', group: 'response', got: array.spl, want: one.spl, check: levelPlus(gain)},
    {name: 'Xmax-limited SPL', group: 'pressure', got: array.splXlimCurve, want: one.splXlimCurve, check: levelPlus(gain)},
    {name: 'pressure (real part)', group: 'pressure', got: real(array.H), want: real(one.H), check: times(n)},
    {name: 'pressure (imaginary part)', group: 'pressure', got: imag(array.H), want: imag(one.H), check: times(n)},
    {name: 'amplifier apparent load power', group: 'response', got: array.va, want: one.va, check: times(n)},
    {name: 'impedance', group: 'response', got: array.zmag, want: one.zmag, check: times(oneDriverImpedance ? 1 : impedanceScale)},
    {name: 'impedance phase', group: 'response', got: array.zph, want: one.zph, check: samePhaseDeg},
    {name: 'excursion', group: 'response', got: array.exc, want: one.exc, check: sameLinear},
    {name: 'radiator excursion', group: 'response', got: array.excPR, want: one.excPR, check: sameLinear},
    {name: 'port velocity', group: 'response', got: array.pv, want: one.pv, check: sameLinear},
    {name: 'rear port velocity', group: 'response', got: array.pvRear, want: one.pvRear, check: sameLinear},
    {name: 'intra port velocity', group: 'response', got: array.pvIntra, want: one.pvIntra, check: sameLinear},
    {name: 'phase', group: 'response', got: array.phase, want: one.phase, check: samePhase},
    {name: 'group delay', group: 'response', got: array.gd, want: one.gd, check: sameDelay},
    {name: 'transfer function', group: 'response', got: array.tfMag, want: one.tfMag, check: levelPlus(0)},
    {name: 'radiator transfer function', group: 'response', got: array.prTfMag, want: one.prTfMag, check: levelPlus(0)},
    {name: 'rear port gain', group: 'response', got: array.rearPortGain, want: one.rearPortGain, check: levelPlus(0)},
    {name: 'front port gain', group: 'response', got: array.frontPortGain, want: one.frontPortGain, check: levelPlus(0)},
  ];
}

function maxAgainstOne(n: number, array: MaxCurvesResult, one: MaxCurvesResult): Expectation[] {
  return [
    {name: 'maximum SPL', group: 'response', got: array.maxspl, want: one.maxspl, check: levelPlus(20 * Math.log10(n))},
    {name: 'maximum power', group: 'response', got: array.maxpwr, want: one.maxpwr, check: times(n)},
  ];
}

/** The series resistance each of n drivers sees: its own Rg when Rg sits at each driver; behind the amplifier's Rg, the
 *  Thevenin equivalent: n x Rg in parallel (n branches share it), Rg / n in series (each takes 1/n of the drop). */
function rgEach(P: SweepParams, n: number, wiring: 'parallel' | 'series'): number {
  const Rg = P.Rs ?? 0;
  if (P.rgAtDriverSide === true) return Rg;
  return wiring === 'parallel' ? n * Rg : Rg / n;
}

type RuleId = 'R1 parallel array' | 'R2 series array' | 'R3 Xmax limit only lowers' | 'R4 Iso-Barik pair' | 'R9 every curve finite';

interface PairMode { readonly winisdIsobarik: boolean; readonly wiring: DriverWiring }
const WIRINGS: readonly DriverWiring[] = ['parallel', 'series'];
const PAIR_MODES = [false, true].flatMap((winisdIsobarik) => WIRINGS.map((wiring): PairMode => ({winisdIsobarik, wiring})));

function pairMisses(s: Setup, {winisdIsobarik, wiring}: PairMode): Miss[] {
  // Two coupled cones move together, with one cone radiating. Each motor still has its own BL. The moving mass,
  // suspension stiffness and mechanical damping double. Halving the chamber volumes, port areas and radiator count
  // doubles the acoustic load, so both motors work into the same load per cone as the single driver.
  // At a given terminal voltage, parallel gives both coils the full voltage and twice the total force, so the
  // doubled load moves at the single cone's speed. Series gives each coil half the voltage and half the current,
  // so the force equals one driver's and the doubled load moves at half speed. The identical branch impedances
  // halve in parallel or double in series, including their motional component.
  // WinISD's equal-load convention has half the cone motion and pressure in the half-box comparison with Le = 0.
  const motion = winisdIsobarik || wiring === 'series' ? 0.5 : 1;
  const load = winisdIsobarik ? 1 : wiring === 'parallel' ? 0.5 : 2;
  const pairParams: SweepParams = {...boxTimes(s.P, 0.5), loading: 'isobaric', driverWiring: wiring, winisdIsobarik};
  // Keep the same amplifier voltage and the same source-resistance drop relative to the terminal load.
  const oneParams: SweepParams = {...s.P, Rs: (s.P.Rs ?? 0) / load};
  const pair = sweep(s, pairParams);
  const one = sweep(s, oneParams);
  // WinISD adds acoustic roll-off to the pair with inductance on. Check that response against the captures below.
  // The response law still applies with Le = 0. Terminal impedance obeys its law with inductance on too.
  const responseSetup: Setup = {...s, Le_H: 0};
  const [pairResponse, oneResponse] = winisdIsobarik && s.P.circuitModel === 'winisdGyrator' && (s.Le_H ?? 0) !== 0
    ? [sweep(responseSetup, pairParams), sweep(responseSetup, oneParams)]
    : [pair, one];
  const portMotion = 2 * motion;
  return misses([
    {name: 'SPL', group: 'response', got: pairResponse.spl, want: oneResponse.spl, check: levelPlus(20 * Math.log10(motion))},
    {name: 'excursion', group: 'response', got: pairResponse.exc, want: oneResponse.exc, check: times(motion)},
    {name: 'impedance', group: 'impedance', got: pair.zmag, want: one.zmag, check: times(load)},
    {name: 'impedance phase', group: 'impedance', got: pair.zph, want: one.zph, check: samePhaseDeg},
    {name: 'phase', group: 'response', got: pairResponse.phase, want: oneResponse.phase, check: samePhase},
    {name: 'group delay', group: 'response', got: pairResponse.gd, want: oneResponse.gd, check: sameDelay},
    {name: 'transfer function', group: 'response', got: pairResponse.tfMag, want: oneResponse.tfMag, check: levelPlus(0)},
    // The same fraction of total flow goes through half the port area or half the radiators.
    {name: 'radiator excursion', group: 'response', got: pairResponse.excPR, want: oneResponse.excPR, check: times(portMotion)},
    // A passive-radiator box has no port: its `pv` is no chart (SweepResult.pv), so only ported boxes are held to this.
    {name: 'port velocity', group: 'response', got: s.box === 'box-passive-radiator' ? null : pairResponse.pv, want: s.box === 'box-passive-radiator' ? null : oneResponse.pv, check: times(portMotion)},
    {name: 'rear port velocity', group: 'response', got: pairResponse.pvRear, want: oneResponse.pvRear, check: times(portMotion)},
    {name: 'intra port velocity', group: 'response', got: pairResponse.pvIntra, want: oneResponse.pvIntra, check: times(portMotion)},
  ]);
}

type RuleCase =
  | { readonly rule: 'R4 Iso-Barik pair'; readonly pairMode: PairMode }
  | { readonly rule: Exclude<RuleId, 'R4 Iso-Barik pair'>; readonly loading: 'standard' | 'isobaric' };

/** The misses of one rule for one box and combination. */
function ruleMisses(s: Setup, c: RuleCase): Miss[] {
  if (c.rule === 'R4 Iso-Barik pair') return pairMisses(s, c.pairMode);
  // Keep the existing array-rule comparisons on WinISD pairs. A physical series array changes the wiring inside
  // each pair too, so its one-pair reference would need a separate array-rule comparison.
  const P: SweepParams = {...s.P, loading: c.loading, winisdIsobarik: true};
  const oneDriverImpedance = P.winisdOneDriverImpedance === true;
  switch (c.rule) {
    case 'R1 parallel array':
      return [2, 3].flatMap((n) => {
        const array: SweepParams = {...boxTimes(P, n), nDrivers: n, driverWiring: 'parallel'};
        const one: SweepParams = {...P, Rs: rgEach(P, n, 'parallel')};
        return [...misses(arrayAgainstOne(n, sweep(s, array), sweep(s, one), oneDriverImpedance, 1 / n)),
          ...misses(maxAgainstOne(n, maxCurves(s, array), maxCurves(s, one)))].map(prefixed(`N ${n}`));
      });
    case 'R2 series array':
      return [2, 3].flatMap((n) => {
        // Series at n x V: each driver gets V, as one driver at V with its share of Rg.
        const series: SweepParams = {...boxTimes(P, n), nDrivers: n, driverWiring: 'series', eg: P.eg * n};
        const one: SweepParams = {...P, Rs: rgEach(P, n, 'series')};
        const found = [...misses(arrayAgainstOne(n, sweep(s, series), sweep(s, one), oneDriverImpedance, n)),
          ...misses(maxAgainstOne(n, maxCurves(s, series), maxCurves(s, one)))];
        // Where each driver sees the same Rg either way, series at n x V is the parallel array at V, impedance n^2 x.
        if (rgEach(P, n, 'series') === rgEach(P, n, 'parallel')) {
          const parallel: SweepParams = {...boxTimes(P, n), nDrivers: n, driverWiring: 'parallel'};
          const sw = sweep(s, series), pw = sweep(s, parallel);
          found.push(...misses([
            {name: 'series against parallel: SPL', group: 'response', got: sw.spl, want: pw.spl, check: levelPlus(0)},
            {name: 'series against parallel: excursion', group: 'response', got: sw.exc, want: pw.exc, check: sameLinear},
            {name: 'series against parallel: VA', group: 'response', got: sw.va, want: pw.va, check: sameLinear},
            {name: 'series against parallel: impedance', group: 'response', got: sw.zmag, want: pw.zmag, check: times(oneDriverImpedance ? 1 : n * n)},
          ]));
        }
        return found.map(prefixed(`N ${n}`));
      });
    case 'R3 Xmax limit only lowers': {
      const sw = sweep(s, P);
      const xmax_mm = (s.driver.values.Xmax_m ?? Infinity) * 1000;
      const found: Miss[] = [];
      for (let i = 0; i < sw.fs.length; i++) {
        if (!(sw.splXlimCurve[i] <= sw.spl[i] + DB_TOL)) found.push(response(`${sw.fs[i]} Hz: Xmax-limited ${sw.splXlimCurve[i]} dB above SPL ${sw.spl[i]} dB`));
        if (sw.exc[i] <= xmax_mm && Math.abs(sw.splXlimCurve[i] - sw.spl[i]) > DB_TOL) found.push(response(`${sw.fs[i]} Hz: excursion ${sw.exc[i]} mm within Xmax but Xmax-limited ${sw.splXlimCurve[i]} dB is not SPL ${sw.spl[i]} dB`));
      }
      return found.slice(0, 3);
    }
    case 'R9 every curve finite': {
      const found: Miss[] = [];
      for (const n of [1, 2, 3]) for (const wiring of ['parallel', 'series'] as const) {
        const Pn: SweepParams = {...boxTimes(P, n), nDrivers: n, driverWiring: wiring};
        const sw = sweep(s, Pn), mx = maxCurves(s, Pn);
        const curves: Record<string, readonly number[] | null> = {spl: sw.spl, splXlim: sw.splXlimCurve, phase: sw.phase, exc: sw.exc,
          excPR: sw.excPR, pv: sw.pv, pvRear: sw.pvRear, pvIntra: sw.pvIntra, zmag: sw.zmag, zph: sw.zph, gd: sw.gd, tfMag: sw.tfMag,
          prTfMag: sw.prTfMag, prTfPhase: sw.prTfPhase, rearPortGain: sw.rearPortGain, frontPortGain: sw.frontPortGain, va: sw.va,
          fltMag: sw.fltMag, fltPhase: sw.fltPhase, fltGd: sw.fltGd, maxspl: mx.maxspl, maxpwr: mx.maxpwr};
        for (const [name, values] of Object.entries(curves)) {
          const bad = values === null ? -1 : values.findIndex((v) => !Number.isFinite(v));
          if (values !== null && bad >= 0) found.push(response(`N ${n} ${wiring}: ${name}[${bad}] = ${values[bad]}`));
        }
      }
      return found;
    }
  }
}

const RULES: readonly RuleId[] = ['R1 parallel array', 'R2 series array', 'R3 Xmax limit only lowers', 'R4 Iso-Barik pair', 'R9 every curve finite'];
const LOADINGS = ['standard', 'isobaric'] as const;

function groupsOf(rule: RuleId): readonly Group[] {
  switch (rule) {
    case 'R1 parallel array': case 'R2 series array': return ['response', 'pressure'];
    case 'R4 Iso-Barik pair': return ['response', 'impedance'];
    case 'R3 Xmax limit only lowers': case 'R9 every curve finite': return ['response'];
  }
}

type Case = RuleCase & { readonly box: BoxCase; readonly group: Group; readonly row: Row };
const settingOf = (c: RuleCase): string => c.rule === 'R4 Iso-Barik pair'
  ? `${c.pairMode.winisdIsobarik ? 'WinISD numbers' : 'physical pair'}, ${c.pairMode.wiring}` : `${c.loading} loading`;
const titleOf = (c: Case): string => `${c.box.label}: ${c.rule} (${c.group}), ${c.row.name}, ${settingOf(c)}`;

const CASES: readonly Case[] = BOXES.flatMap((box) => RULES.flatMap((rule) => groupsOf(rule).flatMap((group) => ROWS.flatMap((row) =>
  rule === 'R4 Iso-Barik pair'
    ? PAIR_MODES.map((pairMode): Case => ({box, rule, group, row, pairMode}))
    : LOADINGS.map((loading): Case => ({box, rule, group, row, loading}))))));

type CaptureChart = 'spl_dB' | 'excursion_m' | 'impedance_ohm';
const difference = (pair: number, one: number): number => pair - one;
const ratio = (pair: number, one: number): number => pair / one;

function captureMiss(chart: CaptureChart, pair: readonly number[], one: readonly number[], compare: (pair: number, one: number) => number, check: Check): string | null {
  const capturedPair: readonly WinIsdPlottedPoint[] = CAPTURE_PAIR[chart];
  const capturedOne: readonly WinIsdPlottedPoint[] = CAPTURE_ONE[chart];
  const got = capturedPair.map((_, i) => compare(pair[i * CAPTURE_PAIR.step], one[i * CAPTURE_ONE.step]));
  const want = capturedPair.map((p, i) => compare(p.v, capturedOne[i].v));
  return check(got, want);
}

describe('the driver array obeys physics rules over every box, driver count, wiring, loading and switch combination', () => {
  const jobs = new Map(BOXES.map((b) => [b.wpr, baseJob(b.wpr, GRID)]));
  const jobOf = (box: BoxCase): SweepJob => {
    const job = jobs.get(box.wpr);
    if (job === undefined) throw new Error(`no job for ${box.wpr}`);
    return job;
  };
  // A rule's parts share one computation for each box, rule, switch combination and comparison setting.
  const computed = new Map<string, readonly Miss[]>();
  const caseMisses = (c: Case): string[] => {
    const key = `${c.box.wpr}|${c.rule}|${c.row.name}|${settingOf(c)}`;
    const all = computed.get(key) ?? ruleMisses(setupOf(jobOf(c.box), c.row), c);
    computed.set(key, all);
    return all.filter((m) => m.group === c.group).map((m) => m.text);
  };

  for (const c of CASES) {
    it(titleOf(c), () => {
      const found = caseMisses(c);
      expect(found, found.join('\n')).toEqual([]);
    });
  }

  // Both captures used the same 4.48 L box and 1 W setting. Compare the whole captured SPL gap,
  // excursion ratio and impedance ratio on that geometry with the same voltage in both sweeps.
  const captureJob = baseJob('sealed-w5-isobarik', CAPTURE_ONE.grid);
  const captureParams: SweepParams = {...captureJob.sweep, air: new FixedAir(captureJob.air), rgAtDriverSide: false, winisdIsobarik: true};
  const captureSetup: Setup = {...captureJob, P: captureParams};
  const captureOne = sweep(captureSetup, captureParams);
  for (const driverWiring of WIRINGS) {
    const pair = sweep(captureSetup, {...captureParams, loading: 'isobaric', driverWiring});
    it(`R4 Iso-Barik pair (response), WinISD sealed W5 capture, ${driverWiring}`, () => {
      expect(captureMiss('spl_dB', pair.spl, captureOne.spl, difference, levelPlus(0)), 'SPL difference').toBeNull();
      expect(captureMiss('excursion_m', pair.exc, captureOne.exc, ratio, sameLinear), 'excursion ratio').toBeNull();
    });
    it(`R4 Iso-Barik pair (impedance), WinISD sealed W5 capture, ${driverWiring}`, () => {
      expect(captureMiss('impedance_ohm', pair.zmag, captureOne.zmag, ratio, sameLinear)).toBeNull();
    });
  }

  // WinISD 0.7.0.950 WPL chart captures and their original projects, from winisd_research commit 159e1f2.
  // The comparison report records a worst miss of 4.59e-12 mm (2.19e-12 relative); the other charts differ by <5e-13.
  const captureTolerance = 1e-11;
  const absoluteMiss = (g: number, w: number): number => Math.abs(g - w);
  const frequencies = inductanceCaptures.frequency_Hz;
  const captureGrid: FrequencyGrid = {fmin: frequencies[0], fmax: frequencies[frequencies.length - 1], N: frequencies.length - 1};
  for (const capture of inductanceCaptures.runs) {
    it(`R4 matches WinISD W5 capture with inductance on: ${capture.run}`, () => {
      const path = join(TEST_DIR, 'fixtures', 'winisd-isobarik-inductance', `${capture.run}.wpr`);
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(readFileSync(path, 'utf8'));
      if (project === null) throw new Error(`${capture.run}: ${JSON.stringify(errors)}`);
      project.winisdDriverModel.set(true);
      project.winisdIsobarik.set(true);
      const {values, issues} = project.sweep(captureGrid);
      if (values === null) throw new Error(`${capture.run}: sweep refused: ${JSON.stringify(issues)}`);
      expect(sameLinear(values.fs, frequencies), 'frequency grid').toBeNull();
      expect(worst(values.spl, capture.spl_dB, absoluteMiss, captureTolerance, 'dB'), 'SPL').toBeNull();
      expect(worst(values.exc, capture.excursion_mm, relativeMiss, captureTolerance, 'relative'), 'excursion').toBeNull();
      expect(worst(values.zmag, capture.impedance_ohm, absoluteMiss, captureTolerance, 'ohm'), 'impedance magnitude').toBeNull();
      expect(worst(values.zph, capture.impedancePhase_deg, angleMiss(360), captureTolerance, 'deg'), 'impedance phase').toBeNull();
    });
  }

  it('R3 is not vacuous: every box drives the cone past Xmax somewhere at the test voltage', () => {
    for (const box of BOXES) {
      const s = setupOf(jobOf(box), ROWS[0]);
      expect(sweep(s, s.P).xlimited.some((x) => x), box.label).toBe(true);
    }
  });
});
