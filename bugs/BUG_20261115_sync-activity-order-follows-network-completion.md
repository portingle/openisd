# BUG_20261115_sync-activity-order-follows-network-completion

**Status:** FIXED in T793 (found when the Cloud sync dialog baselines drew two ways)

## Symptom
With two or more new items to upload, the Cloud sync dialog's Activity list (newest first) showed `Project "sample-project" sent` above `Project "complete-driver-project" sent`
in one run and the other way round in the next, for the same inputs (visual re-take run 43710725421, `desktop-dialog-cloud-confirm`).

## Cause
`syncEngine.ts` uploads new items four at a time and told Activity as each upload finished, so the order of the list was the order Drive happened to answer in. Once that was
fixed to the planned order, the list still varied between runs (CI re-take 43712316674): the plan follows the stored order, and a project's stored id is random.

## Fix
Activity is told after the uploads of the run, sorted by name. Test first: `syncEngine.test.ts`, "Activity lists uploaded items by name, not in the order Drive finished them in" (the first upload is the slowest, the docs are
given in reverse); it failed with `Box 1, Box 2, Box 0`.
