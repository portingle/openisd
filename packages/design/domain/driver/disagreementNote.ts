import type {CalculationIssue} from '../../engine/index.js';
import {disagreementText} from '../../fields/disagreementText.js';

/** The popup of a box whose value disagrees with the others in its relation (QO534, John 11 Nov 2026: "all get the mark"):
 *  Every box in the relation carries the same mark. The popup quotes the engine's gap.
 *  "Fs is 7.8% off from what Mms and Cms give: they give 48.83 Hz, the box says 45.00 Hz.
 *  Correct whichever is wrong, or clear one box and the app works it out from the others."
 *  Any other issue is returned as it is. */
export function withDisagreementNote<Q extends string>(issue: CalculationIssue<Q>): CalculationIssue<Q> {
    if (issue.kind !== 'inconsistent-inputs') return issue;
    return {...issue, text: disagreementText(issue)};
}
