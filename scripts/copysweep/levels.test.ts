/**
 * Levels, power and BL copies: USPL / SPLref / efficiency written in the driver routes, efficiency.ts and the sweep;
 * drive power <-> voltage in SignalEngine, in maxCurves and in the sweep's VA; BL derived from Qes in DriverEngine and in
 * SimulationEngine; Qts = parallel Qes,Qms. Never fails; writes results/levels.json.
 */
import {describe, it} from 'vitest';
import {AIR, COUNTS, Collector, engine, pickDrivers} from './lib.js';
import type {SweepParams} from '../../packages/design/engine/index.js';
import {sweepDriver} from '../../packages/design/test/engine/testSolver.js';

describe('levels', () => {
  it('compares them', () => {
    const c = new Collector('levels');
    for (const d of pickDrivers()) {
      // a self-consistent driver: everything else derived by the engine from Fs, Qes, Qms, Re, Sd, Mms (catalogue values disagree with each other)
      const cons = engine.driver.solveValues({Fs_hz: d.q.Fs_hz, Qes: d.q.Qes, Qms: d.q.Qms, Re_ohm: d.q.Re_ohm, Sd_m2: d.q.Sd_m2, Mms_kg: d.q.Mms_kg, Pe_W: d.q.Pe_W, Xmax_m: d.q.Xmax_m}, AIR);
      const q = {...d.q, ...Object.fromEntries(Object.entries(cons).filter(([, v]) => typeof v === 'number')), Re_terminal_ohm: d.q.Re_ohm, BL_terminal_Tm: cons.BL_Tm ?? d.q.BL_Tm};
      const dsweep = sweepDriver(q);
      const solved = engine.driver.solveValues({Fs_hz: q.Fs_hz, Vas_m3: q.Vas_m3, Qes: q.Qes, Re_ohm: q.Re_ohm}, AIR);
      // efficiency: DriverEngine.referenceEfficiency vs the route's `no`, SPLref vs splFromEfficiency, USPL vs SPLref + 10log10(2.83^2/Re)
      const no = engine.driver.referenceEfficiency(q.Fs_hz!, q.Vas_m3!, q.Qes!, AIR);
      if (solved.no != null) c.compare('DriverEngine.referenceEfficiency', 'solveValues no (route)', d.path, no, solved.no);
      if (solved.SPLref_dB != null) c.compare('DriverEngine.splFromEfficiency(no)', 'solveValues SPLref_dB (route)', d.path, engine.driver.splFromEfficiency(no, AIR), solved.SPLref_dB);
      if (solved.USPL_dB != null && solved.SPLref_dB != null) c.compare('USPL = SPLref + 10log10(2.83^2/Re) (efficiencyRoutes)', 'solveValues USPL_dB', d.path, solved.SPLref_dB + 10 * Math.log10((2.83 * 2.83) / q.Re_ohm!), solved.USPL_dB);
      // the sweep's own passband level at 2.83 V against USPL: flat part one decade above Fs, no inductance
      const P: SweepParams = {Vb: q.Vas_m3! * 50, eg: 2.83, Ql: 1e6, Qa: 1e6, fmin: q.Fs_hz! * 100, fmax: q.Fs_hz! * 100, N: 1, nDrivers: 1, air: AIR};
      const sw = engine.simulation.sweep(dsweep, undefined, 'sealed', P).values;
      if (sw && solved.USPL_dB != null) c.compare('driver routes USPL_dB (2.83 V, 1 m, half space)', 'sweep SPL at 100*Fs in a huge sealed box (0.1 dB tol)', d.path, solved.USPL_dB, sw.spl[0], 0.1 / 90);
      // resonance / compliance / Vas / Qms: the driver routes against PrEngine's own copies of the same relations
      const a = engine.driver.solveValues({Mms_kg: d.q.Mms_kg, Cms_m_per_N: d.q.Cms_m_per_N, Sd_m2: d.q.Sd_m2, Rms_kg_per_s: d.q.Rms_kg_per_s}, AIR);
      if (a.Fs_hz != null) c.compare('PrEngine.fsWithMass (1/(2pi sqrt(M C)))', 'driver route Fs_hz from Mms, Cms', d.path, engine.pr.fsWithMass(d.q.Mms_kg!, 0, d.q.Cms_m_per_N!), a.Fs_hz);
      if (a.Vas_m3 != null) c.compare('PrEngine.vas (Cms Sd^2 rho c^2)', 'driver route Vas_m3 from Cms, Sd', d.path, engine.pr.vas(d.q.Cms_m_per_N!, d.q.Sd_m2!, AIR), a.Vas_m3);
      if (a.Qms != null) c.compare('PrEngine.qms (sqrt(M/C)/Rms)', 'driver route Qms from Mms, Cms, Rms', d.path, engine.pr.qms(d.q.Mms_kg!, d.q.Cms_m_per_N!, d.q.Rms_kg_per_s!), a.Qms);
      const b = engine.driver.solveValues({Fs_hz: d.q.Fs_hz, Cms_m_per_N: d.q.Cms_m_per_N}, AIR);
      if (b.Mms_kg != null) c.compare('PrEngine.mmdFromFs', 'driver route Mms_kg from Fs, Cms', d.path, engine.pr.mmdFromFs(d.q.Fs_hz!, d.q.Cms_m_per_N!), b.Mms_kg);
      const e = engine.driver.solveValues({Vas_m3: d.q.Vas_m3, Sd_m2: d.q.Sd_m2}, AIR);
      if (e.Cms_m_per_N != null) c.compare('PrEngine.cmsFromVas', 'driver route Cms from Vas, Sd', d.path, engine.pr.cmsFromVas(d.q.Vas_m3!, d.q.Sd_m2!, AIR), e.Cms_m_per_N);
      const vd = engine.driver.solveValues({Sd_m2: d.q.Sd_m2, Xmax_m: d.q.Xmax_m}, AIR);
      if (vd.Vd_m3 != null) c.compare('PrEngine.displacement (Sd x Xmax)', 'driver route Vd_m3 from Sd, Xmax', d.path, engine.pr.displacement(d.q.Sd_m2!, d.q.Xmax_m!)!, vd.Vd_m3);
      // BL from Qes: DriverEngine route vs the circuit's own derivation (sweep with BL left out vs BL given)
      const withoutBl = {...q, BL_Tm: undefined, BL_terminal_Tm: undefined};
      const solvedBlWanted = cons.BL_Tm;
      const solvedBl = {BL_Tm: solvedBlWanted};
      if (solvedBl.BL_Tm != null) {
        const Pw: SweepParams = {Vb: q.Vas_m3!, eg: 2.83, Ql: 100, Qa: 100, fmin: 10, fmax: 500, N: 60, nDrivers: 1, air: AIR};
        const a = engine.simulation.sweep(sweepDriver(withoutBl), undefined, 'sealed', Pw).values;
        const b = engine.simulation.sweep(sweepDriver({...withoutBl, BL_Tm: solvedBl.BL_Tm, BL_terminal_Tm: solvedBl.BL_Tm}), undefined, 'sealed', Pw).values;
        if (a && b) for (let i = 0; i < a.spl.length; i += 10) c.compare('SimulationEngine BL from Qes (sweep, BL absent)', 'DriverEngine solveValues BL_Tm given to the sweep', `${d.path} f=${a.fs[i].toFixed(1)}Hz`, a.spl[i], b.spl[i], 1e-6 / 90);
      }
      // power <-> voltage with series resistance, hot coil, 1/2/4 drivers, both wirings
      for (const n of COUNTS) for (const wiring of ['parallel', 'series'] as const) for (const Rg of [0, 1]) for (const dT of [0, 100]) for (const rgAtDriver of [true, false]) {
        const hot = engine.driver.hotRe(q.Re_ohm!, 0.00393, dT);
        const Pmax: SweepParams = {Vb: q.Vas_m3! * n, eg: 2.83, Ql: 1e6, Qa: 1e6, fmin: 300, fmax: 20000, N: 40, nDrivers: n, driverWiring: wiring, Rs: Rg, rgAtDriverSide: rgAtDriver, alfaVC: 0.00393, vcTempRise: dT, air: AIR};
        const mx = engine.simulation.maxCurves(dsweep, undefined, 'sealed', Pmax).values;
        if (!mx) continue;
        // the Pe-limited plateau: the largest maxpwr over the grid (Xmax-limited points are lower)
        const plateau = Math.max(...mx.maxpwr);
        const inp = `${d.path} n=${n} ${wiring} Rg=${Rg} dT=${dT} rgAtDriver=${rgAtDriver}`;
        c.compare('maxCurves Pe plateau (sqrt(Pe*(Re_hot+Rg)) then V^2/Re)', 'n * Pe (the power the array is rated for)', inp, plateau, n * q.Pe_W!, 1e-9);
        // amplifier voltage the signal engine gives for the rated array power, and the power it gives back
        const vAmp = engine.signal.amplifierVoltageFor(n * q.Pe_W!, n, wiring, hot, Rg, rgAtDriver);
        const back = (() => {
          const drive = engine.signal.driveVoltage(q.Pe_W!, hot, Rg);
          return n * (drive * drive) / (hot + Rg) / n;
        })();
        c.compare('SignalEngine.driveVoltage^2/(Re+Rg) for Pe', 'Pe', inp, back, q.Pe_W!);
        void vAmp;
      }
    }
    c.write();
  });
});
