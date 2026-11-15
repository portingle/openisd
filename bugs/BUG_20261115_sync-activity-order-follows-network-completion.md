# BUG_20261115_sync-activity-order-follows-network-completion

**Status:** FIXED in T793 (found when the Cloud sync dialog baselines drew two ways)

## Symptom
With two or more new items to upload, the Cloud sync dialog's Activity list (newest first) showed `Project "sample-project" sent` above `Project "complete-driver-project" sent`
in one run and the other way round in the next, for the same inputs (visual re-take run 43710725421, `desktop-dialog-cloud-confirm`).

## Cause
`syncEngine.ts` uploads new items four at a time and told Activity as each upload finished, so the order of the list was the order Drive happened to answer in.

## Fix
Activity is told after the uploads of the run, in the order the items were planned. Test first: `syncEngine.test.ts`, "Activity lists the items in the order they were planned, not the order
Drive finished them in" (the first upload is the slowest); it failed with `Box 1, Box 2, Box 0`.
