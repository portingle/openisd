"""Compare visual baselines from Git commits named by the release ledger."""

import argparse
from io import BytesIO
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


SCRIPTS = Path(__file__).resolve().parent
LEDGER_ROW = re.compile(
    r"^\| *(?P<version>\d+\.\d+\.\d+)? *\| *(?P<stamp>\d{8}T\d{4}Z) *\|[^|]*\| *`(?P<commit>[0-9a-f]{7,40})` *\|",
    re.MULTILINE,
)


def git(*args, **kwargs):
    return subprocess.check_output(["git", *args], **kwargs)


def commit_for(ref):
    try:
        return git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}",
                   stderr=subprocess.DEVNULL).decode().strip()
    except subprocess.CalledProcessError:
        raise ValueError(f"cannot resolve '{ref}' to a commit in Git") from None


def baseline_blobs(commit, snapshot_dir):
    entries = git("ls-tree", "-rz", commit, "--", f"{snapshot_dir}/").split(b"\0")
    screens = {}
    for entry in filter(None, entries):
        fields, name = entry.split(b"\t", 1)
        _, kind, blob = fields.decode("ascii").split()
        path = Path(os.fsdecode(name)).relative_to(snapshot_dir)
        if kind == "blob" and path.suffix == ".png":
            screens[path.with_suffix("").as_posix()] = blob
    return screens


def comparison_images(screens, side_dir, names):
    blobs = {name: screens[name] for name in names if name in screens}
    if not blobs:
        return {}
    # One Git process reads the blobs in order. Their lengths keep the PNG bytes untouched.
    request = "".join(f"{blob}\n" for blob in blobs.values()).encode("ascii")
    paths = {}
    with BytesIO(git("cat-file", "--batch", input=request)) as data:
        for name, blob in blobs.items():
            header = data.readline().decode("ascii").split()
            if len(header) != 3 or header[:2] != [blob, "blob"]:
                raise ValueError(f"cannot read the Git blob for {name}")
            path = side_dir / f"{name}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data.read(int(header[2])))
            data.read(1)  # batch delimiter
            paths[name] = path
    return paths


def compare(old, new, ledger, snapshot_dir, pages):
    old_commit, new_commit = (commit_for(ledger.get(label, label)) for label in (old, new))
    before, after = (baseline_blobs(commit, snapshot_dir) for commit in (old_commit, new_commit))
    names = sorted(name for name in before.keys() | after.keys() if before.get(name) != after.get(name))
    pages = pages.resolve()
    pages.mkdir(parents=True, exist_ok=True)
    old_slug, new_slug = (re.sub(r"[^a-zA-Z0-9._-]+", "-", label)[:50] for label in (old, new))
    out = Path(tempfile.mkdtemp(prefix=f"releases-{old_slug}-to-{new_slug}-", dir=pages))
    try:
        with tempfile.TemporaryDirectory(prefix="release-compare-") as tmp:
            work = Path(tmp)
            left = comparison_images(before, work / "before", names)
            right = comparison_images(after, work / "after", names)
            entries = [{"name": name, "before": left.get(name), "after": right.get(name)} for name in names]
            manifest = work / "entries.json"
            manifest.write_text(json.dumps(entries, default=str), encoding="utf-8")
            note = f"Before {old_commit} · After {new_commit}"
            subprocess.run(["node", SCRIPTS / "diff-page.mjs", out, f"OpenISD {old} → {new}",
                            manifest, note, "--ranked"], check=True)
        out.chmod(0o755)
    except BaseException:
        shutil.rmtree(out)
        raise
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot_dir")
    parser.add_argument("pages", type=Path)
    parser.add_argument("--latest-pair", type=Path, metavar="LEDGER")
    parser.add_argument("refs", nargs="*", metavar="REF")
    args = parser.parse_args()
    ledger_path = args.latest_pair or Path("RELEASES.md")
    contents = ledger_path.read_text(encoding="utf-8") if args.latest_pair or ledger_path.is_file() else ""
    rows = list(LEDGER_ROW.finditer(contents))
    ledger = {label: row["commit"] for row in rows for label in (row["stamp"], row["version"]) if label}
    url = os.environ.get("VISUAL_PAGES_URL")
    if args.latest_pair:
        if args.refs:
            parser.error("--latest-pair takes the two releases from the ledger")
        if len(rows) < 2:
            return
        if not url:
            raise ValueError(f"Set VISUAL_PAGES_URL to the URL serving {args.pages} on this machine.")
        new, old = (row["version"] or row["stamp"] for row in rows[:2])
    else:
        if len(args.refs) != 2:
            parser.error("give exactly two release versions or Git refs")
        old, new = args.refs
    out = compare(old, new, ledger, args.snapshot_dir, args.pages)
    if url:
        link = f"{url.rstrip('/')}/{out.name}/index.html"
        print(f"release: visual comparison: {link}" if args.latest_pair else link)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f"visual: {error}")
