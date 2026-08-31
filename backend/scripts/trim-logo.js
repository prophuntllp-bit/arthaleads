// Trims the transparent/white border off a palette PNG.
//
// The supplied logo is a 2080x2080 canvas whose artwork occupies a band in the
// middle. Shown in an email at a sensible width, the artwork would be tiny and
// swimming in whitespace, so it has to be cropped to its content first. There
// is no sharp/jimp/ImageMagick on this machine, but zlib is built in and the
// file is colour-type 3, 8-bit, non-interlaced — one byte per pixel, which is
// the easiest possible case to decode and rewrite.
//
// Usage: node scripts/trim-logo.js <in.png> <out.png> [marginPx]

const fs = require("fs");
const zlib = require("zlib");

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function readChunks(buf) {
  const out = {};
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IDAT") idat.push(data);
    else out[type] = data;
    if (type === "IEND") break;
    off += 12 + len;
  }
  out.IDAT = Buffer.concat(idat);
  return out;
}

/** Undo PNG per-scanline filtering. bpp is 1 for 8-bit palette. */
function unfilter(raw, width, height) {
  const bpp = 1;
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return px;
}

const [, , inPath, outPath, marginArg] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/trim-logo.js <in.png> <out.png> [margin]");
  process.exit(1);
}
const margin = parseInt(marginArg || "12", 10);

const buf = fs.readFileSync(inPath);
const c = readChunks(buf);
const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
if (buf[25] !== 3 || buf[24] !== 8 || buf[28] !== 0) {
  console.error("expected an 8-bit, non-interlaced palette PNG");
  process.exit(1);
}

const plte = c.PLTE;
const trns = c.tRNS || Buffer.alloc(0);
const palette = [];
for (let i = 0; i < plte.length / 3; i++) {
  palette.push({
    r: plte[i * 3], g: plte[i * 3 + 1], b: plte[i * 3 + 2],
    a: i < trns.length ? trns[i] : 255,
  });
}

// Background is transparency, and only transparency.
//
// Treating near-white as background too seems harmless until the artwork is
// itself white: on the dark-mode lockup that rule ate 74px off the right edge,
// taking part of the wordmark with it. The light and dark files crop to the
// same box under this rule, which is the check that caught it.
const isBg = palette.map((p) => p.a < 8);

const px = unfilter(zlib.inflateSync(c.IDAT), W, H);

let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  const row = y * W;
  for (let x = 0; x < W; x++) {
    if (!isBg[px[row + x]]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) { console.error("image is entirely background"); process.exit(1); }

minX = Math.max(0, minX - margin); minY = Math.max(0, minY - margin);
maxX = Math.min(W - 1, maxX + margin); maxY = Math.min(H - 1, maxY + margin);
const nw = maxX - minX + 1, nh = maxY - minY + 1;

// Re-encode. Filter 0 on every scanline keeps this simple; zlib still
// compresses a 26-colour image down hard.
const outRaw = Buffer.alloc((nw + 1) * nh);
for (let y = 0; y < nh; y++) {
  outRaw[y * (nw + 1)] = 0;
  px.copy(outRaw, y * (nw + 1) + 1, (minY + y) * W + minX, (minY + y) * W + minX + nw);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(nw, 0); ihdr.writeUInt32BE(nh, 4);
ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const parts = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("PLTE", plte),
];
if (c.tRNS) parts.push(chunk("tRNS", c.tRNS));
parts.push(chunk("IDAT", zlib.deflateSync(outRaw, { level: 9 })));
parts.push(chunk("IEND", Buffer.alloc(0)));

fs.writeFileSync(outPath, Buffer.concat(parts));
const sz = fs.statSync(outPath).size;
console.log(`  ${W}x${H} -> ${nw}x${nh}   ratio ${(nw / nh).toFixed(2)}:1   ${(sz / 1024).toFixed(1)} KB`);
console.log(`  content box was x ${minX}..${maxX}, y ${minY}..${maxY}`);
