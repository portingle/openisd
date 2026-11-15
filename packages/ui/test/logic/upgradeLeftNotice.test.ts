import {describe, expect, it} from 'vitest';
import {announceProjectsLeft} from '../../src/logic/upgradeLeftNotice.js';
import type {ConfirmPort, ConfirmRequest} from '../../src/logic/confirmPort.js';

function confirmPort(): {port: ConfirmPort; asked: ConfirmRequest[]} {
  const asked: ConfirmRequest[] = [];
  return {asked, port: {ask: request => { asked.push(request); return Promise.resolve(true); }}};
}

describe('announceProjectsLeft', () => {
  it('asks nothing when no project was left', async () => {
    const {port, asked} = confirmPort();
    await announceProjectsLeft(0, port);
    expect(asked).toEqual([]);
  });

  it('shows a notice with a Close button, answered only by it, when some were left', async () => {
    const {port, asked} = confirmPort();
    await announceProjectsLeft(2, port);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({title: 'Some projects were not updated', confirmLabel: 'Close', dismissal: 'buttonsOnly'});
    expect(asked[0].message).toContain('2 projects could not be updated');
  });
});
