# BUG_20261118_phone-header-name-wraps-though-it-fits

**Status:** FIXED in T899

## Symptom
On the phone (390 x 844, Cloud sync on) a project named "AS168-9-470 closed" shows on two lines in the header ("AS168-9-470" / "closed").
Production 7.0.960 shows it on one line. Pictures: scratchpad/testsite_t892/prod_phone_03_edited_unsaved.png and test_phone_03_edited_unsaved.png.

## Cause
`MobileShell.vue` `.mob-project-title-text` got `padding-right: 1em` in T886 (PR 208, commit b2282f45, 18 Nov): room for the clamp's
ellipsis. It applied to every name, clamped or not, so a name that fitted the cell by under 12 px (108 px of text in a 118 px cell)
no longer fitted. T892 removed T886's other UI but not this padding.

## Fix
The padding applies only while the name is clamped: `hooks/clampRoom.ts` marks the text `clamped` when it overflows laid out without
the padding. A name too long for three lines keeps the room, so its ellipsis is still drawn (checked: without the padding the ellipsis is cut off).

## Verification
`mobile-header-name-one-line.browser.spec.ts`: failed before (2 lines), passes after; a too-long name still has 3 lines and the room.
