import { useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, Check, X } from "lucide-react";
import api from "../services/api";
import useArthaFeatures from "../hooks/useArthaFeatures";
import { notifyDataChanged } from "../hooks/useAppRefresh";

// Details the customer stated on WhatsApp that differ from what the lead holds
// (lead.arthaSuggest.fields, filled by the server's chat reader). Nothing is
// changed until someone presses Save; Dismiss stops that value coming back.
const LABEL = { propertyType: "Property type", purpose: "Purpose", bhk: "BHK", preferredLocation: "Location", budget: "Budget" };
const ORDER = ["preferredLocation", "bhk", "budget", "propertyType", "purpose"];

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
  const keys = ORDER.filter((k) => fields[k] !== undefined && fields[k] !== null);
  const [picked, setPicked] = useState(() => new Set(keys));
  const [busy, setBusy] = useState(null);
  const [gone, setGone] = useState(false);
  if (!on || !lead?._id || lead._type === "project" || !keys.length || gone) return null;

  const act = async (action) => {
    const chosen = action === "save" ? keys.filter((k) => picked.has(k)) : keys;
    if (!chosen.length) return;
    setBusy(action);
    try {
      const { data } = await api.post(`/copilot/suggestions/${lead._id}`, { action, fields: chosen });
      setGone(true);
      toast.success(action === "save" ? `Saved ${chosen.map((k) => LABEL[k]).join(", ")}` : "Dismissed");
      onChanged?.(data);
      notifyDataChanged("leads");
    } catch (e) {
      toast.error(e.response?.data?.message || "Couldn't do that right now.");
    } finally { setBusy(null); }
  };

  return (
    <div className={`rounded-2xl ${compact ? "px-3 py-2" : "p-3"}`} role="group" aria-label="Artha suggestions from the WhatsApp chat"
      style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.28)" }}>
      <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#ea580c" }}>
        <Sparkles className="h-3.5 w-3.5" /> Artha found in the WhatsApp chat
      </p>
      <div className={`mt-1.5 flex ${compact ? "flex-wrap gap-x-4 gap-y-1" : "flex-col gap-1"}`}>
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-2 text-xs cursor-pointer text-app">
            <input type="checkbox" checked={picked.has(k)} disabled={!!busy}
              onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
            <span className="text-app-soft">{LABEL[k]}:</span>
            <s className="text-app-soft">{show(k, lead[k])}</s>
            <span aria-hidden="true">→</span>
            <b>{show(k, fields[k])}</b>
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => act("save")} disabled={!!busy || !picked.size}
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
