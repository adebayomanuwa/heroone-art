from pathlib import Path
nfiles = 0
for p in Path(".").rglob("*.html"):
    if "tools" in p.parts:
        continue
    t = p.read_text(encoding="utf-8")
    n = t
    for name in ("favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"):
        n = n.replace(f'/assets/img/brand/{name}"', f'/assets/img/brand/{name}?v=clean"')
        n = n.replace("?v=clean?v=clean", "?v=clean")
    if n != t:
        p.write_text(n, encoding="utf-8")
        nfiles += 1
        print(p.as_posix())
print("updated", nfiles)
