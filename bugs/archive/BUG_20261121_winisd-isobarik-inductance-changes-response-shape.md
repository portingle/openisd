# WinISD gyrator gives an Iso-Barik pair additional inductance roll-off

**Status:** RESOLVED — confirmed WinISD behavior

## Resolution

WinISD itself gives the Iso-Barik pair extra roll-off with voice-coil inductance enabled. The WinISD debugger captures in
`winisd_research` commit `159e1f2` use the W5-1138SMF, 1 W, 0.1 Ω source resistance and 0.34 mH voice-coil inductance.
In the 4.48 L sealed box, the pair's SPL relative to one driver was −6.02 dB near 200 Hz, −8.77 dB near 1 kHz,
−10.67 dB near 2 kHz and −11.77 dB near 5 kHz. The excursion ratio near 2 kHz was 0.293. In the 2.24 L half-box
comparison, the SPL gap was already −6.020805 dB at 1 Hz and reached −10.660461 dB near 2 kHz. The half-box pair
and the single driver had equal terminal impedance.

With “WinISD's Iso-Barik numbers” ticked, OpenISD matches WinISD on SPL, excursion, impedance magnitude and impedance
phase across all 1,378 points per capture in seven runs covering sealed, sealed half volume, vented and 4th-order
bandpass designs. The largest absolute difference in the comparison report was 4.59e-12 mm in excursion.
[WinISD capture commit](https://github.com/Johnlon/winisd_research/commit/159e1f2fbf4d8e9f71eaa30fe8e5b668ef99a646)

John's Iso-Barik ruling QO964, “A: real physics by default (box unticked)”, calls for the physical pair law when
unticked and the captured WinISD response when ticked. The guardrail checks the ticked half-volume response law with
inductance off in the affected matrix cases, keeps their terminal-impedance checks with inductance on, and compares the
ticked engine with the four captured charts when inductance is on. The unticked physical pair is checked at every
frequency with the original inductance settings.

## Symptom

With “WinISD's Iso-Barik numbers” ticked, the WinISD gyrator rolls off the pair earlier than one driver in twice the box volume. The half-volume comparison expects half the cone motion and pressure with the same response shape.

## Original guardrail failure

1. Use `sealed-w5-nd2.wpr` from `packages/design/test/winisd/fixtures/`. Compare one W5 driver and one Iso-Barik pair at 20 V with the pair in half the volume. Select the `winisdGyrator` circuit model, tick “WinISD's Iso-Barik numbers”, and turn the other switches in the combination test off.
2. Run `cd packages/design && npx vitest run test/engine/driver-array-physics-law-combinations.test.ts`. The case titled `sealed: R4 Iso-Barik pair (response), winisdGyrator, all off, WinISD numbers, parallel` is an expected failure. To see the values in the test output, run that case as a plain `it` locally.
3. At 2 kHz the pair reads 87.080924 dB. The one-driver response minus 6.020600 dB calls for 91.657865 dB. The pair also has a 40.96% excursion shortfall at that frequency. The half-volume terminal impedance comparison passes for this setup.

## Cause

`SimulationEngine` derives the pair's `BL_Qes_Tm` from the compound suspension while the entered push BL remains one driver's. `circuit.ts` applies the square of their ratio to the inductance in the acoustic circuit. This doubles that multiplier for the pair. The impedance chart receives the unscaled inductance, so its magnitude and phase can agree while the acoustic curves diverge. The sealed W5 captures used in the original test had inductance off.

## Original test coverage

The combination test recorded 228 expected failures across both wiring selections and all six boxes. That count included
34 cases previously affected by the [passive-radiator loss defect](BUG_20261120_passive-radiator-box-losses-not-scaled-with-radiator-count.md).
The `winisd` and `gyrator` circuit models, the default physical pair, and terminal impedance had separate assertions.
