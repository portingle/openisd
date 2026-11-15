/**
 * What the visual baselines may and may not contain, as data (no browser imports, so a unit test can read it).
 * `screens.ts` leaves out what is named here; `architecture/visual-baselines-distinct.test.ts` proves the
 * committed pictures obey it: no two screens draw the same picture unless declared below, and no popup screen
 * draws the screen it was opened from (a popup that never opened).
 * Keys are the baseline's name without `.png`: `<skin>-<screen>`.
 */

/** The screen every popup is opened from: the complete-driver project open, nothing else. A popup picture equal to this one never opened. */
export const BASE_SCREEN = 'complete-project';

/** The same view reached under two names in the view index: pictured once, under the kept name. */
export const SAME_VIEW: ReadonlyMap<string, {readonly kept: string; readonly why: string}> = new Map([
  ['mobile-dialog-driver-import', {kept: 'mobile-dialog-driver-more', why: 'Import is a row of the More menu; the picture of the import itself is the browser\'s file chooser (see CANNOT_BE_SHOWN).'}],
  ['mobile-dialog-native-files', {kept: 'mobile-dialog-project-import', why: 'Both are the phone menu after Open a file raised the browser\'s file chooser; the chooser is not drawn by the page.'}],
  ['desktop-dialog-shared-winisd-difference-entry', {kept: 'desktop-dialog-difference-cue', why: 'The desktop differences dialog shows every entry unfolded; there is no entry to unfold (the phone has one, and is pictured).'}],
  ['desktop-dialog-driver-search-filters', {kept: 'desktop-dialog-driver-library-overview', why: 'The search filters are the top row of the Manage Drivers dialog; one dialog, one picture.'}],
  ['desktop-dialog-projects-new-vented-tuning-warning', {kept: 'desktop-dialog-projects-new-vented-volume-warning', why: 'The volume and the tuning warning are both on screen in the same wizard step: one screen.'}],
  ['mobile-dialog-phone-wizard-vented-tuning-warning', {kept: 'mobile-dialog-phone-wizard-vented-volume-warning', why: 'The volume and the tuning warning are both on screen in the same wizard step: one screen.'}],
  ['mobile-dialog-menu-splashmodal', {kept: 'mobile-dialog-about-version', why: 'The menu\'s About item and the About version view are the same About dialog (the build date is masked, so the pictures were identical).'}],
  ['mobile-dialog-menu-advanced', {kept: 'mobile-tab-advanced', why: 'The menu\'s Advanced item opens the Advanced page, which is the tab already pictured.'}],
]);

/** A view that cannot be photographed: the browser or the OS draws it, or opening it leaves the page unchanged. */
export const CANNOT_BE_SHOWN: ReadonlyMap<string, string> = new Map([
  ['desktop-dialog-projects-import-file', 'Import opens the browser\'s file chooser, which the page does not draw; nothing else opens, so the picture was the Box tab.'],
  ['desktop-dialog-driver-import-file', 'Import opens the browser\'s file chooser, which the page does not draw; the driver editor stays on its Parameters tab, which is pictured.'],
  ['mobile-dialog-native-keyboard', 'The on-screen keyboard is drawn by the OS; the page only gets a shorter window, and the picture showed no keyboard.'],
  ['mobile-dialog-refresh', '/about/refresh/ clears the old app files and replaces itself with the app: the page a user is left on is the app, which is the base screen. Its own "Updating" text is on screen for a moment only.'],
]);

/** Screens that draw the same picture because the screen is the same, each group named. */
export const SAME_PICTURE: readonly {readonly screens: readonly string[]; readonly why: string}[] = [
  {screens: ['desktop-wizard-abc-step4', 'desktop-wizard-bandpass6-step4'], why: 'Wizard step 4 holds the same fields for these two box types.'},
  {
    screens: ['desktop-wizard-abc-step5', 'desktop-wizard-bandpass4-step5', 'desktop-wizard-bandpass6-step5', 'desktop-wizard-sealed-step5', 'desktop-wizard-vented-step5'],
    why: 'Wizard step 5 (Project name and Description) does not depend on the box type.',
  },
];
