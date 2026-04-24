/**
 * generate-icons.js
 * Reads public/logo.png, clips the black corners with a rounded-rect mask,
 * then writes all PWA icon sizes + favicon files.
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * Requires: npm install --save-dev sharp
 */

const sharp = require("sharp");
const path  = require("path");
const fs    = require("fs");

const SRC  = path.join(__dirname, "../public/logo.png");
const DEST = path.join(__dirname, "../public/icons");
const PUB  = path.join(__dirname, "../public");

if (!fs.existsSync(SRC)) {
  console.error("❌  public/logo.png not found — save your logo there first.");
  process.exit(1);
}

// Rounded rectangle SVG mask — radius is 23% of size (matches iOS icon rounding)
function roundedMask(size) {
  const r = Math.round(size * 0.23);
  return Buffer.from(
    `<svg width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
     </svg>`
  );
}

const PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const FAVICON_SIZES = [16, 32, 48];

async function main() {
  fs.mkdirSync(DEST, { recursive: true });

  // ── PWA icons ────────────────────────────────────────────────────────────────
  for (const size of PWA_SIZES) {
    const mask = roundedMask(size);
    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toFile(path.join(DEST, `icon-${size}x${size}.png`));
    console.log(`✅  icons/icon-${size}x${size}.png`);
  }

  // ── Favicon 32×32 (used in browser tab) ─────────────────────────────────────
  const f32 = roundedMask(32);
  await sharp(SRC)
    .resize(32, 32, { fit: "cover" })
    .composite([{ input: f32, blend: "dest-in" }])
    .png()
    .toFile(path.join(PUB, "favicon-32x32.png"));
  console.log("✅  favicon-32x32.png");

  // ── Apple touch icon 180×180 ─────────────────────────────────────────────────
  const f180 = roundedMask(180);
  await sharp(SRC)
    .resize(180, 180, { fit: "cover" })
    .composite([{ input: f180, blend: "dest-in" }])
    .png()
    .toFile(path.join(PUB, "apple-touch-icon.png"));
  console.log("✅  apple-touch-icon.png");

  // ── logo.png itself (clean, no black corners, 512×512) ────────────────────────
  const f512 = roundedMask(512);
  await sharp(SRC)
    .resize(512, 512, { fit: "cover" })
    .composite([{ input: f512, blend: "dest-in" }])
    .png()
    .toFile(path.join(PUB, "logo.png"));
  console.log("✅  logo.png (black corners removed)");

  console.log("\n🎉  All icons generated. Commit the public/ folder and redeploy.");
}

main().catch((e) => { console.error(e); process.exit(1); });
