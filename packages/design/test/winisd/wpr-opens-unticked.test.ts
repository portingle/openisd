/**
 * QO960: a WinISD file is converted to the OpenISD model on opening and the app keeps no memory of where it came
 * from; legacy behaviour comes from the switches. So a project opened from a WinISD file has
 * "Chart from Fs, Vas, Qms (WinISD's way)" OFF, like any new project; the WinISD-number tests tick it themselves.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('a project opened from a WinISD file keeps "Chart from Fs, Vas, Qms" off (QO960)', () => {
  for (const wpr of ['sealed-w5-isobarik', 'vented-w5-tl0-ql1e6-qp15']) {
    it(`${wpr}.wpr opens with the switch unticked`, () => {
      const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${wpr}.wpr`), 'utf8'));
      if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
      expect(project.winisdChartFromFsVasQms.value).toBe(false);
    });
  }
});
