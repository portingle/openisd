# Visual baselines change on a re-take with no source change

Found 10 Nov 2026 while merging T742. Two runs of `scripts/visual/update.sh` in a row on unchanged T742 sources changed different step-3 wizard pictures: `mobile-wizard-bandpass6-step3` the first time, the passive-radiator step 3 the second time. The picture check passed in the PR checks, so it was not caught.

Effect: re-takes commit noise and hide real changes.

Next: find what differs between takes (animation, timer, late fonts, random seed), fix it at the source, and add a test that shoots the same view twice and requires identical pictures.
