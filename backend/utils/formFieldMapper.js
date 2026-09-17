// Maps a lead-generation form's custom question/answer pairs onto real Lead
// fields (propertyType, bhk, purpose, budget, city, streetAddress,
// preferredLocation, timeline) instead of leaving every answer parked in the
// generic formResponses list. Shared by every source that captures custom
// form fields — Facebook Lead Ads, Google Ads Lead Forms, and website forms
// (WordPress plugin) — so "Buying Timeline" (Facebook's wording) and
// "Purchase Timeline" (a different tenant's wording) land on the same Lead
// field instead of each staying its own opaque Q&A pair.
//
// Matching is deliberately two-stage and conservative, mirroring
// mapVistrowExtractedFields's discipline: a field's KEY/LABEL decides which
// Lead field it's even a candidate for (fuzzy, keyword-based — tenants phrase
// the same question differently), but the VALUE must still cleanly resolve to
// something real for that field (exact/enum match, or a parseable currency
// range) before anything is written. A key-only match with an unparseable
// value is left alone rather than guessed at, so it stays visible as a
// leftover "Additional Questions" entry instead of silently vanishing or
// forcing a wrong value onto the lead.

const OPTS = require("../constants/leadOptions");

const KEY_PATTERNS = {
  budget:            /budget|invest(?:ment)?[_ ]?(?:range|budget)|price[_ ]?range/i,
  timeline:          /timeline|planning[_ ]?to[_ ]?buy|purchase[_ ]?timeline|expected[_ ]?purchase/i,
  purpose:           /\bpurpose\b|considering[_ ]?this[_ ]?property[_ ]?for|buying[_ ]?purpose/i,
  bhk:               /\bbhk\b|configuration|bedroom/i,
  propertyType:      /property[_ ]?type/i,
  city:              /\bcity\b/i,
  streetAddress:     /street[_ ]?address|\baddress\b/i,
  preferredLocation: /preferred[_ ]?location|\blocation\b|\barea\b/i,
};

// Order matters — checked top to bottom, first match wins. More specific
// patterns (budget, timeline) are checked before generic ones so e.g.
// "investment_budget" resolves to budget, not accidentally caught by a purpose
// check on "investment".
const KEY_ORDER = ["budget", "timeline", "purpose", "bhk", "propertyType", "streetAddress", "city", "preferredLocation"];

function classifyKey(fieldKey, label) {
  const haystack = `${fieldKey || ""} ${label || ""}`.toLowerCase();
  for (const target of KEY_ORDER) {
    if (KEY_PATTERNS[target].test(haystack)) return target;
  }
  return null;
}

// "₹75 lakh – ₹1 crore", "₹45–50l", "₹1.5cr+", "80l-1cr" → { min, max } in
// rupees. Returns null (never a guessed number) when no recognizable unit is
// present anywhere in the string.
function parseIndianCurrencyRange(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/_/g, " ").replace(/[₹,]/g, "").trim();
  const isOpenEnded = /\+\s*$/.test(cleaned);
  const parts = cleaned.replace(/\+\s*$/, "").split(/[-–—]|(?:\bto\b)/i).map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 2) return null;

  const UNIT_MULT = { crore: 1e7, cr: 1e7, lakh: 1e7 / 100, lakhs: 1e7 / 100, l: 1e5, k: 1e3 };
  const parsePart = (part) => {
    const m = part.match(/^([\d.]+)\s*(crore|cr|lakhs|lakh|l|k)?$/i);
    if (!m) return null;
    const num = parseFloat(m[1]);
    if (!Number.isFinite(num)) return null;
    return { num, unit: m[2] ? m[2].toLowerCase() : null };
  };

  const parsed = parts.map(parsePart);
  if (parsed.some((p) => !p)) return null;

  // A bare number with no unit borrows its sibling's unit ("45–50l" → both L).
  const sharedUnit = parsed.find((p) => p.unit)?.unit;
  if (!sharedUnit) return null; // no unit anywhere — refuse to guess
  const values = parsed.map((p) => p.num * UNIT_MULT[p.unit || sharedUnit]);

  if (values.length === 1) {
    return { min: values[0], max: values[0] };
  }
  const [a, b] = values;
  return { min: Math.min(a, b), max: Math.max(a, b) };
  // isOpenEnded ("1.5cr+") intentionally collapses to min===max — same
  // "single value" convention mapVistrowExtractedFields already uses.
  void isOpenEnded;
}

function normalizeBhk(raw) {
  const val = String(raw || "").toLowerCase().replace(/_/g, " ").trim();
  if (val === "studio") return "Studio";
  const m = val.match(/^(\d+)\s*bhk\+?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const candidate = n >= 5 ? "5BHK+" : `${n}BHK`;
  return OPTS.BHK.includes(candidate) ? candidate : null;
}

const PURPOSE_VALUE_MAP = {
  selfuse: "Buy", selfused: "Buy", buy: "Buy", buying: "Buy",
  investment: "Invest", invest: "Invest", investing: "Invest",
  rent: "Rent", rental: "Rent", renting: "Rent",
};

function normalizePurpose(raw) {
  const key = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
  return PURPOSE_VALUE_MAP[key] || null;
}

function normalizePropertyType(raw) {
  const val = String(raw || "").toLowerCase().replace(/_/g, " ").trim();
  const match = OPTS.PROPERTY_TYPE.find((o) => o !== "N/A" && o.toLowerCase() === val);
  return match || null;
}

function normalizeTimeline(raw) {
  const val = String(raw || "").replace(/_/g, " ").trim().replace(/\s+/g, " ");
  if (!val) return null;
  return val.replace(/\b\w/g, (c) => c.toUpperCase());
}

// entries: [{ fieldKey, label, value }] — same shape as Lead.formResponses.
// Returns { leadUpdates, remaining } — leadUpdates is ready to spread into a
// Lead.create()/updateOne() payload; remaining is exactly the entries that
// weren't confidently mapped, to store as formResponses so nothing is lost.
function mapCustomFieldsToLead(entries) {
  const leadUpdates = {};
  const remaining = [];

  for (const entry of entries || []) {
    const { fieldKey, label, value } = entry;
    if (!value) { remaining.push(entry); continue; }

    const target = classifyKey(fieldKey, label);
    if (!target) { remaining.push(entry); continue; }

    let mapped = null;
    switch (target) {
      case "budget":            mapped = parseIndianCurrencyRange(value); break;
      case "timeline":          if (!leadUpdates.timeline) mapped = normalizeTimeline(value); break;
      case "purpose":           mapped = normalizePurpose(value); break;
      case "bhk":                mapped = normalizeBhk(value); break;
      case "propertyType":      mapped = normalizePropertyType(value); break;
      case "city":               if (!leadUpdates.city) mapped = String(value).trim() || null; break;
      case "streetAddress":     if (!leadUpdates.streetAddress) mapped = String(value).trim() || null; break;
      case "preferredLocation": if (!leadUpdates.preferredLocation) mapped = String(value).trim() || null; break;
    }

    if (mapped === null || mapped === undefined || leadUpdates[target] !== undefined) {
      remaining.push(entry);
      continue;
    }

    if (target === "budget") {
      leadUpdates.budget = { min: mapped.min, max: mapped.max, currency: "INR" };
    } else {
      leadUpdates[target] = mapped;
    }
  }

  return { leadUpdates, remaining };
}

module.exports = { mapCustomFieldsToLead, parseIndianCurrencyRange, normalizeBhk, normalizePurpose, normalizePropertyType, normalizeTimeline };
