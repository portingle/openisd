import {NumberField} from './field.js';

interface DisagreementDetails {
    readonly target: string;
    readonly fields: readonly string[];
    readonly formula: string;
    readonly gap: string;
    readonly expected: number;
    readonly actual: number;
}

/** A disagreement in the box's own labels and units. A single box carries its own guidance. */
export function disagreementText({target, fields, formula, gap, expected, actual}: DisagreementDetails, targetEntered: boolean): string {
    const others = fields.filter(name => name !== target).map(name => NumberField.named(name)?.label ?? name);
    if (others.length === 0) return formula;
    const names = others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`;
    const field = NumberField.named(target);
    // The BL note uses four significant figures, so 26.74834 Tm reads as 26.75 Tm.
    const maxSignificant = field === NumberField.BL_TM ? 4 : undefined;
    const value = (si: number): string => field === undefined
        ? String(si)
        : `${field.format(si, null, undefined, maxSignificant)} ${field.unitLabel()}`.trim();
    const actualText = targetEntered ? `The box shows ${value(actual)}.` : `The calculated value is ${value(actual)}.`;
    const guidance = targetEntered
        ? `Fix any incorrect value. To recalculate a value from the remaining inputs, empty its box.`
        : `Check the entered values used in the calculations.`;
    return `${field?.label ?? target} differs by ${gap}. Using ${names} gives ${value(expected)}. ${actualText} ${guidance}`;
}
