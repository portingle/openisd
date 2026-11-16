/**
 * The passive-radiator editor (John, 16 Nov 2026, QO946.c115): one editor, both skins, for the radiator's own figures
 * (name, Vas, Qms, Fs, Sd, Mms, Cms, Rms, Xmax). It edits a copy: OK hands the copy to whoever opened it (the project's
 * radiator, or the New Project wizard's), Cancel drops it, Save to My PRs files a copy in My passive radiators and leaves
 * the editor open. The build choices (count, added mass, tuning) are the project's, never here (QO946.c38).
 */
import {computed, ref, shallowRef, triggerRef} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import type {MyPassiveRadiatorRepo} from '@openisd/persistence';
import {type EnvironmentEngine, FixedAir, type PrEngine} from '@openisd/design/engine';
import type {ClearableUICell} from '../ui/components/uiFieldBinding.js';
import type {PassiveRadiatorStepCells} from './OriginalNewProject-hooks.js';

export interface PassiveRadiatorEditorDeps {
  readonly myPassiveRadiators: MyPassiveRadiatorRepo;
  /** Fills the figures the stated ones give; called after every typed figure. */
  resolve(pr: OpenISDPassiveRadiatorStandalone): void;
}

/** What OK does with the edited radiator. */
export type ApplyRadiator = (pr: OpenISDPassiveRadiatorStandalone) => void;

/** What the editor dialog binds: no domain value crosses into the component (A9). */
export interface PassiveRadiatorEditorView {
  /** The editor's figure boxes; null while the editor is closed. */
  readonly cells: Readonly<Ref<PassiveRadiatorStepCells | null>>;
  readonly title: Readonly<Ref<string>>;
  readonly name: Readonly<Ref<string>>;
  /** What the last Save to My PRs did, shown in the editor; null before a save. */
  readonly savedNote: Readonly<Ref<string | null>>;
  /** Save to My PRs needs a name: the radiator is filed and listed under it. */
  readonly canSave: ComputedRef<boolean>;
  /** Counts Save to My PRs writes, so a list of the library can re-read it. */
  readonly savedRevision: Readonly<Ref<number>>;
  setName(name: string): void;
  ok(): void;
  cancel(): void;
  saveToMyPRs(): void;
}

export interface PassiveRadiatorEditor extends PassiveRadiatorEditorView {
  /** Opens the editor on a copy of `source`; OK hands the edited copy to `apply`. */
  open(source: OpenISDPassiveRadiatorStandalone, title: string, apply: ApplyRadiator): void;
}

/** The engine areas the editor's calculated figures come from. */
export interface RadiatorEngineAreas {
  readonly pr: PrEngine;
  readonly environment: EnvironmentEngine;
}

/** Fills a radiator's calculated figures in the app's default air: a radiator's own figures belong to no project, as the
 *  New Project wizard's copy (OriginalNewProject-hooks `resolveCopy`). */
export function resolveInAppAir(engine: RadiatorEngineAreas): (pr: OpenISDPassiveRadiatorStandalone) => void {
  return pr => pr.resolve(engine.pr, new FixedAir(engine.environment.solve(engine.environment.defaults()).values));
}

type SpecCell = OpenISDPassiveRadiatorStandalone['spec']['Qms'];

export function createPassiveRadiatorEditor({myPassiveRadiators, resolve}: PassiveRadiatorEditorDeps): PassiveRadiatorEditor {
  const draft = shallowRef<OpenISDPassiveRadiatorStandalone | null>(null);
  const title = ref('');
  const savedNote = ref<string | null>(null);
  const savedRevision = ref(0);
  let apply: ApplyRadiator | null = null;
  /** The library entry this editing session filed, so a second save updates it rather than adding another. */
  let savedUuid: string | undefined;

  function cell(pr: OpenISDPassiveRadiatorStandalone, pick: (spec: OpenISDPassiveRadiatorStandalone['spec']) => SpecCell): ClearableUICell {
    const shown = () => pick(pr.spec);
    const settle = () => { resolve(pr); triggerRef(draft); };
    return {
      get name() { return shown().name; },
      get value() { return shown().value; },
      get provenance() { return shown().provenance; },
      get dq() { return shown().dq; },
      get mandatoryAndUnsatisfied() { return shown().mandatoryAndUnsatisfied; },
      get entered() { return shown().entered; },
      get precision() { return shown().precision; },
      set: (v, precision) => { shown().set(v, precision); settle(); },
      clear: () => { shown().clear(); settle(); },
    };
  }

  const cells = computed<PassiveRadiatorStepCells | null>(() => {
    const pr = draft.value;
    if (pr === null) return null;
    return {
      Vas_m3: cell(pr, s => s.Vas_m3), Qms: cell(pr, s => s.Qms), Fs_hz: cell(pr, s => s.Fs_hz), Sd_m2: cell(pr, s => s.Sd_m2),
      Mms_kg: cell(pr, s => s.Mms_kg), Cms_m_per_N: cell(pr, s => s.Cms_m_per_N), Rms_kg_per_s: cell(pr, s => s.Rms_kg_per_s),
      Xmax_m: cell(pr, s => s.Xmax_m),
    };
  });
  const name = computed(() => draft.value?.model.value ?? '');
  const canSave = computed(() => name.value.trim() !== '');

  function close(): void { draft.value = null; apply = null; savedUuid = undefined; savedNote.value = null; }

  return {
    cells, title, name, savedNote, canSave, savedRevision,
    open(source, heading, onOk) {
      const copy = OpenISDPassiveRadiatorStandalone.wrap(source.clonePassiveRadiator());
      resolve(copy);
      close();
      title.value = heading;
      apply = onOk;
      draft.value = copy;
    },
    setName(text) {
      const pr = draft.value;
      if (pr === null) return;
      pr.model.set(text);
      triggerRef(draft);
    },
    ok() {
      const pr = draft.value;
      const onOk = apply;
      close();
      if (pr !== null && onOk !== null) onOk(pr);
    },
    cancel: close,
    saveToMyPRs() {
      const pr = draft.value;
      if (pr === null || !canSave.value) return;
      const copy = OpenISDPassiveRadiatorStandalone.wrap(pr.clonePassiveRadiator());
      copy.model.set(name.value.trim());
      const result = myPassiveRadiators.upsert(copy, savedUuid);
      if (result === null) {
        savedNote.value = 'Not saved: your saved passive radiators cannot be written.';
        return;
      }
      savedUuid = result.uuid;
      savedNote.value = `Saved "${name.value.trim()}" in My passive radiators.`;
      savedRevision.value++;
    },
  };
}
