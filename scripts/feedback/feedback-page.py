#!/usr/bin/env python3
"""Make a folder's index.html with Look-at lines and a board comment link under each picture.

    feedback-page.py <folder> --card <card-id> --todo "<What to do line>" --note "<note or empty string>"

Copies the one shared template (feedback-page.template.html) into <folder>/index.html. The page reads
<folder>/index.md and links to the card on the live decision board.
Never hand-edit a generated index.html; change the template and regenerate.
"""
from __future__ import annotations

import argparse
import html
import pathlib
from urllib.parse import urlencode

TEMPLATE = pathlib.Path(__file__).resolve().parent / "feedback-page.template.html"


def title_of(folder: pathlib.Path) -> str:
    md = folder / "index.md"
    if md.is_file():
        for line in md.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    return folder.name


def write_page(folder: pathlib.Path, card: str, todo: str, note: str) -> pathlib.Path:
    page = TEMPLATE.read_text(encoding="utf-8")
    board_url = "http://woody:8000/?" + urlencode({"item": card})
    for key, value in (("__TITLE__", html.escape(title_of(folder))), ("__TODO__", html.escape(todo)),
                       ("__BOARD_URL__", html.escape(board_url)), ("__FOLDER__", html.escape(folder.name)),
                       ("__NOTE__", f'<p class="note">{html.escape(note)}</p>' if note else "")):
        page = page.replace(key, value)
    out = folder / "index.html"
    out.write_text(page, encoding="utf-8")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("folder", type=pathlib.Path)
    ap.add_argument("--card", required=True, help="live decision board card ID")
    ap.add_argument("--todo", required=True, help="the 'What to do' line John reads first")
    ap.add_argument("--note", required=True, help="plain sentence under the title, or an empty string")
    a = ap.parse_args()
    if not a.card.strip():
        ap.error("--card must name a live decision board card")
    print(write_page(a.folder.resolve(), a.card, a.todo, a.note))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
