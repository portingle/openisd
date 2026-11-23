/**
 * Port tuning stated at or below zero: the charts use a working tuning. A saved port length that is a
 * calculated value supplies it like an entered one, and a port with a real missing-dependency issue keeps
 * that issue when another port of the same box has a tuning at or below zero.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenISDProjectJson} from '../../domain/openisdSchema.js';
import {DEFAULT_GRID, loadProject} from '../fixtures/inputLimitsSweep.js';
import type {ProjectName} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();

function opened(name: ProjectName, change: (record: OpenISDProjectJson) => OpenISDProjectJson): OpenISDProject {
  const session = loadProject(name).cloneSession();
  const text = JSON.stringify({...session, saved: change(session.edited ?? session.saved), edited: null}, null, 2);
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result.project;
}

describe('a port tuning at or below zero with a saved port length', () => {
  it('a calculated saved length of 0.2 m supplies the tuning, as an entered one does', () => {
    const project = opened('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented,
      chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: 0}},
      vent: {...r.box.vented.vent, length_m: {state: 'C', value: 0.2}},
    }}}));
    const fromLength = project.box.vented.vent.tuningIn_hz(project.box.vented.volume_m3.value);
    expect(fromLength).not.toBeNull();
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind).toBe('ready');
    if (plan.kind === 'ready') expect(plan.job.sweep.Fb).toBeCloseTo(fromLength ?? NaN, 9);
  });
});

describe('a box with one port that cannot be sized and another with a tuning at or below zero', () => {
  it('a 6th-order bandpass keeps the rear port missing-dependency issue when the front tuning is 0 Hz', () => {
    const project = opened('bandpass6', r => ({...r, box: {...r.box, bandpass6: {...r.box.bandpass6,
      rear: {...r.box.bandpass6.rear, tuning_goal_hz: {state: 'E', value: 40}},
      rearVent: {...r.box.bandpass6.rearVent, length_m: undefined, diameter_m: {state: 'E', value: 0}},
      front: {...r.box.bandpass6.front, tuning_goal_hz: {state: 'E', value: 0}},
      frontVent: {...r.box.bandpass6.frontVent, length_m: undefined},
    }}}));
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind).toBe('blocked');
    if (plan.kind === 'blocked') {
      expect(plan.issues).toContainEqual(expect.objectContaining({kind: 'missing-dependencies', target: 'length_m'}));
    }
  });
});
