import {END_CORRECTION_OPTIONS} from '@openisd/design/fields';

/** `options` with the value a file states added when the list does not offer it, so a drop-down shows what was loaded. */
export function withStatedOption<T extends {readonly value: number}>(options: readonly T[], stated: number | null, make: (stated: number) => T): readonly T[] {
  if (stated === null || options.some(option => option.value === stated)) return options;
  return [make(stated), ...options];
}

/** The port end-correction choices, with the end correction a file states when none of them is it. */
export function endCorrectionChoices(stated: number | null): readonly (typeof END_CORRECTION_OPTIONS)[number][] {
  return withStatedOption(END_CORRECTION_OPTIONS, stated, value => ({value, label: String(value), compactLabel: String(value)}));
}
