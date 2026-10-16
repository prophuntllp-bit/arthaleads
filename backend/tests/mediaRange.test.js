// /api/media serves byte ranges (video streaming, iPhones) and still serves
// whole files, with storage mocked.
const express = require("express");
const http = require("http");
// Plain http rather than fetch: undici's keep-alive sockets make Node crash on
// exit on Windows ("UV_HANDLE_CLOSING"), which stopped the rest of npm test.
function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: { get: (k) => res.headers[k.toLowerCase()] || null }, text: async () => Buffer.concat(chunks).toString() }));
    }).on("error", reject);
  });
}
const { Readable } = require("stream");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const storage = require("../utils/storage");
  const DATA = Buffer.from("0123456789");
  const seen = [];
  storage.getObject = async (key, { range } = {}) => {
    seen.push(range || null);
    if (range === "bytes=50-60") { const e = new Error("bad range"); e.name = "InvalidRange"; throw e; }
    if (range) {
      const [a, b] = range.replace("bytes=", "").split("-");
      const start = Number(a), end = b ? Number(b) : DATA.length - 1;
      const part = DATA.subarray(start, end + 1);
      return { body: Readable.from([part]), contentType: "video/mp4", contentLength: part.length, contentRange: `bytes ${start}-${end}/${DATA.length}` };
    }
    return { body: Readable.from([DATA]), contentType: "video/mp4", contentLength: DATA.length };
  };
  console.log("\nMedia byte ranges\n");
  const app = express();
  app.use("/api/media", require("../routes/mediaRoutes"));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/media/arthaleads/site/tour/inbox.mp4`;

  const whole = await get(url);
  check(whole.status === 200 && (await whole.text()) === "0123456789" && whole.headers.get("accept-ranges") === "bytes", "the whole file is served and advertises range support");
  const part = await get(url, { Range: "bytes=2-5" });
  check(part.status === 206 && (await part.text()) === "2345" && part.headers.get("content-range") === "bytes 2-5/10", "a byte range returns 206 with just those bytes", `${part.status} ${part.headers.get("content-range")}`);
  const open = await get(url, { Range: "bytes=7-" });
  check(open.status === 206 && (await open.text()) === "789", "an open-ended range works");
  const bad = await get(url, { Range: "bytes=50-60" });
  check(bad.status === 416, "an impossible range answers 416", String(bad.status));
  const junk = await get(url, { Range: "items=1-2" });
  check(junk.status === 200 && seen[seen.length - 1] === null, "an unknown range format is ignored and the whole file is sent");

  server.closeAllConnections?.(); await new Promise((r) => server.close(r));
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all media range checks passed\n");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
