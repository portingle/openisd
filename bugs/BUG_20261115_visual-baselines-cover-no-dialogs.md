# BUG_20261115_visual-baselines-cover-no-dialogs

**Status:** FIXED by T793 (the left-out views below are listed with their reasons)

## Symptom

The visual baselines (`packages/ui/test/visual/screens.ts`) pictured only the empty screen, the wizard steps,
the main tabs, the phone menu and the box types. No dialog, popup, sheet, menu or help panel had a baseline,
so a change that broke one (clipped, moved, restyled) turned nothing red. T230 had said "every screen in both
skins". John: "every screen in the app is meant to have regression testing".

## Steps to reproduce (before T793)

1. `grep -c "screen(" packages/ui/test/visual/screens.ts`: 60 screens, none of them a dialog.
2. Change the Options dialog's padding and run `bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts`.
3. Observed: every visual test passes. Expected: `desktop-dialog-settings-options-general` and the phone
   Options screens fail.

## Evidence

- `packages/ui/test/fixtures/viewIndex.ts` lists every view and popup in both skins, and `fixtures/viewOpen.ts`
  `openTargets()` gives each (view, skin) a real-UI open step (the layout walk uses them). None of them reached
  `screens.ts`.

## Fix (T793)

`screens.ts` now adds one screen per popup in `openTargets()`: kinds dialog, sheet, menu, help, field note,
warning popup, error popup, inline expansion and driver browser. Each tab of a tabbed dialog is its own view.
Each opens from the complete-driver project, through the same open steps the layout walk uses. That makes 182
new baselines (82 desktop, 100 phone); with the 60 before, 242 screens. Pages, tabs and wizard steps were
already pictured.

### Found on the way: a frozen clock broke clicks

`VisualSkin.start` used `page.clock.setFixedTime`. Vue skips an event handler attached at or after the event's
`Date.now()` stamp (`runtime-dom` invoker, `e._vts <= invoker.attached`). With a frozen clock every stamp is
equal, so a parent's `@click.stop` never ran. Example: the phone menu's Save As / Export opened and the click
then reached the document listener, which closed it again. The clock now starts at `FIXTURE_DATE` and runs
(`clock.install` + `clock.resume`). All 60 earlier baselines came out unchanged.

### Masked parts (each on every popup screen; a selector that matches nothing masks nothing)

| Part                                                         | Selector                             | Why                                                        |
| ------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| "This site uses … of the … this browser allows"              | `.su-site`                           | The browser works the storage quota out from the disk.      |
| "Projects saved in this browser at http://localhost:<port>/" | `.store-label`                       | The test server's port is one of a pool (4100-4107).        |
| Phone About "Build · <date>"                                 | `[data-testid="about-version-line"]` | The build's own date.                                       |

The build stamp in the toolbar was masked before T793 and still is.

### Not pictured, and why

| View                                                                  | Skin    | Why                                                                                                     |
| --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `shared/flash-message`, `phone/flash-strip`                           | both    | Fade out by design a few seconds after they show; no stable picture.                                    |
| `diagnostic-repairs`, `desktop/diagnostic-repairs`                    | both    | The fault report prints a stack trace naming the hashed bundle (`main-<hash>.js`) and the test port.    |
| `startup-failure`, `desktop/startup-failure`                          | both    | Same: a stack trace with the bundle hash and the port.                                                  |
| `phone/cloud-reconnect-strip`, `phone/cloud-conflict-notice`, `phone/cloud-hint` | phone   | The Box page behind the strip differs between runs: BUG_20261115_mobile-wizard-box-type-select-width-varies. |
| `cloud`, `cloud-confirm`, `desktop/settings/cloud/account-and-activity`, `desktop/cloud-confirm` | both | The Cloud sync dialog says "Retrying at <time>": now plus the retry delay, so the minute depends on how long the run took (13:00 in one run, 13:01 in the next). |
| `native-select`, `native-colour`, `native-title`, `desktop/projects/trace-colour-picker` | as listed | Drawn by the browser or the OS (`NoOpenReason.BrowserOwned`).                         |
| `cross-tab`, `desktop/cross-tab-notice`, `shared/driver-library-storage-note`, `phone/response-model-pending-notice`, `desktop/enclosure/response-model-pending-notice`, `desktop/results/chart-unavailable-notice`, `desktop/wizard-help` | as listed | The index lists a view the app cannot show (`NoOpenReason.IndexDisagrees`). |

Pages and tabs not yet pictured (charts, filter cards and editors, the desktop enclosure tabs and What-if panel,
the phone Box page per box type): about 100 more. Those are screens, not popups, and are outside T793.

### Seen while reviewing the pictures (not changed here)

- The existing baselines `mobile-wizard-bandpass6-step3` and `mobile-wizard-bandpass4-step3` each failed once on a re-run: the same box-type width flake
  as BUG_20261115_mobile-wizard-box-type-select-width-varies. T793 left main's picture in place.
