// scripts/upload-site-videos.js - one-off (16 Oct 2026): copy the website's
// videos (product tour clips and the intro films) into file storage, so they no
// longer sit inside every Vercel deployment (52 MB of each ~62 MB build, which
// pushed the project over Vercel's deployment storage limit).
//
// Run from the Railway console of the production service (it has the B2_*
// settings):  node scripts/upload-site-videos.js           (preview)
//             node scripts/upload-site-videos.js --apply   (copy)
// Each file is fetched from the live website and stored at
// arthaleads/site/<path>, served by /api/media. Safe to run again: a file that
// is already stored at the same size is skipped.
const storage = require("../utils/storage");

const SITE = "https://www.arthaleads.com";
const TOUR = ["booking", "dashboard", "inbox", "lead", "performance", "pipeline", "project"];
const FILES = [
  ...TOUR.flatMap((id) => [`tour/${id}.mp4`, `tour/${id}.webm`]),
  "video/arthaleads-intro-en.mp4",
  "video/arthaleads-intro-hi.mp4",
];
const TYPE = { mp4: "video/mp4", webm: "video/webm" };
const apply = process.argv.includes("--apply");

(async () => {
  if (!storage.isConfigured()) { console.log("[site-videos] file storage is not configured here (B2_*)."); process.exit(1); }
  let copied = 0, skipped = 0, failed = 0;
  for (const path of FILES) {
    const key = `arthaleads/site/${path}`;
    try {
      const res = await fetch(`${SITE}/${path}`, { signal: AbortSignal.timeout(60000) });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.startsWith("video/")) throw new Error(`website answered ${res.status} ${type}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      let existing = null;
      try { existing = await storage.getObject(key, { range: "bytes=0-0" }); } catch { /* not stored yet */ }
      const storedSize = existing?.contentRange ? Number(String(existing.contentRange).split("/")[1]) : null;
      existing?.body?.destroy?.();
      if (storedSize === buffer.length) { skipped++; console.log(`  already stored: ${path} (${(buffer.length / 1048576).toFixed(1)} MB)`); continue; }
      if (!apply) { console.log(`  would copy: ${path} (${(buffer.length / 1048576).toFixed(1)} MB)`); continue; }
      const url = await storage.put(key, buffer, TYPE[path.split(".").pop()], { cacheSeconds: 31536000 });
      copied++;
      console.log(`  copied: ${path} -> ${url}`);
    } catch (e) {
      failed++;
      console.log(`  FAILED: ${path}: ${e.message}`);
    }
  }
  console.log(`[site-videos] ${apply ? `copied ${copied}` : "preview only (add --apply)"}, already stored ${skipped}, failed ${failed} of ${FILES.length}.`);
  process.exit(failed ? 1 : 0);
})();
