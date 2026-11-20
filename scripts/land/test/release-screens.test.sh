#!/usr/bin/env bash
# Exercise the archive and comparison against real Git objects and small lossless pictures.
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
for name in ("small", "large", "same", "removed"):
    Image.new("RGBA", (20, 20), (12, 34, 56, 0)).save(Path(sys.argv[1]) / f"{name}.png")
PY
git add "$snap"; git commit -qm before
old="$(git rev-parse HEAD)"
git branch before
git rm -q "$snap/removed.png"
python3 - "$snap" <<'PY'
import sys
from pathlib import Path
from PIL import Image, PngImagePlugin
snap = Path(sys.argv[1])
for name, box in (("small", (0, 0, 2, 2)), ("large", (0, 0, 10, 10))):
    path = snap / f"{name}.png"
    with Image.open(path) as src:
        image = src.copy()
    image.paste((200, 20, 30, 255), box)
    image.save(path)
meta = PngImagePlugin.PngInfo()
meta.add_text("openisd-visual-run", "run=42")
Image.new("RGBA", (20, 20), (12, 34, 56, 0)).save(snap / "same.png", pnginfo=meta)
Image.new("RGB", (20, 20), "#729aef").save(snap / "added.png")
PY
git add "$snap"; git commit -qm after
new="$(git rev-parse HEAD)"
printf '| 1.0.1 | 20261119T0100Z | Date | `%s` |\n| 1.0.0 | 20261118T0100Z | Date | `%s` |\n|  | 20261117T0100Z | Date | `%s` |\n' \
  "${new:0:9}" "${old:0:9}" "${early:0:9}" > RELEASES.md
archive=docs/releases/screens
if out="$(bash scripts/visual/release-screens.sh 1.0.9 2>&1)" || [[ "$out" != *'unknown release version'* ]]; then
  echo "unknown release did not give a clear refusal: $out"; exit 1
fi
bash scripts/visual/release-screens.sh 1.0.0
bash scripts/visual/release-screens.sh 1.0.0
bash scripts/visual/release-screens.sh 20261117T0100Z
grep -Fq "$early" "$archive/20261117T0100Z/index.md"
grep -Fq 'No visual baselines' "$archive/20261117T0100Z/index.md"
grep -Fq "$old" "$archive/1.0.0/index.md"
[[ "$(find "$archive/1.0.0" -name '*.webp' | wc -l)" = 4 ]]
git show "$old:$snap/small.png" > "$scratch/original.png"
python3 - "$scratch/original.png" "$archive/1.0.0/small.webp" <<'PY'
import sys
from PIL import Image
with Image.open(sys.argv[1]) as png, Image.open(sys.argv[2]) as webp:
    assert webp.format == "WEBP" and png.size == webp.size
    assert png.convert("RGBA").tobytes() == webp.convert("RGBA").tobytes()
PY

export VISUAL_PAGES_DIR="$scratch/pages"
unset VISUAL_PAGES_URL
compare() {
  local out
  out="$(bash scripts/visual/compare-releases.sh "$@")"
  page="$(find "$VISUAL_PAGES_DIR" -name index.html)"
  [[ -s "$page" ]] || { echo "$out"; return 1; }
  folder="$(dirname "$page")"
}
# Git fallback (branch and SHA), mixed sources (stored old release, Git new release), then both stored.
compare before "$new"
cp "$folder/index.md" "$scratch/git.md"
rm -rf "$folder"
compare 1.0.0 1.0.1
diff -u <(tail -n +2 "$scratch/git.md") <(tail -n +2 "$folder/index.md")
rm -rf "$folder"
bash scripts/visual/release-screens.sh 1.0.1
compare 1.0.0 1.0.1
diff -u <(tail -n +2 "$scratch/git.md") <(tail -n +2 "$folder/index.md")
[[ "$(grep -oE '\]\([a-z]+\.(before|after)\.png\)' "$folder/index.md" | cut -d. -f1 | uniq)" = $'](added\n](removed\n](large\n](small' ]]
[[ ! -e "$folder/same.before.png" && ! -e "$folder/added.before.png" && ! -e "$folder/removed.after.png" ]]
python3 -c 'from PIL import Image; import sys; assert Image.open(sys.argv[1]).text["marked"] == "1"' "$folder/large.after.png"
python3 - "$page" <<'PY'
import json
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text()
rows = json.loads(re.search(r'<script type="application/json" id="standalone-rows">(.*?)</script>', html)[1])
assert [row[0] for row in rows] == ["added", "removed", "large", "small"]
assert "Your comment" in html
PY
rm -rf "$folder"
compare 1.0.1 main
grep -Fq 'No screens changed' "$page"
echo "ok   release screens retain exact pixels and compare only changed screens in rank order"
