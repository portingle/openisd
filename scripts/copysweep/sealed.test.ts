/**
 * Sealed-box copy sweep: every place the sealed Qtc, Fsc, volume-for-Qtc, source-loaded Qts and driver-count Vas are
 * computed, called with the same inputs as the engine's own function. Never fails; writes results/sealed.json.
 */
import {describe, it} from 'vitest';
import {AIR, COUNTS, Collector, LOADINGS, engine, pickDrivers} from './lib.js';
import {sealedResonanceLossless, sealedResonanceWinisd, boxRatio, arrayVas} from '../../packages/design/engine/sealedResonance.js';

const LOSSLESS = 1e6;

describe('sealed copies', () => {
  it('compares them', () => {
    const c = new Collector('sealed');
    for (const d of pickDrivers()) {
      const {Fs_hz: Fs, Qts, Qes, Qms, Vas_m3: Vas, Re_ohm: Re} = d.q;
      for (const n of COUNTS) for (const loading of LOADINGS) {
        const vas = engine.sealed.arrayVas(Vas!, n, loading);
        for (const Vb of [Vas! * n * 0.3, Vas! * n, Vas! * n * 3]) {
          const inp = `${d.path} n=${n} ${loading} Vb=${Vb.toExponential(4)}`;
          const p = {Fs: Fs!, Vas: vas, Qts: Qts!, Vb, Ql: LOSSLESS, Qa: LOSSLESS};
          const eng = engine.sealed.resonance(p);
          // copies of Qtc = Qts*sqrt(1+Vas/Vb)
          c.compare('SealedEngine.qtcFromVolume (Qts*sqrt(1+Vas/Vb))', 'sealedResonanceWinisd lossless branch', inp, engine.sealed.qtcFromVolume(Qts!, vas, Vb)!, eng.Qtc);
          c.compare('sealedResonanceLossless (Qts*boxRatio)', 'sealedResonanceWinisd lossless branch', inp, sealedResonanceLossless(p).Qtc, eng.Qtc);
          c.compare('sealedResonanceLossless Fsc', 'sealedResonanceWinisd lossless branch', inp, sealedResonanceLossless(p).Fsc, eng.Fsc);
          c.compare('boxRatio^2-1 vs Vas/Vb', 'sealedResonanceWinisd', inp, boxRatio(vas, Vb) ** 2 - 1, vas / Vb);
          // the inverse (volume for Qtc) round trip: lossless branch vs the lossy solver at no losses
          const qtc = eng.Qtc;
          const vLossless = engine.sealed.volumeForQtc(Qts!, vas, qtc);
          const vLossy = engine.sealed.volumeForLossyQtc({Fs: Fs!, Vas: vas, Qts: Qts!, Ql: LOSSLESS, Qa: LOSSLESS}, qtc);
          if (vLossless !== null && vLossy !== null) c.compare('SealedEngine.volumeForQtc (lossless branch)', 'volumeForLossyQtc at Ql=Qa=1e6', inp, vLossless, vLossy, 1e-6);
          if (vLossless !== null) c.compare('SealedEngine.volumeForQtc round trip', 'Vb input', inp, vLossless, Vb, 1e-9);
        }
        // arrayVas vs the plain statement N*Vas*(isobaric?0.5:1) used elsewhere
        c.compare('arrayVas (module function)', 'engine.sealed.arrayVas', `${d.path} n=${n} ${loading}`, arrayVas(Vas!, n, loading), vas);
      }
      // Qts: source-loaded copies. winisdPickerVolume inlines Qes*(Re+Rg)/Re then the parallel Q; the engine has sourceLoadedQts.
      for (const Rg of [0, 0.1, 1]) {
        const eng = engine.driver.sourceLoadedQts(Qms!, Qes!, Re!, Rg, Qts!);
        const inlineQes = Qes! * (Re! + Rg) / Re!;
        c.compare('SealedEngine.winisdPickerVolume inline QtsLoaded', 'DriverEngine.sourceLoadedQts', `${d.path} Rg=${Rg}`, 1 / (1 / inlineQes + 1 / Qms!), eng);
      }
      // picker volume (Rg 0.1, Qa 100 fixed) vs the engine's own pieces composed
      const pickQtc = 0.707;
      const pick = engine.sealed.winisdPickerVolume({Vas: Vas!, Qes: Qes!, Qms: Qms!, Re: Re!}, pickQtc);
      const qtsL = engine.driver.sourceLoadedQts(Qms!, Qes!, Re!, 0.1, Qts!);
      const composed = engine.sealed.volumeForQtc(1 / (1 / qtsL + 1 / 100), Vas!, pickQtc);
      if (pick !== null && composed !== null) c.compare('winisdPickerVolume', 'sourceLoadedQts + volumeForQtc composed', d.path, pick, composed);
      // Qts = Qes*Qms/(Qes+Qms) copies
      const qp = engine.driver.solveValues({Qes, Qms}, AIR);
      if (qp.Qts != null) c.compare('driverQuantities Qts = Qes*Qms/(Qes+Qms)', 'DriverEngine.solveValues Qts', d.path, (Qes! * Qms!) / (Qes! + Qms!), qp.Qts);
      // lossy resonance with finite losses must be continuous with the lossless one as Ql grows
      const lossy = sealedResonanceWinisd({Fs: Fs!, Vas: Vas!, Qts: Qts!, Vb: Vas!, Ql: 9.9e5, Qa: 9.9e5});
      const ll = sealedResonanceLossless({Fs: Fs!, Vas: Vas!, Qts: Qts!, Vb: Vas!, Ql: 0, Qa: 0});
      c.compare('lossless branch Qtc at Ql=1e6', 'lossy cubic at Ql=9.9e5', d.path, ll.Qtc, lossy.Qtc, 1e-3);
      c.compare('lossless branch Fsc at Ql=1e6', 'lossy cubic at Ql=9.9e5', d.path, ll.Fsc, lossy.Fsc, 1e-3);
    }
    c.write();
  });
});
