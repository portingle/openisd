# Passive radiator editor shows Date added in two formats

**Status:** FIXED (T852)
**Issue:** https://github.com/portingle/openisd/issues/157
**Reported by:** John, 16 Nov 2026 (test site v20261116T1935Z).

There are two forms of Date added, the dash-less stamp (20261116) and the dashed day (2026-09-12). A newly defined radiator was written as the stamp, existing catalogue records hold the dashed day, and the editor showed each as stored.

Fix: `isoDay` in `packages/design/fields/format.ts` is the one form shown (dashed). A blank radiator or driver record now stores the dashed day; the passive radiator editor and the driver editor show Date added through `isoDay`, so files saved earlier with the stamp read back dashed.
Tests: `packages/design/test/fields/format-date.test.ts`, `packages/design/test/domain/blank-device-id.test.ts`, `packages/ui/test/hooks/passiveRadiatorEditor.test.ts`.
