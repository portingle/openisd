/** The one-time note, when a project saved before QO941 with several drivers is first in front of the user,
 *  that its impedance chart changed (the wiring of several drivers is no longer applied, as WinISD's).
 *  The words are the design layer's (`OpenISDProject.retiredArrayWiringNotice`). */
import type {OpenISDProject} from '@openisd/design';

export function flashRetiredArrayWiringNotice(project: OpenISDProject | null, noticed: string[], flash: (msg: string) => void): string[] {
  if (project === null) return noticed;
  const id = project.uuid();
  if (noticed.includes(id)) return noticed;
  const notice = project.retiredArrayWiringNotice();
  if (notice === null) return noticed;
  flash(notice);
  return [...noticed, id];
}
