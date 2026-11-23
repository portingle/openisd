import type {CalculationIssue} from '../../engine/index.js';
import {disagreementText} from '../../fields/disagreementText.js';

/** The popup of a box whose value disagrees with the others in its relation (QO534):
 *  Every box in the relation carries the same mark. The popup quotes the engine's gap.
 *  It gives the percentage gap, what the other boxes give and what this box says, then tells the user to correct
 *  whichever is wrong or clear one box.
 *  Any other issue is returned as it is. */
export function withDisagreementNote<Q extends string>(issue: CalculationIssue<Q>): CalculationIssue<Q> {
    if (issue.kind !== 'inconsistent-inputs') return issue;
    return {...issue, text: disagreementText(issue)};
}
