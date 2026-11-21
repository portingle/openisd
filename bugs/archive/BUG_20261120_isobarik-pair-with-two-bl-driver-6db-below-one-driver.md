# Iso-Barik combination test expected the wrong SPL and excursion

**Status:** RESOLVED by the Iso-Barik combination guardrail update (T939).

## Fix

John chose “A: real physics by default (box unticked)” on 20 Nov 2026 at 02:25 UTC in the Iso-Barik ruling QO964. He added “the real physics by default was approved by me months ago”. The combination test now checks the coil wiring's physics when unticked and WinISD's captured curves when ticked.

## Verification

Both wiring selections pass the response and impedance checks against the sealed W5 captures with WinISD's numbers ticked. At 1998.9 Hz the captures differ by −6.030949 dB and show 3.4032047 Ω for one driver and 3.4031971 Ω for the pair. The default physical pair is checked in both parallel and series across all six box types. Remaining engine failures have their own records for [passive-radiator losses](../BUG_20261120_passive-radiator-box-losses-not-scaled-with-radiator-count.md) and the [WinISD gyrator's pair response](../BUG_20261121_winisd-isobarik-inductance-changes-response-shape.md).
