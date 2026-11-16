import {describe, expect, it} from 'vitest';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {readFileSync} from 'node:fs';
import {flashRetiredArrayWiringNotice} from '../../src/logic/arrayWiringNotice.js';

/** QO941: a project saved before the wiring of several drivers went is told once that its impedance chart changed. */
function savedProject(n: number, wiring: 'series' | 'parallel'): OpenISDProject {
  const engine = createEngine();
  const driver = OpenISDDriver.fromOwdrText(readFileSync('packages/ui/public/drivers/dayton-audio/mx6-22.json', 'utf8'), engine);
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  const built = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  built.nDrivers.set(n);
  const text = built.toOwprText().replaceAll('"driverEmbedding": {', `"driverEmbedding": {\n    "retiredArrayWiring": "${wiring}",`);
  const back = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(back)) throw new Error(back.join('; '));
  return back;
}

describe('flashRetiredArrayWiringNotice', () => {
  it('flashes once per project and records its id', () => {
    const p = savedProject(2, 'series');
    const said: string[] = [];
    const after = flashRetiredArrayWiringNotice(p, [], m => said.push(m));
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/2 drivers were wired in series/);
    expect(after).toEqual([p.uuid()]);
    flashRetiredArrayWiringNotice(p, after, m => said.push(m));
    expect(said).toHaveLength(1);
  });

  it('says nothing for one driver or no project', () => {
    const said: string[] = [];
    expect(flashRetiredArrayWiringNotice(savedProject(1, 'parallel'), [], m => said.push(m))).toEqual([]);
    expect(flashRetiredArrayWiringNotice(null, [], m => said.push(m))).toEqual([]);
    expect(said).toEqual([]);
  });
});
