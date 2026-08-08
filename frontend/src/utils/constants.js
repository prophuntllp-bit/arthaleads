// ── Lead option lists ─────────────────────────────────────────────────────────
// These mirror backend/constants/leadOptions.js, which is the single source of
// truth (the Mongoose enums and Joi validators derive from it too). The values
// below are the bundled fallback; hydrateLeadOptions() below refreshes them
// from GET /api/public/options at startup, so a deployed backend can add an
// option without the client needing a rebuild.
export const STATUS_OPTIONS = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];
export const SOURCE_OPTIONS = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Custom", "Vistrow Voice", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "QR Code", "Other"];
export const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Hot"];
export const PROPERTY_TYPES = ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse", "Other"];
export const BHK_OPTIONS = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK+", "Studio", "N/A"];
export const PURPOSE_OPTIONS = ["Buy", "Rent", "Invest", "N/A"];
export const DATE_RANGE_OPTIONS = [
  { value: "",             label: "Maximum" },
  { value: "today",        label: "Today" },
  { value: "yesterday",    label: "Yesterday" },
  { value: "last7days",    label: "Last 7 Days" },
  { value: "last14days",   label: "Last 14 Days" },
  { value: "last28days",   label: "Last 28 Days" },
  { value: "last30days",   label: "Last 30 Days" },
  { value: "thisweek",     label: "This Week" },
  { value: "lastweek",     label: "Last Week" },
  { value: "thismonth",    label: "This Month" },
  { value: "lastmonth",    label: "Last Month" },
  { value: "thisyear",     label: "This Year" },
];

export const STATUS_COLORS = {
  New: "bg-blue-50 text-blue-700",
  Contacted: "bg-amber-50 text-amber-700",
  "Site Visit": "bg-violet-50 text-violet-700",
  Negotiation: "bg-orange-50 text-orange-700",
  "Closed Won": "bg-green-50 text-green-700",
  "Closed Lost": "bg-red-50 text-red-700"
};

export const PRIORITY_COLORS = {
  Low: "bg-gray-100 text-gray-700",
  Medium: "bg-sky-50 text-sky-700",
  High: "bg-orange-50 text-orange-700",
  Hot: "bg-red-50 text-red-700"
};

export const SOURCE_COLORS = {
  Facebook: "bg-[#1877F2] text-white",
  Google: "bg-emerald-50 text-emerald-700",
  WhatsApp: "bg-[#2AB540] text-white",
  Manual: "bg-gray-100 text-gray-700",
  Website: "bg-[#f88025] text-white",
  Referral: "bg-purple-50 text-purple-700",
  "Walk-in": "bg-amber-50 text-amber-700",
  PropTiger: "bg-rose-50 text-rose-700",
  "99acres": "bg-lime-50 text-lime-700",
  MagicBricks: "bg-fuchsia-50 text-fuchsia-700",
  Other: "bg-gray-100 text-gray-700",
  "Vistrow Voice": "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 text-white"
};

export function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/** Format a UTC date string as IST date + 12h time (e.g. "07 Apr 2026, 2:30 PM") */
export function fmtDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  // Shift to IST (+5:30)
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  const date = ist.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${date}, ${h12}:${minutes} ${ampm}`;
}

export function fmtCurrency(value) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}


// ── Runtime hydration ─────────────────────────────────────────────────────────
// Replaces each list's CONTENTS in place (never the array reference) so every
// module that already imported them sees the update without re-importing.
// Best-effort: if the request fails, the bundled values above stay in use.
const _OPTION_TARGETS = {
  status:       STATUS_OPTIONS,
  priority:     PRIORITY_OPTIONS,
  source:       SOURCE_OPTIONS,
  propertyType: PROPERTY_TYPES,
  bhk:          BHK_OPTIONS,
  purpose:      PURPOSE_OPTIONS,
};

export async function hydrateLeadOptions(api) {
  try {
    const { data } = await api.get("/public/options");
    const opts = data?.options;
    if (!opts) return;
    for (const [key, target] of Object.entries(_OPTION_TARGETS)) {
      const incoming = opts[key];
      // Ignore anything that isn't a non-empty array of strings — a malformed
      // payload must never blank out a dropdown.
      if (!Array.isArray(incoming) || incoming.length === 0) continue;
      if (!incoming.every((v) => typeof v === "string")) continue;
      target.splice(0, target.length, ...incoming);
    }
  } catch {
    // Offline or backend down — bundled defaults remain correct enough.
  }
}
