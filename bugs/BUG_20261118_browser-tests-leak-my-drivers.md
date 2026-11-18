# Browser tests leak My Drivers from one test to the next

Found by T921 (the vented-picker driver-count journey), "Separate finding" in
bugs/BUG_20261118_vented-picker-ignores-driver-count.md on branch t921.

## Symptom
`packages/ui/test/ui/new-project-wizard.browser.spec.ts` imports its own "Tang Band W5-1138SMF" into My Drivers
through the wizard's file input. The import stayed for every later test on the same Playwright worker, in other spec
files too. A later spec that took the first "W5-1138SMF" in the New Project list got the imported copy (10.60 L,
Fb 36.0028 Hz) instead of the catalogue driver (10.70 L, 35.9002 Hz).

## Cause
`resetApp` (packages/ui/test/fixtures.ts) put back the window, skin, projects, Options and sidebar width, and
`TestAdditions` undid init scripts, listeners, cookies, headers and media. Nothing emptied My Drivers, which the app
keeps in the browser's storage (`openisd_my_drivers`) and which the worker's shared page keeps between tests. The
app is right to keep it; the reset left it.

## Fix
`resetApp` now calls `emptyMyDrivers`: it opens Manage Drivers and presses the "Remove from My Drivers" cross on each
saved row, as a user does, until none is left (and fails the reset if one stays). It does not depend on a spec
registering what it made, and no test is changed. Not covered, no user path to empty them from the library: My Passive
Radiators and favourite stars (a spec that stars a driver or saves a radiator still carries that over).

## Proof
`packages/ui/test/ui/reset-between-tests.browser.spec.ts`: one test imports a driver through the wizard, the next test on
the same worker checks My Drivers holds no row. It failed before the fix (1 row left) and passes after.
