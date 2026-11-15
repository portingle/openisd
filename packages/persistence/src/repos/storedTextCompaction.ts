/** REPO: rewrites the project texts browser storage holds — the saved projects, the open
 *  session, the autosave and the quarantine copy — as `compactedStoredText` writes them: one
 *  compact line, without `dq_calculated`, at the current schemaVersion. A text that is not a
 *  project, and an entry that will not read, stay as they are. Runs only when a text would change,
 *  so a store already current is not touched again.
 *
 *  No whole-store backup (T827, QO940; the reason is in the header of `storageBackup.ts`). Each key
 *  is written in place, whole, through `rewriteInPlace`: its old text is held until the new text
 *  reads back, and nothing else in the store is removed for room. A key that does not fit is
 *  written record by record, the records that shrink first. A record that still does not fit is
 *  left as saved and counted in `left`: it opens as before, upgraded in memory, and the next start
 *  tries it again.
 *
 *  Against a defect in an upgrade step, which a read-back cannot see, each project the upgrade changes
 *  in substance (`changesInSubstance`) first has its stored text kept as a refused copy
 *  (`beforeUpgrade`: listed on the Backups page, exportable as a project file). A project whose copy
 *  does not fit, or would take the store over `keepUseBelowChars`, is not rewritten: it stays as saved,
 *  counted in `left`. A project that only restamps or compacts needs no copy. A start interrupted between two writes leaves each key whole, old or new; the
 *  next start finds what is still to do from the stored texts. */
import {compactedStoredText} from '@openisd/design';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {StorageBackup} from './storageBackup.js';
import {changesInSubstance} from './upgradeSubstance.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from './storageKeys.js';

export type CompactionOutcome =
  | {readonly kind: 'nothingToDo'}
  /** `left`: project texts that did not fit and stay as saved; 0 when all were written. */
  | {readonly kind: 'rewritten'; readonly charsBefore: number; readonly charsAfter: number; readonly left: number}
  /** Nothing fit: every text that would change stays as saved, `left` of them. */
  | {readonly kind: 'left'; readonly left: number};

/** How many project texts the rewrite left as saved. */
export function projectTextsLeft(outcome: CompactionOutcome): number {
  return outcome.kind === 'nothingToDo' ? 0 : outcome.left;
}

/** Told, inside the backup, of each saved project whose text was rewritten: its id, its text before
 *  and after. Cloud sync hashes these texts, so it follows the rewrite and sees no edit. */
export type ProjectRewritten = (projectId: string, before: string, after: string) => void;

export interface StoredTextCompaction {
  run(): CompactionOutcome;
}

/** One entry of a record of entries whose text changes; `id` is null for an entry with none. */
interface EntryRewrite { readonly index: number; readonly id: string | null; readonly before: string; readonly after: string }
interface Rewrite {
  readonly key: string;
  /** The key holds one project text (the autosave), not entries. */
  readonly whole: boolean;
  readonly before: string;
  readonly after: string;
  /** The entries whose text changes, for a key of entries; none for the autosave. */
  readonly entries: readonly EntryRewrite[];
  /** The key's text with only the entries at these indexes rewritten. */
  readonly build: (indexes: ReadonlySet<number>) => string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A record of `{entries: [{text, ...}], ...}` with each readable entry's text compacted; null
 *  when nothing in it changes or it is not such a record. */
function compactedEntries(record: string): {readonly text: string; readonly entries: readonly EntryRewrite[]; readonly build: (indexes: ReadonlySet<number>) => string} | null {
  let parsed: unknown;
  try { parsed = JSON.parse(record); } catch { return null; }
  if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return null;
  const items: readonly unknown[] = parsed.entries;
  const rewritten: EntryRewrite[] = [];
  const entries = items.map((item, index): unknown => {
    if (!isRecord(item) || typeof item.text !== 'string') return item;
    const text = compactedStoredText(item.text);
    if (text === null || text === item.text) return item;
    rewritten.push({index, id: typeof item.id === 'string' ? item.id : null, before: item.text, after: text});
    return {...item, text};
  });
  if (rewritten.length === 0) return null;
  const build = (indexes: ReadonlySet<number>): string =>
    JSON.stringify({...parsed, entries: items.map((item, i) => indexes.has(i) ? entries[i] : item)});
  return {text: JSON.stringify({...parsed, entries}), entries: rewritten, build};
}

const ENTRY_RECORD_KEYS: readonly string[] = [OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY];

/** The project's name in a stored text, '' when it has none; what a kept copy is listed under. */
function nameOf(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && typeof parsed.label === 'string' ? parsed.label : '';
  } catch { return ''; }
}

/** `keepUseBelowChars`: a copy is kept only while the store, with it, holds no more than this. */
export function createStoredTextCompaction(storage: ListableStorage, backup: StorageBackup, projectRewritten: ProjectRewritten, keepUseBelowChars = Infinity): StoredTextCompaction {
  const useChars = (): number => storage.keys().reduce((sum, key) => sum + key.length + (storage.get(key)?.length ?? 0), 0);

  /** True when `entry` needs no copy, or its copy is kept now. */
  function protectedBy(entry: EntryRewrite): boolean {
    if (!changesInSubstance(entry.before, entry.after)) return true;
    if (useChars() + JSON.stringify(entry.before).length + 80 > keepUseBelowChars) return false;
    return backup.refuse('beforeUpgrade', nameOf(entry.before), entry.before);
  }

  function pending(): Rewrite[] {
    const rewrites: Rewrite[] = [];
    for (const key of ENTRY_RECORD_KEYS) {
      const before = storage.get(key);
      const compacted = before === null ? null : compactedEntries(before);
      if (before !== null && compacted !== null) rewrites.push({key, whole: false, before, after: compacted.text, entries: compacted.entries, build: compacted.build});
    }
    const autosave = storage.get(OPENISD_STATE_KEY);
    const compacted = autosave === null ? null : compactedStoredText(autosave);
    if (autosave !== null && compacted !== null && compacted !== autosave) {
      rewrites.push({key: OPENISD_STATE_KEY, whole: true, before: autosave, after: compacted, entries: [{index: -1, id: null, before: autosave, after: compacted}], build: () => compacted});
    }
    return rewrites;
  }

  /** `rewrite`'s key written one entry at a time, the entries that shrink first; the count left. */
  function writeByRecord(rewrite: Rewrite, entries: readonly EntryRewrite[]): number {
    const written = new Set<number>();
    let left = 0;
    for (const entry of [...entries].sort((a, b) => (a.after.length - a.before.length) - (b.after.length - b.before.length))) {
      if (backup.rewriteInPlace(rewrite.key, rewrite.build(new Set([...written, entry.index]))) === 'done') {
        written.add(entry.index);
        if (entry.id !== null && rewrite.key === OPENISD_PROJECTS_KEY) projectRewritten(entry.id, entry.before, entry.after);
      } else {
        left += 1;
      }
    }
    return left;
  }

  return {
    run() {
      const rewrites = pending();
      if (rewrites.length === 0) return {kind: 'nothingToDo'};
      let left = 0;
      let charsBefore = 0;
      let charsAfter = 0;
      let wrote = false;
      for (const rewrite of rewrites) {
        const allowed = rewrite.entries.filter(protectedBy);
        left += rewrite.whole ? (allowed.length === 0 ? 1 : 0) : rewrite.entries.length - allowed.length;
        if (allowed.length === 0) continue;
        const whole = backup.rewriteInPlace(rewrite.key, rewrite.build(new Set(allowed.map(entry => entry.index)))) === 'done';
        if (whole) {
          if (rewrite.key === OPENISD_PROJECTS_KEY) for (const entry of allowed) if (entry.id !== null) projectRewritten(entry.id, entry.before, entry.after);
        } else {
          left += rewrite.whole ? 1 : writeByRecord(rewrite, allowed);
        }
        if (whole || (storage.get(rewrite.key) ?? rewrite.before) !== rewrite.before) {
          wrote = true;
          charsBefore += rewrite.before.length;
          charsAfter += (storage.get(rewrite.key) ?? '').length;
        }
      }
      return wrote ? {kind: 'rewritten', charsBefore, charsAfter, left} : {kind: 'left', left};
    },
  };
}
