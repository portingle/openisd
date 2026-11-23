/**
 * A passive-radiator count below 1 in a file (an OpenISD project, a WinISD `.wpr`) opens as the file
 * states it, with the data-quality warning on the count; the charts draw with 1 radiator and say so
 * as an approximate-charts issue (QO972).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {NumberField} from '../../fields/field.js';
import {DEFAULT_GRID, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';

const engine = createEngine();
const PRS = NumberField.PR_NUM.label;

/** The passive-radiator W5 project as a saved `.owpr` text, its radiator count set to `count`. */
function owprWithCount(count: number): string {
  const session = loadProject('passive radiator').cloneSession();
  const saved = session.edited ?? session.saved;
  return JSON.stringify({...session, saved: {...saved, box: {...saved.box, passiveRadiator: {...saved.box.passiveRadiator, count}}}, edited: null}, null, 2);
}

function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

/** The passive-radiator W5 `.wpr` with `[Box] Npr` set to `n`, opened as File > Open opens it. */
function wprWithNpr(n: string): OpenedProject {
  const plain = wprText('passive radiator');
  const text = plain.replace('\nNpr=1\n', `\nNpr=${n}\n`);
  expect(text, 'the passive-radiator W5 file states Npr=1').not.toBe(plain);
  const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error(errors.map(e => e.message).join('; '));
  return {project: value, loadRepairs};
}

describe('a passive-radiator count below 1 in a file opens as saved (QO972)', () => {
  it('the Num. of PRs field states no load repair', () => {
    expect(NumberField.PR_NUM.loadRepair).toBeNull();
    expect(NumberField.PR_NUM.limits.min).toBe(1);
  });

  for (const count of [0, -2]) {
    it(`a project file with ${count} radiators opens with ${count}, the warning on the count, and charts drawn with 1`, () => {
      const {project, loadRepairs} = opened(owprWithCount(count));
      expect(project.box.passiveRadiator.count.value).toBe(count);
      expect(project.box.passiveRadiator.workingCount()).toBe(1);
      expect(project.box.passiveRadiator.countDq).toEqual([expect.stringContaining(PRS)]);
      expect(loadRepairs).toEqual([]);
      const result = projectFindings(project, DEFAULT_GRID);
      expect(result.findings).toEqual([]);
      expect(result.refused).toBe(false);
      const plan = project.sweepPlan(DEFAULT_GRID);
      expect(plan.kind === 'ready' && plan.job.sweep.prNum).toBe(1);
      expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'prNum'}));
    });
  }

  it('a WinISD file with Npr=0 opens with 0 radiators, no repair named, and charts drawn with 1', () => {
    const {project, loadRepairs} = wprWithNpr('0');
    expect(project.box.passiveRadiator.count.value).toBe(0);
    expect(loadRepairs).toEqual([]);
    const result = projectFindings(project, DEFAULT_GRID);
    expect(result.findings).toEqual([]);
    expect(result.refused).toBe(false);
  });

  it('a project file with 2 radiators opens unchanged with no warning', () => {
    const {project, loadRepairs} = opened(owprWithCount(2));
    expect(project.box.passiveRadiator.count.value).toBe(2);
    expect(project.box.passiveRadiator.countDq).toEqual([]);
    expect(loadRepairs).toEqual([]);
  });
});
