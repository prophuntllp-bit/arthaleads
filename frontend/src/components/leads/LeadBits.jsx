// Small display pieces shared by the Leads page and the Lead Details window.

// Source pills in the same soft style as the Status and Priority pills (light
// tint, coloured text). The shared SourceBadge uses solid colour blocks, which
// shouted louder than Status in the table; each source keeps its colour here.
const SOURCE_SOFT = {
  Facebook:        "bg-blue-50 text-blue-700",
  Google:          "bg-sky-50 text-sky-700",
  WhatsApp:        "bg-green-50 text-green-700",
  Manual:          "bg-slate-100 text-slate-700",
  Website:         "bg-orange-50 text-orange-700",
  Custom:          "bg-teal-50 text-teal-700",
  Referral:        "bg-purple-50 text-purple-700",
  "Walk-in":       "bg-amber-50 text-amber-700",
  PropTiger:       "bg-red-50 text-red-700",
  "99acres":       "bg-lime-50 text-lime-700",
  "Housing.com":   "bg-violet-50 text-violet-700",
  MagicBricks:     "bg-indigo-50 text-indigo-700",
  "QR Code":       "bg-gray-100 text-gray-800",
  Other:           "bg-gray-100 text-gray-600",
  "Vistrow Voice": "bg-fuchsia-50 text-fuchsia-700",
};

export function SoftSourceBadge({ source }) {
  if (!source) return <EmptyValue />;
  return (
    <span className={`badge ${SOURCE_SOFT[source] || "bg-gray-100 text-gray-600"}`}>
      {source}
    </span>
  );
}

// The one placeholder for an empty value, everywhere on these screens.
export function EmptyValue({ className = "" }) {
  return <span className={`text-xs text-app-soft ${className}`} aria-label="Not set">—</span>;
}

// "N/A", "-" and blanks all count as "not filled in".
export function isBlank(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s === "—" || s.toUpperCase() === "N/A";
}
