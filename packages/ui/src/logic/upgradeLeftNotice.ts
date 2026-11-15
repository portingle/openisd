/** The notice when the start-up update of saved projects left some as saved for want of room. The
 *  words are the design layer's (`projectsLeftNotice`). Shown until the user clicks Close. */
import {projectsLeftNotice} from '@openisd/design/fields';
import type {ConfirmPort} from './confirmPort.js';

export async function announceProjectsLeft(left: number, confirm: ConfirmPort): Promise<void> {
  const notice = projectsLeftNotice(left);
  if (notice === null) return;
  await confirm.ask({title: notice.title, message: notice.message, confirmLabel: 'Close', dismissal: 'buttonsOnly'});
}
