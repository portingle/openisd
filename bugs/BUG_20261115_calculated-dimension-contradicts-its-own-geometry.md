# BUG_20261115_calculated-dimension-contradicts-its-own-geometry

**Status:** FIXED by T821

## Symptom
Purifi PTT10.0X04-NAB-01 and PTT10.0X08-NAB-01, a 10 inch driver 145 mm deep, show a magnet depth (MagDepth) of 3.98 m, calculated.

## Steps to reproduce
1. Leave MagDepth blank and enter what Purifi's page prints: Sd 360 cm2 (Dd 0.214 m), Vcd 52 mm, DVol 1.40 L, Depth 145 mm,
   Magnet 140 mm. Or read `winisd_drivers/snapshot/datasheets/purifi/ptt10-0x04-nab-01/openisd.json`:
   `MagDepth_m {"state": "C", "value": 3.9836, "precision": 3.9295}`.
2. Observed: MagDepth 3.98 m. Expected: MagDepth not available, with a reason (it cannot exceed Depth).

## Evidence
`magDepthFromDims` = (pi*S*Depth - 12*DVol) / (pi*(S - 3*Magnet^2)); S = 0.059628, 3*Magnet^2 = 0.058800, denominator 0.000828:
two nearly equal areas subtracted. The function guarded a non-positive denominator only, and nothing compared the result with
Depth. The other three directions had the same gap: `depthFromDims` could return a Depth at or below MagDepth (no cone),
`magnetFromDims` a magnet narrower than the voice coil. Test: `driver-solve.test.ts` "DVol geometry lock — a result outside the
driver is refused".
Catalogue (snapshot, 2001 records): the relation calculates a dimension in exactly these 2 records, both MagDepth 3.9836 m.
Every other Depth, DVol, Magnet and MagDepth in the snapshot is entered.

## Cause
`engine/dvolRelation.ts` returned the algebra's answer whatever it was.

## Fix
Each direction refuses a result outside the model's own bounds: 0 < MagDepth < Depth (the cone height is positive), Depth >
MagDepth, Magnet >= Vcd (the magnet holds the voice coil). `geometryRefusal` gives the sentence; `DriverEngine.solve` returns it
as a `result-refused` issue on the target field, so the field stays not-available with a reason on it. It is a note: no
data-quality line, so the ratchet does not move.

WinISD: its recovered trace (WINISD_SCHEMA.md §3.10.1, RE_GHIDRA_FINDINGS.md) guards only a zero target and strictly positive
participants, and the notes say a Magnet inverse of impossible inputs gives NaN. Nothing in the research says WinISD refuses a
MagDepth beyond Depth; by the same formula it would write 3.98 m. ⚠ not run in WinISD. A deliberate difference, listed under
"Not observable" in `docs/research/ACCURACY_IMPROVEMENTS.md` (a dimension on the Dimensions tab, no chart effect, so no cue).
