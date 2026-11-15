/**
 * `createStoredTextCompaction` — rewrites the project texts browser storage holds as one compact
 * line without `dq_calculated`, upgraded to the current schemaVersion, and only when a text would change.
 * The rewrite is in place, key by key and record by record when a key does not fit: it takes no
 * whole-store backup (T827, QO940; the reason is in the header of `storageBackup.ts`).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compactedStoredText} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {changesInSubstance} from '../src/repos/upgradeSubstance.js';
import {createStoredTextCompaction, projectTextsLeft} from '../src/repos/storedTextCompaction.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';
import {backupOn, projectRepoOn} from './fixtures/repoOn.js';
import type {FileStorage} from '../src/storage/fileStorage.js';

const session = {label: 'p', saved: {spec: {Fs: {value: 45, dq_calculated: [{rule: 'x'}]}}}, edited: null};
const pretty = JSON.stringify(session, null, 2);
const compact = JSON.stringify({label: 'p', saved: {spec: {Fs: {value: 45}}}, edited: null});
const entries = (text: string) => JSON.stringify({entries: [{id: 'a', text, modified: '2026-01-01T00:00:00.000Z'}], focusedId: 'a'});
const backupKeys = (storage: ListableStorage) => storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));

describe('run', () => {
  it('rewrites every project text key as a compact line without dq_calculated, and keeps the rest of each record', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: entries(pretty), [OPENISD_OPEN_SESSIONS_KEY]: entries(pretty),
      [OPENISD_QUARANTINE_SESSION_KEY]: entries(pretty), [OPENISD_STATE_KEY]: pretty,
    });
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.equal(outcome.kind, 'rewritten');
    assert.equal(storage.get(OPENISD_STATE_KEY), compact);
    for (const key of [OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY]) {
      assert.equal(storage.get(key), entries(compact), key);
    }
  });

  it('takes no backup: the texts are rewritten in place', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: entries(pretty), [OPENISD_STATE_KEY]: pretty});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.equal(backupKeys(storage).length, 0);
  });

  it('reports the characters before and after', () => {
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: pretty});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(outcome, {kind: 'rewritten', charsBefore: pretty.length, charsAfter: compact.length, left: 0});
  });

  it('does nothing, and takes no backup, when every text is already compact', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: entries(compact), [OPENISD_STATE_KEY]: compact});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.deepEqual(outcome, {kind: 'nothingToDo'});
    assert.equal(backupKeys(storage).length, 0);
  });

  it('writes schemaVersion into a stored project that has none, and then has nothing to do (QO395)', () => {
    const saved = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'design', 'test', 'fixtures', 'air-migration', 'saved-by-t375-sample_project_vented.owpr'), 'utf8');
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: JSON.stringify({id: 'p1', ...JSON.parse(saved)})});
    const compaction = createStoredTextCompaction(storage, backupOn(storage), () => undefined);
    assert.equal(compaction.run().kind, 'rewritten');
    assert.match(storage.get(OPENISD_STATE_KEY) ?? '', /"schemaVersion":4,/);
    assert.deepEqual(compaction.run(), {kind: 'nothingToDo'});
  });

  it('does nothing on an empty store', () => {
    const storage = createMemoryStorage({});
    assert.deepEqual(createStoredTextCompaction(storage, backupOn(storage), () => undefined).run(), {kind: 'nothingToDo'});
  });

  it('leaves a text that is not a project, and a key it does not own, exactly as it is', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'not json', [OPENISD_STATE_KEY]: '{"x": 1}', [OPENISD_MY_DRIVERS_KEY]: entries(pretty),
    });
    assert.deepEqual(createStoredTextCompaction(storage, backupOn(storage), () => undefined).run(), {kind: 'nothingToDo'});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'not json');
    assert.equal(storage.get(OPENISD_STATE_KEY), '{"x": 1}');
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), entries(pretty));
  });

  it('rewrites the readable texts of a record and keeps an entry it cannot read', () => {
    const mixed = JSON.stringify({entries: [{id: 'a', text: pretty}, {id: 'b', text: 'garbage'}]});
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: mixed});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), JSON.stringify({entries: [{id: 'a', text: compact}, {id: 'b', text: 'garbage'}]}));
  });

  it('a second run finds nothing to do', () => {
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: pretty});
    const compaction = createStoredTextCompaction(storage, backupOn(storage), () => undefined);
    compaction.run();
    assert.deepEqual(compaction.run(), {kind: 'nothingToDo'});
  });
});

// --- the upgrade of a store of version-3 projects (T827) ---------------------------------------

const LIMIT = 5 * 1024 * 1024;
/** The `entries` of a stored bucket: each with its id and project text. */
function entriesIn(bucket: string): {id: string; text: string}[] {
  const parsed: unknown = JSON.parse(bucket);
  if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed) || !Array.isArray(parsed.entries)) throw new Error('not a bucket');
  return parsed.entries.map((e: unknown) => {
    if (typeof e !== 'object' || e === null || !('id' in e) || typeof e.id !== 'string' || !('text' in e) || typeof e.text !== 'string') throw new Error('not an entry');
    return {id: e.id, text: e.text};
  });
}
const v3 = entriesIn(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stored-v3-projects.json'), 'utf8'));
const usedBy = (storage: ListableStorage) => storage.keys().reduce((n, k) => n + k.length + (storage.get(k) ?? '').length, 0);
const idOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A projects bucket of version-3 texts under new ids, `fraction` of LIMIT: by default one project in eight is the
 *  dual-coil one and the rest are single-coil; the fixture's texts are real. */
function bucketAt(fraction: number, baseOf: (n: number) => {id: string; text: string} = n => v3[n % 8 === 0 ? 1 : 0]): {bucket: string; list: {id: string; text: string}[]} {
  const list: {id: string; text: string}[] = [];
  let bucket = '';
  do {
    const base = baseOf(list.length);
    const id = idOf(list.length);
    list.push({id, text: base.text.split(base.id).join(id)});
    bucket = JSON.stringify({entries: list.map(e => ({id: e.id, text: e.text, modified: '2026-01-01T00:00:00.000Z'}))});
  } while (OPENISD_PROJECTS_KEY.length + bucket.length < fraction * LIMIT);
  return {bucket, list};
}

const noFiles: FileStorage = {
  save: () => { throw new Error('no file'); }, saveAs: () => { throw new Error('no file'); }, openFileName: () => null, forget: () => { throw new Error('no file'); },
};
const storedEntries = (storage: ListableStorage) => entriesIn(storage.get(OPENISD_PROJECTS_KEY) ?? '{}');

describe.each([0.4, 0.46, 0.6])('a store of version-3 projects at %s of capacity', fraction => {
  const {bucket, list} = bucketAt(fraction);
  const upgradedOf = (text: string) => compactedStoredText(text) ?? text;

  it('is upgraded in place: every project version 4, no backup, use no more than one record above the upgraded data', () => {
    const storage = createQuotaStorage(LIMIT, {[OPENISD_PROJECTS_KEY]: bucket});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.equal(outcome.kind, 'rewritten');
    assert.equal(backupKeys(storage).length, 0);
    const after = storedEntries(storage);
    assert.deepEqual(after.map(e => e.id), list.map(e => e.id));
    for (const [i, entry] of after.entries()) {
      assert.match(entry.text, /"schemaVersion":4,/, entry.id);
      assert.equal(entry.text, upgradedOf(list[i].text), entry.id);
    }
    const needed = OPENISD_PROJECTS_KEY.length + JSON.stringify({entries: after.map(e => ({id: e.id, text: e.text, modified: '2026-01-01T00:00:00.000Z'}))}).length;
    const copied = list.filter(e => changesInSubstance(e.text, upgradedOf(e.text)));
    const copyChars = copied.reduce((n, e) => n + e.text.length, 0);
    assert.ok(copied.length > 0 && copied.length < list.length, 'the store holds both kinds of project');
    assert.ok(usedBy(storage) <= needed + 1.2 * copyChars, `used ${usedBy(storage)}, upgraded data needs ${needed}, copies ${copyChars}`);
    assert.ok(usedBy(storage) < 0.8 * LIMIT, 'not nearly full');
  });

  it('keeps the stored text, as it was, of every project the upgrade changes in substance, and of no other', () => {
    const storage = createQuotaStorage(LIMIT, {[OPENISD_PROJECTS_KEY]: bucket});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    const backup = backupOn(storage);
    const kept = backup.refusedCopies().map(c => ({reason: c.reason, text: backup.readRefused(c.key)?.text}));
    assert.ok(kept.every(c => c.reason === 'beforeUpgrade'));
    const expected = [...new Set(list.filter(e => changesInSubstance(e.text, upgradedOf(e.text))).map(e => e.text))].sort();
    assert.deepEqual(kept.map(c => c.text).sort(), expected.length === 0 ? [] : expected);
  });

  it('gives each project the same figures as reading its version-3 text in memory', () => {
    const storage = createQuotaStorage(LIMIT, {[OPENISD_PROJECTS_KEY]: bucket});
    const engine = createEngine();
    const before = projectRepoOn(engine, noFiles, storage, 'http://localhost');
    const sample = [list[0], list[1], list[list.length - 1]];
    const read = (repo: typeof before, id: string) => {
      const project = repo.loadStoredProject(id);
      assert.ok(!Array.isArray(project), id);
      return project.toOwprText();
    };
    const expected = sample.map(e => read(before, e.id));
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    const after = projectRepoOn(engine, noFiles, storage, 'http://localhost');
    assert.deepEqual(sample.map(e => read(after, e.id)), expected);
  });
});

/** The project text a stored key holds: the autosave is the text, the others hold entries. */
const projectTextAt = (storage: ListableStorage, key: string): string => {
  const held = storage.get(key) ?? '';
  return key === OPENISD_STATE_KEY ? held : entriesIn(held)[0].text;
};

describe('a start interrupted half-way (the tab closed)', () => {
  const texts: Record<string, string> = {[OPENISD_PROJECTS_KEY]: entries(v3[1].text), [OPENISD_OPEN_SESSIONS_KEY]: entries(v3[1].text), [OPENISD_STATE_KEY]: v3[1].text};

  it.each([1, 2, 3, 4])('after write %s leaves every key readable, and the next start finishes the job', dieAt => {
    const inner = createMemoryStorage({...texts});
    let sets = 0;
    const dying = {...inner, set: (key: string, value: string) => { sets += 1; if (sets === dieAt) throw new Error('tab closed'); inner.set(key, value); }};
    assert.throws(() => createStoredTextCompaction(dying, backupOn(dying), () => undefined).run(), /tab closed/);
    for (const key of Object.keys(texts)) {
      const held = inner.get(key) ?? '';
      assert.ok(held === texts[key] || /"schemaVersion":4,/.test(projectTextAt(inner, key)), `${key} is the old text or the new one, whole`);
      JSON.parse(held);
    }

    assert.equal(createStoredTextCompaction(inner, backupOn(inner), () => undefined).run().kind, 'rewritten');
    for (const key of Object.keys(texts)) assert.match(projectTextAt(inner, key), /"schemaVersion":4,/, key);
    assert.deepEqual(createStoredTextCompaction(inner, backupOn(inner), () => undefined).run(), {kind: 'nothingToDo'});
  });
});

describe('a store with room for some records and not for the rest', () => {
  /** The current text of a real project with its schemaVersion taken off: upgrading it only grows it. */
  const unversioned = (n: number) => (compactedStoredText(v3[1].text) ?? '').split(v3[1].id).join(idOf(n)).replace('"schemaVersion":4,', '');
  const bucketOf = (n: number) => JSON.stringify({entries: Array.from({length: n}, (_, i) => ({id: idOf(i), text: unversioned(i), modified: ''}))});

  it('rewrites the records that fit, leaves the others as saved, and says how many were left', () => {
    const seeded = {[OPENISD_PROJECTS_KEY]: bucketOf(10)};
    const grow = JSON.stringify(compactedStoredText(unversioned(0))).length - JSON.stringify(unversioned(0)).length;
    assert.ok(grow > 0, 'an upgrade of an unversioned text grows it');
    const storage = createQuotaStorage(usedBy(createMemoryStorage(seeded)) + grow * 3 + 1, seeded);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.deepEqual(outcome.kind === 'rewritten' ? outcome.left : null, 7);
    const after = storedEntries(storage);
    assert.equal(after.length, 10);
    assert.equal(after.filter(e => /"schemaVersion":4,/.test(e.text)).length, 3);
    for (const [i, entry] of after.entries()) assert.ok(entry.text === unversioned(i) || entry.text === compactedStoredText(unversioned(i)), entry.id);
  });

  it('leaves everything as saved, and says so, when there is no room even for one record', () => {
    const seeded = {[OPENISD_PROJECTS_KEY]: bucketOf(4)};
    const storage = createQuotaStorage(usedBy(createMemoryStorage(seeded)), seeded);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(outcome, {kind: 'left', left: 4});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), seeded[OPENISD_PROJECTS_KEY]);
  });
});

describe('the protection of a project the upgrade changes in substance', () => {
  const multi = v3[1];
  const bucketOfMulti = (n: number) => {
    const list = Array.from({length: n}, (_, i) => ({id: idOf(i), text: multi.text.split(multi.id).join(idOf(i))}));
    return {list, bucket: JSON.stringify({entries: list.map(e => ({id: e.id, text: e.text, modified: ''}))})};
  };
  const copiesOf = (storage: ListableStorage) => { const b = backupOn(storage); return b.refusedCopies().map(c => b.readRefused(c.key)?.text); };

  it('keeps the v3 text before it writes the v4 one, so a user can export the project as it was', () => {
    const {list, bucket} = bucketOfMulti(3);
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: bucket});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(copiesOf(storage).sort(), list.map(e => e.text).sort());
    const history = backupOn(storage).refusedCopies();
    assert.ok(history.every(c => c.reason === 'beforeUpgrade' && c.name !== ''));
  });

  it('leaves a project as saved, and counts it, when its copy does not fit', () => {
    const {list, bucket} = bucketOfMulti(4);
    const seeded = {[OPENISD_PROJECTS_KEY]: bucket};
    const room = list[0].text.length * 2.5; // two copies, not four
    const storage = createQuotaStorage(usedBy(createMemoryStorage(seeded)) + room, seeded);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    const after = storedEntries(storage);
    assert.equal(after.length, 4);
    const rewritten = after.filter(e => /"schemaVersion":4,/.test(e.text));
    assert.ok(rewritten.length < 4, 'not every project could be written');
    assert.equal(projectTextsLeft(outcome), 4 - rewritten.length);
    for (const [i, entry] of after.entries()) {
      if (rewritten.includes(entry)) assert.ok(copiesOf(storage).includes(list[i].text), `a copy of ${entry.id}`);
      else assert.equal(entry.text, list[i].text, `${entry.id} stays as saved`);
    }
  });

  it('writes no project whose copy is not kept, and keeps no copy of a project it did not write', () => {
    const {list, bucket} = bucketOfMulti(2);
    const seeded = {[OPENISD_PROJECTS_KEY]: bucket};
    const storage = createQuotaStorage(usedBy(createMemoryStorage(seeded)) + 10, seeded);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(outcome, {kind: 'left', left: 2});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), bucket);
    assert.deepEqual(copiesOf(storage), []);
    assert.equal(list.length, 2);
  });

  it('does not take the store over the line it is told to stay under, for any number of such projects', () => {
    const {bucket} = bucketOfMulti(60);
    const seeded = {[OPENISD_PROJECTS_KEY]: bucket};
    const limit = Math.ceil(usedBy(createMemoryStorage(seeded)) * 1.3);
    const storage = createQuotaStorage(10 * limit, seeded);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined, limit).run();
    assert.ok(usedBy(storage) <= limit, `used ${usedBy(storage)} of ${limit}`);
    const rewritten = storedEntries(storage).filter(e => /"schemaVersion":4,/.test(e.text)).length;
    assert.ok(rewritten > 0 && rewritten < 60);
    assert.equal(projectTextsLeft(outcome), 60 - rewritten);
  });
});
