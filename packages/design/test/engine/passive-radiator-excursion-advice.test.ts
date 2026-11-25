import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

describe('passive radiator excursion assessment', () => {
  it('finds the exceeded band and tests each count using its own response', () => {
    const calls: number[] = [];
    const result = createEngine().pr.assessExcursion(1, 0.01, 4, count => {
      calls.push(count);
      return {frequency_hz: [20, 24, 28, 32, 40], excursion_mm: count === 1 ? [5, 11, 15, 12, 5]
        : count === 2 ? [5, 10.5, 12, 11, 5] : [4, 6, 8, 7, 4]};
    });
    expect(result).toEqual({kind: 'exceeded', start_hz: 24, end_hz: 32, peak_hz: 28, peak_mm: 15, minimumCount: 3});
    expect(calls).toEqual([1, 2, 3, 4]);
  });

  it('does not report a warning when excursion stays at or below Xmax', () => {
    expect(createEngine().pr.assessExcursion(1, 0.01, 4, () => ({frequency_hz: [20, 40], excursion_mm: [10, 5]})))
      .toEqual({kind: 'within-limit'});
  });

  it('only says at least N when all larger selectable counts also stay within Xmax', () => {
    const result = createEngine().pr.assessExcursion(1, 0.01, 4, count => ({
      frequency_hz: [20, 40], excursion_mm: count === 1 || count === 3 ? [11, 12] : [3, 4],
    }));
    expect(result).toMatchObject({kind: 'exceeded', minimumCount: null});
  });

  it('does not claim a count when a candidate cannot be simulated', () => {
    const result = createEngine().pr.assessExcursion(1, 0.01, 4, count => count === 4 ? null
      : {frequency_hz: [20, 40], excursion_mm: count === 1 ? [11, 12] : [3, 4]});
    expect(result).toMatchObject({kind: 'exceeded', minimumCount: null});
  });
});
