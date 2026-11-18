/**
 * A saved project's entry carries its unsaved layer while Cloud sync is on, so a run sends the whole
 * project (John, 18 Nov 2026, QO946.c248). The store writes it only over the version the project came
 * from, never over another one.
 */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {projectRepoOn} from './fixtures/repoOn.js';

const engine = createEngine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

/** "Sub 12" saved at a port limit of 17 m/s, and the repo it is saved in. */
function savedProject() {
  const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
  const project = ProjectBuilder.empty(engine);
  project.name.set('Sub 12');
  project.portVelocityLimit_m_per_s.set(17);
  project.save();
  expect(repo.saveToStorage(project).kind).toBe('saved');
  const entry = (): string => {
    const docs = repo.storedDocs();
    return docs.kind === 'ok' ? docs.docs.find(d => d.id === project.uuid())?.body ?? '' : '';
  };
  return {repo, project, entry};
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The port limit a stored project text holds in its `side` layer: null when it has no such layer. */
function limitIn(text: string, side: 'saved' | 'edited'): unknown {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('not a stored project');
  const layer = parsed[side];
  if (!isRecord(layer)) return null;
  const box = layer['box'];
  return isRecord(box) ? box['portVelocityLimit_m_per_s'] : undefined;
}

describe('storeWithUnsavedLayer', () => {
  it('writes the unsaved edits over the checkpoint they were made on, and keeps the save time', () => {
    const {repo, project, entry} = savedProject();
    const modified = repo.listStoredProjects()[0]?.modified;
    project.portVelocityLimit_m_per_s.set(20);
    const result = repo.storeWithUnsavedLayer(project, null);
    expect(result).toEqual({kind: 'written', held: entry()});
    expect(limitIn(entry(), 'edited')).toBe(20);
    expect(limitIn(entry(), 'saved')).toBe(17);
    expect(repo.listStoredProjects()[0]?.modified).toBe(modified);
  });

  it('writes again over the text it wrote last', () => {
    const {repo, project, entry} = savedProject();
    project.portVelocityLimit_m_per_s.set(20);
    const first = repo.storeWithUnsavedLayer(project, null);
    project.portVelocityLimit_m_per_s.set(22);
    expect(repo.storeWithUnsavedLayer(project, first.kind === 'written' ? first.held : null).kind).toBe('written');
    expect(limitIn(entry(), 'edited')).toBe(22);
  });

  it('writes nothing for a project with nothing unsaved over an entry with nothing unsaved', () => {
    const {repo, project, entry} = savedProject();
    const before = entry();
    expect(repo.storeWithUnsavedLayer(project, null)).toEqual({kind: 'same', held: before});
    expect(entry()).toBe(before);
  });

  it('never writes over another version: an entry that is not the one the edits started from is "moved"', () => {
    const {repo, project, entry} = savedProject();
    const other: OpenISDProject = ProjectBuilder.empty(engine);
    other.name.set('Sub 12');
    other.portVelocityLimit_m_per_s.set(30);
    other.save();
    other.adoptId(project.uuid());
    expect(repo.putStoredDoc(project.uuid(), other.toStoredText())).toBe('done');
    const theirs = entry();
    project.portVelocityLimit_m_per_s.set(20);
    expect(repo.storeWithUnsavedLayer(project, null)).toEqual({kind: 'moved'});
    expect(entry()).toBe(theirs);
  });

  it('says so when the project has no saved entry', () => {
    const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
    const project = ProjectBuilder.empty(engine);
    project.portVelocityLimit_m_per_s.set(20);
    expect(repo.storeWithUnsavedLayer(project, null)).toEqual({kind: 'notStored'});
  });
});

describe('dropUnsavedLayer (closing without saving)', () => {
  it('leaves the checkpoint and clears the unsaved edits', () => {
    const {repo, project, entry} = savedProject();
    project.portVelocityLimit_m_per_s.set(20);
    repo.storeWithUnsavedLayer(project, null);
    expect(repo.dropUnsavedLayer(project.uuid())).toBe('written');
    expect(limitIn(entry(), 'edited')).toBeNull();
    const reopened = repo.loadStoredProject(project.uuid());
    expect(Array.isArray(reopened) ? null : [reopened.isModified(), reopened.portVelocityLimit_m_per_s.value]).toEqual([false, 17]);
  });

  it('changes nothing when there is nothing unsaved', () => {
    const {repo, project} = savedProject();
    expect(repo.dropUnsavedLayer(project.uuid())).toBe('same');
    expect(repo.dropUnsavedLayer('no-such-project')).toBe('notStored');
  });
});

describe('a stored text with no unsaved layer key', () => {
  it('loads as saved with nothing unsaved', () => {
    const {repo, project, entry} = savedProject();
    const parsed: unknown = JSON.parse(entry());
    if (!isRecord(parsed)) throw new Error('not a stored project');
    const {edited: _edited, ...old} = parsed;
    expect(repo.putStoredDoc(project.uuid(), JSON.stringify(old))).toBe('done');
    const loaded = repo.loadStoredProject(project.uuid());
    if (Array.isArray(loaded)) throw new Error(loaded.join('; '));
    expect(loaded.isModified()).toBe(false);
    expect(loaded.portVelocityLimit_m_per_s.value).toBe(17);
  });
});
