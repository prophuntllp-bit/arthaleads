"""
Run from anywhere — creates arthaleads-integration.zip in the wordpress-plugin folder.
    python wordpress-plugin/make_zip.py

ZIP structure (required by WordPress.org):
    arthaleads-integration/
        arthaleads-integration.php
        readme.txt
"""
import zipfile, pathlib

here  = pathlib.Path(__file__).parent
out   = here / "arthaleads-integration.zip"
files = ["arthaleads-integration.php", "readme.txt"]

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for f in files:
        zf.write(here / f, f"arthaleads-integration/{f}")

size_kb = out.stat().st_size / 1024
print(f"Done. {size_kb:.1f} KB  →  {out}")
with zipfile.ZipFile(out) as z:
    for n in sorted(z.namelist()):
        print(f"  {n}")
