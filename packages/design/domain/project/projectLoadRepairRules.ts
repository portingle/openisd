/**
 * The load repair rules (`loadRepair.ts`) of a project record's own values (the drive level, driver count, series resistance and air are not repaired on load: QO972): the
 * active box's tunings, port lengths, losses and passive radiator. A box volume of 0 is not repaired:
 * it is how a built project holds a chamber nothing has designed yet (`ProjectBuilder.empty()`). Each rule is the
 * field's own `NumberField.loadRepair`; this file only says where in the record each field lives.
 *
 * QO953.c27-c32: a loaded impossible value is repaired automatically; a loaded
 * 0 where 0 is impossible counts as an empty box (as the same as clearing the value, c28): a field the app can calculate is calculated, the others get their minimum or default;
 * the box shows the repaired value with no data-quality mark and the opening toast lists it.
 */
import {NumberField} from '../../fields/field.js';
import {enteredEntry} from '../specEntry.js';
import {focus, simpleField} from '../cell.js';
import type {SimpleField} from '../cell.js';
import type {
    ChamberJson, OpenISDBoxJson, OpenISDProjectJson, SpecEntryJson, VentJson,
} from '../openisdSchema.js';
import {fieldLoadRule, repairLoaded} from './loadRepair.js';
import type {LoadRepairNote, LoadRepairRule} from './loadRepair.js';

/** A rule over a plain number slot: the field's repair always sets a number there. */
function numberRule(field: NumberField, slot: SimpleField<number>): LoadRepairRule {
    return fieldLoadRule(field, () => slot.value, v => {
        if (v === null) throw new Error(`${field.value} repairs to a number: its slot cannot be emptied`);
        slot.set(v);
    });
}

/** A rule over an entry slot: only an entered value is checked (a calculated one is worked out
 *  again by the resolve); emptied is the key absent, so the resolve calculates it or fills it. */
function entryRule(field: NumberField, slot: SimpleField<SpecEntryJson | undefined>): LoadRepairRule {
    return fieldLoadRule(field,
        () => {
            const entry = slot.value;
            return entry?.state === 'E' ? entry.value : null;
        },
        v => slot.set(v === null ? undefined : enteredEntry(v)));
}

/** A chamber's tuning (`tuning`: Fb, Ffc or Frc), paired with its port's length: an emptied tuning
 *  is worked out from the length the file gave, which becomes the entered side of the pair. */
function tuningRule(tuning: NumberField, goal: SimpleField<SpecEntryJson | undefined>, vent: SimpleField<VentJson>): LoadRepairRule {
    const length = focus(vent, 'length_m');
    return fieldLoadRule(tuning,
        () => {
            const entry = goal.value;
            return entry?.state === 'E' ? entry.value : null;
        },
        v => {
            goal.set(v === null ? undefined : enteredEntry(v));
            const stated = length.value;
            if (v === null && stated !== undefined && stated.state !== 'N' && stated.value > 0) length.set(enteredEntry(stated.value));
        });
}

/** A vented chamber and its port: the tuning, the losses and the port's length. The port's
 *  length runs first, so a negative one is emptied before the tuning could be worked out from it. */
function ventedChamberRules(chamber: SimpleField<ChamberJson>, vent: SimpleField<VentJson>, tuning: NumberField): LoadRepairRule[] {
    return [
        tuningRule(tuning, focus(chamber, 'tuning_goal_hz'), vent),
    ];
}

/** The rules of the box type the project is set to; the other types' records are not shown. */
function boxRules(box: SimpleField<OpenISDBoxJson>): LoadRepairRule[] {
    const type = box.value.boxType;
    switch (type) {
        case 'sealed': return [];
        case 'vented': {
            const vented = focus(box, 'vented');
            return ventedChamberRules(focus(vented, 'chamber'), focus(vented, 'vent'), NumberField.BOX_FB_HZ);
        }
        case 'bandpass4': {
            const bp = focus(box, 'bandpass4');
            return [
                ...ventedChamberRules(focus(bp, 'front'), focus(bp, 'frontVent'), NumberField.BOX_FFC_HZ),
            ];
        }
        case 'bandpass6': {
            const bp = focus(box, 'bandpass6');
            return [
                ...ventedChamberRules(focus(bp, 'rear'), focus(bp, 'rearVent'), NumberField.BOX_FRC_HZ),
                ...ventedChamberRules(focus(bp, 'front'), focus(bp, 'frontVent'), NumberField.BOX_FFC_HZ),
            ];
        }
        case 'abc': {
            const abc = focus(box, 'abc');
            return [
                ...ventedChamberRules(focus(abc, 'rear'), focus(abc, 'rearVent'), NumberField.BOX_FRC_HZ),
                ...ventedChamberRules(focus(abc, 'front'), focus(abc, 'frontVent'), NumberField.BOX_FFC_HZ),
                entryRule(NumberField.VENT_L_CM, focus(focus(abc, 'intraVent'), 'length_m')),
            ];
        }
        case 'box-passive-radiator': {
            const pr = focus(box, 'passiveRadiator');
            return [
                numberRule(NumberField.PR_NUM, focus(pr, 'count')),
                entryRule(NumberField.PR_MADD_G, focus(pr, 'addedMass_kg')),
            ];
        }
    }
}

/** Every record rule, in the order they run. The driver count, series
 *  resistance and air are not repaired: a loaded one is shown as the file states it (QO972). */
export function projectLoadRepairRules(root: SimpleField<OpenISDProjectJson>): readonly LoadRepairRule[] {
    return [
        ...boxRules(focus(root, 'box')),
    ];
}

/** A record as the load repair left it, and the repairs made. */
export interface RepairedRecord {
    readonly record: OpenISDProjectJson;
    readonly notes: readonly LoadRepairNote[];
}

/** `record` with every rule of `projectLoadRepairRules` applied, before any resolve has read it. */
export function repairedRecord(record: OpenISDProjectJson): RepairedRecord {
    let current = record;
    const notes = repairLoaded(projectLoadRepairRules(simpleField(() => current, v => { current = v; })));
    return {record: current, notes};
}
