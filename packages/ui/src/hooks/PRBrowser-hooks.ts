import type {InjectionKey, Ref} from 'vue';
import {computed, ref, shallowRef} from 'vue';
import type {PassiveRadiatorStepCells} from './OriginalNewProject-hooks.js';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {useApp} from '../logic/app.js';
import {flashIfNoRoom} from '../logic/backupRefusal.js';
import {bundledPassiveRadiatorRows, type PassiveRadiatorRow, passiveRadiatorRows} from '../logic/driverDisplay.js';

export interface PRBrowserAPI {
  /** The "Define new passive radiator" editor's boxes: null while it is closed. */
  readonly defineCells: Readonly<Ref<PassiveRadiatorStepCells | null>>;
  /** Open the editor on a new blank radiator. */
  startDefine(): void;
  setDefineName(name: string): void;
  /** The editor's OK: files the radiator in My passive radiators (the project is not touched) and closes the editor. */
  confirmDefine(): void;
  /** The editor's Cancel: keeps nothing. */
  cancelDefine(): void;
  readonly filter: Ref<string>;
  readonly fSaved: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  readonly fBundled: Readonly<Ref<readonly ReturnType<typeof passiveRadiatorRows>[number][]>>;
  /** Why the bundled section is empty when the index could not be fetched; '' otherwise. */
  readonly bundledStatus: Readonly<Ref<string>>;
  /** The Favorites button: when on, both sections show only starred radiators. */
  readonly favoritesOnly: Readonly<Ref<boolean>>;
  isFavorite(id: string): boolean;
  /** Star or unstar a radiator by its row id; kept for the next session. */
  toggleFavorite(id: string): void;
  toggleFavoritesOnly(): void;
  remove(uuid: string): void;
  close(): void;
}

export const PRBrowserKey: InjectionKey<PRBrowserAPI> = Symbol('PRBrowserAPI');

export function usePRBrowser(emit: (event: 'close') => void): PRBrowserAPI {
  const { appState, myPassiveRadiators, bundledPassiveRadiators, prefs, logging } = useApp();
  const filter = ref('');

  const savedRows = ref(passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator }))));
  // The bundled section lists the catalogue index — rows keyed by record uuid, fetched when this
  // browser opens (the repo holds them after the first time). A fetch that fails is shown in the
  // section instead of an empty list.
  const bundledRows = ref<readonly PassiveRadiatorRow[]>([]);
  const bundledStatus = ref('');
  void bundledPassiveRadiators.index().then(
    rows => { bundledRows.value = bundledPassiveRadiatorRows(rows); },
    (err: Error) => { bundledStatus.value = err.message; });

  const favorites = ref<string[]>(prefs.favoritePassiveRadiators());
  const favoritesOnly = ref(false);
  const isFavorite = (id: string): boolean => favorites.value.includes(id);
  function toggleFavorite(id: string): void {
    favorites.value = isFavorite(id) ? favorites.value.filter(k => k !== id) : [...favorites.value, id];
    prefs.setFavoritePassiveRadiators(favorites.value);
  }
  function toggleFavoritesOnly(): void {
    favoritesOnly.value = !favoritesOnly.value;
  }

  const matching = <T extends { id: string; name: string }>(rows: readonly T[], q: string): readonly T[] =>
    rows.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!favoritesOnly.value || isFavorite(r.id)));

  const fSaved = computed(() => matching(savedRows.value, filter.value.trim().toLowerCase()));
  const fBundled = computed(() => matching(bundledRows.value, filter.value.trim().toLowerCase()));

  function remove(uuid: string): void {
    flashIfNoRoom(logging, myPassiveRadiators.remove(uuid));
    savedRows.value = passiveRadiatorRows(
      myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
  }

  function close(): void {
    emit('close');
  }

  // "Define new passive radiator": an editor on a blank radiator, as "Add new Driver" opens one. Only OK
  // files it, in My passive radiators; the project's radiator is never touched.
  const draft = shallowRef<OpenISDPassiveRadiatorStandalone | null>(null);
  const defineCells = computed<PassiveRadiatorStepCells | null>(() => {
    const d = draft.value;
    if (d === null) return null;
    const {spec} = d;
    return {
      Vas_m3: spec.Vas_m3, Qms: spec.Qms, Fs_hz: spec.Fs_hz, Sd_m2: spec.Sd_m2,
      Mms_kg: spec.Mms_kg, Cms_m_per_N: spec.Cms_m_per_N, Rms_kg_per_s: spec.Rms_kg_per_s, Xmax_m: spec.Xmax_m,
    };
  });
  function startDefine(): void { draft.value = OpenISDPassiveRadiatorStandalone.empty(appState.appContext); }
  function setDefineName(name: string): void { draft.value?.model.set(name); }
  function cancelDefine(): void { draft.value = null; }
  function confirmDefine(): void {
    const pr = draft.value;
    draft.value = null;
    if (pr === null) return;
    const saved = myPassiveRadiators.upsert(pr);
    if (saved === null) logging.flash('The passive radiator was not saved: your saved passive radiators cannot be written.');
    savedRows.value = passiveRadiatorRows(
      myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
  }

  return {
    defineCells, startDefine, setDefineName, confirmDefine, cancelDefine,
    filter,
    fSaved,
    fBundled,
    bundledStatus,
    favoritesOnly,
    isFavorite,
    toggleFavorite,
    toggleFavoritesOnly,
    remove,
    close,
  };
}
