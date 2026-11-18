/**
 * Coil-wiring copies: the engine's DriverEngine.convertWiring against the domain's schema-3 migration
 * (multiCoilAsPublished.withMultiCoilAsPublished, which scales a per-coil Re and BL to the measured wiring), 2/3/4 coils, 20 catalogue drivers.
 * The engine converts parallel -> series as x N^2 on Re, x N on BL; the migration states series = N*r, parallel = r/N (Re), series BL = N*b, parallel BL = b.
 * Also the circle-area copies. Never fails; writes results/coil-wiring.json.
 */
import {describe, it} from 'vitest';
import {AIR, Collector, engine, pickDrivers} from './lib.js';
import {withMultiCoilAsPublished} from '../../packages/design/domain/multiCoilAsPublished.js';

const SERIES = 2, PARALLEL = 1; // the schema-3 numeric VCCon values

function published(numVC: number, vccon: number, re: number, bl: number): {Re: number; BL: number} {
  const rec = {model: {value: 'x'}, specs: {woofer: {numVC: {state: 'E', value: numVC}, VCCon: {state: 'E', value: vccon}, Re_ohm: {state: 'E', value: re}, BL_Tm: {state: 'E', value: bl}}}};
  const out = withMultiCoilAsPublished(rec) as typeof rec;
  return {Re: out.specs.woofer.Re_ohm.value, BL: out.specs.woofer.BL_Tm.value};
}

describe('coil wiring copies', () => {
  it('compares them', () => {
    const c = new Collector('coil-wiring');
    for (const d of pickDrivers()) for (const N of [2, 3, 4]) {
      const re = d.q.Re_ohm!, bl = d.q.BL_Tm!;
      const s = published(N, SERIES, re, bl), p = published(N, PARALLEL, re, bl);
      const eng = engine.driver.convertWiring({Re_ohm: p.Re, BL_Tm: p.BL, Le_H: null, Znom_ohm: null}, N, 'parallel', 'series');
      if (!eng.converted) continue;
      const inp = `${d.path} coils=${N} per-coil Re=${re} BL=${bl}`;
      c.compare('multiCoilAsPublished series Re (N*r)', 'convertWiring parallel->series Re', inp, s.Re, eng.motor.Re_ohm);
      c.compare('multiCoilAsPublished series BL (N*b)', 'convertWiring parallel->series BL', inp, s.BL, eng.motor.BL_Tm);
      const back = engine.driver.convertWiring({Re_ohm: s.Re, BL_Tm: s.BL, Le_H: null, Znom_ohm: null}, N, 'series', 'parallel');
      if (back.converted) {
        c.compare('multiCoilAsPublished parallel Re (r/N)', 'convertWiring series->parallel Re', inp, p.Re, back.motor.Re_ohm);
        c.compare('multiCoilAsPublished parallel BL (b)', 'convertWiring series->parallel BL', inp, p.BL, back.motor.BL_Tm);
      }
    }
    // circle area: vent/geometry copies against the engine's driver route and VentEngine
    for (const dd of [0.02, 0.05, 0.0762, 0.1, 0.1524, 0.2, 0.33]) {
      const sd = engine.driver.solveValues({Dd_m: dd}, AIR).Sd_m2;
      if (sd != null) c.compare('projectResolve vent area = PI*(d/2)^2', 'driver route Sd_m2 from Dd_m', `d=${dd}`, Math.PI * (dd / 2) ** 2, sd);
      const area = Math.PI * (dd / 2) ** 2;
      c.compare('projectResolve vent diameter = 2*sqrt(A/PI)', 'VentEngine.effectiveLength(0,A,1,1) (d = 2*sqrt(A/PI))', `d=${dd}`, 2 * Math.sqrt(area / Math.PI), engine.vent.effectiveLength(0, area, 1, 1));
    }
    c.write();
  });
});
