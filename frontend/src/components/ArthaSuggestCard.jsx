import { useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, Check, X } from "lucide-react";
import api from "../services/api";
import useArthaFeatures from "../hooks/useArthaFeatures";
import { notifyDataChanged } from "../hooks/useAppRefresh";

// Details the customer stated on WhatsApp (or on a Vistrow Voice call) that differ from what the lead holds
// (lead.arthaSuggest.fields, filled by the server's chat reader). Nothing is
// changed until someone presses Save; Dismiss stops that value coming back.
const LABEL = { propertyType: "Property type", purpose: "Purpose", bhk: "BHK", preferredLocation: "Location", budget: "Budget", timeline: "Timeline" };
const ORDER = ["preferredLocation", "bhk", "budget", "propertyType", "purpose", "timeline"];

const lakhs = (n) => (n >= 1e7 ? `${+(n / 1e7).toFixed(2)} Cr` : `${+(n / 1e5).toFixed(1)} L`);
function show(key, v) {
  if (key === "budget") {
    if (!v || (!v.min && !v.max)) return "empty";
    return v.min && v.max && v.min !== v.max ? `₹${lakhs(v.min)} – ₹${lakhs(v.max)}` : `₹${lakhs(v.max || v.min)}`;
  }
  return v && v !== "N/A" ? String(v) : "empty";
}

export default function ArthaSuggestCard({ lead, onChanged, compact = false }) {
  const { suggestions: on } = useArthaFeatures();
  const fields = lead?.arthaSuggest?.fields || {};
  const [handled, setHandled] = useState(() => new Set()); // saved or dismissed here
  const keys = ORDER.filter((k) => fields[k] !== undefined && fields[k] !== null && !handled.has(k));
  const [picked, setPicked] = useState(() => new Set(ORDER));
  const [busy, setBusy] = useState(null);
  if (!on || !lead?._id || lead._type === "project" || !keys.length) return null;
  // Suggestions come from the WhatsApp chat unless the server marked them as
  // from a Vistrow Voice call (lead.arthaSuggest.from).
  const fromCall = keys.filter((k) => lead.arthaSuggest?.from?.[k] === "vistrow_voice").length;
  const fromFlow = keys.filter((k) => lead.arthaSuggest?.from?.[k] === "button_flow").length;
  const where = fromCall === keys.length ? "on the Vistrow Voice call"
    : fromFlow === keys.length ? "in their WhatsApp button answers"
    : fromCall ? "in the WhatsApp chat and the call" : "in the WhatsApp chat";

  const act = async (action) => {
    // Save: the ticked rows. Dismiss: everything still shown.
    const chosen = action === "save" ? keys.filter((k) => picked.has(k)) : keys;
    if (!chosen.length) return;
    setBusy(action);
    try {
      const { data } = await api.post(`/copilot/suggestions/${lead._id}`, { action, fields: chosen });
      setHandled((h) => new Set([...h, ...chosen]));
      toast.success(action === "save" ? `Saved ${chosen.map((k) => LABEL[k]).join(", ")}` : "Dismissed");
      onChanged?.(data);
      notifyDataChanged("leads");
    } catch (e) {
      toast.error(e.response?.data?.message || "Couldn't do that right now.");
    } finally { setBusy(null); }
  };

  return (
    <div className={`rounded-2xl ${compact ? "px-3 py-2" : "p-3"}`} role="group" aria-label={`Artha suggestions ${where}`}
      style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.28)" }}>
      <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#ea580c" }}>
        <Sparkles className="h-3.5 w-3.5" /> Artha found {where}
      </p>
      <div className={`mt-1.5 flex ${compact ? "flex-wrap gap-x-4 gap-y-1" : "flex-col gap-1"}`}>
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-2 text-xs cursor-pointer text-app">
            <input type="checkbox" checked={picked.has(k)} disabled={!!busy} aria-label={`Include ${LABEL[k]}`}
              onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
            <span className="text-app-soft">{LABEL[k]}:</span>
            <s className="text-app-soft">{show(k, lead[k])}</s>
            <span aria-hidden="true">→</span>
            <b>{show(k, fields[k])}</b>
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => act("save")} disabled={!!busy || !keys.some((k) => picked.has(k))}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          style={{ background: "#ea580c" }}>
          <Check className="h-3.5 w-3.5" /> {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => act("dismiss")} disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50 text-app-soft"
          style={{ border: "1px solid var(--app-border)" }}>
          <X className="h-3.5 w-3.5" /> {busy === "dismiss" ? "…" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
