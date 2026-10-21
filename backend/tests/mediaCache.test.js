// /api/media keeps a copy of each file on the server's disk (utils/mediaCache.js),
// so B2 is read once per file instead of once per request (21 Oct 2026: the
// free daily download and Class B caps were hit on 17 Oct). Storage mocked.
const os = require("os");
const path = require("path");
process.env.MEDIA_CACHE_DIR = path.join(os.tmpdir(), `media-cache-test-${process.pid}`);
process.env.MEDIA_CACHE_MB = String(600 / (1024 * 1024));     // 600 bytes in all
process.env.MEDIA_CACHE_MAX_FILE_MB = String(250 / (1024 * 1024)); // files over 250 bytes are not kept
const express = require("express");
const http = require("http");
const { Readable } = require("stream");

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }).on("error", reject);
  });
}

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const storage = require("../utils/storage");
  const files = {
    "arthaleads/projects/p/a.jpg": { type: "image/jpeg", data: Buffer.from("A".repeat(200)) },
    "arthaleads/projects/p/b.jpg": { type: "image/jpeg", data: Buffer.from("B".repeat(200)) },
    "arthaleads/projects/p/c.jpg": { type: "image/jpeg", data: Buffer.from("C".repeat(200)) },
    "arthaleads/projects/p/v.mp4": { type: "video/mp4", data: Buffer.from("0123456789") },
    "arthaleads/projects/p/big.mp4": { type: "video/mp4", data: Buffer.from("x".repeat(400)) },
  };
  const calls = [];
  storage.getObject = async (key, { range } = {}) => {
    calls.push(`${key}${range ? ` ${range}` : ""}`);
    await new Promise((r) => setTimeout(r, 30)); // like a real network fetch
    const f = files[key];
    if (!f) { const e = new Error("no such key"); e.name = "NoSuchKey"; throw e; }
    let data = f.data, contentRange;
    if (range) {
      const [a, b] = range.replace("bytes=", "").split("-");
      const start = Number(a), end = b ? Number(b) : data.length - 1;
      data = data.subarray(start, end + 1);
      contentRange = `bytes ${start}-${end}/${f.data.length}`;
    }
    return { body: Readable.from([data]), contentType: f.type, contentLength: data.length, contentRange, etag: `"e-${key}"` };
  };
  const cache = require("../utils/mediaCache");

  console.log("\nMedia cache\n");
  const app = express();
  app.use("/api/media", require("../routes/mediaRoutes"));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/media/`;
  const fromB2 = (key) => calls.filter((c) => c.startsWith(key)).length;

  // Same file three times (Meta fetching it for three customers): B2 once.
  const v = "arthaleads/projects/p/v.mp4";
  const r1 = await get(base + v), r2 = await get(base + v), r3 = await get(base + v);
  check([r1, r2, r3].every((r) => r.status === 200 && r.body === "0123456789"), "the file is served every time");
  check(fromB2(v) === 1, "but read from B2 only once", calls.join(", "));
  check(r3.headers["content-type"] === "video/mp4" && r3.headers["cache-control"].includes("immutable")
    && r3.headers["cross-origin-resource-policy"] === "cross-origin" && r3.headers["etag"] === `"e-${v}"`, "a cached response carries the same headers as before");

  // Seeking in a video: ranges from the copy, no new B2 calls.
  const part = await get(base + v, { Range: "bytes=2-5" });
  check(part.status === 206 && part.body === "2345" && part.headers["content-range"] === "bytes 2-5/10", "a byte range comes from the copy (206)", `${part.status} ${part.headers["content-range"]}`);
  const tail = await get(base + v, { Range: "bytes=-3" });
  check(tail.status === 206 && tail.body === "789", "'the last 3 bytes' works");
  const open = await get(base + v, { Range: "bytes=7-" });
  check(open.status === 206 && open.body === "789", "an open-ended range works");
  const bad = await get(base + v, { Range: "bytes=50-60" });
  check(bad.status === 416 && bad.headers["content-range"] === "bytes */10", "an impossible range answers 416");
  check(fromB2(v) === 1, "still one B2 read after all the seeking");

  // Five requests at once for a file not yet cached: one B2 read.
  const a = "arthaleads/projects/p/a.jpg";
  const many = await Promise.all([1, 2, 3, 4, 5].map(() => get(base + a)));
  check(many.every((r) => r.status === 200 && r.body.length === 200), "five simultaneous requests are all served");
  check(fromB2(a) === 1, "with a single B2 read between them", String(fromB2(a)));

  // Too big to keep: streamed from B2 as before, ranges passed through.
  const big = "arthaleads/projects/p/big.mp4";
  const g1 = await get(base + big);
  const g2 = await get(base + big, { Range: "bytes=0-9" });
  check(g1.status === 200 && g1.body.length === 400 && g2.status === 206 && g2.body === "xxxxxxxxxx", "a file over the size limit is still served, whole and in ranges");
  check(calls.includes(`${big} bytes=0-9`), "its range request goes straight to B2, not a whole download");

  // The cache never grows past its limit; the least recently used goes first.
  await get(base + "arthaleads/projects/p/b.jpg");
  await get(base + a); // a is now more recent than v and b
  await get(base + "arthaleads/projects/p/c.jpg");
  const st = cache.status();
  check(st.bytes <= 600, "total stays within the limit", JSON.stringify(st));
  const before = fromB2(a);
  await get(base + a);
  check(fromB2(a) === before, "the recently used file was kept");

  // Missing and forbidden keys behave as before.
  check((await get(base + "arthaleads/projects/p/none.jpg")).status === 404, "a missing file is 404");
  check((await get(base + "arthaleads/backups/2026-10-21.gz")).status === 404, "database backups are never served");

  server.closeAllConnections?.(); await new Promise((r) => server.close(r));
  require("fs").rmSync(process.env.MEDIA_CACHE_DIR, { recursive: true, force: true });
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all media cache checks passed\n");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
