/**
 * A passive radiator a project file holds with Fs, Mms, Sd, Cms, Qms, Vas or Rms of 0 opens exactly as the file states it,
 * with the invalid-value warning on that figure and finite charts drawn from the other figures (reference values stand in
 * for a moving mass, compliance or area the others do not give, and the approximate-charts issue says so).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import {DEFAULT_GRID, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const engine = createEngine();

type Figure = 'Sd_m2' | 'Cms_m_per_N' | 'Mms_kg' | 'Fs_hz' | 'Qms' | 'Vas_m3' | 'Rms_kg_per_s';

/** A saved passive-radiator project whose radiator states Sd, Mms and Cms (and Qms), with `zeroed` set to 0 in the file. */
function owprWithZero(zeroed: Figure): string {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6, Pe_W: 100, Xmax_m: 0.006,
  });
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  p.box.boxType.set('box-passive-radiator');
  const spec = p.box.passiveRadiator.radiator.spec;
  // Fs, Mms and Cms agree, so a zeroed Mms or Cms can be recalculated from the other two; Vas and Rms are not stated.
  spec.Vas_m3.clear(); spec.Rms_kg_per_s.clear();
  spec.Fs_hz.set(1 / (2 * Math.PI * Math.sqrt(0.01 * 0.0008)));
  spec.Sd_m2.set(0.0133); spec.Mms_kg.set(0.01); spec.Cms_m_per_N.set(0.0008); spec.Qms.set(5);
  p.box.passiveRadiator.volume_m3.set(0.02);
  p.box.passiveRadiator.addedMass_kg.set(0.02);
  spec[zeroed].set(0);
  p.save();
  return p.toOwprText();
}

function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

describe('passive-radiator figures in project files', () => {
  for (const figure of ['Fs_hz', 'Mms_kg', 'Sd_m2', 'Cms_m_per_N', 'Qms', 'Vas_m3', 'Rms_kg_per_s'] as const) {
    it.each(['E', 'C'] as const)(`keeps ${figure} of zero as %s with a warning and finite charts`, state => {
      const first = opened(owprWithZero(figure)).project.cloneSession();
      const {box} = first.saved;
      const pr = box.passiveRadiator;
      const {component} = pr;
      const specs = {'passive-radiator': {...component.specs['passive-radiator'], [figure]: {state, value: 0}}};
      const saved = {...first.saved, box: {...box, passiveRadiator: {...pr, component: {...component, specs}}}};
      const {project, loadRepairs} = opened(JSON.stringify({...first, saved}));
      const field = project.box.passiveRadiator.radiator.spec[figure];
      expect(field.value).toBe(0);
      expect(field.entered).toBe(state === 'E');
      expect(field.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
      expect(loadRepairs).toEqual([]);
      expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
      expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts'}));
      expect(opened(project.toOwprText()).project.box.passiveRadiator.radiator.spec[figure].value).toBe(0);
    });
  }

  it('keeps an invalid resonance on a radiator held by a sealed project', () => {
    const session = opened(owprWithZero('Fs_hz')).project.cloneSession();
    const saved = {...session.saved, box: {...session.saved.box, boxType: 'sealed'}};
    const {project, loadRepairs} = opened(JSON.stringify({...session, saved}));
    expect(loadRepairs).toEqual([]);
    expect(project.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(0);
    expect(project.box.passiveRadiator.radiator.spec.Fs_hz.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value'}));
  });

  it('a clean radiator project opens with nothing repaired', () => {
    const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
    const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
    p.box.boxType.set('box-passive-radiator');
    p.save();
    expect(opened(p.toOwprText()).loadRepairs).toEqual([]);
  });
});

describe('passive-radiator figures in WinISD files', () => {
  it('keeps Fs of 0 Hz and labels the reference moving mass on finite charts', () => {
    const plain = wprText('passive radiator');
    const text = plain.replace(/(\[PassiveRadiator\][^\[]*?\nFs=)[^\r\n]*/, '$10');
    expect(text).not.toBe(plain);
    const {value: project, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (project === null) throw new Error(errors.map(e => e.message).join(', '));
    const spec = project.box.passiveRadiator.radiator.spec;
    expect(spec.Fs_hz.value).toBe(0);
    expect(spec.Fs_hz.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
    expect(loadRepairs).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
    expect(project.sweep(DEFAULT_GRID).issues.some(issue =>
      issue.kind === 'approximate-charts' && issue.text.includes('50 g moving mass'))).toBe(true);
  });

  it('keeps a tuning that the reference radiator cannot reach and draws its zero-ballast response', () => {
    const text = wprText('passive radiator').replace(/(\[PassiveRadiator\][^\[]*?\nFs=)[^\r\n]*/, '$10')
      .replace(/^Me=.*$/m, '').replace(/^Fr=.*$/m, 'Fr=1000');
    const {value: project, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (project === null) throw new Error(errors.map(e => e.message).join(', '));
    expect(project.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(0);
    expect(project.box.passiveRadiator.tuning_goal_hz.value).toBe(1000);
    expect(loadRepairs).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
    expect(project.sweep(DEFAULT_GRID).issues.some(issue =>
      issue.kind === 'approximate-charts' && issue.text.includes('0 g of added mass'))).toBe(true);
  });

  for (const [key, field] of [['Sd', 'Sd_m2'], ['Vas', 'Vas_m3'], ['Qms', 'Qms']] as const) {
    it(`[PassiveRadiator] ${key}=0: the figure is kept with the invalid-value warning, and no readout is NaN or Infinity`, () => {
      const plain = wprText('passive radiator');
      const text = plain.replace(new RegExp(`(\\[PassiveRadiator\\][^\\[]*?\\n${key}=)[^\\r\\n]*`), '$10');
      expect(text, `the PR .wpr states ${key}`).not.toBe(plain);
      const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (value === null) throw new Error(errors.map(e => e.message).join('; '));
      expect(loadRepairs).toEqual([]);
      const spec = value.box.passiveRadiator.radiator.spec;
      expect(spec[field].value).toBe(0);
      expect(spec[field].dq).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
      const pr = value.box.passiveRadiator;
      for (const f of [pr.systemTuning_hz, pr.tuning_goal_hz, pr.addedMass_kg]) {
        expect(f.value === null || Number.isFinite(f.value), `${f.value}`).toBe(true);
      }
      expect(projectFindings(value, DEFAULT_GRID)).toMatchObject({findings: [], refused: false});
    });
  }
});
