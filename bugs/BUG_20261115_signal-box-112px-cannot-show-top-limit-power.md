# The phone Signal tab's 112 px box cannot show the top limit of System input power (100000.00 W)

Found 15 Nov 2026 (T800). Two of John's rules disagree on the phone Signal tab.

- T720 (John, 8 Nov 2026): the Signal tab's number box is 60% of the 186 px a box had: 112 px, unit chip inside. T742 (10 Nov) meant to keep it so, but its share of a per-page label column gave 169 px, so the box was never 112 px after T742 and the spec `mobile-signal-box-width` has been red since.
- Longest-value rule (John, 10 Nov 2026, board; `layout-long-values.browser.spec.ts`): a box holds the longest value its field can show in any unit. At 112 px the text area is 54 px: System input power 100000.00 W is 71 px, and "1000.00" (Driver input voltage, Series resistance) is 55 px.

Chosen in T800 (to be confirmed by John): T720 stands, the box is a fixed 112 px (`PhoneRowColumns.SIGNAL_INPUT_PX`), and `tab-signal` is a known fault in `layout-long-values` like the Vb boxes.

The other option: a Signal box of at least 128 px (71 px of text, 16 px gutter, 40 px chip, a pixel to spare); then `mobile-signal-box-width.browser.spec.ts` and the Signal expectation in `compactFieldContract.ts` change to 128 and `tab-signal` leaves the known list.

Ask John: must 100000.00 W fit the Signal box, or is the 112 px box the rule?
