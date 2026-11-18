/**
 * Shared helpers for the copy sweep (read-only; nothing here changes the app).
 * `pickDrivers()` takes 20 drivers from the bundled catalogue by a fixed rule: every driver with a complete single-coil
 * small-signal record, sorted by catalogue path, then index floor(i * (n - 1) / 19) for i = 0..19.
 */
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../../packages/design/engine/Engine.js';
import type {SweepDriver} from '../../packages/design/engine/index.js';
import {sweepDriver} from '../../packages/design/test/engine/testSolver.js';
import type {TestSolverQuantities} from '../../packages/design/test/engine/testSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = join(HERE, '..', '..', 'packages', 'ui', 'public', 'drivers');

export const engine = createEngine();
export {REFERENCE_AIR as AIR, REFERENCE_AIR_VALUES} from '../../packages/design/test/fixtures/referenceAir.js';

export interface CatDriver {
  readonly path: string;
  readonly q: TestSolverQuantities;
  readonly sweep: SweepDriver;
}

const NEEDED = ['Fs_hz', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Sd_m2', 'Re_ohm', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Pe_W'] as const;

function readAll(): CatDriver[] {
  const out: CatDriver[] = [];
  for (const maker of readdirSync(CATALOGUE).sort()) {
    for (const file of readdirSync(join(CATALOGUE, maker)).sort()) {
      if (!file.endsWith('.json')) continue;
      const rec = JSON.parse(readFileSync(join(CATALOGUE, maker, file), 'utf8'));
      const w = rec.specs?.woofer;
      if (!w) continue;
      if (w.numVC && w.numVC.value > 1) continue;
      const q: Record<string, number> = {};
      let ok = true;
      for (const k of NEEDED) {
        const v = w[k]?.value;
        if (typeof v !== 'number' || !(v > 0)) { ok = false; break; }
        q[k] = v;
      }
      if (!ok) continue;
      for (const k of ['Le_H', 'Vd_m3', 'Dd_m', 'Znom_ohm', 'USPL_dB', 'SPL_dB', 'SPLref_dB', 'no']) {
        const v = w[k]?.value;
        if (typeof v === 'number') q[k] = v;
      }
      q.Re_terminal_ohm = q.Re_ohm;
      q.BL_terminal_Tm = q.BL_Tm;
      const tq: TestSolverQuantities = q;
      out.push({path: `${maker}/${file.replace('.json', '')}`, q: tq, sweep: sweepDriver(tq)});
    }
  }
  return out;
}

let cache: CatDriver[] | null = null;
export function pickDrivers(): CatDriver[] {
  if (cache === null) {
    const all = readAll();
    const n = all.length;
    cache = Array.from({length: 20}, (_, i) => all[Math.floor(i * (n - 1) / 19)]);
  }
  return cache;
}

export const COUNTS = [1, 2, 4] as const;
export const LOADINGS = ['standard', 'isobaric'] as const;

export interface Row {
  group: string;
  copy: string;
  engine: string;
  inputs: string;
  copyValue: number;
  engineValue: number;
}

/** relative difference, or absolute when the engine value is 0 */
export function rel(a: number, b: number): number {
  if (a === b) return 0;
  const d = Math.abs(a - b);
  return b === 0 ? d : d / Math.abs(b);
}

export class Collector {
  readonly rows: Row[] = [];
  readonly checked: Record<string, number> = {};
  constructor(readonly group: string) {}
  /** Compare a copy with the engine; record a row only when they differ by more than `tol` (relative). */
  compare(copy: string, engineName: string, inputs: string, copyValue: number, engineValue: number, tol = 1e-9): void {
    const key = `${copy} | ${engineName}`;
    this.checked[key] = (this.checked[key] ?? 0) + 1;
    if (!(rel(copyValue, engineValue) <= tol)) this.rows.push({group: this.group, copy, engine: engineName, inputs, copyValue, engineValue});
  }
  write(): void {
    const dir = join(HERE, 'results');
    mkdirSync(dir, {recursive: true});
    // summarise: per copy|engine, number of checks, number of differences, worst example
    const summary: Record<string, unknown>[] = [];
    for (const key of Object.keys(this.checked)) {
      const [copy, eng] = key.split(' | ');
      const diffs = this.rows.filter(r => r.copy === copy && r.engine === eng);
      const worst = diffs.reduce<Row | null>((w, r) => (w === null || rel(r.copyValue, r.engineValue) > rel(w.copyValue, w.engineValue) ? r : w), null);
      summary.push({copy, engine: eng, checks: this.checked[key], differences: diffs.length, worst});
    }
    writeFileSync(join(dir, `${this.group}.json`), JSON.stringify(summary, null, 1));
    for (const s of summary) console.log(`[${this.group}] ${String(s.copy)} vs ${String(s.engine)}: ${String(s.checks)} checks, ${String(s.differences)} differ`, s.worst ? JSON.stringify(s.worst) : '');
  }
}
