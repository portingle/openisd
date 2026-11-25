import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';

describe('project problems', () => {
  it('finds a marked driver field and identifies its editor destination', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.driver.specs.weight_kg.set(-1);
    expect(project.problems().some(problem => problem.destinations.some(d => d.area === 'driver' && d.field === 'weight_kg'))).toBe(true);
  });

  it('finds the active box loss without including inactive box fields', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('sealed');
    project.box.sealed.volume_m3.set(0.02);
    project.box.sealed.losses.Ql.set(0);
    project.box.vented.volume_m3.set(-1);
    expect(project.problems().some(problem => problem.destinations.some(d => d.area === 'box' && d.field === 'losses.whole.Ql'))).toBe(true);
    expect(project.problems().some(problem => problem.destinations.some(d => d.area === 'box' && d.field === 'volume'))).toBe(false);
  });
  it('reports an unusual air setting on the Advanced page', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.envTempK.set(410);
    expect(project.problems().some(problem => problem.destinations.some(d => d.area === 'advanced' && d.field === 'temperature'))).toBe(true);
  });

  it('does not add chart-only approximation notes to the problem list', () => {
    const project = ProjectBuilder.empty(createEngine());
    expect(project.problems().some(problem => problem.kind === 'approximate-charts')).toBe(false);
  });

});
