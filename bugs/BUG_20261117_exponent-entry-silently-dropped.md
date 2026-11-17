# BUG_20261117_exponent-entry-silently-dropped

**Status:** OPEN (T868)

## Symptom
Typing `1e9` into any number box: the `e` never appears (the box shows `19`), no mark, no note. A pasted or filled `1e9` is shown as "not a number".
The shared number parser (`parseEntry` in `packages/design/fields/dimensions.ts`) already reads `1e9`, `2.5E-3` and `1e+3` correctly, with the right precision.

## Cause
`NUMBER_TEXT` in `packages/design/fields/numberText.ts` (what a box accepts while typing) has no exponent part, so `typedEdit` refuses the key `e`; the box hook then reads the text with `parseFloat` after the same pattern.

## Fix
Accepted, not refused: `NUMBER_TEXT` allows an exponent, and a new design function `numberFromText` reads the box text (whole, with exponent) so the UI does no parsing. A half-typed exponent (`1e`) is marked "not a number" until finished.

## Tests
`packages/design/test/fields/numberText.test.ts`; `packages/ui/test/hooks/NumInput-hooks.test.ts`; `packages/ui/test/ui/driver-editor-refusal.browser.spec.ts`.
