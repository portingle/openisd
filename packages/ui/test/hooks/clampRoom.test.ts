import {describe, expect, it} from 'vitest';
import {CLAMPED_CLASS, watchClampRoom} from '../../src/hooks/clampRoom.js';

/** A text element whose laid-out height depends on whether it carries the room (the class), as a narrower cell would. */
function fakeText(fitsWithoutRoom: boolean, fitsWithRoom: boolean): {el: HTMLElement; fire: () => void} {
  const callbacks: Array<() => void> = [];
  const observer = class { constructor(cb: () => void) { callbacks.push(cb); } observe(): void {} disconnect(): void {} };
  const classes = new Set<string>();
  const el = {
    ownerDocument: {defaultView: {MutationObserver: observer, ResizeObserver: observer}},
    classList: {add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c)},
    get scrollHeight() { return (classes.has(CLAMPED_CLASS) ? fitsWithRoom : fitsWithoutRoom) ? 14 : 42; },
    clientHeight: 14,
  } as unknown as HTMLElement;
  return {el, fire: () => callbacks.forEach(cb => cb())};
}

describe('watchClampRoom', () => {
  it('leaves a text that fits without room unmarked, so it keeps its single line', () => {
    const {el} = fakeText(true, false);
    watchClampRoom(el);
    expect(el.classList.contains(CLAMPED_CLASS)).toBe(false);
  });
  it('marks a text that does not fit and keeps the mark when measured again', () => {
    const {el, fire} = fakeText(false, false);
    watchClampRoom(el);
    expect(el.classList.contains(CLAMPED_CLASS)).toBe(true);
    fire();
    expect(el.classList.contains(CLAMPED_CLASS)).toBe(true);
  });
  it('stop takes the mark back', () => {
    const {el} = fakeText(false, false);
    watchClampRoom(el).stop();
    expect(el.classList.contains(CLAMPED_CLASS)).toBe(false);
  });
});
