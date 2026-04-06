export const STATUS_OPTIONS = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];
export const SOURCE_OPTIONS = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "Other"];
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
  Facebook: "bg-blue-50 text-blue-700",
  Google: "bg-emerald-50 text-emerald-700",
  WhatsApp: "bg-green-50 text-green-700",
  Manual: "bg-gray-100 text-gray-700",
  Website: "bg-cyan-50 text-cyan-700",
  Referral: "bg-purple-50 text-purple-700",
  "Walk-in": "bg-amber-50 text-amber-700",
  PropTiger: "bg-rose-50 text-rose-700",
  "99acres": "bg-lime-50 text-lime-700",
  MagicBricks: "bg-fuchsia-50 text-fuchsia-700",
  Other: "bg-gray-100 text-gray-700"
};

export function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function fmtCurrency(value) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}
