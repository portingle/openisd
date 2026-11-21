# Passive-radiator box losses fail to scale with the radiator count

**Status:** RESOLVED by the passive-radiator loss-mass fix in the driver-array guardrail task (T939).

## Symptom

With “PR Npr resonance” unticked, scaling the box volume and radiator count together changes the response shape and impedance. Halving both should double the entire acoustic load impedance and leave the shape unchanged in the half-volume Iso-Barik comparison.

## Reproduction before the fix

1. Use `pr-w5-1.wpr` from `packages/design/test/winisd/fixtures/`. Compare one W5 driver at 20 V with a parallel-wired physical Iso-Barik pair at 20 V, half the box volume and half the effective radiator count. Select the `winisd` circuit model and turn all the switches in the combination test off.
2. Run `cd packages/design && npx vitest run test/engine/driver-array-physics-law-combinations.test.ts`. The cases titled `passive radiator: R4 Iso-Barik pair (response)` and `(impedance)` with `winisd, all off, physical pair, parallel` are expected failures. To see the values in the test output, run those cases as plain `it` locally.
3. At 5 Hz the pair reads 56.815 dB against the expected 57.252 dB, with 14.734 ms group delay against 10.483 ms and a phase error of 0.159 rad. The impedance magnitude misses by up to 5.97%. With “WinISD's Iso-Barik numbers” ticked the SPL is 50.795 dB against the expected 51.231 dB at 5 Hz.

## Cause

`PassiveRadiatorBox` used one radiator's acoustic mass for both leak and absorption. The unticked formula paired that mass with the physical tuning angular frequency. This made the resistances too large by the radiator count.

## Fix

`PassiveRadiatorBox` uses the combined acoustic mass of the parallel radiators for leakage and absorption with “PR Npr resonance” unticked. With the switch ticked, it uses one radiator's acoustic mass and WinISD's angular frequency. WinISD's frequency is lower by the radiator count and its loss mass is larger by the same factor, so both settings give the same resistances in exact arithmetic.

## Verification

With one active driver, two radiators each having half the area, half the moving mass, twice the compliance and half the damping present the same combined acoustic load as one radiator. With Ql 7 and Qa 30, the regression compares complex pressure and impedance magnitude and phase at all 121 frequencies from 2 to 500 Hz. It failed on complex pressure at 2 Hz before the fix and all points match exactly with the fix.

The driver-array combination test now passes 374 formerly expected failures as ordinary tests. At the time of the loss fix, the 34 response cases that also exercised the [WinISD gyrator's extra Iso-Barik inductance](BUG_20261121_winisd-isobarik-inductance-changes-response-shape.md) were still expected failures.
