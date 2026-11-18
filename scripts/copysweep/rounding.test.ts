/**
 * Display rounding (REPORT item 18, "four rounding rules"): the same catalogue numbers through the shared formatters
 * (fields/format.ts formatFixed, formatTrimmed, formatSignificant). Each result is compared with the exact value: a rule
 * is DIFFERENT from another when the digits shown differ by more than the coarser rule's half-unit. Never fails;
 * writes results/rounding.json (digit strings, so the report can show examples).
 */
import {describe, it} from 'vitest';
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Collector, pickDrivers} from './lib.js';
import {formatFixed, formatSignificant, formatTrimmed} from '../../packages/design/fields/format.js';

describe('rounding', () => {
  it('compares them', () => {
    const c = new Collector('rounding');
    const examples: string[] = [];
    for (const d of pickDrivers()) {
      const v = d.q.Vas_m3! * 1000; // litres
      const fixed = formatFixed(v, 2), trimmed = formatTrimmed(v, 2), sig = formatSignificant(v);
      examples.push(`${d.path}: Vas ${v} L -> formatFixed(2)="${fixed}" formatTrimmed(2)="${trimmed}" formatSignificant="${sig}"`);
      const half = (s: string): number => { const dp = (s.split('.')[1] ?? '').length; return 0.5 * 10 ** -dp; };
      // every rule must be within its own half-unit of the exact value
      for (const [name, s] of [['formatFixed(2)', fixed], ['formatTrimmed(2)', trimmed], ['formatSignificant', sig]] as const) {
        c.compare(`${name} within its own half-unit`, 'exact value within half a displayed unit', `${d.path} ${v} L`, Math.abs(Number(s) - v) <= half(s) * (1 + 1e-9) ? 0 : 1, 0, 0);
      }
      // across rules: same number, different digits
      c.compare('formatFixed(2) vs formatSignificant (digits shown)', 'same digits', `${d.path}: "${fixed}" vs "${sig}"`, Number(fixed), Number(sig), 0);
    }
    c.write();
    mkdirSync(join(dirname(fileURLToPath(import.meta.url)), 'results'), {recursive: true});
    writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'results', 'rounding-examples.txt'), examples.join('\n'));
  });
});
