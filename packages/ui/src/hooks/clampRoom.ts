/**
 * Room for the ellipsis of a right-aligned, line-clamped text (T899). The browser draws the clamp's ellipsis past
 * the right edge of a right-aligned line, where the cell cuts it off, so a clamped text keeps one em free on its right.
 * A text that is not clamped keeps that room too (T886 did, always) and a name that fits on one line wrapped
 * onto two (John, 18 Nov 2026: production showed "AS168-9-470 closed" on one line, the test site on two).
 * This marks `text` with `CLAMPED_CLASS` only while the text, laid out without the room, does not fit; the room
 * can only make a clamped text clamp more, so the mark does not flip back and forth.
 * It measures again when `text` changes or resizes.
 */
export const CLAMPED_CLASS = 'clamped';

export interface ClampRoom {
  stop(): void;
}

export function watchClampRoom(text: HTMLElement): ClampRoom {
  const view = text.ownerDocument.defaultView;
  if (view === null) throw new Error('A clamp room needs a live document');
  const measure = (): void => {
    text.classList.remove(CLAMPED_CLASS);
    if (text.scrollHeight > text.clientHeight) text.classList.add(CLAMPED_CLASS);
  };
  const mutations = new view.MutationObserver(measure);
  mutations.observe(text, {childList: true, characterData: true, subtree: true});
  const resizes = new view.ResizeObserver(measure);
  resizes.observe(text);
  measure();
  return {
    stop(): void {
      mutations.disconnect();
      resizes.disconnect();
      text.classList.remove(CLAMPED_CLASS);
    },
  };
}
