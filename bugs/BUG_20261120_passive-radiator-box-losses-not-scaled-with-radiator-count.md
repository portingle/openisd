# Passive-radiator box losses fail to scale with the radiator count

**Status:** OPEN

## Symptom

With “PR Npr resonance” unticked, scaling the box volume and radiator count together changes the response shape and impedance. Halving both should double the entire acoustic load impedance and leave the shape unchanged in the half-volume Iso-Barik comparison.

## Steps to reproduce

1. Use `pr-w5-1.wpr` from `packages/design/test/winisd/fixtures/`. Compare one W5 driver at 20 V with a parallel-wired physical Iso-Barik pair at 20 V, half the box volume and half the effective radiator count. Select the `winisd` circuit model and turn all the switches in the combination test off.
2. Run `cd packages/design && npx vitest run test/engine/driver-array-physics-law-combinations.test.ts`. The cases titled `passive radiator: R4 Iso-Barik pair (response)` and `(impedance)` with `winisd, all off, physical pair, parallel` are expected failures. To see the values in the test output, run those cases as plain `it` locally.
3. At 5 Hz the pair reads 56.815 dB against the expected 57.252 dB, with 14.734 ms group delay against 10.483 ms and a phase error of 0.159 rad. The impedance magnitude misses by up to 5.97%. With “WinISD's Iso-Barik numbers” ticked the SPL is 50.795 dB against the expected 51.231 dB at 5 Hz.

## Cause

`PassiveRadiatorBox` sets the leak and absorption resistances from the product of the tuning angular frequency and one radiator's acoustic mass. With “PR Npr resonance” unticked, the tuning is physical but the resistances need the radiators' combined acoustic mass, which divides the one-radiator mass by the radiator count. With the switch ticked, WinISD's tuning frequency already includes the reciprocal count, giving the proportional scaling.

## Verification

The combination test records 51 response and 51 impedance cases for each of the four Iso-Barik mode and wiring combinations. With “PR Npr resonance” ticked, the radiator scaling checks pass. The ticked pair still has a separate [WinISD gyrator response defect](BUG_20261121_winisd-isobarik-inductance-changes-response-shape.md) in that circuit model.
