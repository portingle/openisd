import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { Air, IssueEngine, PrEngine, PrSpecIssue, PrSpecPrecision, PrSpecValues } from '../../engine/index.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { prSpec } from '../box/prSpec.js';
import { radiatorSection } from '../box/radiatorSection.js';
import { withDisagreementNote } from '../driver/disagreementNote.js';

/** The figures whose stated value must be above zero. */
const INVALID_CHECKED: readonly {readonly key: keyof PrSpecValues; readonly label: string}[] = Object.freeze([
    {key: 'Fs_hz', label: 'Fs'}, {key: 'Mms_kg', label: 'Mms'}, {key: 'Qms', label: 'Qms'}, {key: 'Vas_m3', label: 'Vas'},
    {key: 'Sd_m2', label: 'Sd'}, {key: 'Cms_m_per_N', label: 'Cms'}, {key: 'Rms_kg_per_s', label: 'Rms'},
]);

/**
 * ONE PASSIVE-RADIATOR SPEC SECTION, PUBLISHED — the radiator's counterpart to `DriverSpec`.
 *
 * A window onto the `passive-radiator` section of a device record, with every parameter that
 * section can carry. Separate from `DriverSpec` because a radiator has no motor: `Re`, `BL`,
 * `Qes`, `Znom`, `Pe` and the thermal parameters are not absent from it, they are meaningless to
 * it, and one shared class would have to model one of the two dishonestly.
 */
export class OpenIsdPassiveRadiatorSpec {
    readonly Fs_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qms: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Cms_m_per_N: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Mms_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rms_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Sd_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vas_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vd_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xmax_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xlim_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly DVol_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Thick_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Depth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Basket_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Outer_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterX_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterY_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly weight_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    constructor(
        slot: SimpleField<RadiatorDeviceJson>, conflicts: () => readonly PrSpecIssue[] = () => [],
        checkPositive?: IssueEngine['positiveValueIssue'],
    ) {
        const section = radiatorSection(slot);
        const marks = (name: keyof PrSpecValues) => (): readonly PrSpecIssue[] =>
            conflicts().filter(issue => issue.fields.some(field => field === name));
        this.Fs_hz = prSpec(section, 'Fs_hz', marks('Fs_hz'), checkPositive);
        this.Qms = prSpec(section, 'Qms', marks('Qms'), checkPositive);
        this.Cms_m_per_N = prSpec(section, 'Cms_m_per_N', marks('Cms_m_per_N'), checkPositive);
        this.Mms_kg = prSpec(section, 'Mms_kg', marks('Mms_kg'), checkPositive);
        this.Rms_kg_per_s = prSpec(section, 'Rms_kg_per_s', marks('Rms_kg_per_s'), checkPositive);
        this.Sd_m2 = prSpec(section, 'Sd_m2', marks('Sd_m2'), checkPositive);
        this.Vas_m3 = prSpec(section, 'Vas_m3', marks('Vas_m3'), checkPositive);
        this.Vd_m3 = prSpec(section, 'Vd_m3');
        this.Xmax_m = prSpec(section, 'Xmax_m');
        this.Xlim_m = prSpec(section, 'Xlim_m');
        this.Dd_m = prSpec(section, 'Dd_m');
        this.DVol_m3 = prSpec(section, 'DVol_m3');
        this.Thick_m = prSpec(section, 'Thick_m');
        this.Depth_m = prSpec(section, 'Depth_m');
        this.Basket_m = prSpec(section, 'Basket_m');
        this.Outer_m = prSpec(section, 'Outer_m');
        this.OuterX_m = prSpec(section, 'OuterX_m');
        this.OuterY_m = prSpec(section, 'OuterY_m');
        this.weight_kg = prSpec(section, 'weight_kg');
    }

    /** The Xmax this radiator has once picked into a project: its own, else its Xlim ("Xmech"). A
     *  radiator has no voice coil, so a record that states a mechanical limit and no Xmax has that
     *  limit as its Xmax (QO327). Null when the record has neither; the box's starting rule then applies. */
    get pickedXmax_m(): number | null {
        return this.Xmax_m.entered ? this.Xmax_m.value : (this.Xlim_m.entered ? this.Xlim_m.value : null);
    }

    /** The seven figures of the radiator's T/S set that were typed or loaded, without any that is not greater than zero. */
    #usableStated(): PrSpecValues {
        const invalid = new Set(this.invalidFigures.map(f => f.key));
        const stated = (key: keyof PrSpecValues): number | null => {
            const field = this[key];
            return field.entered && !invalid.has(key) ? field.value : null;
        };
        return {
            Fs_hz: stated('Fs_hz'), Mms_kg: stated('Mms_kg'), Qms: stated('Qms'), Vas_m3: stated('Vas_m3'),
            Sd_m2: stated('Sd_m2'), Cms_m_per_N: stated('Cms_m_per_N'), Rms_kg_per_s: stated('Rms_kg_per_s'),
        };
    }

    /** The T/S figures whose value, entered or calculated, is not a number above zero, each with its name for a sentence. */
    get invalidFigures(): readonly {readonly key: keyof PrSpecValues; readonly label: string}[] {
        return INVALID_CHECKED.filter(({key}) => {
            const value = this[key].value;
            return value !== null && (!Number.isFinite(value) || value <= 0);
        });
    }

    get hasInvalidFs(): boolean {
        return this.invalidFigures.some(f => f.key === 'Fs_hz');
    }

    get hasInvalidMms(): boolean {
        return this.invalidFigures.some(f => f.key === 'Mms_kg');
    }

    /** Work out usable figures without using a stated figure that is not above zero. */
    solveUsable(pr: PrEngine, air: Air): PrSpecValues {
        return pr.solveSpec(this.#usableStated(), air);
    }

    /** Each stated figure's own half-width, 0 for one not stated. */
    #precisions(): PrSpecPrecision {
        // An entered figure always states a width; `Number(null)` is 0 for the type's sake.
        const width = (f: Entered & Precise): number => f.entered ? Number(f.precision) : 0;
        return {
            Fs_hz: width(this.Fs_hz), Qms: width(this.Qms), Vas_m3: width(this.Vas_m3), Sd_m2: width(this.Sd_m2),
            Mms_kg: width(this.Mms_kg), Cms_m_per_N: width(this.Cms_m_per_N), Rms_kg_per_s: width(this.Rms_kg_per_s),
        };
    }

    /** Write every figure the stated ones derive onto its field as calculated, `air` being the
     *  project's, and return the stated figures that contradict each other. A stated figure is
     *  never touched; one nothing derives reads not-available. */
    resolve(pr: PrEngine, air: Air, preserveReadouts = false): PrSpecIssue[] {
        const stated = this.#usableStated();
        const solved = pr.solveSpec(stated, air);
        const invalid = new Set<keyof PrSpecValues>(this.invalidFigures.map(f => f.key));
        const write = (key: keyof PrSpecValues): void => {
            const field = this[key];
            if (field.entered || invalid.has(key)) return;
            if (preserveReadouts && field.calculated && (key === 'Fs_hz' || key === 'Mms_kg')) return;
            const value = solved[key];
            if (value === null) field.setNotAvailable(); else field.setCalculated(value);
        };
        for (const {key} of INVALID_CHECKED) write(key);
        return pr.checkSpec(stated, this.#precisions(), air).map(withDisagreementNote);
    }

    /** A record just adopted into a project: its Xlim becomes its Xmax when it has none. Every figure the datasheet states stays
     *  entered, Cms, Mms and Rms included, and the charts use them as the boxes show them (an entered value is never
     *  overwritten with a calculated value). Where they disagree with each other, every box in the disagreeing set is marked. */
    adoptDatasheetFigures(): void {
        const picked = this.pickedXmax_m;
        if (!this.Xmax_m.entered && picked !== null) this.Xmax_m.set(picked, this.Xlim_m.precision ?? undefined);
    }
}
