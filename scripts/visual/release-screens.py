"""Archive and compare the visual baselines recorded in the release ledger."""

from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote, unquote

from PIL import Image


HISTORY = Path("docs/releases/screens")
SCRIPTS = Path(__file__).resolve().parent
LEDGER_ROW = re.compile(
    r"^\| *(?P<version>\d+\.\d+\.\d+)? *\| *(?P<stamp>\d{8}T\d{4}Z) *\|[^|]*\| *`(?P<commit>[0-9a-f]{7,40})` *\|",
    re.MULTILINE,
)
INDEX_COMMIT = re.compile(r"^Commit: `([0-9a-f]{40})`$", re.MULTILINE)
INDEX_SCREEN = re.compile(r"^- \[[^\n]+\]\(([^\s()]+\.webp)\)$", re.MULTILINE)


def git(*args, **kwargs):
    return subprocess.check_output(["git", *args], **kwargs)


def releases():
    ledger = Path("RELEASES.md")
    if not ledger.is_file():
        return {}
    return {
        row["version"] or row["stamp"]: row["commit"]
        for row in LEDGER_ROW.finditer(ledger.read_text(encoding="utf-8"))
    }


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


def read_blobs(screens):
    if not screens:
        return
    # One Git process reads the blobs in order, including their lengths so PNG bytes stay untouched.
    request = "".join(f"{blob}\n" for blob in screens.values()).encode("ascii")
    with BytesIO(git("cat-file", "--batch", input=request)) as data:
        for name, blob in screens.items():
            header = data.readline().decode("ascii").split()
            if len(header) != 3 or header[:2] != [blob, "blob"]:
                raise ValueError(f"cannot read the Git blob for {name}")
            yield name, data.read(int(header[2]))
            data.read(1)  # batch delimiter


def archived_screens(version, ledger_commit):
    folder = HISTORY / version
    index = folder / "index.md"
    if not index.is_file():
        return None
    contents = index.read_text(encoding="utf-8")
    commit = INDEX_COMMIT.search(contents)
    if not commit or not commit[1].startswith(ledger_commit):
        return None
    paths = {
        Path(unquote(link)).with_suffix("").as_posix(): folder / unquote(link)
        for link in INDEX_SCREEN.findall(contents)
    }
    files = set(folder.rglob("*.webp"))
    if set(paths.values()) != files:
        return None
    if not paths and "No visual baselines at this commit." not in contents:
        return None
    return paths


def encode_screen(folder, screen):
    name, png = screen
    path = folder / f"{name}.webp"
    path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(BytesIO(png)) as image:
        image.convert("RGBA").save(path, lossless=True, exact=True, method=4)
    return path.stat().st_size


def archive(version, snapshot_dir, ledger):
    if version not in ledger:
        raise ValueError(f"unknown release version '{version}' in RELEASES.md")
    commit = commit_for(ledger[version])
    screens = baseline_blobs(commit, snapshot_dir)
    folder = HISTORY / version
    if folder.exists():
        existing = archived_screens(version, commit)
        if existing is None or existing.keys() != screens.keys():
            raise ValueError(f"{folder} already exists and does not match release {version}")
        size = sum(path.stat().st_size for path in existing.values())
    else:
        HISTORY.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=HISTORY, prefix=".release-screens-") as tmp:
            staged = Path(tmp) / version
            staged.mkdir()
            with ThreadPoolExecutor(max_workers=4) as pool:
                size = sum(pool.map(lambda screen: encode_screen(staged, screen), read_blobs(screens)))
            index = [f"# OpenISD {version} screens", "", f"Commit: `{commit}`", "",
                     f"{len(screens)} screens · {size:,} bytes of lossless WebP", ""]
            index.extend(f"- [{name}]({quote(name + '.webp')})" for name in sorted(screens))
            if not screens:
                index.append("No visual baselines at this commit.")
            (staged / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
            staged.rename(folder)
    print(f"{folder}: {len(screens)} screens, {size:,} bytes of lossless WebP")


def comparison_side(label, ledger, snapshot_dir):
    if label in ledger:
        stored = archived_screens(label, ledger[label])
        if stored is not None:
            return stored
    return baseline_blobs(commit_for(ledger.get(label, label)), snapshot_dir)


def comparison_images(screens, side_dir, names):
    paths = {name: screens[name].resolve() for name in names if isinstance(screens.get(name), Path)}
    blobs = {name: screens[name] for name in names if isinstance(screens.get(name), str)}
    for name, png in read_blobs(blobs):
        path = side_dir / f"{name}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)
        paths[name] = path
    return paths


def compare(old, new, snapshot_dir, pages, ledger):
    before = comparison_side(old, ledger, snapshot_dir)
    after = comparison_side(new, ledger, snapshot_dir)
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
            subprocess.run(["node", SCRIPTS / "diff-page.mjs", out, f"OpenISD {old} → {new}",
                            manifest, "", "--ranked"], check=True)
    except BaseException:
        shutil.rmtree(out)
        raise
    if url := os.environ.get("VISUAL_PAGES_URL"):
        print(f"{url.rstrip('/')}/{out.name}/index.html")


if __name__ == "__main__":
    try:
        mode, snapshot_dir, *args = sys.argv[1:]
        ledger = releases()
        if mode == "archive":
            archive(args[0], snapshot_dir, ledger)
        else:
            pages, old, new = args
            compare(old, new, snapshot_dir, Path(pages), ledger)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f"visual: {error}")
