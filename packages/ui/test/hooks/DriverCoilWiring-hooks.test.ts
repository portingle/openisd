/**
 * The Driver tab's "Coil wiring" row; no measured-wiring row (QO941) (QO907, issue 512). Dayton MX6-22: measured
 * in series, Re 4.7 Ω, BL 12.3 T·m, 2 coils (datasheet); in parallel Re 1.175 Ω, BL 6.15 T·m
 * (Re ÷ 4, BL ÷ 2). Bliesma W137A-854-4 states no wiring.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {useDriverCoilWiring} from '../../src/hooks/DriverCoilWiring-hooks.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

function hookFor(path: string, phone = true) {
  const logic = testAppLogic();
  const driver = OpenISDDriver.fromOwdrText(readFileSync(`packages/ui/public/drivers/${path}.json`, 'utf8'), createEngine());
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  const project = new ProjectBuilder(driver, logic.appState.engine).sealed().volume_m3(0.03).build();
  logic.appState.addProject(project);
  return {project, wiring: runHook(computed(() => project), () => useDriverCoilWiring(phone), logic)};
}

describe('useDriverCoilWiring', () => {
  it('MX6-22: Coil wiring equal to the driver own wiring, one line with the coil count and the figures, enabled', () => {
    const {wiring} = hookFor('dayton-audio/mx6-22');
    expect(wiring.shown.value).toBe(true);
    expect(wiring.disabled.value).toBe(false);
    expect(wiring.mine.value).toBe('series');
    expect(wiring.inUseLine.value).toBe('2 coils · Re 4.70 Ω · BL 12.30 Tm');
    expect(wiring.options.value.map(o => o.value)).toEqual(['series', 'parallel']);
  });

  it('choosing parallel writes the project and shows the converted figures', () => {
    const {project, wiring} = hookFor('dayton-audio/mx6-22');
    wiring.choose('parallel');
    expect(project.coilWiring.mine).toBe('parallel');
    expect(wiring.mine.value).toBe('parallel');
    expect(wiring.inUseLine.value).toBe('2 coils · Re 1.175 Ω · BL 6.15 Tm');
  });

  it('Bliesma W137A-854-4: wiring not stated, so nothing is drawn (the data-quality mark in the editor is the only sign)', () => {
    const {wiring} = hookFor('bliesma/w137a-854-4');
    expect(wiring.shown.value).toBe(false);
    expect(hookFor('bliesma/w137a-854-4', false).wiring.shown.value).toBe(false);
  });

  it('a one-coil or no-coil-count driver: nothing on the phone, the control greyed on the desktop as in WinISD (QO941)', () => {
    expect(hookFor('dayton-audio/ce28m-4', true).wiring.shown.value).toBe(false);
    const desktop = hookFor('dayton-audio/ce28m-4', false).wiring;
    expect(desktop.shown.value).toBe(true);
    expect(desktop.disabled.value).toBe(true);
    expect(desktop.mine.value).toBe('parallel');
  });
});
