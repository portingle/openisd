/**
 * A stored project opens as its text states it (here a passive-radiator count of 0): nothing is repaired on load,
 * so no repair is reported by any way of opening it.
 */
import {describe, expect, it, vi} from 'vitest';
import {createProjectRepo, type LoadRepairReport} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY} from '../src/repos/storageKeys.js';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {goldenText} from './fixtures/goldens.js';
import {backupOn, exportedFilesOn} from './fixtures/repoOn.js';

const engine = createEngine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

/** A saved project named `name` whose stored text holds a passive-radiator count of 0. */
function zeroPrCountText(name: string): {id: string; text: string} {
  const p = ProjectBuilder.empty(engine);
  p.name.set(name);
  p.save();
  const session = p.cloneSession();
  return {id: session.id, text: JSON.stringify({...session, saved: {...session.saved, box: {...session.saved.box, boxType: 'box-passive-radiator', passiveRadiator: {...session.saved.box.passiveRadiator, count: 0}}}})};
}

/** The same project with a series resistance of -2 Ω, which opening leaves as the file states it. */
function minusTwoOhmText(name: string): {id: string; text: string} {
  const p = ProjectBuilder.empty(engine);
  p.name.set(name);
  p.save();
  const session = p.cloneSession();
  return {id: session.id, text: JSON.stringify({...session, saved: {...session.saved, driverEmbedding: {...session.saved.driverEmbedding, Rs_ohm: -2}}})};
}

function repoOver(seed: Record<string, string>, onLoadRepaired: (report: LoadRepairReport) => void) {
  const storage = createMemoryStorage(seed);
  return createProjectRepo(engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(), () => undefined, () => undefined, onLoadRepaired);
}

describe('a stored project opens as its text states it and reports no repair (QO972)', () => {
  it('restoring the open projects at start-up keeps a passive-radiator count of 0 and reports nothing', () => {
    const {id, text} = zeroPrCountText('old build');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const session = repoOver({[OPENISD_OPEN_SESSIONS_KEY]: JSON.stringify({entries: [{id, text, modified: '', traceHidden: false}], focusedId: id})}, told)
      .loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.projects[0]?.box.passiveRadiator.count.value).toBe(0);
    expect(session.projects[0]?.box.passiveRadiator.countDq).toEqual([expect.stringContaining('Num. of PRs')]);
    expect(told).not.toHaveBeenCalled();
  });

  it('opening a saved project from the projects list keeps the count of 0 and reports nothing', () => {
    const {id, text} = zeroPrCountText('saved one');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const repo = repoOver({[OPENISD_PROJECTS_KEY]: JSON.stringify({version: 1, entries: [{id, text, modified: '2026-01-01T00:00:00Z'}]})}, told);
    expect(repo.listStoredProjects()).toHaveLength(1);
    const project = repo.loadStoredProject(id);
    if (project === null || Array.isArray(project)) throw new Error('expected a project');
    expect(project.box.passiveRadiator.count.value).toBe(0);
    expect(told).not.toHaveBeenCalled();
  });

  it('File > Open keeps the count of 0 and hands its caller no repair', () => {
    const {text} = zeroPrCountText('a file');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const opened = repoOver({}, told).openProjectText(text);
    if (Array.isArray(opened)) throw new Error(opened.join('; '));
    expect(opened.project.box.passiveRadiator.count.value).toBe(0);
    expect(opened.loadRepairs).toEqual([]);
    expect(told).not.toHaveBeenCalled();
  });

  it('a backup or archive entry read as project text (restore) keeps the count of 0 and reports nothing', () => {
    const {text} = zeroPrCountText('restored');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const project = repoOver({}, told).readProjectText(text);
    if (Array.isArray(project)) throw new Error(project.join('; '));
    expect(project.box.passiveRadiator.count.value).toBe(0);
    expect(told).not.toHaveBeenCalled();
  });

  it('a stored project whose series resistance is -2 Ω opens with -2 Ω and reports nothing (QO972)', () => {
    const {id, text} = minusTwoOhmText('negative rs');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const repo = repoOver({[OPENISD_PROJECTS_KEY]: JSON.stringify({version: 1, entries: [{id, text, modified: '2026-01-01T00:00:00Z'}]})}, told);
    const project = repo.loadStoredProject(id);
    if (project === null || Array.isArray(project)) throw new Error('expected a project');
    expect(project.Rs_ohm.value).toBe(-2);
    expect(told).not.toHaveBeenCalled();
  });
});

describe('projects saved before Chart from Fs, Vas, Qms', () => {
  function oldAlphaText(layout: number): string {
    const dump: unknown = JSON.parse(goldenText('one-project', `dump-layout-${layout}.json`));
    if (typeof dump !== 'object' || dump === null || !('openisd_state' in dump) || typeof dump.openisd_state !== 'string') {
      throw new Error('expected the old Alpha project');
    }
    return dump.openisd_state;
  }

  function alphaFromOldSave(): OpenISDProject {
    const project = OpenISDProject.fromOwprText(oldAlphaText(5), engine);
    if (Array.isArray(project)) throw new Error(project.join('; '));
    return project;
  }

  function openSavedAlpha(text: string, tell: (report: LoadRepairReport) => void): OpenISDProject {
    const id = '00000000-0000-4000-8000-000000000004';
    const storage = {[OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{id, text, modified: '2026-01-01T00:00:00Z'}]})};
    const repo = repoOver(storage, tell);
    const opened = repo.loadStoredProject(id);
    if (Array.isArray(opened)) throw new Error(opened.join('; '));
    return opened;
  }

  it.each([5, 6])('opens layout-%i Alpha with the typed parts and tells the user which readouts moved', (layout) => {
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const recorded = oldAlphaText(layout);
    expect(recorded).toContain('0.7101774159567577');
    const opened = openSavedAlpha(recorded, told);

    expect(opened.winisdChartFromFsVasQms.value).toBe(false);
    expect(opened.box.sealed.resonance_hz.value).toBeCloseTo(73.54, 2);
    expect(opened.box.sealed.q_tc.value).toBe(0.8193428312756991);
    expect(told).toHaveBeenCalledExactlyOnceWith({projectName: 'Alpha', lines: [
      'Calculated with your typed Mms, Cms and Rms: box resonance 67.5 -> 73.5 Hz, Qtc 0.71 -> 0.82',
    ]});
  });

  it('opens quietly when the typed parts agree with the old calculation', () => {
    const project = alphaFromOldSave();
    // The old chart's moving mass, mechanical loss and motor strength for Alpha.
    project.driver.specs.Mms_kg.set(0.060238515839677625);
    project.driver.specs.Rms_kg_per_s.set(4.635220849600864);
    project.driver.specs.BL_Tm.set(12.77340103128178);
    project.save();
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const opened = openSavedAlpha(project.toOwprText(), told);

    expect(opened.winisdChartFromFsVasQms.value).toBe(false);
    expect(opened.box.sealed.resonance_hz.value).toBeCloseTo(67.53, 2);
    expect(opened.box.sealed.q_tc.value).toBeCloseTo(0.710, 3);
    expect(told).not.toHaveBeenCalled();
  });

  it('keeps the old calculation quietly when the saved switch is ticked', () => {
    const project = alphaFromOldSave();
    project.winisdChartFromFsVasQms.set(true);
    project.save();
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const opened = openSavedAlpha(project.toOwprText(), told);

    expect(opened.winisdChartFromFsVasQms.value).toBe(true);
    expect(opened.box.sealed.resonance_hz.value).toBeCloseTo(67.53, 2);
    expect(opened.box.sealed.q_tc.value).toBeCloseTo(0.710, 3);
    expect(told).not.toHaveBeenCalled();
  });
});
