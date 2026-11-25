import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';

function project() {
  const engine = createEngine();
  const d = OpenISDDriver.empty(engine);
  d.specs.Fs_hz.set(45);
  d.specs.Qes.set(0.57);
  d.specs.Qms.set(3.56);
  d.specs.Vas_m3.set(0.00485);
  d.specs.Re_ohm.set(3.4);
  d.specs.Sd_m2.set(0.0094);
  d.specs.Xmax_m.set(0.00925);
  const p = new ProjectBuilder(d, engine).sealed().volume_m3(0.01).build();
  p.box.boxType.set('box-passive-radiator');
  p.box.passiveRadiator.radiator.spec.Xmax_m.set(0.001);
  p.powerDrive_W.set(10);
  return p;
}

describe('passive radiator excursion advice', () => {
  it('uses the project signal and does not alter the project while trying counts', () => {
    const p = project();
    const before = p.toOwprText();
    const advice = p.passiveRadiatorExcursionAdvice();
    expect(advice?.text).toContain('10 W signal and current filters');
    expect(advice?.text).toContain('exceeds Xmax');
    expect(advice?.warning).toBe(true);
    expect(p.toOwprText()).toBe(before);
  });

  it('tests the suggested count using the same count change a user makes', () => {
    const p = project();
    p.box.passiveRadiator.addedMass_kg.set(0.005);
    p.box.passiveRadiator.radiator.spec.Xmax_m.set(0.004);
    const advice = p.passiveRadiatorExcursionAdvice();
    expect(advice?.text).toContain('use at least 2 radiators');
    p.box.passiveRadiator.count.set(2);
    const result = p.sweep({fmin: 10, fmax: 20000, N: 400});
    expect(result.values).not.toBeNull();
    expect(Math.max(...result.values!.excPR)).toBeLessThanOrEqual(4);
    expect(p.box.passiveRadiator.addedMass_kg.value).toBe(0.005);
  });

  it('recalculates after a high-pass filter is enabled', () => {
    const p = project();
    expect(p.passiveRadiatorExcursionAdvice()?.warning).toBe(true);
    p.filters.set([{type: 'highpass', enabled: true, family: 'butterworth', order: 8, fc: 500, Q: 0.707}]);
    expect(p.passiveRadiatorExcursionAdvice()?.warning).toBe(false);
  });

  it('does not warn when the selected power is low enough', () => {
    const p = project();
    p.box.passiveRadiator.radiator.spec.Xmax_m.set(0.03);
    p.powerDrive_W.set(0.1);
    expect(p.passiveRadiatorExcursionAdvice()?.text).toContain('stays within Xmax');
    expect(p.passiveRadiatorExcursionAdvice()?.warning).toBe(false);
  });

  it('does not claim an assessment without a stated radiator limit', () => {
    const p = project();
    p.box.passiveRadiator.radiator.spec.Xmax_m.clear();
    expect(p.passiveRadiatorExcursionAdvice()).toBeNull();
  });
});
