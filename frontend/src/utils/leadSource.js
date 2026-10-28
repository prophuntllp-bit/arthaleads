// leadSource.js — where a lead really came from, for lists and downloads
// (owner, 28 Oct 2026). Mirrors backend/utils/siteName.js.

const GENERIC = /^(new wordpress site|wordpress site|wordpress|website|my site|my website|just another wordpress site)( \d+)?$/i;

/** "shaporjipallonji.com/treetopia-2": the site and the page a website lead came from. */
export function websiteSource(lead) {
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
export function originalSourceLabel(lead) {
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
export function adFromPage(pageUrl) {
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
