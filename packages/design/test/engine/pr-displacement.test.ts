// John, 16 Nov 2026 12:57/12:58: the phone Box tab's Key figures show the radiator's displacement Vd, so a user can hold it
// against the driver's ("2×" rule of thumb). The engine works it out: Vd = Sd · Xmax.
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

describe('PrEngine.displacement', () => {
  it('is Sd times Xmax', () => {
    expect(createEngine().pr.displacement(0.0202, 0.012)).toBeCloseTo(0.0002424, 12);
  });
  it('is not available without a positive Sd and Xmax', () => {
    const pr = createEngine().pr;
    expect(pr.displacement(null, 0.012)).toBeNull();
    expect(pr.displacement(0.0202, null)).toBeNull();
    expect(pr.displacement(0, 0.012)).toBeNull();
  });
});
