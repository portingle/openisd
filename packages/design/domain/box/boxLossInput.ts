import type {DqIssue, Engine} from '../../engine/index.js';
import {NumberField} from '../../fields/field.js';
import {WINISD_BOX_LOSSES} from '../boxDefaults.js';

const LOSS_FIELDS = Object.freeze({
    Ql: NumberField.LOSS_QL,
    Qa: NumberField.LOSS_QA,
    Qp: NumberField.LOSS_QP,
    Qicl: NumberField.LOSS_QICL,
});

/** The working loss and the warning that explains it on the field and on charts. */
export function boxLossInput(issues: Engine['issues'], key: keyof typeof LOSS_FIELDS, stated: number): {value: number; dq: readonly DqIssue[]} {
    const issue = issues.positiveValueIssue(stated);
    if (issue === null) return {value: stated, dq: []};
    const value = WINISD_BOX_LOSSES[key];
    return {value, dq: [{...issue, text: `${LOSS_FIELDS[key].label} must be greater than zero. Charts are calculated using ${value}.`}]};
}
