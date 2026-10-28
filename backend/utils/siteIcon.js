// utils/siteIcon.js - a connected website's own icon, for its connection card
// (owner, 28 Oct 2026). Google's favicon service draws a grey globe for any
// site it doesn't know, which looked broken. This reads the site's homepage:
// its app icon, then its declared favicons (largest first), then its logo,
// then /favicon.ico, and keeps the first one that really is an image.

const { isSafePublicUrl } = require("./siteName");

// Some sites stall for an unknown bot name, so this reads them as a browser would.
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ArthaLeads" };
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i")); return m ? m[1].trim() : ""; };
const IMG_TAG = /<img\b[^>]*>/gi;

/** Icon and logo addresses named in a homepage, best first. */
function iconCandidates(html, base) {
  const out = [];
  const abs = (href) => { try { return new URL(href.replace(/&amp;/g, "&"), base).href; } catch { return ""; } };
  const imgSrc = (tag) => attr(tag, "src") || attr(tag, "data-src");
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const icons = [];
  for (const tag of links) {
    const rel = attr(tag, "rel").toLowerCase();
    const href = attr(tag, "href");
    if (!href || rel.includes("mask-icon")) continue;
    if (rel.includes("apple-touch-icon")) icons.push({ href, score: 1000 });
    else if (/\bicon\b/.test(rel)) {
      const size = Number((attr(tag, "sizes").match(/(\d+)x\d+/) || [])[1] || 16);
      icons.push({ href, score: Math.min(size, 512) + (/\.svg(\?|$)/i.test(href) ? 0 : 1) });
    }
  }
  icons.sort((a, b) => b.score - a.score).forEach((i) => out.push({ url: abs(i.href), kind: "favicon" }));

  // A logo: schema.org "logo", og:logo, then an <img> that says it is the logo.
  const ld = html.match(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/i);
  if (ld) out.push({ url: abs(ld[1].replace(/\\\//g, "/")), kind: "logo" });
  const og = html.match(/<meta[^>]+property=["']og:logo["'][^>]+content=["']([^"']+)["']/i);
  if (og) out.push({ url: abs(og[1]), kind: "logo" });
  const imgs = html.match(IMG_TAG) || [];
  for (const tag of imgs.slice(0, 80)) {
    const hint = `${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "alt")} ${attr(tag, "src")}`.toLowerCase();
    const src = imgSrc(tag);
    if (src && /logo/.test(hint) && !/^data:/i.test(src)) { out.push({ url: abs(src), kind: "logo" }); break; }
  }

  // Many sites have no favicon but show their logo as the first image of the
  // page header, or name the file after themselves ("mahindralifespaces.webp").
  const header = (html.match(/<header\b[\s\S]*?<\/header>/i) || [""])[0];
  const headerImg = (header.match(IMG_TAG) || [])[0];
  const headerSrc = headerImg ? imgSrc(headerImg) : "";
  if (headerSrc && !/^data:/i.test(headerSrc)) out.push({ url: abs(headerSrc), kind: "logo" });
  let host = "";
  try { host = new URL(base).hostname.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/gi, "").toLowerCase(); } catch { /* no base */ }
  if (host.length >= 5) {
    for (const tag of imgs.slice(0, 40)) {
      const src = imgSrc(tag);
      const stem = (src.split("/").pop() || "").split(/[.?]/)[0].toLowerCase();
      const words = stem.split(/[-_]/).filter((w) => w.length >= 5);
      if (src && !/^data:/i.test(src) && words.some((w) => host.includes(w) || w.includes(host))) { out.push({ url: abs(src), kind: "logo" }); break; }
    }
  }

  out.push({ url: abs("/favicon.ico"), kind: "favicon" });
  const seen = new Set();
  return out.filter((c) => c.url && /^https?:/i.test(c.url) && !seen.has(c.url) && seen.add(c.url));
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: UA }); }
  finally { clearTimeout(timer); }
}

/** True when the address answers with a real image (not an HTML error page). */
async function isImage(url) {
  if (!(await isSafePublicUrl(url))) return false;
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return false;
    const type = String(res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) return false;
    if (type.startsWith("image/")) return true;
    // Some servers send .ico as octet-stream: check the bytes.
    return buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
  } catch { return false; }
}

/** { url, kind: "favicon" | "logo" } for the site, or null when it has none. */
async function fetchSiteIcon(siteUrl) {
  if (!siteUrl || !(await isSafePublicUrl(siteUrl))) return null;
  let html = "", base = siteUrl;
  try {
    const res = await fetchWithTimeout(siteUrl, 9000);
    if (res.ok) { html = (await res.text()).slice(0, 900000); base = res.url || siteUrl; }
  } catch { /* still try /favicon.ico */ }
  for (const c of iconCandidates(html, base).slice(0, 8)) {
    if (await isImage(c.url)) return c;
  }
  return null;
}

module.exports = { fetchSiteIcon, iconCandidates };
