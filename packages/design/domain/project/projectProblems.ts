import type {DqIssue, Engine} from '../../engine/index.js';
import type {OpenISDProject} from './openISDProject.js';
import {NumberField} from '../../fields/field.js';

export type ProjectProblemArea = 'driver' | 'box' | 'enclosure' | 'signal' | 'advanced' | 'filters';
export interface ProjectProblemDestination { readonly area: ProjectProblemArea; readonly field: string }
export interface ProjectProblem {
  readonly kind: string;
  readonly text: string;
  readonly destinations: ProjectProblemDestination[];
}

function isIssue(value: unknown): value is DqIssue {
  return typeof value === 'object' && value !== null && 'kind' in value && typeof value.kind === 'string'
    && 'text' in value && typeof value.text === 'string';
}

/** Field data-quality marks from the active project, without chart-only diagnostics. */
export function projectProblemsOf(project: OpenISDProject, engine: Engine): ProjectProblem[] {
  const problems: ProjectProblem[] = [];
  const shared = new Map<DqIssue, ProjectProblem>();
  const add = (issue: DqIssue, area: ProjectProblemArea, field: string): void => {
    const destination = {area, field};
    const existing = shared.get(issue);
    if (existing) {
      if (!existing.destinations.some(d => d.area === area && d.field === field)) {
        if ('target' in issue && issue.target === field.split('.').at(-1)) existing.destinations.unshift(destination);
        else existing.destinations.push(destination);
      }
    } else {
      const key = field.split('.').at(-1) ?? field;
      const label = NumberField.named(key)?.fullLabel;
      const subject = area === 'driver' ? 'Driver' : field.startsWith('radiator.') ? 'Passive radiator' : null;
      const text = [subject, label, issue.text].filter(Boolean).join(': ');
      const problem = {kind: issue.kind, text, destinations: [destination]};
      shared.set(issue, problem);
      problems.push(problem);
    }
  };
  const cell = (value: unknown, area: ProjectProblemArea, field: string): void => {
    if (typeof value !== 'object' || value === null || !('dq' in value) || !Array.isArray(value.dq)) return;
    for (const issue of value.dq) {
      if (isIssue(issue) && issue.kind !== 'approximate-charts' && issue.kind !== 'wiring-inferred') add(issue, area, field);
    }
  };
  if (!project.driver.brand.value.trim()) problems.push({kind: 'driver-identity', text: 'Driver brand is not set.', destinations: [{area: 'driver', field: 'brand'}]});
  if (!project.driver.model.value.trim()) problems.push({kind: 'driver-identity', text: 'Driver model is not set.', destinations: [{area: 'driver', field: 'model'}]});
  for (const [field, value] of Object.entries(project.driver.specs)) cell(value, 'driver', field);
  const driverCount = engine.issues.positiveValueIssue(project.nDrivers.value);
  if (driverCount !== null) add(driverCount, 'driver', 'project.nDrivers');
  const resistance = engine.issues.nonNegativeValueIssue(project.Rs_ohm.value);
  if (resistance !== null) add(resistance, 'signal', 'resistance');
  const type = project.box.boxType.value;
  cell(project.box.volumeOf(type), 'box', 'volume');
  cell(project.box.frontVolumeOf(type), 'box', 'frontVolume');
  cell(project.box.rearTuningOf(type), 'box', 'rearTuning');
  for (const port of project.box.ventPortsOf(type)) {
    cell(port.tuning_goal_hz, 'enclosure', `${port.name}.tuning`);
    for (const [name, value] of Object.entries(port.vent)) {
      if (port.vent.shape.value === 'round' && (name === 'width_m' || name === 'height_m')) continue;
      if (port.vent.shape.value === 'slotted' && name === 'diameter_m') continue;
      cell(value, 'enclosure', `${port.name}.${name}`);
    }
  }
  let interchamberAdded = false;
  for (const group of project.box.lossGroupsOf(type)) {
    for (const [name, issues] of Object.entries(group.dq)) {
      if (name === 'Qicl' && interchamberAdded) continue;
      for (const issue of issues) add(issue, 'box', `losses.${group.chamber}.${name}`);
      if (name === 'Qicl' && issues.length > 0) interchamberAdded = true;
    }
  }
  if (type === 'box-passive-radiator') {
    const radiator = project.box.passiveRadiator;
    cell(radiator.tuning_goal_hz, 'enclosure', 'tuning');
    cell(radiator.addedMass_kg, 'enclosure', 'addedMass');
    for (const [field, value] of Object.entries(radiator.radiator.spec)) cell(value, 'enclosure', `radiator.${field}`);
    for (const text of radiator.countDq) problems.push({kind: 'radiator-count', text, destinations: [{area: 'enclosure', field: 'count'}]});
    const excursion = project.passiveRadiatorExcursionAdvice();
    if (excursion?.warning) problems.push({kind: 'radiator-excursion', text: excursion.text, destinations: [{area: 'enclosure', field: 'count'}]});
  }
  cell(project.powerDrive_W, 'signal', 'power');
  cell(project.driveVoltage_V, 'signal', 'voltage');
  cell(project.envTempK, 'advanced', 'temperature');
  cell(project.envHumidityPct, 'advanced', 'humidity');
  cell(project.envPressurePa, 'advanced', 'pressure');
  cell(project.envC_m_per_s, 'advanced', 'soundSpeed');
  cell(project.envRoo_kg_per_m3, 'advanced', 'airDensity');
  for (const filter of project.filters.value) {
    const issue = engine.filters.issue(filter);
    if (issue !== null) problems.push({kind: 'filter', text: issue.text, destinations: [{area: 'filters', field: filter.id ?? ''}]});
  }
  return problems;
}
