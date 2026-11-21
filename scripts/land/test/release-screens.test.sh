#!/usr/bin/env bash
# Exercise the release comparison against real Git objects and small lossless pictures.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
scratch="$(mktemp -d)"; trap 'rm -rf "$scratch"' EXIT
mkdir "$scratch/repo"
cd "$scratch/repo"
git init -qb main
git config user.name Test
git config user.email test@example.test
mkdir -p scripts
cp -r "$REPO/scripts/visual" "$REPO/scripts/feedback" scripts/
snap=packages/ui/test/visual/visual.browser.spec.ts-snapshots
mkdir -p "$snap"
git commit -qm 'before baselines' --allow-empty
early="$(git rev-parse HEAD)"
python3 - "$snap" <<'PY'
import sys
from pathlib import Path
from PIL import Image
for name in ("desktop-tab-enclosure", "desktop-tab-box", "desktop-tab-driver", "mobile-tab-enclosure", "mobile-tab-driver"):
    Image.new("RGBA", (64, 64), (12, 34, 56, 255)).save(Path(sys.argv[1]) / f"{name}.png")
PY
git add "$snap"; git commit -qm before
old="$(git rev-parse HEAD)"
git branch before
git rm -q "$snap/mobile-tab-enclosure.png"
python3 - "$snap" <<'PY'
import sys
from pathlib import Path
from PIL import Image, PngImagePlugin
snap = Path(sys.argv[1])
for name, box in (("desktop-tab-enclosure", (0, 0, 2, 2)), ("desktop-tab-box", (20, 20, 30, 30))):
    path = snap / f"{name}.png"
    with Image.open(path) as src:
        image = src.copy()
    image.paste((13, 34, 56, 254), box)
    image.save(path)
meta = PngImagePlugin.PngInfo()
meta.add_text("openisd-visual-run", "run=42")
Image.new("RGBA", (64, 64), (12, 34, 56, 255)).save(snap / "desktop-tab-driver.png", pnginfo=meta)
Image.new("RGB", (64, 64), "#729aef").save(snap / "mobile-tab-box.png")
Image.new("RGB", (64, 65), (12, 34, 56)).save(snap / "mobile-tab-driver.png")
PY
git add "$snap"; git commit -qm after
new="$(git rev-parse HEAD)"
printf '| 1.0.1 | 20261119T0100Z | Date | `%s` |\n| 1.0.0 | 20261118T0100Z | Date | `%s` |\n|  | 20261117T0100Z | Date | `%s` |\n' \
  "${new:0:9}" "${old:0:9}" "${early:0:9}" > RELEASES.md
export VISUAL_PAGES_DIR="$scratch/pages"
unset VISUAL_PAGES_URL
if out="$(bash scripts/visual/compare-releases.sh 1.0.9 1.0.1 2>&1)" || [[ "$out" != *"cannot resolve '1.0.9'"* ]]; then
  echo "unknown release did not give a clear refusal: $out"; exit 1
fi
compare() {
  local out
  out="$(bash scripts/visual/compare-releases.sh "$@")"
  page="$(find "$VISUAL_PAGES_DIR" -name index.html)"
  [[ -s "$page" ]] || { echo "$out"; return 1; }
  folder="$(dirname "$page")"
}
# Branch and SHA, public versions, and a date-stamped release without baselines.
compare before "$new"
cp "$folder/index.md" "$scratch/git.md"
rm -rf "$folder"
compare 1.0.0 1.0.1
diff -u <(tail -n +2 "$scratch/git.md") <(tail -n +2 "$folder/index.md")
rm -rf "$folder"
compare 20261117T0100Z 1.0.0
grep -Fq "Before $early · After $old" "$page"
[[ "$(find "$folder" -name '*.after.png' | wc -l)" = 5 && -z "$(find "$folder" -name '*.before.png')" ]]
rm -rf "$folder"
compare 1.0.0 1.0.1
[[ ! -e "$folder/desktop-tab-driver.before.png" && ! -e "$folder/mobile-tab-box.before.png" && ! -e "$folder/mobile-tab-enclosure.after.png" ]]
python3 - "$page" <<'PY'
import json
import re
import sys
from pathlib import Path
from PIL import Image

page = Path(sys.argv[1])
html = page.read_text()
rows = json.loads(re.search(r'<script type="application/json" id="standalone-rows">(.*?)</script>', html)[1])
assert [re.findall(r'\(([^)]*)\)', row[3])[0].rsplit(".", 2)[0] for row in rows] == [
    "desktop-tab-box", "desktop-tab-enclosure", "mobile-tab-box",
    "mobile-tab-enclosure", "mobile-tab-driver",
]
assert [row[6] for row in rows] == [
    "Desktop · Box tab", "Desktop · Box tab", "Phone · Box tab", "Phone · Box tab", "Phone · Driver tab",
]
for side, value, alpha in (("before", 12, 255), ("after", 13, 254)):
    with Image.open(page.parent / f"desktop-tab-box.{side}.png") as crop:
        assert crop.size == (34, 34) and crop.text["marked"] == "1"
        assert crop.getpixel((12, 12)) == (value, 34, 56, alpha)
with Image.open(page.parent / "desktop-tab-enclosure.after.png") as crop:
    assert crop.size == (14, 14)
with Image.open(page.parent / "mobile-tab-driver.after.png") as crop:
    assert crop.size == (64, 13)
with Image.open(page.parent / "mobile-tab-box.after.png") as crop:
    assert crop.size == (64, 64)
assert "Your comment" in html
PY
git diff --exit-code -- "$snap"
[[ ! -e docs/releases/screens ]]
rm -rf "$folder"
compare 1.0.1 main
grep -Fq 'No screens changed' "$page"
echo "ok   release comparisons read Git, crop changed pixels and group screens by device and tab"
