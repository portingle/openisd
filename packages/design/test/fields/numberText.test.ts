import {describe, it, expect} from 'vitest';
import {NUMBER_TEXT, numberFromText, numberInPaste, pastedEdit, typedEdit, type NumberBox, type NumberEdit} from '../../fields/numberText.js';

/** A box from marked text: `|` is the caret, `[..]` a selection. */
function box(marked: string): NumberBox {
  const s = marked.indexOf('[');
  if (s >= 0) {
    const e = marked.indexOf(']');
    return {text: marked.slice(0, s) + marked.slice(s + 1, e) + marked.slice(e + 1), selectionStart: s, selectionEnd: e - 1};
  }
  const c = marked.indexOf('|');
  return {text: marked.replace('|', ''), selectionStart: c, selectionEnd: c};
}
function result(e: NumberEdit): string | null {
  return e.kind === 'refuse' ? null : e.text.slice(0, e.caret) + '|' + e.text.slice(e.caret);
}

describe('NUMBER_TEXT', () => {
  it('takes numbers and the start of one', () => {
    for (const t of ['', '-', '.', ',', '1.', '.5', '-0,5', '12.5']) expect(NUMBER_TEXT.test(t)).toBe(true);
  });
  it('takes an exponent, and the start of one (BUG_20261117_exponent-entry-silently-dropped)', () => {
    for (const t of ['1e', '1e+', '1e-', '1e9', '1E9', '1e+3', '.5e3', '-2.5E-3', '1.e2']) expect(NUMBER_TEXT.test(t)).toBe(true);
  });
  it('refuses an exponent with no number before it, or a second one', () => {
    for (const t of ['e', 'e5', '-e5', '1e5e', '1e5.2', '1e--5', '1ee5']) expect(NUMBER_TEXT.test(t)).toBe(false);
  });
  it('refuses anything else', () => {
    for (const t of ['a', '12a', '1.2.3', '--1', '1-', ' 1', '12 Hz']) expect(NUMBER_TEXT.test(t)).toBe(false);
  });
});

describe('numberFromText', () => {
  it('reads a whole number as typed: point, comma, exponent', () => {
    expect(numberFromText('12.5')).toBe(12.5);
    expect(numberFromText('-0,5')).toBe(-0.5);
    expect(numberFromText('1e9')).toBe(1e9);
    expect(numberFromText('2.5E-3')).toBe(0.0025);
    expect(numberFromText('1.')).toBe(1);
    expect(numberFromText('.5')).toBe(0.5);
  });
  it('is NaN for the start of a number that is not one yet', () => {
    for (const t of ['', '-', '.', '1e', '1e+', 'e5', '1e5e', '12a']) expect(numberFromText(t)).toBeNaN();
  });
});

describe('typedEdit', () => {
  it('lets an e and its sign and digits in after a number (1e9 typed key by key)', () => {
    expect(result(typedEdit(box('1|'), 'e'))).toBe('1e|');
    expect(result(typedEdit(box('1e|'), '-'))).toBe('1e-|');
    expect(result(typedEdit(box('1e-|'), '9'))).toBe('1e-9|');
  });
  it('still refuses an e with no number before it', () => {
    expect(result(typedEdit(box('|'), 'e'))).toBeNull();
  });
  it('lets digits, a point and a leading minus in', () => {
    expect(result(typedEdit(box('12|'), '3'))).toBe('123|');
    expect(result(typedEdit(box('12|'), '.'))).toBe('12.|');
    expect(result(typedEdit(box('|12'), '-'))).toBe('-|12');
  });
  it('refuses letters, at the end, the start and over a selection', () => {
    expect(result(typedEdit(box('12|'), 'a'))).toBeNull();
    expect(result(typedEdit(box('|12'), 'a'))).toBeNull();
    expect(result(typedEdit(box('[12]'), 'a'))).toBeNull();
  });
  it('refuses a second point or a minus in the middle', () => {
    expect(result(typedEdit(box('1.2|'), '.'))).toBeNull();
    expect(result(typedEdit(box('1|2'), '-'))).toBeNull();
  });
  it('a typed digit replaces the selection', () => {
    expect(result(typedEdit(box('[12]'), '7'))).toBe('7|');
  });
});

describe('numberInPaste', () => {
  it('keeps an exponent: 1e9 pastes as 1e9, not as 1', () => {
    expect(numberInPaste('1e9')).toBe('1e9');
    expect(numberInPaste('2,5E-3 W')).toBe('2.5E-3');
  });
  it('takes the number out of the text', () => {
    expect(numberInPaste('12.5 Hz')).toBe('12.5');
    expect(numberInPaste('1,5')).toBe('1.5');
    expect(numberInPaste(' -3 dB')).toBe('-3');
    expect(numberInPaste('.5')).toBe('.5');
  });
  it('is null when there is no number', () => {
    expect(numberInPaste('abc')).toBeNull();
    expect(numberInPaste('')).toBeNull();
    expect(numberInPaste('-')).toBeNull();
  });
});

describe('pastedEdit', () => {
  it('puts the number of "12.5 Hz" into an empty box', () => {
    expect(result(pastedEdit(box('|'), '12.5 Hz'))).toBe('12.5|');
  });
  it('replaces the selection', () => {
    expect(result(pastedEdit(box('[12]'), '1,5'))).toBe('1.5|');
  });
  it('refuses a paste with no number, and the box is left as it was', () => {
    expect(result(pastedEdit(box('12|'), 'abc'))).toBeNull();
  });
  it('refuses a paste that would leave something that is not a number', () => {
    expect(result(pastedEdit(box('12|'), '-3'))).toBeNull();
    expect(result(pastedEdit(box('1.2|'), '3.4'))).toBeNull();
  });
  it('adds at the caret in the middle', () => {
    expect(result(pastedEdit(box('1|3'), 'x 2 y'))).toBe('12|3');
  });
});
