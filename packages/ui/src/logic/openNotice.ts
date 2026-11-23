/**
 * The toast that tells the user what opening a stored project, a backup or a share link has to say (a
 * project saved by an earlier build, whose readouts are now calculated from the typed driver values):
 * one line per note, under the project's name. File > Open shows its own notes under
 * "Project imported from X" (`applicationIO.ts`).
 *
 * Several projects opened together (the open session at start-up) give one toast: the reports made in
 * one turn are gathered and shown once.
 */
import type {OpenNoticeReport} from '@openisd/persistence';

/** The handler `createProjectRepo` calls for each project opened with a note. `schedule` runs the
 *  gathered toast once the current turn is done (`queueMicrotask` in the app). */
export function createOpenNotice(flash: (msg: string) => void, schedule: (show: () => void) => void): (report: OpenNoticeReport) => void {
  let pending: string[] = [];
  return report => {
    if (pending.length === 0) {
      schedule(() => {
        const lines = pending;
        pending = [];
        flash(lines.join('\n'));
      });
    }
    pending.push(`Project opened: ${report.projectName}`, ...report.lines);
  };
}
