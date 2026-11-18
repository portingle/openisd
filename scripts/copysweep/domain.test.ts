/**
 * Copies that live in the domain, reached the way the app reaches them (a project built from a catalogue driver):
 * the vent's area <-> diameter (projectResolve), vent length/tuning with the project's end correction, and the starting
 * dummy passive radiator's displacement (openISDBox, the 1x versus the engine's 2x rule). Never fails; writes results/domain.json.
 */
import {describe, it} from 'vitest';
import {AIR, COUNTS, Collector, engine, pickDrivers} from './lib.js';
import {ProjectBuilder} from '../../packages/design/domain/openisdTransforms.js';
import {driverFromSpec} from '../../packages/design/test/fixtures/recordBuilders.js';

describe('domain copies', () => {
  it('compares them', () => {
    const c = new Collector('domain');
    for (const d of pickDrivers()) {
      const spec: Record<string, number> = {};
      for (const k of ['Fs_hz', 'Qes', 'Qms', 'Qts', 'Vas_m3', 'Sd_m2', 'Re_ohm', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Pe_W'] as const) spec[k] = d.q[k]!;
      for (const n of COUNTS) {
        const driver = driverFromSpec(engine, spec);
        const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
        p.nDrivers.set(n);
        // vent geometry through the project
        const vent = p.box.vented.vent;
        vent.shape.set('round');
        for (const dd of [0.03, 0.05, 0.1]) {
          vent.diameter_m.set(dd);
          const area = vent.area_m2.value;
          if (area !== null) c.compare('projectResolve vent area = PI*(d/2)^2 (via project)', 'driver route Sd_m2 from Dd_m', `${d.path} n=${n} d=${dd}`, area, engine.driver.solveValues({Dd_m: dd}, AIR).Sd_m2!);
        }
        vent.endCorrection_m.set(0.613);
        vent.diameter_m.set(0.05);
        const A = vent.area_m2.value!;
        const L = vent.lengthForTuning_m(0.03, 40);
        if (L !== null) c.compare('Vent.lengthForTuning_m (project, count 1)', 'VentEngine.lengthForTuning', `${d.path} n=${n}`, L, engine.vent.lengthForTuning(0.03, 40, A, 1, p.air ?? AIR, 0.613), 1e-9);
        // the starting dummy passive radiator
        const dVd = spec.Sd_m2 * spec.Xmax_m;
        p.box.passiveRadiator.radiator.spec.Xmax_m.clear();
        p.box.passiveRadiator.radiator.spec.Vd_m3.clear();
        p.box.boxType.set('box-passive-radiator');
        const prVd = p.box.passiveRadiator.radiator.spec.Vd_m3.value;
        const count = p.box.passiveRadiator.count.value;
        if (prVd !== null && count !== null) c.compare('openISDBox.#startDummyRadiator: radiator Vd x count (domain starting rule)', 'PrEngine.twiceDriverDisplacement (2 x N x driver Vd)', `${d.path} drivers=${n} radiator Vd=${prVd.toExponential(3)} x count ${count}`, prVd * count, engine.pr.twiceDriverDisplacement(dVd, n)!, 1e-9);
      }
    }
    c.write();
  });
});
