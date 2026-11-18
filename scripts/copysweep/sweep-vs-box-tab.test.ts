/**
 * The Box tab's sealed Fsc/Qtc (engine.sealed.resonance with arrayVas and the source-loaded Qts) against what the chart
 * sweep itself shows (impedance peak read by engine.driver.findImpedancePeak), for 1/2/4 drivers, standard/isobaric,
 * parallel/series, Rg 0 and 1 ohm, coil heating 0 and 100 K. The sweep is the reference: it is what the user sees plotted.
 * Also: the "N drivers as one" model inside circuit.ts (reachable only if nDrivers > 1 reaches it) and the unused
 * project.impedancePeak readout. Never fails; writes results/sweep-vs-box-tab.json.
 */
import {describe, it} from 'vitest';
import {AIR, COUNTS, Collector, LOADINGS, engine, pickDrivers} from './lib.js';
import type {SweepParams} from '../../packages/design/engine/index.js';

const ALFA = 0.00393;

describe('sweep vs box tab', () => {
  it('compares them', () => {
    const c = new Collector('sweep-vs-box-tab');
    for (const d of pickDrivers()) {
      const {Fs_hz: Fs, Qts, Qes, Qms, Vas_m3: Vas, Re_ohm: Re} = d.q;
      for (const n of COUNTS) for (const loading of LOADINGS) for (const wiring of ['parallel', 'series'] as const)
        for (const Rg of [0, 1]) for (const dT of [0, 100]) {
          const Vb = Vas! * n * (loading === 'isobaric' ? 0.5 : 1) * 0.8;
          const P: SweepParams = {
            Vb, eg: 2.83, Rs: Rg, nDrivers: n, loading, driverWiring: wiring, Ql: 1e6, Qa: 1e6, Qp: 1e6,
            fmin: 5, fmax: 2000, N: 6000, air: AIR, alfaVC: ALFA, vcTempRise: dT, winisdOneDriverImpedance: true,
          };
          const sw = engine.simulation.sweep(d.sweep, undefined, 'sealed', P).values;
          if (!sw) continue;
          const hot = engine.driver.hotRe(Re!, ALFA, dT);
          // the Box tab: Qts loaded by Rg (and by hot Re, as the chart's circuit does), Vas of the array
          const qtsLoaded = engine.driver.sourceLoadedQts(Qms!, Qes!, hot, Rg, Qts!);
          const box = engine.sealed.resonance({Fs: Fs!, Vas: engine.sealed.arrayVas(Vas!, n, loading), Qts: qtsLoaded, Vb, Ql: 1e6, Qa: 1e6});
          const peak = engine.driver.findImpedancePeak(sw, hot + (Rg > 0 ? 0 : 0));
          if (peak === null) continue;
          const inp = `${d.path} n=${n} ${loading} ${wiring} Rg=${Rg} dT=${dT} Vb=${Vb.toExponential(3)}`;
          c.compare('Box tab Fsc (arrayVas, source-loaded Qts)', 'sweep impedance-peak Fsc (1% tol)', inp, box.Fsc, peak.Fsc, 0.01);
          if (Rg === 0 && dT === 0) c.compare('Box tab Qtc (arrayVas, source-loaded Qts)', 'sweep impedance-peak Qtc (10% tol)', inp, box.Qtc, peak.Qtc, 0.10);
          // REPORT item 8: project.impedancePeak passes ONE driver's Re with the array's impedance curve
          if (n > 1 && Rg === 0 && dT === 0) {
            const arr = engine.simulation.sweep(d.sweep, undefined, 'sealed', {...P, winisdOneDriverImpedance: false}).values;
            const ap = arr ? engine.driver.findImpedancePeak(arr, Re!) : null;
            if (ap) c.compare('OpenISDProject.impedancePeak (array impedance / one driver Re) Qtc', 'impedance-peak Qtc of the one-driver curve', inp, ap.Qtc, peak.Qtc, 1e-3);
          }
        }
    }
    c.write();
  });
});
