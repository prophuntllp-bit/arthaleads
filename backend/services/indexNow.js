// services/indexNow.js - tells Bing (and Yandex, Seznam, Naver, which share
// IndexNow) that pages on www.arthaleads.com were added, changed or removed,
// so they recrawl within minutes instead of waiting for the sitemap.
//
// The key is public by design: it must be served at
// https://www.arthaleads.com/<key>.txt (frontend/public). Changing it means
// changing that file too. Only production pings: staging's FRONTEND_URL
// contains "staging", and the sync that calls this does not run there anyway.
const logger = require("../config/logger");

const HOST = "www.arthaleads.com";
const KEY = "189c8ff7fe6112df19c2db3c2503d376";
const ENDPOINT = "https://api.indexnow.org/indexnow";

function enabled() {
  if (process.env.INDEXNOW === "off") return false;
  if (/staging/i.test(process.env.FRONTEND_URL || "")) return false;
  return process.env.NODE_ENV === "production";
}

/**
 * Pings IndexNow with site paths ("/blog/x") or full www URLs. Never throws:
 * a failed ping only means the search engine finds the change a bit later.
 */
async function submit(paths = []) {
  const urlList = [...new Set(paths.filter(Boolean).map((p) =>
    p.startsWith("http") ? p : `https://${HOST}${p.startsWith("/") ? "" : "/"}${p}`))]
    .filter((u) => new URL(u).host === HOST)
    .slice(0, 10000);
  if (!urlList.length || !enabled()) return { sent: 0 };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(10000),
    });
    // 200 = accepted, 202 = accepted while the key is still being checked.
    if (res.status === 200 || res.status === 202) {
      logger.info(`[indexnow] ${res.status} for ${urlList.length} URL(s): ${urlList.slice(0, 5).join(", ")}`);
    } else {
      logger.warn(`[indexnow] HTTP ${res.status} for ${urlList.length} URL(s)`);
    }
    return { sent: urlList.length, status: res.status };
  } catch (err) {
    logger.warn(`[indexnow] ping failed: ${err.message}`);
    return { sent: 0, error: err.message };
  }
}

module.exports = { submit, KEY, HOST };
