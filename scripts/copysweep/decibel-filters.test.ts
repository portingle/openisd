/**
 * Decibel copies in the filter models (10^(gain/20)) and in the sweep (20*log10): a filter of a stated dB gain must move the
 * sweep's SPL by exactly that many dB (static gain everywhere; parametric peaking at its centre; peaking high-pass at its peak),
 * and the filter chain's own chart (fltMag) must read the same dB. Writes results/decibel-filters.json.
 */
import {describe, it} from 'vitest';
import {AIR, Collector, engine, pickDrivers} from './lib.js';
import type {Filter, SweepParams} from '../../packages/design/engine/index.js';

describe('decibel copies', () => {
  it('compares them', () => {
    const c = new Collector('decibel-filters');
    for (const d of pickDrivers()) for (const g of [-20, -6, 0, 3, 12]) {
      const base: SweepParams = {Vb: d.q.Vas_m3!, eg: 2.83, Ql: 10, Qa: 100, fmin: 20, fmax: 2000, N: 100, nDrivers: 1, air: AIR};
      const ref = engine.simulation.sweep(d.sweep, undefined, 'sealed', base).values;
      const run = (f: Filter) => engine.simulation.sweep(d.sweep, undefined, 'sealed', {...base, filters: [f]}).values;
      const sg = run({enabled: true, type: 'staticGain', gain: g});
      if (ref && sg) {
        for (const i of [0, 40, 99]) {
          c.compare('StaticGainFilterModel 10^(gain/20) -> sweep SPL shift', 'stated gain dB', `${d.path} gain=${g} f=${ref.fs[i].toFixed(1)}`, sg.spl[i] - ref.spl[i] + 1e3, g + 1e3, 1e-9);
          c.compare('StaticGainFilterModel -> filter chain chart fltMag', 'stated gain dB', `${d.path} gain=${g}`, sg.fltMag[i] + 1e3, g + 1e3, 1e-9);
        }
      }
      // parametric EQ at its centre frequency, taken at a grid frequency
      if (ref) {
        const i = 50, fc = ref.fs[i];
        const pk = run({enabled: true, type: 'peaking', fc, Q: 2, gain: g});
        if (pk) c.compare('ParametricEqFilterModel gain at fc -> sweep SPL shift', 'stated gain dB', `${d.path} gain=${g} fc=${fc.toFixed(2)}`, pk.spl[i] - ref.spl[i] + 1e3, g + 1e3, 1e-9);
        const ph = run({enabled: true, type: 'peakHighpass', fpk: fc, gainPk: g});
        if (ph) {
          // side finding (not a copy): a negative gainPk makes sqrt(P*P - 1) NaN, so the whole filter chart is NaN
          c.compare('PeakHighpassFilterModel with gainPk < 0: filter chart is finite (0 = finite, 1 = NaN)', 'finite', `${d.path} gainPk=${g} fpk=${fc.toFixed(2)}`, ph.fltMag.every(Number.isFinite) ? 0 : 1, 0, 0);
          if (g >= 0) c.compare('PeakHighpassFilterModel peak gain -> filter chart max', 'stated gain dB', `${d.path} gainPk=${g} fpk=${fc.toFixed(2)}`, Math.max(...ph.fltMag) + 1e3, g + 1e3, 2e-3);
        }
      }
    }
    c.write();
  });
});
