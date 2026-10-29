#!/usr/bin/env python3
"""Checks that every page's header and footer are identical.

Each page at the repo root carries its own copy of the header and footer. This
compares every page's copies with index.html's, byte for byte, prints a short
hash of each, and exits 1 with a diff if any page differs or doesn't have
exactly one of each:

    python3 tools/check_chrome.py
"""

import difflib
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = "index.html"
PARTS = {
    "header": re.compile(r"<header\b.*?</header>", re.S),
    "footer": re.compile(r"<footer\b.*?</footer>", re.S),
}


def chrome(path):
    """{part: every copy of that part in the page}."""
    text = path.read_text(encoding="utf-8")
    return {part: pattern.findall(text) for part, pattern in PARTS.items()}


def short_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def main():
    pages = sorted(ROOT.glob("*.html"), key=lambda p: (p.name != REFERENCE, p.name))
    if not pages or pages[0].name != REFERENCE:
        sys.exit(f"{REFERENCE} not found at the repo root")
    reference = chrome(pages[0])
    problems, diffs = [], []

    print(f"Header and footer check: {len(pages)} pages at the repo root, compared with {REFERENCE}")
    for page in pages:
        found = chrome(page)
        cells = []
        for part in PARTS:
            copies = found[part]
            if len(copies) != 1:
                cells.append(f"{part} {'missing' if not copies else f'{len(copies)} copies'}")
                problems.append(f"{page.name} has {len(copies)} <{part}> elements, expected 1")
                continue
            cells.append(f"{part} {short_hash(copies[0])}")
            expected = reference[part]
            if page is not pages[0] and len(expected) == 1 and copies[0] != expected[0]:
                cells[-1] += " DIFFERS"
                problems.append(f"{page.name}: {part} differs from {REFERENCE}")
                diffs.append(difflib.unified_diff(
                    expected[0].splitlines(keepends=True), copies[0].splitlines(keepends=True),
                    f"{REFERENCE} {part}", f"{page.name} {part}"))
        print(f"   {page.name:<20}" + "   ".join(cells))

    if problems:
        print()
        for diff in diffs:
            sys.stdout.writelines(diff)
            print()
        print("FAILED:")
        for problem in problems:
            print(f"   {problem}")
        sys.exit(1)
    print(f"OK: every page's header and footer match {REFERENCE} exactly.")


if __name__ == "__main__":
    main()
