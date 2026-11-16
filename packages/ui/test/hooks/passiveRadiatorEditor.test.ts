// The passive-radiator editor (John, 16 Nov 2026, QO946.c115): OK applies, Cancel discards, Save to My PRs files a copy.
import {describe, expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@openisd/persistence';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createPassiveRadiatorEditor} from '../../src/hooks/passiveRadiatorEditor.js';
import {myPassiveRadiatorRepoOn} from '../fixtures/repoOn.js';

function setUp() {
  const myPassiveRadiators = myPassiveRadiatorRepoOn(createMemoryStorage());
  const resolve = vi.fn();
  const editor = createPassiveRadiatorEditor({myPassiveRadiators, resolve});
  const source = OpenISDPassiveRadiatorStandalone.empty();
  source.model.set('Source PR');
  source.spec.Xmax_m.set(0.01);
  return {myPassiveRadiators, resolve, editor, source};
}

describe('createPassiveRadiatorEditor', () => {
  it('opens on a copy: typing changes the copy, never the radiator it came from', () => {
    const {editor, source, resolve} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    expect(editor.name.value).toBe('Source PR');
    expect(editor.cells.value?.Xmax_m.value).toBe(0.01);

    editor.cells.value?.Xmax_m.set(0.02);
    editor.setName('Changed');

    expect(resolve).toHaveBeenCalled();
    expect(editor.cells.value?.Xmax_m.value).toBe(0.02);
    expect(source.spec.Xmax_m.value).toBe(0.01);
    expect(source.model.value).toBe('Source PR');
    expect(apply).not.toHaveBeenCalled();
  });

  it('OK hands the edited radiator to apply and closes', () => {
    const {editor, source} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    editor.cells.value?.Xmax_m.set(0.02);
    editor.setName('Changed');

    editor.ok();

    expect(apply).toHaveBeenCalledTimes(1);
    const applied = apply.mock.calls[0]?.[0] as OpenISDPassiveRadiatorStandalone;
    expect(applied.model.value).toBe('Changed');
    expect(applied.spec.Xmax_m.value).toBe(0.02);
    expect(editor.cells.value).toBeNull();
  });

  it('Cancel keeps nothing', () => {
    const {editor, source, myPassiveRadiators} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    editor.setName('Thrown away');

    editor.cancel();

    expect(apply).not.toHaveBeenCalled();
    expect(editor.cells.value).toBeNull();
    expect(myPassiveRadiators.list()).toHaveLength(0);
  });

  it('Save to My PRs files a copy under its name, says so, and a second save updates that entry', () => {
    const {editor, source, myPassiveRadiators} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    editor.setName('Filed');

    editor.saveToMyPRs();
    editor.cells.value?.Xmax_m.set(0.03);
    editor.saveToMyPRs();

    const list = myPassiveRadiators.list();
    expect(list.map(e => e.passiveRadiator.model.value)).toEqual(['Filed']);
    expect(list[0]?.passiveRadiator.spec.Xmax_m.value).toBe(0.03);
    expect(editor.savedNote.value).toContain('Filed');
    expect(editor.savedRevision.value).toBe(2);
    expect(apply).not.toHaveBeenCalled();
    expect(editor.cells.value).not.toBeNull();
  });

  it('Save to My PRs needs a name', () => {
    const {editor, myPassiveRadiators} = setUp();
    editor.open(OpenISDPassiveRadiatorStandalone.empty(), 'Define new passive radiator', vi.fn());
    expect(editor.canSave.value).toBe(false);

    editor.saveToMyPRs();

    expect(myPassiveRadiators.list()).toHaveLength(0);
  });
});
