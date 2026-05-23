import zipfile, os

src = r"E:\PROPHUNT CRM\wordpress-plugin\build\arthaleads-integration"
dst = r"E:\PROPHUNT CRM\wordpress-plugin\arthaleads-integration.zip"

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(src):
        for filename in files:
            abs_path = os.path.join(root, filename)
            rel_path = os.path.relpath(abs_path, os.path.dirname(src))
            zip_entry = rel_path.replace("\\", "/")
            zf.write(abs_path, zip_entry)

size_kb = os.path.getsize(dst) / 1024
print(f"Done. ZIP size: {size_kb:.1f} KB")
print(f"Path: {dst}")

# Verify
with zipfile.ZipFile(dst) as z:
    names = z.namelist()
    print(f"Total files in ZIP: {len(names)}")
    for n in sorted(names):
        print(f"  {n}")
