// The phone What-if sheet's number boxes (QO536, John 11 Nov 2026: "the numpad coming up on the
// mobile what if is inconvenient"): a quick tap picks a digit to spin and opens no keypad; a press
// held for `holdToTypeMs` switches that box to typing, with the keypad; leaving the box goes back.

import type {InjectionKey} from 'vue';

/** Provided by a container whose number boxes tap to spin and hold to type. */
export interface TapToSpin {
  /** How long a press is held before the box switches to typing. */
  readonly holdToTypeMs: number;
  /** The person spun a digit or switched a box to typing: the first-time hint has done its job. */
  used(): void;
}

/** Null (the default everywhere else): a tap focuses the box and opens the keypad. */
export const TAP_TO_SPIN: InjectionKey<TapToSpin | null> = Symbol('openisd.tapToSpin');
