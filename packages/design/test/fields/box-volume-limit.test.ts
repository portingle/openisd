import {describe, it, expect} from 'vitest';
import {NumberField} from '../../fields/field.js';

// 10 m3 = 10,000 L: far beyond any speaker box, and the longest value fits the phone Box tab's box in every unit (QO946.c187, lead).
const TEN_THOUSAND_LITRES_M3 = 10;

describe('box volume top limit', () => {
  it('the net enclosure volume tops out at 10,000 L', () => {
    expect(NumberField.BOX_VB_L.limits.max).toBe(TEN_THOUSAND_LITRES_M3);
  });
  it('the bandpass front chamber volume tops out at 10,000 L', () => {
    expect(NumberField.BOX_VF_L.limits.max).toBe(TEN_THOUSAND_LITRES_M3);
  });
});
