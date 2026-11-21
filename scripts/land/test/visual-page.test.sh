#!/usr/bin/env bash
# The before/after page of a landed visual change is made by scripts/feedback/feedback-page.py: one item per
# picture with its own board link, every picture marked by mark-diff.py, a "What to do" first line.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"; trap 'rm -rf "$SCRATCH"' EXIT
GALLERY_BIN="${VISUAL_GALLERY_BIN:-$REPO/scripts/feedback}"
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }

python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw, PngImagePlugin
d = sys.argv[1]
a = Image.new("RGB", (1800, 800), "white"); b = a.copy()
ImageDraw.Draw(b).rectangle((400, 300, 800, 400), fill="black")
stamp = PngImagePlugin.PngInfo()
stamp.add_text("stamp", "source=review; build=example; viewport=1800x800")
a.save(f"{d}/a.png", pnginfo=stamp); b.save(f"{d}/b.png"); a.save(f"{d}/same.png")
ci_stamp = PngImagePlugin.PngInfo()
ci_stamp.add_text("openisd-visual-run", "run=123456")
Image.new("RGB", (300, 400), "white").save(f"{d}/diff.png", pnginfo=ci_stamp)
PY
cat > "$SCRATCH/entries.json" <<JSON
[{"name":"mobile-tab-box","before":"$SCRATCH/a.png","after":"$SCRATCH/b.png","diff":"$SCRATCH/diff.png"},
 {"name":"mobile-tab-graph","before":"$SCRATCH/a.png","after":"$SCRATCH/same.png","diff":null},
 {"name":"mobile-menu","before":null,"after":"$SCRATCH/b.png","diff":null}]
JSON
out="$SCRATCH/page"
node "$REPO/scripts/visual/diff-page.mjs" "$out" "What changed on screen" "$SCRATCH/entries.json" picture-review "The box got bigger." > "$SCRATCH/log.txt" 2>&1 \
  && ok "page written" || fail "diff-page failed: $(cat "$SCRATCH/log.txt")"
[ -s "$out/index.html" ] && grep -q "What to do" "$out/index.html" && ok "index.html is the shared feedback page with a What to do line" || fail "no feedback page"
if python3 - "$out" <<'PY'
from html import unescape
from itertools import combinations
from pathlib import Path
import re
import sys

page = Path(sys.argv[1])
html = (page / "index.html").read_text().split("<script>", 1)[0]
paragraphs = [unescape(re.sub(r"<[^>]+>", "", p)) for p in re.findall(r"<p\b[^>]*>(.*?)</p>", html, re.S)]
# The viewer renders the Look at column as one paragraph per comparison.
paragraphs.extend(row.split("|")[5].strip() for row in (page / "index.md").read_text().splitlines()[3:])
for first, second in combinations(paragraphs, 2):
    if first in second or second in first:
        sys.exit(f"Repeated paragraph text: {first!r} and {second!r}")
PY
then
  ok "no paragraph repeats another paragraph's text"
else
  fail "a paragraph repeats another paragraph's text"
fi
rows=$(grep -c '^| Phone, ' "$out/index.md" 2>/dev/null || true)
[ "$rows" = 3 ] && ok "index.md has one row per screen" || fail "index.md rows: $rows"
for f in mobile-tab-box.before mobile-tab-box.after mobile-tab-box.diff mobile-tab-graph.before mobile-tab-graph.after mobile-menu.after; do
  python3 -c "import sys; from PIL import Image; sys.exit(0 if Image.open(sys.argv[1]).text.get('marked') == '1' else 1)" "$out/$f.png" \
    && ok "$f.png is marked" || fail "$f.png is not marked"
done
if python3 - "$out" <<'PY'
import json
from pathlib import Path
import re
import sys
from PIL import Image

page = Path(sys.argv[1])
links = re.findall(r"\]\(([^)]+\.png)\)", (page / "index.md").read_text())
html = (page / "index.html").read_text()
match = re.search(r'<script type="application/json" id="picture-data">(.*?)</script>', html)
assert match, "page lacks display-copy and stamp data"
pictures = json.loads(match.group(1))
assert set(pictures) == set(links) and len(links) == 6
assert pictures["mobile-tab-box.before.png"]["stamp"] == "source=review; build=example; viewport=1800x800"
assert pictures["mobile-tab-box.diff.png"]["stamp"] == "run=123456"
assert pictures["mobile-tab-box.after.png"]["stamp"] is None
for png, picture in pictures.items():
    assert picture["src"] == Path(png).with_suffix(".webp").name
    with Image.open(page / png) as full, Image.open(page / picture["src"]) as display:
        assert full.format == "PNG" and full.text["marked"] == "1"
        assert display.format == "WEBP" and display.width == min(full.width, 900)
        assert abs(display.height - full.height * display.width / full.width) <= 1
        assert picture["stamp"] == (full.text.get("stamp") or full.text.get("openisd-visual-run"))
        if png == "mobile-tab-box.after.png":
            assert full.size == (1800, 800) and display.size == (900, 400)
            # The red box's left edge survives on each row through the middle of the rectangle.
            for y in range(170, 190):
                edge = [display.getpixel((x, y)) for x in range(196, 201)]
                assert any(r - max(g, b) > 100 for r, g, b in edge)
PY
then
  ok "every picture has a marked full-size PNG link, a WebP at most 900 px wide, and its stamp data"
else
  fail "display copies, links or stamp data are wrong"
fi
[ ! -e "$out/mobile-menu.before.png" ] && ok "a new screen has no before picture" || fail "new screen has a before"
grep -q "Look at" "$out/index.md" || grep -qi "look" "$out/index.md" && ok "rows carry a Look at statement" || fail "no Look at"

# Grouping: pairs whose changed box is at the same place and size are one group (leader + "Same as" followers);
# a different box, or a pair with no box, is its own group.
python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
for name, box in (("g1", (40, 100, 200, 140)), ("g2", (42, 102, 202, 142)), ("g3", (40, 300, 200, 340))):
    a = Image.new("RGB", (300, 400), "white"); b = a.copy()
    ImageDraw.Draw(b).rectangle(box, fill="black")
    a.save(f"{d}/{name}.a.png"); b.save(f"{d}/{name}.b.png")
PY
cat > "$SCRATCH/groups.json" <<JSON
[{"name":"mobile-tab-driver","before":"$SCRATCH/g1.a.png","after":"$SCRATCH/g1.b.png","diff":null},
 {"name":"mobile-tab-signal","before":"$SCRATCH/g2.a.png","after":"$SCRATCH/g2.b.png","diff":null},
 {"name":"mobile-tab-filters","before":"$SCRATCH/g3.a.png","after":"$SCRATCH/g3.b.png","diff":null},
 {"name":"mobile-empty","before":null,"after":"$SCRATCH/g1.b.png","diff":null}]
JSON
gout="$SCRATCH/groups"
node "$REPO/scripts/visual/diff-page.mjs" "$gout" "What changed on screen" "$SCRATCH/groups.json" picture-review "The box moved." > "$SCRATCH/glog.txt" 2>&1 \
  && ok "grouped page written" || fail "grouped diff-page failed: $(cat "$SCRATCH/glog.txt")"
grep -q "3 group(s)" "$SCRATCH/glog.txt" && ok "four screens make 3 groups" || fail "group count: $(cat "$SCRATCH/glog.txt")"
grep -q '^| Phone, Driver tab .*1 more picture, folded below. |  |$' "$gout/index.md" && ok "same box: the first picture leads and says '1 more'" || fail "leader row: $(grep 'Driver tab' "$gout/index.md")"
grep -q '^| Phone, Signal tab .*| Phone, Driver tab |$' "$gout/index.md" && ok "same box: the second picture is folded under the first" || fail "follower row: $(grep 'Signal tab' "$gout/index.md")"
grep -q '^| Phone, Filters tab .*|  |$' "$gout/index.md" && ! grep '^| Phone, Filters tab' "$gout/index.md" | grep -q "more picture" && ok "different box: its own group" || fail "g3 row: $(grep 'Filters tab' "$gout/index.md")"
grep -q '^| Phone, no project open .*|  |$' "$gout/index.md" && ok "no box (new screen): its own group" || fail "gnew row: $(grep 'no project' "$gout/index.md")"
# Plain words: no task id, file name or jargon in the page. The note goes under the title. The first picture's
# Look at line names the screen and points to the red boxes. A folded picture points to the first picture.
for bad in 'T9' 'baseline' 'landed' '\.png' 'mobile-'; do
  sed -e 's/\[[a-z]*\]([^)]*\.png)//g' "$gout/index.md" | grep -qE "$bad" && fail "page text holds '$bad'" || ok "page text has no '$bad'"
done
head -1 "$gout/index.md" | grep -qx '# What changed on screen' && ok "title says what changed" || fail "title: $(head -1 "$gout/index.md")"
grep -A1 -Fx '<h1>What changed on screen</h1>' "$gout/index.html" | grep -qx '<p class="note">The box moved\.</p>' && ok "the note shows under the title" || fail "no note under the title"
grep -q '^| Phone, Driver tab .*| Phone, Driver tab, the red boxes show what changed\.' "$gout/index.md" && ok "leader Look at names the screen and points to the red boxes" || fail "leader look: $(grep 'Driver tab' "$gout/index.md")"
grep -q '| Phone, Signal tab, the same change as the first picture of this group\. |' "$gout/index.md" && ok "follower Look at points at the first picture" || fail "follower look"
for screen in 'Filters tab' 'no project open'; do
  grep -q "^| Phone, $screen |.*| Phone, $screen, the red boxes show what changed |" "$gout/index.md" \
    && ok "$screen Look at names the screen and points to the red boxes" || fail "$screen Look at: $(grep "^| Phone, $screen |" "$gout/index.md")"
done
grep -q '^| Phone, Driver tab |  |  |' "$gout/index.md" && ok "Task and State columns are empty" || fail "task/state not empty"
# Union-box grouping and leader: a second small box inside the same area keeps the pair in the group, and a pair with
# fewer boxes leads even though its name sorts later.
python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
for name, boxes in (("u1", [(40, 100, 100, 140), (140, 100, 200, 140)]), ("u2", [(42, 102, 202, 142)])):
    a = Image.new("RGB", (300, 400), "white"); b = a.copy()
    for box in boxes: ImageDraw.Draw(b).rectangle(box, fill="black")
    a.save(f"{d}/{name}.a.png"); b.save(f"{d}/{name}.b.png")
PY
cat > "$SCRATCH/union.json" <<JSON
[{"name":"desktop-empty","before":"$SCRATCH/u1.a.png","after":"$SCRATCH/u1.b.png","diff":null},
 {"name":"desktop-tab-box","before":"$SCRATCH/u2.a.png","after":"$SCRATCH/u2.b.png","diff":null}]
JSON
node "$REPO/scripts/visual/diff-page.mjs" "$SCRATCH/union" "What changed on screen" "$SCRATCH/union.json" picture-review "x" > "$SCRATCH/ulog.txt" 2>&1
grep -q "1 group(s)" "$SCRATCH/ulog.txt" && ok "union box: two pairs with different small boxes are one group" || fail "union group: $(cat "$SCRATCH/ulog.txt")"
grep -q '^| Desktop, Box tab .*|  |$' "$SCRATCH/union/index.md" && grep -q '^| Desktop, no project open .*| Desktop, Box tab |$' "$SCRATCH/union/index.md" && ok "leader is the pair with the fewest boxes, not the first by name" || fail "leader: $(cat "$SCRATCH/union/index.md")"
node "$REPO/scripts/visual/screen-names.test.mjs" > "$SCRATCH/names.txt" 2>&1 && ok "plain screen names cover every baseline" || fail "screen names: $(cat "$SCRATCH/names.txt")"
# feedback_page_group_test.mjs exercises the fold and the links with only the page viewer's resources.
exit "$fails"
