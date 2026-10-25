"""Remove trailing #i-arrow SVGs from every published HTML page."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAT = re.compile(
    r'\s*<svg class="icon(?: icon--sm)?" aria-hidden="true"><use href="#i-arrow"/></svg>'
)

nfiles = 0
for p in ROOT.rglob("*.html"):
    if "tools" in p.parts:
        continue
    text = p.read_text(encoding="utf-8")
    new = PAT.sub("", text)
    if new != text:
        p.write_text(new, encoding="utf-8")
        nfiles += 1
        print(p.relative_to(ROOT).as_posix())
print("stripped", nfiles, "files")
