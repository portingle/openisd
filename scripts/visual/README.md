# Visual change page

After a landing changes visual baselines, `publish-changes.sh <task> <base> <head>` writes a before/after page
for John (`diff-page.mjs` builds it, `scripts/feedback/feedback-page.py` renders it,
`scripts/feedback/mark-diff.py` draws the red boxes).

Set `VISUAL_PAGES_URL` to the URL serving your machine's pages directory. The directory
defaults to `visual-pages` next to the checkout. Set `VISUAL_PAGES_DIR` to change it.

## Release screen history

`bash scripts/visual/release-screens.sh 7.0.960` archives the PNG baselines from the commit
recorded for that release in [RELEASES.md](../../RELEASES.md). The release ledger task includes
the index and lossless WebP files from [docs/releases/screens](../../docs/releases/screens).
For early ledger entries with a blank version, use their build stamp. A release that predates
visual baselines has an index with zero screens.

`bash scripts/visual/compare-releases.sh 7.0.959 7.0.960` prints the path of an on-demand page
under `VISUAL_PAGES_DIR`. Either argument can also be a Git commit or branch. The script uses
the WebP archive when available and reads the baselines from Git otherwise. It ranks screens
by the percentage of differing pixels, with added and removed screens at 100%.

Open the generated `index.html` locally or use the additional link printed when
`VISUAL_PAGES_URL` is set. The feedback board supplies the comment boxes when available.
A locally opened page has text boxes for the current session.

The archive uses Pillow with WebP support. Comparisons use the visual tools' existing
NumPy dependency. The scripts look for Python in the active environment and the workspace
virtual environments. Set `VISUAL_PYTHON` to choose a different executable.

## Grouping rule

- Pairs that show the same change are one group. "Same change" = mark-diff's changed boxes (`--print-box`)
  have the same position and size within 8 px (`BOX_TOLERANCE` in `diff-page.mjs`), compared to the group's first pair.
- A pair with no box (new screen, removed screen, no visible difference, change fills the picture) is its own group.
- A group shows its first pair, with its own "Look at:" line saying how many more pictures show the same change.
- The other pairs of the group sit in a closed fold under it: "Same change in N more pictures (show)".
  A group of one has no fold.
- Every picture, folded or not, keeps its OWN comment box and its own "Look at:" line. The fold only hides; it never drops a picture.

## How it is written

`index.md` has an optional sixth column, "Same as": the name of the group's first pair. The page template
(`feedback-page.template.html`) renders rows that name a leader inside the leader's fold.

## Tests

`bash scripts/test.sh scripts/land/test/visual-page.test.sh`,
`bash scripts/test.sh scripts/land/test/visual.e2e.test.sh`,
`bash scripts/test.sh scripts/land/test/release-screens.test.sh`,
`scripts/feedback/feedback_page_test.py`.
