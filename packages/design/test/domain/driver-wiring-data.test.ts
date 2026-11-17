/**
 * Several-driver wiring, slice 2 "Data, inert" (plan docs/plans/PLAN_20261116_DRIVER_WIRING.md section 4,
 * ticket 519; QO946.c129): the project file saves and loads `driverWiring` (parallel or series, in
 * `driverEmbedding`). Nothing reads it yet. The one-driver-impedance key and the facade are held: see build/T876_REPORT.md.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {upgradeToCurrent} from '../../domain/schemaVersion.js';
import {createEngine} from '../../engine/Engine.js';
import {sealedProject} from '../fixtures/domainBuilders.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function opened(text: string): OpenISDProject {
  const back = OpenISDProject.fromOwprText(text, createEngine());
  if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
  return back;
}

function sectionOf(text: string, name: 'driverEmbedding' | 'advanced'): Record<string, unknown> {
  const session: unknown = JSON.parse(text);
  const section = isRecord(session) && isRecord(session.saved) ? session.saved[name] : undefined;
  if (!isRecord(section)) throw new Error(`no ${name} in the saved project`);
  return section;
}

function sealedProjectText(): string {
  const p = sealedProject();
  p.save();
  return p.toOwprText();
}

describe('driver wiring data (slice 2, inert): the saved file', () => {
  function withKeys(): string {
    const p = sealedProject();
    p.save();
    return p.toOwprText()
      .replace(/"nDrivers": 1,/, '"nDrivers": 1, "driverWiring": "series",');
  }

  it('a file that carries driverWiring is accepted and writes it back as they were', () => {
    const text = withKeys();
    expect(text).toMatch(/"driverWiring": "series"/);
    const again = opened(text).toOwprText();
    expect(sectionOf(again, 'driverEmbedding').driverWiring).toBe('series');
  });

  it('browser storage text keeps the key too', () => {
    const stored = opened(withKeys()).toStoredText();
    expect(sectionOf(stored, 'driverEmbedding').driverWiring).toBe('series');
  });

  it('a file from before the keys existed (no driverWiring) is accepted', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText();
    expect(text).not.toMatch(/driverWiring/);
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(false);
  });

  it('a driverWiring that is not parallel or series is refused by the schema', () => {
    const text = sealedProjectText().replace(/"nDrivers": 1,/, '"nDrivers": 1, "driverWiring": "star",');
    expect(text).toMatch(/"driverWiring": "star"/);
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(true);
  });
});

describe('schema version step (plan 4.2)', () => {
  function v5File(): Record<string, unknown> {
    const p = sealedProject();
    p.save();
    const parsed: unknown = JSON.parse(p.toOwprText());
    if (!isRecord(parsed)) throw new Error('not a record');
    return {...parsed, schemaVersion: 5};
  }

  it('the step from 5 to 6 is the identity on a version 5 file except schemaVersion', () => {
    const file = v5File();
    const result = upgradeToCurrent(file, 6);
    if ('refusal' in result) throw new Error(result.refusal);
    const {schemaVersion: was, ...before} = file;
    expect(was).toBe(5);
    expect(result.value).toEqual({...before, schemaVersion: 6});
  });

  it('a version 6 file is refused by a build that reads up to 5, as made by a newer OpenISD', () => {
    const result = upgradeToCurrent({...v5File(), schemaVersion: 6}, 5);
    expect('refusal' in result && result.refusal).toMatch(/saved by a newer OpenISD/);
  });
});
