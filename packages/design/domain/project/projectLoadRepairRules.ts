/**
 * The load repair rules (`loadRepair.ts`) of a project record's own values. There are none: a loaded
 * value is shown as the file states it and the data-quality warning marks it where it is impossible (QO972).
 * A box volume of 0 is likewise left alone: it is how a built project holds a chamber nothing has designed yet
 * (`ProjectBuilder.empty()`).
 */
import {simpleField} from '../cell.js';
import type {OpenISDProjectJson} from '../openisdSchema.js';
import type {SimpleField} from '../cell.js';
import {repairLoaded} from './loadRepair.js';
import type {LoadRepairNote, LoadRepairRule} from './loadRepair.js';

/** Every record rule, in the order they run. No record value is repaired on load: the tunings, port
 *  lengths, losses, radiator figures and count, added mass, driver count, series resistance and air
 *  are all shown as the file states them, with the data-quality warning where the value is impossible (QO972). */
export function projectLoadRepairRules(root: SimpleField<OpenISDProjectJson>): readonly LoadRepairRule[] {
    void root;
    return [];
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
