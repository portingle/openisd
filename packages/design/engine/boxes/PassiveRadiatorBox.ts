/**
 * Passive radiator — mechanical elements referred to the acoustical domain.
 * Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
 * https://aes.org/e-lib/browse.cfm?elib=2223
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
import {eachOfN} from '../array/driverWiring.js';
import {cAdd, cDiv, cInv, cMul, cPar, cScale, cSub, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class PassiveRadiatorBox implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Cab, Zc, Ral, Raa, Ql, Qa, loss} = q;
    const P = this.P;

    // n_pr PRs in parallel → combined acoustic impedance = Zpr_single / n_pr. Map/Cap/Rap are
    // the radiator's own mass/compliance/loss — the same under either loss form; only the BOX's leak
    // and absorption (Ral/Raa) and how the output is read off Zbox differ below.
    const n_pr = P.prNum || 1;
    // The domain guarantees prMmd/prSd/prCms present before a sweep (engine/params.ts
    // `solveBoxParams`); `?? NaN` narrows without a throw and matches how the vented box treats
    // a missing `P.Fb` — absent still poisons the branch with NaN, never a non-null assertion.
    const Map = ((P.prMmd ?? NaN) + (P.prMadd ?? NaN)) / ((P.prSd ?? NaN) * (P.prSd ?? NaN));
    const Cap = (P.prCms ?? NaN) * (P.prSd ?? NaN) * (P.prSd ?? NaN);
    const Rap = (P.prRms || 0) / ((P.prSd ?? NaN) * (P.prSd ?? NaN));
    const Zpr_single = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    const Zpr = n_pr !== 1 ? cScale(Zpr_single, 1 / n_pr) : Zpr_single;

    switch (loss) {
      case 'lossless': {
        // Ral/Raa here are the per-frequency Ql/Qa/(ω·Cab); they are effectively
        // absent because Ql/Qa are then ≥1e6. Output is cone minus radiator (leak not split out).
        const Zbox = cPar(Zc, Ral, Raa, Zpr);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, Zpr));
        const U0 = cSub(UD, UP);
        return {Zbox, UD, UP, U0};
      }
      case 'winisd-lossy': {
        // WinISD's passive-radiator box (winisd_research/archive/GHIDRA_FINDINGS.md "Passive radiator
        // box — `0x45a960`", bugs/archive/BUG_20260927_passive-radiator-losses-not-winisd-form.md).
        // Leak and absorption are fixed across the sweep. Both use the product ωr·lossMass.
        //   Ral = Ql·ωr·lossMass     leak, parallel to the box (fixed)
        //   Raa = ωr·lossMass/Qa     absorption, in series with Cab (fixed)
        //   Zbox = Ral ∥ (Raa + 1/(jωCab)) ∥ Zpr
        // Radiated output is the Cab branch's own current — cone MINUS leak MINUS radiator, not
        // cone minus radiator alone. The box's own Qp is never used for a passive radiator (the
        // radiator's own loss Rap above already carries it, as ωp·Map_free/Qms per radiator,
        // WITHOUT Me — verified for Me ≠ 0 and n_pr > 1, winisd_research/archive/GHIDRA_FINDINGS.md same section).
        //
        // With `winisdPrNprResonance` off, ωr is the physical box tuning
        // `1/√((Map/Npr)·(Cab ∥ Npr·Cap))` and lossMass is the parallel radiators' mass, `Map/Npr`.
        // With it on, ωr is WinISD's `1/√(Npr·Map·(Cab ∥ Npr·Cap))` and lossMass is one radiator's `Map`
        // (winisd_research/archive/GHIDRA_FINDINGS.md, "Added mass and radiator count"). The factors
        // of Npr cancel in ωr·lossMass, so both settings give the same fixed resistances in exact arithmetic.
        // Both frequencies come from the acoustic elements. `P.Fr` is the separate domain tuning readout.
        const CabParNCap = (Cab * n_pr * Cap) / (Cab + n_pr * Cap);
        const wrWinisd = 1 / Math.sqrt(n_pr * Map * CabParNCap);
        const winisdNprResonance = P.winisdPrNprResonance === true;
        const wr = winisdNprResonance ? wrWinisd : n_pr * wrWinisd;
        const lossMass = winisdNprResonance ? Map : eachOfN(Map, n_pr);
        const RalConst = cx(Ql * wr * lossMass, 0);
        const RaaSeries = cx(wr * lossMass / Qa, 0);
        const CabBranch = cAdd(RaaSeries, Zc);
        const Zbox = cPar(RalConst, CabBranch, Zpr);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, Zpr));
        const U0 = cMul(UD, cDiv(Zbox, CabBranch));
        return {Zbox, UD, UP, U0};
      }
    }
  }
}
