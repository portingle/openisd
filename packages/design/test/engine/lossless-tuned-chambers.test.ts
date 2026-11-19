/**
 * T929: the 6th-order bandpass and ABC lossless branches build their two chambers through one engine
 * function, `losslessTunedChambers` (engine/boxes/port.ts), instead of each keeping its own copy:
 * Cab = V/(ρc²), ω₀ = 2π·F, Map = 1/(ω₀²·Cab), port branch ω₀·Map/Qp + jω·Map, each port's own Qpr/Qpf,
 * the shared Qp only where the caller states none.
 */
import {describe, expect, it} from 'vitest';
import {losslessTunedChambers} from '../../engine/boxes/port.js';
import type {SweepParams} from '../../engine/types.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {DEFAULT_NEW_PROJECT_QP} from '../../fields/defaults.js';

const rho = 1.2, c = 343;
const w = 2 * Math.PI * 60;
const BASE: SweepParams = {Vb: 0.05, Vf: 0.03, Fr: 40, Ff: 80, eg: 2.83, Ql: 1e6, Qa: 1e6, fmin: 10, fmax: 200, N: 5, air: REFERENCE_AIR};

function expected(V: number, F: number, Qp: number) {
  const Cab = V / (rho * c * c);
  const w0 = 2 * Math.PI * F;
  const Map = 1 / (w0 * w0 * Cab);
  return {Cab, w0, Map, re: w0 * Map / Qp, im: w * Map};
}

describe('losslessTunedChambers', () => {
  it('tunes each chamber port to its own frequency and uses each port its own Qpr/Qpf', () => {
    const {rear, front} = losslessTunedChambers(w, {...BASE, Qpr: 50, Qpf: 30, Qp: 10}, rho, c);
    const r = expected(0.05, 40, 50), f = expected(0.03, 80, 30);
    expect(rear.Cab).toBe(r.Cab);
    expect(rear.Map).toBe(r.Map);
    expect(rear.portBranch.re).toBe(r.re);
    expect(rear.portBranch.im).toBe(r.im);
    expect(front.Cab).toBe(f.Cab);
    expect(front.w0).toBe(f.w0);
    expect(front.portBranch.re).toBe(f.re);
    expect(front.portBranch.im).toBe(f.im);
  });

  it('takes the shared Qp where a port states none, and the new-project Qp where neither is stated', () => {
    const shared = losslessTunedChambers(w, {...BASE, Qp: 10}, rho, c);
    expect(shared.rear.portBranch.re).toBe(expected(0.05, 40, 10).re);
    expect(shared.front.portBranch.re).toBe(expected(0.03, 80, 10).re);
    const neither = losslessTunedChambers(w, BASE, rho, c);
    expect(neither.rear.portBranch.re).toBe(expected(0.05, 40, DEFAULT_NEW_PROJECT_QP).re);
  });

  it('poisons a chamber with NaN when its volume or tuning is absent, never a throw', () => {
    const {rear, front} = losslessTunedChambers(w, {...BASE, Vf: undefined, Fr: undefined}, rho, c);
    expect(Number.isNaN(rear.Map)).toBe(true);
    expect(Number.isNaN(front.Cab)).toBe(true);
  });
});
