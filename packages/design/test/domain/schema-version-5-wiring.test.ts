/**
 * Data version 5 (QO941; John, QO942.c54: "the project already had a connection setting"): the project's `wiring` field,
 * which meant the wiring of several drivers (usually the default "parallel"), now means the wiring of the driver's own
 * coils. The upgrade must not rewire anyone's project silently: a series-measured MX6-22 saved with the old default
 * "parallel" array wiring must load showing its published figures, not converted to parallel.
 *
 * Fixtures are real-shaped: the three projects copied from a production browser store (schemaVersion 3, data version 3,
 * `packages/persistence/test/fixtures/stored-v3-projects.json`: RS225-8 single coil, MX6-22 dual coil, GF 250 dual
 * coil), taken through the real upgrade steps; the test-site shapes are made from them by the same steps and the
 * fields the test-site builds wrote (`coilWiring`, an array `wiring` set to series).
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {CURRENT_SCHEMA_VERSION, upgradeToCurrent} from '../../domain/schemaVersion.js';

type Plain = Record<string, unknown>;
const FIXTURE = '../../../persistence/test/fixtures/stored-v3-projects.json';
function rec(v: unknown): Plain {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('not an object');
  return Object.fromEntries(Object.entries(v));
}
const entries: readonly Plain[] = (() => {
  const list: unknown = rec(JSON.parse(readFileSync(new URL(FIXTURE, import.meta.url), 'utf8'))).entries;
  if (!Array.isArray(list)) throw new Error('no entries');
  return list.map((e: unknown) => rec(e));
})();
const engine = createEngine();

function entryNamed(model: string): Plain {
  const found = entries.find(e => typeof e.text === 'string' && e.text.includes(model));
  if (found === undefined || typeof found.text !== 'string') throw new Error(`no ${model} in the production fixture`);
  return rec(JSON.parse(found.text));
}

/** The embedding of every state (saved and edited) of a session, changed by `change`. */
function withEmbedding(session: Plain, change: (embedding: Plain) => Plain): Plain {
  const out: Plain = {...session};
  for (const state of ['saved', 'edited']) {
    const s = out[state];
    if (typeof s === 'object' && s !== null) out[state] = {...rec(s), driverEmbedding: change(rec(rec(s).driverEmbedding))};
  }
  return out;
}

function embeddingOf(session: unknown, state: 'saved' | 'edited' = 'saved'): Plain {
  return rec(rec(rec(session)[state]).driverEmbedding);
}

function loaded(session: unknown): OpenISDProject {
  const project = OpenISDProject.fromOwprText(JSON.stringify(session), engine);
  if (Array.isArray(project)) throw new Error(project.join('; '));
  return project;
}

function upgraded(session: Plain): unknown {
  const result = upgradeToCurrent(session);
  if ('refusal' in result) throw new Error(result.refusal);
  return result.value;
}

describe('data version 5', () => {
  it('is the current version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('production v3, MX6-22 (series-measured) with the old array wiring "parallel": loads with no coil rewiring', () => {
    const v3 = entryNamed('MX6-22');
    expect(embeddingOf(v3).wiring).toBe('parallel');
    const up = upgraded(v3);
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up)).not.toHaveProperty('retiredArrayWiring');
    const project = loaded(up);
    expect(project.coilWiring.mine).toBe('series');
    expect(project.coilWiring.inUseLine).toBe('2 coils · Re 4.70 Ω · BL 12.30 Tm');
    expect(project.retiredArrayWiringNotice()).toBeNull();
  });

  it('production v3, one driver or several: the old array wiring never becomes the coil wiring', () => {
    for (const model of ['RS225-8', 'MX6-22', 'GF 250']) {
      const up = upgraded(withEmbedding(entryNamed(model), e => ({...e, wiring: 'series'})));
      expect(embeddingOf(up), model).not.toHaveProperty('wiring');
    }
  });

  it('production v3 with several drivers wired in series: the dropped value is kept to tell the project once', () => {
    const v3 = withEmbedding(entryNamed('MX6-22'), e => ({...e, nDrivers: 2, wiring: 'series'}));
    const up = upgraded(v3);
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up).retiredArrayWiring).toBe('series');
    const project = loaded(up);
    expect(project.coilWiring.mine).toBe('series');
    expect(project.retiredArrayWiringNotice()).toMatch(/2 drivers were wired in series \(2 times one driver's impedance\)/);
  });

  it('production v3 with several drivers that had ticked Per-driver impedance: nothing to tell', () => {
    const v3 = withEmbedding(entryNamed('MX6-22'), e => ({...e, nDrivers: 2, wiring: 'series'}));
    const flagged: Plain = {...v3};
    for (const state of ['saved', 'edited']) {
      const s = flagged[state];
      if (typeof s === 'object' && s !== null) flagged[state] = {...rec(s), advanced: {...(rec(s).advanced === undefined ? {} : rec(rec(s).advanced)), winisdDriverCountModel: true}};
    }
    expect(embeddingOf(upgraded(flagged))).not.toHaveProperty('retiredArrayWiring');
  });

  it('test-site v4 without coilWiring (array wiring series, two drivers): the array value is dropped and kept to tell the project', () => {
    const v4 = withEmbedding(upgraded4(entryNamed('MX6-22')), e => ({...e, nDrivers: 2, wiring: 'series'}));
    const up = upgraded(v4);
    expect(embeddingOf(up)).not.toHaveProperty('wiring');
    expect(embeddingOf(up).retiredArrayWiring).toBe('series');
    expect(loaded(up).coilWiring.mine).toBe('series');
  });

  it('test-site v4 with coilWiring parallel: it becomes wiring, and the coils are rewired as the user chose', () => {
    const v4 = withEmbedding(upgraded4(entryNamed('MX6-22')), e => ({...e, wiring: 'parallel', coilWiring: 'parallel'}));
    const up = upgraded(v4);
    expect(embeddingOf(up).wiring).toBe('parallel');
    expect(embeddingOf(up)).not.toHaveProperty('coilWiring');
    const project = loaded(up);
    expect(project.coilWiring.mine).toBe('parallel');
    expect(project.coilWiring.inUseLine).toBe('2 coils · Re 1.175 Ω · BL 6.15 Tm');
  });

  it('test-site v4 with coilWiring and an array wiring over two drivers: both are kept apart', () => {
    const v4 = withEmbedding(upgraded4(entryNamed('MX6-22')), e => ({...e, nDrivers: 2, wiring: 'series', coilWiring: 'parallel'}));
    const up = upgraded(v4);
    expect(embeddingOf(up).wiring).toBe('parallel');
    expect(embeddingOf(up).retiredArrayWiring).toBe('series');
  });

  it('a version 5 project is not upgraded again: its wiring stays', () => {
    const v5 = withEmbedding(rec(upgraded(entryNamed('MX6-22'))), e => ({...e, wiring: 'parallel'}));
    expect(embeddingOf(upgraded(v5)).wiring).toBe('parallel');
  });
});

/** A production v3 session taken through the steps below version 5 only (what a test-site build before the change wrote). */
function upgraded4(session: Plain): Plain {
  const result = upgradeToCurrent(session, 4);
  if ('refusal' in result) throw new Error(result.refusal);
  return rec(result.value);
}
