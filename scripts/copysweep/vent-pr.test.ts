/**
 * Vent and passive-radiator tuning: the engine's own formulas (VentEngine.tuningFromLength, PrEngine.tuning) against the
 * tuning the chart sweep's circuit shows (the impedance dip between the two impedance peaks of a box with no losses), for
 * 1/2/4 vents and radiators, end corrections 0, 0.613 and 0.732, and 20 catalogue drivers. Also the end-correction fallbacks.
 * Never fails; writes results/vent-pr.json.
 */
import {describe, it} from 'vitest';
import {AIR, COUNTS, Collector, engine, pickDrivers} from './lib.js';
import {airOfConditions} from '../../packages/design/test/fixtures/referenceAir.js';
import type {SweepParams, SweepResult} from '../../packages/design/engine/index.js';

/** the frequency of the impedance minimum between the two highest local maxima */
function dipBetweenPeaks(r: SweepResult): number | null {
  const z = r.zmag;
  const maxima: number[] = [];
  for (let i = 1; i < z.length - 1; i++) if (z[i] > z[i - 1] && z[i] >= z[i + 1]) maxima.push(i);
  if (maxima.length < 2) return null;
  const top = maxima.sort((a, b) => z[b] - z[a]).slice(0, 2).sort((a, b) => a - b);
  let best = top[0];
  for (let i = top[0]; i <= top[1]; i++) if (z[i] < z[best]) best = i;
  return r.fs[best];
}

const AIRS = [AIR, airOfConditions({tempK: 263.15, humidityPct: 80, pressurePa: 90000}), airOfConditions({tempK: 313.15, humidityPct: 10, pressurePa: 105000})];

describe('vent and PR tuning copies', () => {
  it('compares them', () => {
    const c = new Collector('vent-pr');
    for (const d of pickDrivers()) {
      const Vas = d.q.Vas_m3!;
      const Vb = Math.min(Math.max(Vas * 0.7, 0.01), 0.2);
      for (const air of AIRS) for (const count of COUNTS) for (const ec of [0, 0.613, 0.732]) {
        const Sp = Math.PI * 0.025 * 0.025, L = 0.2;
        const Leff = engine.vent.effectiveLength(L, Sp, count, ec);
        const fb = engine.vent.tuningFromLength(Vb, L, Sp, count, air, ec);
        // inverse must round-trip
        c.compare('VentEngine.lengthForTuning', 'VentEngine.tuningFromLength (round trip)', `${d.path} count=${count} ec=${ec} c=${air.c().toFixed(1)}`, engine.vent.lengthForTuning(Vb, fb, Sp, count, air, ec), L, 1e-9);
        const P: SweepParams = {Vb, eg: 2.83, Ql: 1e6, Qa: 1e6, Qp: 1e6, Sp: Sp * count, Leff, Fb: fb, fmin: 5, fmax: 400, N: 8000, air: air, nDrivers: 1};
        const sw = engine.simulation.sweep(d.sweep, undefined, 'vented', P).values;
        const dip = sw ? dipBetweenPeaks(sw) : null;
        if (dip !== null) c.compare('VentEngine.tuningFromLength (Helmholtz)', 'sweep vented lossless port branch: impedance dip (1.5% tol)', `${d.path} Vb=${Vb.toExponential(3)} count=${count} ec=${ec} Fb=${fb.toFixed(3)}`, fb, dip, 0.015);
      }
      for (const air of AIRS) for (const n of COUNTS) for (const prNum of [1, 2]) {
        const prSd = 0.012, prCms = 0.0008, prMmd = 0.04;
        const prParams = {Vb: Vb * n, prMmd, prMadd: 0.01, prSd, prCms, prNum: prNum * n};
        const fp = engine.pr.tuning({...prParams, prRms: 0} as never, air);
        // sweep of n drivers: oneBoxOfN scales Vb and prNum by 1/n, so each driver sees its own share
        const P: SweepParams = {Vb: Vb * n, eg: 2.83, Ql: 1e6, Qa: 1e6, Qp: 1e6, nDrivers: n, prSd, prCms, prMmd, prMadd: 0.01, prNum: prNum * n, prRms: 0, fmin: 5, fmax: 400, N: 8000, air: air, loading: 'standard'};
        const sw = engine.simulation.sweep(d.sweep, undefined, 'box-passive-radiator', P).values;
        const dip = sw ? dipBetweenPeaks(sw) : null;
        if (dip !== null) c.compare('PrEngine.tuning', 'sweep passive-radiator box lossless: impedance dip (1.5% tol)', `${d.path} drivers=${n} radiators=${prNum * n} Vb=${(Vb * n).toExponential(3)} fp=${fp.toFixed(3)} c=${air.c().toFixed(1)}`, fp, dip, 0.015);
      }
    }
    // End-correction fallbacks: the engine's default parameter / `?? 0.732` against the project's own default 0.613.
    for (const [V, A, L] of [[0.03, 0.05 * 0.15, 0.2], [0.03, Math.PI * 0.025 ** 2, 0.15]]) {
      const withDefault = engine.vent.tuningFromLength(V, L, A, 1, AIR);
      const withProject = engine.vent.tuningFromLength(V, L, A, 1, AIR, 0.613);
      c.compare('VentEngine.tuningFromLength default end correction 0.732 (default parameter)', 'project default end correction 0.613 (boxDefaults.NO_VENT)', `Vb=${V} m3, port area=${A.toExponential(3)} m2, L=${L} m: ${withDefault.toFixed(3)} Hz vs ${withProject.toFixed(3)} Hz`, withDefault, withProject);
    }
    c.write();
  });
});
