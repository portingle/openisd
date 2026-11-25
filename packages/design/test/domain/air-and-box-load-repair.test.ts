/**
 * QO972: a loaded value is shown exactly as the file states it, never repaired, with the usual
 * data-quality mark where it is impossible; the charts stay finite and nothing crashes. This covers the air,
 * the driver count, the series resistance, the box losses, the port tunings and lengths, the
 * passive-radiator count and added mass, and the connecting-port length. Where the charts need a value the file's
 * cannot give, they use a working value and report an approximate-charts issue.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';
import {NumberField} from '../../fields/field.js';
import {soundSpeedAt} from '../../engine/air.js';
import type {OpenISDProjectJson} from '../../domain/openisdSchema.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {DEFAULT_GRID, importWprText, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import type {ProjectName} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();

/** A starting project as a saved `.owpr` text (no unsaved edits), its record changed by `change`. */
function owprWith(name: ProjectName, change: (record: OpenISDProjectJson) => OpenISDProjectJson): string {
  const session = loadProject(name).cloneSession();
  return JSON.stringify({...session, saved: change(session.edited ?? session.saved), edited: null}, null, 2);
}

/** An `.owpr` text opened as File > Open opens it. */
function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

/** The project's air with one entry replaced by an entered `value`. */
function withAir(key: keyof OpenISDProjectJson['environment'], value: number): (r: OpenISDProjectJson) => OpenISDProjectJson {
  return r => ({...r, environment: {...r.environment, [key]: {state: 'E', value}}});
}

/** The charts draw: nothing non-finite, nothing refused. */
function expectCharts(project: OpenISDProject): void {
  const result = projectFindings(project, DEFAULT_GRID);
  expect(result.findings).toEqual([]);
  expect(result.refused).toBe(false);
}

describe('a loaded impossible air value is shown as the file states it, with its mark, and the charts stay finite (QO972)', () => {
  const cases = [
    {key: 'pressure_Pa', value: 0, read: (p: OpenISDProject) => p.envPressurePa},
    {key: 'pressure_Pa', value: -1, read: (p: OpenISDProject) => p.envPressurePa},
    {key: 'c_m_per_s', value: 0, read: (p: OpenISDProject) => p.envC_m_per_s},
    {key: 'roo_kg_per_m3', value: -100, read: (p: OpenISDProject) => p.envRoo_kg_per_m3},
    {key: 'humidity_pct', value: 150, read: (p: OpenISDProject) => p.envHumidityPct},
    {key: 'humidity_pct', value: -5, read: (p: OpenISDProject) => p.envHumidityPct},
    {key: 'temperature_K', value: 0, read: (p: OpenISDProject) => p.envTempK},
    {key: 'temperature_K', value: -20, read: (p: OpenISDProject) => p.envTempK},
  ] as const;

  for (const c of cases) {
    it(`${c.key} ${c.value} in a project file stays ${c.value}, entered, marked, nothing repaired, and the charts are finite`, () => {
      const {project} = opened(owprWith('sealed', withAir(c.key, c.value)));
      const field = c.read(project);
      expect(field.value).toBe(c.value);
      expect(field.entered).toBe(true);
      expect(field.dq.length).toBeGreaterThan(0);
      const result = projectFindings(project, DEFAULT_GRID);
      expect(result.findings).toEqual([]);
    });
  }

  it('a WinISD .wpr with T=0, p=0 and phi=2 (200 %) keeps all three as the file states them, nothing repaired, the charts finite', () => {
    const plain = wprText('sealed');
    const text = plain.replace('T=293.15\n', 'T=0\n').replace('p=101325\n', 'p=0\n').replace('phi=0.3\n', 'phi=2\n');
    expect(text, 'the sealed W5 file states T, p and phi').not.toBe(plain);
    const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (value === null) throw new Error(errors.map(e => e.message).join('; '));
    expect(value.envTempK.value).toBe(0);
    expect(value.envPressurePa.value).toBe(0);
    expect(value.envHumidityPct.value).toBe(200);
    expect(projectFindings(value, DEFAULT_GRID).findings).toEqual([]);
  });

  it('odd but possible air in a file (pressure 5000 Pa, 330 K, 60 %) is kept as it is and nothing is repaired', () => {
    const {project} = opened(owprWith('sealed', r => withAir('temperature_K', 330)(withAir('humidity_pct', 60)(withAir('pressure_Pa', 5000)(r)))));
    expect(project.envPressurePa.value).toBe(5000);
    expect(project.envPressurePa.entered).toBe(true);
    expect(project.envTempK.value).toBe(330);
    expect(project.envHumidityPct.value).toBe(60);
    expectCharts(project);
  });
});

describe('the air boxes warn outside their normal band, keeping and using the value (QO953.c14)', () => {
  for (const {field, set, value, says} of [
    {field: NumberField.ADV_PRESSURE_KPA, set: (p: OpenISDProject) => p.envPressurePa, value: 1000, says: 'Air pressure 1000 Pa is outside the sane range for air (30000 Pa to 110000 Pa). It is kept and used; check it.'},
    {field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, set: (p: OpenISDProject) => p.envC_m_per_s, value: 1000, says: 'Sound velocity 1000.00 m/s is outside the sane range for air (260.00 m/s to 500.00 m/s). It is kept and used; check it.'},
    {field: NumberField.ADV_AIRDENSITY_KG_PER_M3, set: (p: OpenISDProject) => p.envRoo_kg_per_m3, value: 10, says: 'Air density 10.00 kg/m³ is outside the sane range for air (0.15 kg/m³ to 2.25 kg/m³). It is kept and used; check it.'},
    {field: NumberField.ADV_TEMP_K, set: (p: OpenISDProject) => p.envTempK, value: 400, says: 'Temperature 400.00 K is outside the sane range for air (174.00 K to 373.00 K). It is kept and used; check it.'},
  ]) {
    it(`${field.label} ${value} is stored, marked with the band, and the charts draw`, () => {
      const project = loadProject('sealed');
      set(project).set(value);
      expect(set(project).value).toBe(value);
      expect(set(project).dq.map(i => i.text)).toContain(says);
      // A warning of its own kind, never a conflict: the box says it without "Conflicts with other values".
      expect(set(project).dq.filter(i => i.text === says).map(i => i.kind)).toEqual(['outside-normal-band']);
      expectCharts(project);
    });
  }

  it('20 C air, as WinISD starts, carries no mark on any air box', () => {
    const project = loadProject('sealed');
    project.envTempK.set(293.15);
    for (const f of [project.envTempK, project.envHumidityPct, project.envPressurePa, project.envC_m_per_s, project.envRoo_kg_per_m3]) expect(f.dq).toEqual([]);
  });

  it("each air field's normal band holds the air model's own values over the temperature, humidity and pressure bands", () => {
    const {ADV_TEMP_K: T, ADV_PRESSURE_KPA: P, ADV_SOUNDVELOCITY_M_PER_S: C, ADV_AIRDENSITY_KG_PER_M3: R} = NumberField;
    for (const tempK of [T.plausible.min, 293.15, T.plausible.max]) for (const rh of [0, 50, 100]) for (const p of [P.plausible.min, 101325, P.plausible.max]) {
      const c = soundSpeedAt(tempK, rh, p);
      const rho = 1.4 * p / c ** 2;
      expect(c, `c at ${tempK} K, ${rh} %, ${p} Pa`).toBeGreaterThanOrEqual(C.plausible.min);
      expect(c).toBeLessThanOrEqual(C.plausible.max);
      expect(rho, `rho at ${tempK} K, ${rh} %, ${p} Pa`).toBeGreaterThanOrEqual(R.plausible.min);
      expect(rho).toBeLessThanOrEqual(R.plausible.max);
    }
  });
});

describe('the driver count, series resistance, box tunings, port lengths, losses and radiator count and added mass stay as the file states them (QO972)', () => {
  it('driver count 0 and series resistance -2 Ω stay as saved while charts use named working values', () => {
    const {project} = opened(owprWith('sealed', r => ({...r, driverEmbedding: {...r.driverEmbedding, nDrivers: 0, Rs_ohm: -2}})));
    expect(project.nDrivers.value).toBe(0);
    expect(project.Rs_ohm.value).toBe(-2);
    const swept = project.sweep(DEFAULT_GRID);
    expectCharts(project);
    expect(swept.values).not.toBeNull();
    expect(swept.issues.map(i => [i.kind, i.text])).toEqual(expect.arrayContaining([
      ['approximate-charts', 'Num. of drivers must be at least 1. Charts are calculated using 1.'],
      ['approximate-charts', 'Series resistance must not be negative. Charts are calculated using 0 Ω.'],
    ]));
    const result = projectFindings(project, DEFAULT_GRID);
    expect(result.refused).toBe(false);
  });

  it('each invalid input independently produces a chart and its own note', () => {
    const rs = opened(owprWith('sealed', r => ({...r, driverEmbedding: {...r.driverEmbedding, Rs_ohm: -2}}))).project;
    expect(rs.Rs_ohm.value).toBe(-2);
    expectCharts(rs);
    expect(rs.sweep(DEFAULT_GRID).issues.map(i => i.text)).toEqual(['Series resistance must not be negative. Charts are calculated using 0 Ω.']);
    const n = opened(owprWith('sealed', r => ({...r, driverEmbedding: {...r.driverEmbedding, nDrivers: 0}}))).project;
    expect(n.nDrivers.value).toBe(0);
    expectCharts(n);
    expect(n.sweep(DEFAULT_GRID).issues.map(i => i.text)).toEqual(['Num. of drivers must be at least 1. Charts are calculated using 1.']);
  });

  it('invalid saved driver inputs also leave charts usable with a power signal', () => {
    const {project} = opened(owprWith('sealed', r => ({...r, signal: {power_W: {state: 'E', value: 10}},
      driverEmbedding: {...r.driverEmbedding, nDrivers: 0, Rs_ohm: -2}})));
    expect(project.nDrivers.value).toBe(0);
    expect(project.Rs_ohm.value).toBe(-2);
    expectCharts(project);
  });

  it("a sealed box keeps Ql 0 and Qa -1 and labels the chart calculation with Ql 10 and Qa 100", () => {
    const {project} = opened(owprWith('sealed', r => ({...r, box: {...r.box, sealed: {...r.box.sealed, losses: {Ql: 0, Qa: -1}}}})));
    expect(project.box.sealed.losses.Ql.value).toBe(0);
    expect(project.box.sealed.losses.Qa.value).toBe(-1);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && [plan.job.sweep.Ql, plan.job.sweep.Qa]).toEqual([10, 100]);
    expect(project.sweep(DEFAULT_GRID).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'approximate-charts', target: 'Ql'}),
      expect.objectContaining({kind: 'approximate-charts', target: 'Qa'}),
    ]));
    expectCharts(project);
  });

  it('a vented box keeps port Qp -1 and calculates the charts with Qp 100', () => {
    const {project} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented, chamber: {...r.box.vented.chamber, losses: {...r.box.vented.chamber.losses, Qp: -1}},
    }}})));
    expect(project.box.vented.losses.Qp.value).toBe(-1);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && plan.job.sweep.Qp).toBe(100);
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'Qp'}));
    expectCharts(project);
  });

  it('a vented box saved with tuning 0 Hz and a port length of 0.2 m keeps both and charts at the tuning that length gives', () => {
    const {project} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented,
      chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: 0}},
      vent: {...r.box.vented.vent, length_m: {state: 'E', value: 0.2}},
    }}})));
    expect(project.box.vented.tuning_goal_hz.value).toBe(0);
    expect(project.box.vented.tuning_goal_hz.entered).toBe(true);
    expect(project.box.vented.vent.length_m.value).toBe(0.2);
    expect(project.box.vented.tuning_goal_hz.dq.length).toBeGreaterThan(0);
    const fromLength = project.box.vented.vent.tuningIn_hz(project.box.vented.volume_m3.value);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind).toBe('ready');
    if (plan.kind === 'ready') {
      expect(plan.job.sweep.Fb).toBeCloseTo(fromLength ?? NaN, 9);
      expect(plan.job.sweep.Leff).toBeCloseTo(project.box.vented.vent.effectiveLength_m() ?? NaN, 9);
    }
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'Fb'}));
    expectCharts(project);
  });

  it('a vented box saved with tuning 0 Hz and no usable port length keeps the 0 Hz and charts at 35 Hz', () => {
    const {project} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented,
      chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: 0}},
      vent: {...r.box.vented.vent, length_m: undefined},
    }}})));
    expect(project.box.vented.tuning_goal_hz.value).toBe(0);
    expect(project.box.vented.tuning_goal_hz.dq.length).toBeGreaterThan(0);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && plan.job.sweep.Fb).toBe(35);
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'Fb'}));
    expectCharts(project);
  });

  it('a 4th-order bandpass saved with Ffc -3 Hz keeps it and charts at 35 Hz', () => {
    const {project} = opened(owprWith('bandpass4', r => ({...r, box: {...r.box, bandpass4: {...r.box.bandpass4,
      front: {...r.box.bandpass4.front, tuning_goal_hz: {state: 'E', value: -3}},
      frontVent: {...r.box.bandpass4.frontVent, length_m: undefined},
    }}})));
    expect(project.box.bandpass4.chambers.front.tuning_goal_hz.value).toBe(-3);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && plan.job.sweep.Ff).toBe(35);
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'Ff'}));
    expectCharts(project);
  });

  it('a vented port length entered as -0.05 m opens with the length worked out from the tuning', () => {
    const before = loadProject('vented');
    const Fb = before.box.vented.tuning_goal_hz.value;
    expect(Fb).not.toBeNull();
    const {project} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: Fb ?? 0}},
      vent: {...r.box.vented.vent, length_m: {state: 'E', value: -0.05}},
    }}})));
    // The project file reader's own repair (`repaired`) already drops a negative entry; the load
    // repair pass is the same rule for a record that reaches it another way (a stored session).
    expect(project.box.vented.vent.length_m.value).toBe(before.box.vented.vent.length_m.value);
    expectCharts(project);
  });

  it('a 6th-order bandpass saved with Frc 0 Hz keeps it and charts the rear chamber at 35 Hz', () => {
    const {project} = opened(owprWith('bandpass6', r => ({...r, box: {...r.box, bandpass6: {...r.box.bandpass6,
      rear: {...r.box.bandpass6.rear, tuning_goal_hz: {state: 'E', value: 0}},
      rearVent: {...r.box.bandpass6.rearVent, length_m: undefined},
    }}})));
    expect(project.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(0);
    expect(project.box.bandpass6.chambers.rear.tuning_goal_hz.dq.length).toBeGreaterThan(0);
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && plan.job.sweep.Fr).toBe(35);
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'Fr'}));
    expectCharts(project);
  });

  it('a passive radiator count of 0 and an added mass of -0.01 kg open as saved and chart with 1 radiator and 0 g', () => {
    const pr = opened(owprWith('passive radiator', r => ({...r, box: {...r.box, passiveRadiator: {...r.box.passiveRadiator,
      count: 0, addedMass_kg: {state: 'E', value: -0.01}}}})));
    expect(pr.project.box.passiveRadiator.count.value).toBe(0);
    expect(pr.project.box.passiveRadiator.addedMass_kg.value).toBe(-0.01);
    expect(pr.project.box.passiveRadiator.countDq.length).toBe(1);
    expect(pr.project.box.passiveRadiator.addedMass_kg.dq).toContainEqual(expect.objectContaining({kind: 'negative-value'}));
    const plan = pr.project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && [plan.job.sweep.prNum, plan.job.sweep.prMadd]).toEqual([1, 0]);
    expect(pr.project.sweep(DEFAULT_GRID).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'approximate-charts', target: 'prNum'}),
      expect.objectContaining({kind: 'approximate-charts', target: 'prMadd'}),
    ]));
    expectCharts(pr.project);
  });

  it('an ABC connecting port length of -0.01 m opens as saved and charts with the 5 cm starting length', () => {
    const {project} = opened(owprWith('abc', r => ({...r, box: {...r.box, abc: {...r.box.abc,
      intraVent: {...r.box.abc.intraVent, length_m: {state: 'E', value: -0.01}}}}})));
    expect(project.box.abc.vents.intra.length_m.value).toBe(-0.01);
    expect(project.box.abc.vents.intra.length_m.dq).toContainEqual(expect.objectContaining({kind: 'invalid-value'}));
    const plan = project.sweepPlan(DEFAULT_GRID);
    expect(plan.kind === 'ready' && plan.job.sweep.LeffIntra).toBeCloseTo(0.05 + (project.box.abc.vents.intra.endCorrectionLength_m() ?? NaN), 9);
    expect(project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts', target: 'LeffIntra'}));
    expectCharts(project);
  });

  it('a 4th-order bandpass Qicl of 0 opens as the file states it, with the warning on the field and approximate charts', () => {
    const bp4 = opened(owprWith('bandpass4', r => ({...r, box: {...r.box, bandpass4: {...r.box.bandpass4, Qiclfr: 0}}})));
    expect(bp4.project.box.bandpass4.Qiclfr.value).toBe(0);
    const [group] = bp4.project.box.lossGroupsOf('bandpass4');
    expect(group.dq.Qicl).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
    expect(group.dq.Ql).toEqual([]);
    expectCharts(bp4.project);
    expect(bp4.project.sweep(DEFAULT_GRID).issues).toContainEqual(expect.objectContaining({kind: 'approximate-charts'}));
  });

  it.each(['Ql', 'Qa', 'Qp'] as const)('a vented box with a saved %s of 0 shows the warning on that loss only', loss => {
    const {project} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented, chamber: {...r.box.vented.chamber, losses: {...r.box.vented.chamber.losses, [loss]: 0}}}}})));
    const [group] = project.box.lossGroupsOf('vented');
    expect(group[loss]?.value).toBe(0);
    for (const key of ['Ql', 'Qa', 'Qp', 'Qicl'] as const) {
      if (key === loss) expect(group.dq[key]).toContainEqual(expect.objectContaining({kind: 'invalid-value', value: 0}));
      else expect(group.dq[key]).toEqual([]);
    }
  });
});

describe('a .wpr that states tuning 0 Hz beside a port length (QO972)', () => {
  const wpr = wprText('vented').replace(/^Fr=.*$/m, 'Fr=0').replace(/^(\[VentRear\][^[]*?)Fb=.*$/m, '$1Fb=0').replace(/^(\[VentRear\][^[]*?)len=.*$/m, '$1len=0.2');

  it('opens with the 0 Hz and the 0.2 m both as the file states them, the 0 Hz marked', () => {
    const project = importWprText('vented tuning 0 with a port length', wpr);
    expect(project.box.vented.tuning_goal_hz.value).toBe(0);
    expect(project.box.vented.tuning_goal_hz.entered).toBe(true);
    expect(project.box.vented.tuning_goal_hz.dq.length).toBeGreaterThan(0);
    expect(project.box.vented.vent.length_m.value).toBe(0.2);
    expect(project.box.vented.vent.length_m.entered).toBe(true);
  });
});
