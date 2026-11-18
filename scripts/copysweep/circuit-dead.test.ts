/**
 * REPORT item 3: circuit.ts `solve` has its own "N drivers as one" model (Sdt = Sd*n, Cas*n, Mas/n, Ras/n, Rdc/n...).
 * Is it reachable? The mock records the nDrivers every call of circuit.solve and hfAsymptotePressure_Pa receives while the
 * public sweep runs 1, 2 and 4 drivers on every box type, standard and isobaric. Then circuit.solve is called directly with
 * n = 2 and compared with the live path (sweep of 2 drivers). Writes results/circuit-dead.json.
 */
import {describe, it, vi} from 'vitest';
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AIR, engine, pickDrivers} from './lib.js';
import type {BoxType, SweepParams} from '../../packages/design/engine/index.js';

const seen = new Map<string, Set<number>>();
vi.mock('../../packages/design/engine/circuit.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../packages/design/engine/circuit.js')>();
  return {
    ...orig,
    solve: (f: number, drv: never, box: BoxType, P: SweepParams, fd?: number) => {
      const key = `solve/${box}`;
      seen.set(key, (seen.get(key) ?? new Set()).add(P.nDrivers || 1));
      return fd === undefined ? orig.solve(f, drv, box, P) : orig.solve(f, drv, box, P, fd);
    },
    hfAsymptotePressure_Pa: (drv: never, P: SweepParams, r: number) => {
      seen.set('hfAsymptote', (seen.get('hfAsymptote') ?? new Set()).add(P.nDrivers || 1));
      return orig.hfAsymptotePressure_Pa(drv, P, r);
    },
  };
});

describe('circuit.ts own driver-count model', () => {
  it('is reached only with one driver', async () => {
    const circuit = await import('../../packages/design/engine/circuit.js');
    const d = pickDrivers()[3];
    const base: SweepParams = {Vb: 0.03, eg: 2.83, Ql: 10, Qa: 100, Qp: 100, Vf: 0.02, Sp: 0.005, Leff: 0.2, Spr: 0.005, Fr: 40, Fp: 40, Fb: 40,
      prSd: 0.01, prCms: 0.001, prMmd: 0.05, prNum: 1, fmin: 10, fmax: 500, N: 40, air: AIR};
    const boxes: BoxType[] = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];
    const worked: string[] = [];
    for (const box of boxes) for (const n of [1, 2, 4]) for (const loading of ['standard', 'isobaric'] as const) for (const wiring of ['parallel', 'series'] as const) {
      const r = engine.simulation.sweep(d.sweep, undefined, box, {...base, nDrivers: n, loading, driverWiring: wiring, Rs: 1});
      if (r.values) worked.push(`${box}/${n}`);
    }
    // direct call of circuit.solve with n = 2 vs the live sweep of 2 drivers, series, Rg 1, 60 Hz-ish first grid point
    const P2: SweepParams = {...base, nDrivers: 2, driverWiring: 'series', Rs: 1, fmin: 60, fmax: 60, N: 1, loading: 'standard'};
    const live = engine.simulation.sweep(d.sweep, undefined, 'sealed', P2).values!;
    const q = d.q;
    const cq = {Sd_m2: q.Sd_m2!, Re_terminal_ohm: q.Re_ohm!, BL_terminal_Tm: q.BL_Tm!, BL_entered_Tm: q.BL_Tm!, Cms_m_per_N: q.Cms_m_per_N!, Mms_kg: q.Mms_kg!, Rms_kg_per_s: q.Rms_kg_per_s!};
    const direct = (n: number, wiring: 'parallel' | 'series') => {
      const P: SweepParams = {...base, nDrivers: n, driverWiring: wiring, Rs: 1, eg: 2.83, loading: 'standard'};
      const u0 = circuit.solve(60, cq, 'sealed', P).U0;
      const w = 2 * Math.PI * 60;
      return 20 * Math.log10(Math.hypot(u0.re, u0.im) * w * AIR.rho() / (2 * Math.PI) / 2e-5);
    };
    const directSeries2 = direct(2, 'series');
    const directParallel2 = direct(2, 'parallel');
    const livePar = engine.simulation.sweep(d.sweep, undefined, 'sealed', {...P2, driverWiring: 'parallel'}).values!.spl[0];
    const out = {seen: Object.fromEntries([...seen].map(([k, v]) => [k, [...v].sort()])), sweepsThatProducedValues: worked.length, driver: d.path, live60HzSplSeries2: live.spl[0], circuitSolveDirectSeries2: directSeries2, live60HzSplParallel2: livePar, circuitSolveDirectParallel2: directParallel2, circuitModuleExports: Object.keys(circuit)};
    mkdirSync(join(dirname(fileURLToPath(import.meta.url)), 'results'), {recursive: true});
    writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'results', 'circuit-dead-raw.json'), JSON.stringify(out, null, 1));
  });
});
