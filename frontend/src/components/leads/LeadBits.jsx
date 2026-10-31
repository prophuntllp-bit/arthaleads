// Small display pieces shared by the Leads page and the Lead Details window.
import { leadHadAiCall, conversationKind } from "../UI";

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

// With `lead`: a lead from another source that also had a Vistrow AI call
// shows both in one pill, the source tint blending into Vistrow purple
// (owner, 21 Oct 2026, kept in the soft style).
export function SoftSourceBadge({ source, lead }) {
  if (!source) return <EmptyValue />;
  const soft = SOURCE_SOFT[source] || "bg-gray-100 text-gray-600";
  if (lead && source !== "Vistrow Voice" && leadHadAiCall(lead)) {
    // The newest Vistrow conversation: a voice call or a text chat.
    const last = [...lead.voiceCalls].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    const what = conversationKind(last) === "text" ? "chat" : "call";
    return (
      <span className={`badge justify-between gap-2 ${soft}`}
        style={{ backgroundImage: "linear-gradient(90deg, transparent 40%, rgba(217,70,239,0.22) 100%)" }}
        title={`Came in via ${source}, then a Vistrow AI ${what}`}>
        <span>{source}</span>
        <span className="font-semibold text-fuchsia-700">AI {what}</span>
      </span>
    );
  }
  return (
    <span className={`badge ${soft}`}>
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
