/**
 * Passive-radiator actions on the PR page (Enclosure tab, PR box type) — loading a saved PR or a
 * bundled catalogue entry, the passive-radiator editor (Edit, and the Select popup's Define new), and saving a copy of
 * the page's PR to My passive radiators under a name confirmed in a dialog.
 * Skin-neutral: shared by every shell's PR page (one implementation, two presentations).
 */
import {computed, ref} from 'vue';
import type {ComputedRef} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {SaveNameField} from './saveNameField.js';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';
import type {RadiatorPicks} from '../logic/telemetry/radiatorPick.js';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createPassiveRadiatorEditor, type RadiatorEngineAreas, resolveInAppAir} from './passiveRadiatorEditor.js';

export interface PassiveRadiatorActionsDeps {
  project: ComputedRef<OpenISDProject>;
  myPassiveRadiators: MyPassiveRadiatorRepo;
  bundledPassiveRadiators: BundledPassiveRadiatorRepo;
  /** Told which radiator the user loaded, for usage statistics. */
  radiatorPicks: RadiatorPicks;
  /** Where the editor's calculated figures come from. */
  engine: RadiatorEngineAreas;
}

export function createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators, radiatorPicks, engine }: PassiveRadiatorActionsDeps) {
  const prBrowseOpen = ref(false);
  function loadPREntry(uuid: string) {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (!entry) return;
    project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
    radiatorPicks.saved();
    prBrowseOpen.value = false;
  }
  async function loadBundledPassiveRadiatorEntry(uuid: string): Promise<void> {
    const pr = await bundledPassiveRadiators.load(uuid);
    project.value.box.passiveRadiator.configurePR(pr);
    radiatorPicks.bundled(uuid);
    prBrowseOpen.value = false;
  }
  // ---- The passive-radiator editor (John, 16 Nov 2026, QO946.c115) -----------------------------------------------
  // Edits a copy of the radiator; OK puts it in the project's box as edited (nothing stated is dropped), Cancel keeps
  // nothing. The project's count, added mass and tuning are not the radiator's and are not touched (QO946.c38).
  const prEditor = createPassiveRadiatorEditor({ myPassiveRadiators, resolve: resolveInAppAir(engine) });
  const useRadiator = (pr: OpenISDPassiveRadiatorStandalone): void => { project.value.box.passiveRadiator.holdEditedPR(pr); };
  function startEditPR(): void {
    prEditor.open(project.value.box.passiveRadiator.radiator.detach(), 'Edit passive radiator', useRadiator);
  }
  /** The Select popup's "+ Define new passive radiator": the editor on a blank radiator; OK makes it the project's and
   *  closes the popup. */
  function defineNewPREntry(): void {
    prEditor.open(OpenISDPassiveRadiatorStandalone.empty(), 'Define new passive radiator', pr => {
      useRadiator(pr);
      prBrowseOpen.value = false;
    });
  }
  // ---- Save to library: a dialog confirms the name, then a detached copy is saved -------------
  // John, 2026-10-05: the dialog's name names only the library entry. The project's radiator is
  // never touched; the saved entry is a deep copy, so later edits to either leave the other alone.
  // Entries are keyed by identity, not name (as My Drivers, QO81): a name already in the library
  // saves a second entry beside it and overwrites nothing.
  const prSaveOpen = ref(false);
  const prSaveName = ref('');
  const prSaveCanSave = computed(() => prSaveName.value.trim() !== '');
  const prSaveFields: readonly SaveNameField[] = [
    { label: 'Name', placeholder: 'Passive radiator name', text: prSaveName, inputClass: 'pr-save-name' },
  ];
  function openPRSave(): void {
    prSaveName.value = project.value.box.passiveRadiator.radiator.model.value;
    prSaveOpen.value = true;
  }
  function cancelPRSave(): void {
    prSaveOpen.value = false;
  }
  function confirmPRSave(): void {
    if (!prSaveCanSave.value) return;
    const copy = project.value.box.passiveRadiator.radiator.detach();
    copy.model.set(prSaveName.value.trim());
    myPassiveRadiators.upsert(copy);
    prSaveOpen.value = false;
  }
  return {
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry,
    prEditor, startEditPR, defineNewPREntry,
    prSaveOpen, prSaveName, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
  };
}
