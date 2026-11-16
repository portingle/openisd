import {describe, expect, it, vi} from 'vitest';
import {computed} from 'vue';
import {createPassiveRadiatorActions} from '../../src/hooks/passiveRadiatorActions.js';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '@openisd/design';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';
import type {RadiatorPicks} from '../../src/logic/telemetry/radiatorPick.js';

function fakeMyPassiveRadiators(): MyPassiveRadiatorRepo {
  return {
    read: () => ({ kind: 'ok', passiveRadiators: [], broken: [] }),
    list: vi.fn(() => []),
    replaceAll: () => 'done',
    upsert: vi.fn(() => ({ uuid: 'pr-1', overwrote: false })),
    remove: vi.fn((): 'done' => 'done'),
    removeBroken: () => 'done',
    exportRaw: () => null,
    deleteAll: () => 'done',
  };
}

function setUp(bundled: OpenISDPassiveRadiatorStandalone = OpenISDPassiveRadiatorStandalone.empty()) {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.box.boxType.set('box-passive-radiator');
  const myPassiveRadiators = fakeMyPassiveRadiators();
  const bundledPassiveRadiators: BundledPassiveRadiatorRepo = {
    index: vi.fn(async () => []),
    load: vi.fn(async () => bundled),
  };
  const radiatorPicks: RadiatorPicks = { bundled: vi.fn(), saved: vi.fn() };
  const actions = createPassiveRadiatorActions({ project: computed(() => project), myPassiveRadiators, bundledPassiveRadiators, radiatorPicks, engine });
  return { project, myPassiveRadiators, actions, radiatorPicks };
}

describe('createPassiveRadiatorActions', () => {
  // John, 16 Nov 2026 (QO946.c115): one passive-radiator editor; OK applies the edits to the project's radiator.
  it('Edit opens the editor on the project\'s radiator; OK puts the edits in the project, the build choices untouched', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    project.box.passiveRadiator.count.set(2);

    actions.startEditPR();
    expect(actions.prEditor.name.value).toBe('Bench PR');
    actions.prEditor.setName('Edited PR');
    actions.prEditor.cells.value?.Xmax_m.set(0.015);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
    actions.prEditor.ok();

    expect(project.box.passiveRadiator.radiator.model.value).toBe('Edited PR');
    expect(project.box.passiveRadiator.radiator.spec.Xmax_m.value).toBe(0.015);
    expect(project.box.passiveRadiator.count.value).toBe(2);
  });

  it('Edit then Cancel leaves the project\'s radiator as it was', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    actions.startEditPR();
    actions.prEditor.setName('Thrown away');
    actions.prEditor.cancel();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
  });

  it('Define new opens the editor on a blank radiator; OK makes it the project\'s and closes the Select popup', () => {
    const { project, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('Bench PR');
    actions.prBrowseOpen.value = true;

    actions.defineNewPREntry();
    expect(actions.prEditor.name.value).toBe('');
    expect(actions.prBrowseOpen.value).toBe(true);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Bench PR');
    actions.prEditor.setName('New PR');
    actions.prEditor.ok();

    expect(project.box.passiveRadiator.radiator.model.value).toBe('New PR');
    expect(actions.prBrowseOpen.value).toBe(false);
  });

  // John, 2026-10-05: "Save PR to library needs to ask for a name confirmation dialog."
  it('opening Save to library prefills the name with the page\'s passive radiator name and saves nothing yet', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');

    actions.openPRSave();

    expect(actions.prSaveOpen.value).toBe(true);
    expect(actions.prSaveName.value).toBe('My bench PR');
    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
  });

  // John, 2026-10-05: the dialog's name names only the library entry. Save clones the project's
  // radiator, names the clone, and saves the clone; the project's radiator is never touched.
  it('Save stores a copy under the typed name and leaves the project\'s passive radiator unchanged', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    actions.openPRSave();

    actions.prSaveName.value = '  Bench PR 2  ';
    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(myPassiveRadiators.upsert).mock.calls[0][0];
    expect(saved.model.value).toBe('Bench PR 2');
    expect(vi.mocked(myPassiveRadiators.upsert).mock.calls[0][1]).toBeUndefined();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('My bench PR');
    expect(actions.prSaveOpen.value).toBe(false);
  });

  it('the saved copy and the project\'s passive radiator share nothing: editing one leaves the other alone', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    project.box.passiveRadiator.radiator.spec.Qms.set(5);
    actions.openPRSave();
    actions.prSaveName.value = 'Library PR';
    actions.confirmPRSave();
    const saved = vi.mocked(myPassiveRadiators.upsert).mock.calls[0][0];

    project.box.passiveRadiator.radiator.spec.Qms.set(9);
    project.box.passiveRadiator.radiator.model.set('Renamed on page');
    expect(saved.spec.Qms.value).toBe(5);
    expect(saved.model.value).toBe('Library PR');

    saved.spec.Qms.set(3);
    saved.model.set('Renamed in library');
    expect(project.box.passiveRadiator.radiator.spec.Qms.value).toBe(9);
    expect(project.box.passiveRadiator.radiator.model.value).toBe('Renamed on page');
  });

  it('Cancel closes the dialog and saves nothing', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    project.box.passiveRadiator.radiator.model.set('My bench PR');
    actions.openPRSave();
    actions.prSaveName.value = 'Other name';

    actions.cancelPRSave();

    expect(actions.prSaveOpen.value).toBe(false);
    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
    expect(project.box.passiveRadiator.radiator.model.value).toBe('My bench PR');
  });

  it('an empty name cannot be saved', () => {
    const { myPassiveRadiators, actions } = setUp();
    actions.openPRSave();
    actions.prSaveName.value = '   ';

    expect(actions.prSaveCanSave.value).toBe(false);
    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).not.toHaveBeenCalled();
    expect(actions.prSaveOpen.value).toBe(true);
  });

  // Same as My Drivers (QO81): entries are keyed by identity, not name, so a name already in the
  // library saves a second entry beside it and overwrites nothing; there is no overwrite question.
  it('a name already in the library saves a new entry and overwrites nothing', () => {
    const { project, myPassiveRadiators, actions } = setUp();
    const existing = project.box.passiveRadiator.radiator.detach();
    existing.model.set('Bench PR');
    vi.mocked(myPassiveRadiators.list).mockReturnValue([{ uuid: 'pr-old', passiveRadiator: existing }]);
    actions.openPRSave();
    actions.prSaveName.value = 'Bench PR';

    actions.confirmPRSave();

    expect(myPassiveRadiators.upsert).toHaveBeenCalledTimes(1);
    expect(vi.mocked(myPassiveRadiators.upsert).mock.calls[0][1]).toBeUndefined();
  });

  it('loading a bundled passive radiator closes the browser and opens no editor', async () => {
    const { actions } = setUp();
    actions.prBrowseOpen.value = true;

    await actions.loadBundledPassiveRadiatorEntry('nd140');

    expect(actions.prBrowseOpen.value).toBe(false);
    expect(Object.keys(actions)).not.toContain('prEditOpen');
  });

  // John, 10 Nov 2026: "also record the pr picked either on Wiz or in main".
  it('loading a bundled passive radiator on the box page counts it as a bundled pick', async () => {
    const { actions, radiatorPicks } = setUp();
    await actions.loadBundledPassiveRadiatorEntry('nd140');
    expect(radiatorPicks.bundled).toHaveBeenCalledWith('nd140');
    expect(radiatorPicks.saved).not.toHaveBeenCalled();
  });

  it('loading a saved passive radiator on the box page counts it as my pick', () => {
    const { actions, myPassiveRadiators, radiatorPicks } = setUp();
    vi.mocked(myPassiveRadiators.list).mockReturnValue([{ uuid: 'mine-1', passiveRadiator: OpenISDPassiveRadiatorStandalone.empty() }]);
    actions.loadPREntry('mine-1');
    expect(radiatorPicks.saved).toHaveBeenCalledTimes(1);
    expect(radiatorPicks.bundled).not.toHaveBeenCalled();
  });
});
