# Visual change page

After a landing changes visual baselines, `publish-changes.sh <task> <base> <head>` writes a before/after page
for John (`diff-page.mjs` builds it, `scripts/feedback/feedback-page.py` renders it,
`scripts/feedback/mark-diff.py` draws the red boxes).
Set `VISUAL_FEEDBACK_ITEM` to the live decision board card ID before publishing changed baselines or a failure page.

## Grouping rule

- Pairs that show the same change are one group. "Same change" = mark-diff's changed boxes (`--print-box`)
  have the same position and size within 8 px (`BOX_TOLERANCE` in `diff-page.mjs`), compared to the group's first pair.
- A pair with no box (new screen, removed screen, no visible difference, change fills the picture) is its own group.
- A group shows its first pair. Its "Look at:" line names the screen, points to the red boxes and says how many pictures are folded below when there are more.
- The other pairs of the group sit in a closed fold under it: "Same change in N more pictures (show)".
  A group of one has no fold.
- Every picture has a link to comment on the board. A folded pair's "Look at:" line names its screen and points to the group's first picture.

## How it is written

`index.md` has an optional sixth column, "Same as": the name of the group's first pair. The page template
(`feedback-page.template.html`) renders rows that name a leader inside the leader's fold.

## Tests

`bash scripts/land/test/visual-page.test.sh`, `scripts/feedback/feedback_page_test.py`.
