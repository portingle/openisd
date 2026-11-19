/**
 * The load repair of a passive radiator's figures (T930, ultra review finding 8). A radiator
 * record can state Fs, Qms, Vas, Sd, Mms (Mmd), Cms or Rms as 0, which no radiator has. John,
 * 18 Nov 2026 (QO953.c10-c26): a loaded impossible value is repaired automatically, and "a loaded
 * 0, in a field where 0 is impossible, counts as an empty box": a figure the app can calculate from
 * the others is recalculated, any other stays empty (a box the datasheet never states stays empty,
 * QO424). The box then shows that value with no data-quality mark, and only the opening message
 * names the repair.
 */
import {NumberField} from '../../fields/field.js';
import type {LoadRepairNote} from './loadRepair.js';
import type {OpenIsdPassiveRadiatorSpec} from '../passiveRadiator/openIsdPassiveRadiatorSpec.js';

/** The radiator figures a record states, with the field that names and formats each. */
const FIGURES = [
  {key: 'Fs_hz', field: NumberField.PR_FS_HZ},
  {key: 'Qms', field: NumberField.PR_QMS},
  {key: 'Vas_m3', field: NumberField.PR_VAS_L},
  {key: 'Sd_m2', field: NumberField.PR_SD_CM2},
  {key: 'Mms_kg', field: NumberField.MMS_KG},
  {key: 'Cms_m_per_N', field: NumberField.CMS_M_PER_N},
  {key: 'Rms_kg_per_s', field: NumberField.RMS_KG_PER_S},
] as const;

/** Empties every entered radiator figure that is 0, negative or not a number, and returns one note
 *  each. The caller resolves again, which recalculates what the other figures give. */
export function emptyBrokenRadiatorFigures(spec: OpenIsdPassiveRadiatorSpec): readonly LoadRepairNote[] {
  const notes: LoadRepairNote[] = [];
  for (const {key, field} of FIGURES) {
    const cell = spec[key];
    if (!cell.entered) continue;
    const v = cell.value;
    if (v === null || (Number.isFinite(v) && v > 0)) continue;
    cell.clear();
    notes.push({
      field, loaded: v, repaired: null,
      text: `Passive radiator ${field.label} ${field.toDisplay(v)} ${field.unitLabel()} in the file: treated as not stated (calculated from the radiator's other figures when they give it)`,
    });
  }
  return notes;
}
