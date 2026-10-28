// Works out what a connected website calls itself, so a connection card can
// say "Mahindra Lifespaces" instead of whatever label was typed when it was
// set up. Reads the page's own og:site_name, application-name or <title>.

const dns = require("dns").promises;
const net = require("net");

const GENERIC = /^(new wordpress site|wordpress site|wordpress|website|my site|my website|just another wordpress site)( \d+)?$/i;
const isGenericSiteName = (n) => !n || GENERIC.test(String(n).trim());

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// The address is tenant-supplied, so never let it point the server at its own
// network.
async function isSafePublicUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  if (net.isIP(u.hostname)) return !isPrivateIp(u.hostname);
  if (/^localhost$|\.local$|\.internal$/i.test(u.hostname)) return false;
  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch { return false; }
}

const decode = (s) => String(s)
  .replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8211;|&ndash;/g, "-").replace(/\s+/g, " ").trim();

function pickName(html) {
  const meta = (re) => { const m = html.match(re); return m ? decode(m[1]) : ""; };
  const og = meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (og) return og;
  const app = meta(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i);
  if (app) return app;
  const title = meta(/<title[^>]*>([^<]+)<\/title>/i);
  // "Brand | tagline" or "Brand - tagline": keep the brand.
  return title ? title.split(/\s[|\-–—:]\s/)[0].trim() : "";
}

async function fetchSiteName(siteUrl) {
  if (!siteUrl || !(await isSafePublicUrl(siteUrl))) return "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(siteUrl, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "ArthaLeadsBot/1.0 (+https://arthaleads.com)" } });
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 200000);
    const name = pickName(html);
    return name && name.length <= 80 ? name : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** "shaporjipallonji.com/treetopia-2": the site and the page a website lead came from. */
function websiteSource(lead) {
  const domain = String(lead?.sourceDomain || "").trim().replace(/^www\./i, "");
  if (!domain) return "";
  let path = "";
  try { path = new URL(lead.sourcePage).pathname.replace(/\/+$/, ""); } catch { /* no page address */ }
  return `${domain}${path}`;
}

/**
 * Where a lead really came from, for lists and downloads (owner, 28 Oct 2026):
 * for website leads the site and page ("shaporjipallonji.com/treetopia-2"), so
 * each landing page (and its ad) is told apart; otherwise the saved label,
 * never a placeholder connection name like "WordPress Site 5".
 */
function originalSourceLabel(lead) {
  const site = websiteSource(lead);
  if (site) return site;
  const label = String(lead?.leadSourceLabel || "").trim();
  return label && !GENERIC.test(label) ? label : String(lead?.sourceDomain || "");
}

/**
 * The ad a website visit came from, read from its page address: a
 * utm_campaign name, a Google Ads campaign number (gad_campaignid), or just
 * the network (gclid / fbclid). Empty when the visit carried none.
 */
function adFromPage(pageUrl) {
  let q;
  try { q = new URL(pageUrl).searchParams; } catch { return ""; }
  const utm = q.get("utm_campaign");
  if (utm) return [q.get("utm_source"), utm].filter(Boolean).join(" · ");
  if (q.get("gad_campaignid")) return `Google Ads · campaign ${q.get("gad_campaignid")}`;
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid") || q.get("gad_source")) return "Google Ads";
  if (q.get("fbclid")) return "Facebook / Instagram ad";
  if (q.get("utm_source")) return q.get("utm_source");
  return "";
}

module.exports = { fetchSiteName, isGenericSiteName, pickName, isSafePublicUrl, originalSourceLabel, websiteSource, adFromPage };
