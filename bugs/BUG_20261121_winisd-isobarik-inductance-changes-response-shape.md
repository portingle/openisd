# WinISD gyrator gives an Iso-Barik pair additional inductance roll-off

**Status:** OPEN

## Symptom

With “WinISD's Iso-Barik numbers” ticked, the WinISD gyrator rolls off the pair earlier than one driver in twice the box volume. The half-volume comparison expects half the cone motion and pressure with the same response shape.

## Steps to reproduce

1. Use `sealed-w5-nd2.wpr` from `packages/design/test/winisd/fixtures/`. Compare one W5 driver and one Iso-Barik pair at 20 V with the pair in half the volume. Select the `winisdGyrator` circuit model, tick “WinISD's Iso-Barik numbers”, and turn the other switches in the combination test off.
2. Run `cd packages/design && npx vitest run test/engine/driver-array-physics-law-combinations.test.ts`. The case titled `sealed: R4 Iso-Barik pair (response), winisdGyrator, all off, WinISD numbers, parallel` is an expected failure. To see the values in the test output, run that case as a plain `it` locally.
3. At 2 kHz the pair reads 87.080924 dB. The one-driver response minus 6.020600 dB calls for 91.657865 dB. The pair also has a 40.96% excursion shortfall at that frequency. The half-volume terminal impedance comparison passes for this setup.

## Cause

`SimulationEngine` derives the pair's `BL_Qes_Tm` from the compound suspension while the entered push BL remains one driver's. `circuit.ts` applies the square of their ratio to the inductance in the acoustic circuit. This doubles that multiplier for the pair. The impedance chart receives the unscaled inductance, so its magnitude and phase can agree while the acoustic curves diverge. WinISD parity with voice-coil inductance on is unverified. The sealed W5 captures used in the test have inductance off and pass.

## Verification

The combination test records 228 response cases across both wiring selections and all six boxes. Of these, 34 also exercise the [passive-radiator loss defect](BUG_20261120_passive-radiator-box-losses-not-scaled-with-radiator-count.md). The `winisd` and `gyrator` circuit models, the default physical pair, and the impedance part have separate assertions.
