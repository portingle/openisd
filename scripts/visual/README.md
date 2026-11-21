# Visual change page

After a landing changes visual baselines, `publish-changes.sh <task> <base> <head>` writes a before/after page
for John (`diff-page.mjs` builds it, `scripts/feedback/feedback-page.py` renders it,
`scripts/feedback/mark-diff.py` draws the red boxes).

Set `VISUAL_PAGES_URL` to the URL serving your machine's pages directory. The directory
defaults to `visual-pages` next to the checkout. Set `VISUAL_PAGES_DIR` to change it.

## Release comparisons

When promoting a release, `scripts/release.sh` compares it with the preceding release in
the ledger and prints the page link at `VISUAL_PAGES_URL`. It writes the page to the
workspace's `visual-pages` directory. The ledger task commits the release row and task file.

`bash scripts/visual/compare-releases.sh 7.0.959 7.0.960` prints the path of an on-demand page
under `VISUAL_PAGES_DIR`. It accepts versions or build stamps from
[RELEASES.md](../../RELEASES.md), plus Git refs. The comparison reads PNG baselines directly
from the two commits. It filters out identical pixels and shows each changed pair cropped
to its changed area with up to 12 pixels of context. Added and removed screens show in
full. Screens are grouped by device and tab or other screen family, with the largest
percentage of changed pixels first within each group.

Open the generated `index.html` locally or use the additional link printed when
`VISUAL_PAGES_URL` is set. The feedback board supplies the comment boxes when available.
A locally opened page has text boxes for the current session.

Comparisons use Pillow and NumPy. The scripts look for Python in the active environment
and the workspace virtual environments. Set `VISUAL_PYTHON` to choose a different executable.

### Capture noise

The baseline capture already fixes the storage estimate and starts the clock at the
fixture time in `VisualSkin.prepare`. It opens at a canonical URL via `standInForReleaseSite`
and applies the build-specific masks in `visual.browser.spec.ts`.
Any further masks belong on the relevant screen in `packages/ui/test/visual/screens.ts`.
For storage KB, target the numeric rows in Options → Your data (`.su-used` and
`.su-row dd`). For the bundled driver total, target the counts in About
(`.sp-stat` and the inline Open data count in `SplashContent.vue`). For a fluctuating
capture URL or timestamp, target the corresponding text element in that screen.
Older Git baselines can still contain these values.

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
