"""
Run from the wordpress-plugin folder:
    python make_zip.py

Output: arthaleads-integration.zip (gitignored)
"""
import zipfile, pathlib

here = pathlib.Path(__file__).parent
out  = here / "arthaleads-integration.zip"

# Only these top-level items go into the ZIP — nothing else
INCLUDE = [
    "arthaleads-integration.php",
    "index.php",
    "uninstall.php",
    "readme.txt",
    "admin",
    "includes",
    "languages",
]

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for name in INCLUDE:
        p = here / name
        if not p.exists():
            continue
        if p.is_file():
            zf.write(p, f"arthaleads-integration/{name}")
        else:
            for path in sorted(p.rglob("*")):
                if path.is_file():
                    rel = path.relative_to(here)
                    zf.write(path, f"arthaleads-integration/{rel.as_posix()}")

size_kb = out.stat().st_size / 1024
print(f"Done. {size_kb:.1f} KB  →  {out}")
with zipfile.ZipFile(out) as z:
    for n in sorted(z.namelist()):
        print(f"  {n}")
