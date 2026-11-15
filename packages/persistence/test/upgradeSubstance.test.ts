/**
 * `changesInSubstance` — whether upgrading a stored project text changes anything beyond the version
 * stamp, the derived marks and the text's shape (T827). The records in the fixture are real saved
 * projects at schemaVersion 3 (see the file).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compactedStoredText} from '@openisd/design';
import {createUpgradeSubstance} from '../src/repos/upgradeSubstance.js';

const fixture: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stored-v3-projects.json'), 'utf8'));
function textOf(id: string): string {
  if (typeof fixture !== 'object' || fixture === null || !('entries' in fixture) || !Array.isArray(fixture.entries)) throw new Error('fixture');
  const entries: unknown[] = fixture.entries;
  for (const e of entries) {
    if (typeof e === 'object' && e !== null && 'id' in e && typeof e.id === 'string' && e.id.startsWith(id) && 'text' in e && typeof e.text === 'string') return e.text;
  }
  throw new Error(id);
}
const upgraded = (text: string): string => compactedStoredText(text) ?? text;

const substance = createUpgradeSubstance();

describe('changesInSubstance', () => {
  it('is false for a single-coil project: the stamp goes up and a never-stated default goes', () => {
    const before = textOf('bee3ade1');
    assert.notEqual(upgraded(before), before);
    assert.equal(substance.changesInSubstance(before, upgraded(before)), false);
  });

  it('is true for a dual-coil project with the wiring defaulted: the wiring becomes unknown', () => {
    const before = textOf('70cd09e7');
    assert.equal(substance.changesInSubstance(before, upgraded(before)), true);
  });

  it('is true for a dual-coil project with the wiring entered as series: Re and BL change', () => {
    const before = textOf('e1f49c18');
    assert.equal(substance.changesInSubstance(before, upgraded(before)), true);
  });

  it('is false when the text only gets shorter: indentation and derived marks', () => {
    const record = {schemaVersion: 4, label: 'p', saved: {spec: {Fs: {state: 'E', value: 45, dq_calculated: [{rule: 'x'}]}}}};
    assert.equal(substance.changesInSubstance(JSON.stringify(record, null, 2), JSON.stringify({...record, saved: {spec: {Fs: {state: 'E', value: 45}}}})), false);
  });

  it('is true when an entered value differs, and when an entered field goes', () => {
    const base = {label: 'p', saved: {spec: {Fs: {state: 'E', value: 45}}}};
    assert.equal(substance.changesInSubstance(JSON.stringify(base), JSON.stringify({label: 'p', saved: {spec: {Fs: {state: 'E', value: 46}}}})), true);
    assert.equal(substance.changesInSubstance(JSON.stringify(base), JSON.stringify({label: 'p', saved: {spec: {}}})), true);
  });

  it('is true for text that is not JSON, so nothing unreadable is ever called safe', () => {
    assert.equal(substance.changesInSubstance('not json', '{}'), true);
  });
});
