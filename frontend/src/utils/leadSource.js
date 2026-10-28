// leadSource.js — where a lead really came from, for lists and downloads
// (owner, 28 Oct 2026). Mirrors backend/utils/siteName.js originalSourceLabel:
// the saved source label, unless it is a placeholder connection name
// ("WordPress Site 5", "New WordPress Site"), then the website it came from.

const GENERIC = /^(new wordpress site|wordpress site|wordpress|website|my site|my website|just another wordpress site)( \d+)?$/i;

export function originalSourceLabel(lead) {
  const label = String(lead?.leadSourceLabel || "").trim();
  if (label && !GENERIC.test(label)) return label;
  const domain = String(lead?.sourceDomain || "").trim().replace(/^www\./i, "");
  return domain || label;
}
