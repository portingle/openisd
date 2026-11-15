/** Whether upgrading a stored project text changes anything a user designed (T827, QO940).
 *
 *  The two texts are compared field by field. Not counted: `schemaVersion`, `dq_calculated` (derived
 *  marks), the text's shape (indentation, key order), and a calculated value (`state: 'C'`, one the
 *  user never stated) that goes from a section with fewer than 2 coils, where it names nothing.
 *  Counted: every other difference, and any text that is not JSON. */
type Json = unknown;

const NEVER_COUNTED: ReadonlySet<string> = new Set(['schemaVersion', 'dq_calculated']);

function isRecord(v: Json): v is Readonly<Record<string, Json>> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCalculated(v: Json): boolean {
  return isRecord(v) && v.state === 'C';
}

/** A section with 2 or more coils: its calculated values (the wiring) decide how Re and BL are read. */
function isMultiCoil(section: Readonly<Record<string, Json>>): boolean {
  const numVC = section.numVC;
  return isRecord(numVC) && typeof numVC.value === 'number' && numVC.value >= 2;
}

function differs(before: Json, after: Json): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length !== after.length || before.some((item: Json, i) => differs(item, after[i]));
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (NEVER_COUNTED.has(key)) continue;
      if (!(key in after) && isCalculated(before[key]) && !isMultiCoil(before)) continue;
      if (differs(before[key], after[key])) return true;
    }
    return false;
  }
  return before !== after;
}

export function changesInSubstance(before: string, after: string): boolean {
  try {
    const parsedBefore: Json = JSON.parse(before);
    const parsedAfter: Json = JSON.parse(after);
    return differs(parsedBefore, parsedAfter);
  } catch {
    return true;
  }
}
