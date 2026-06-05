"""
Run from anywhere — creates arthaleads-integration.zip in the wordpress-plugin folder.
    python wordpress-plugin/make_zip.py

ZIP structure (required by WordPress.org):
    arthaleads-integration/
        arthaleads-integration.php
        uninstall.php
        readme.txt
        admin/
        includes/
        languages/
"""
import zipfile, pathlib

here = pathlib.Path(__file__).parent
out  = here / "arthaleads-integration.zip"

# Everything except this script and any existing zip
EXCLUDE = {"make_zip.py", "arthaleads-integration.zip"}

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for path in sorted(here.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(here)
        if rel.parts[0] in EXCLUDE:
            continue
        zf.write(path, f"arthaleads-integration/{rel.as_posix()}")

size_kb = out.stat().st_size / 1024
print(f"Done. {size_kb:.1f} KB  →  {out}")
with zipfile.ZipFile(out) as z:
    for n in sorted(z.namelist()):
        print(f"  {n}")
