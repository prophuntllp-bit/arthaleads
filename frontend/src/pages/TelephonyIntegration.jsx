import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import EnableXSettings from "../components/EnableXSettings";
import PlivoSettings from "../components/PlivoSettings";
import { useAuth } from "../context/AuthContext";

// Which phone service click-to-call uses (27 Oct 2026): EnableX as before, or
// Plivo, which records each side separately for speaker-by-speaker transcripts.
const PROVIDERS = [
  { key: "enablex", label: "EnableX", note: "Current setup" },
  { key: "plivo",   label: "Plivo",   note: "Each side recorded separately" },
];

export default function TelephonyIntegration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [provider, setProvider] = useState(null);
  const [view, setView] = useState("enablex");
  const [switching, setSwitching] = useState(false);
  const first = useRef(true);

  const load = () => api.get("/plivo/settings").then((r) => {
    setProvider(r.data.provider);
    // Open on the service in use the first time; keep the reader's tab after.
    if (first.current) { setView(r.data.provider); first.current = false; }
  }).catch(() => setProvider("enablex"));
  useEffect(() => { load(); }, []);

  const switchTo = async (key) => {
    if (key === provider) return;
    setSwitching(true);
    try {
      const { data } = await api.patch("/plivo/settings", { provider: key });
      setProvider(key);
      toast.success(`Calls now go through ${key === "plivo" ? "Plivo" : "EnableX"}.`);
      if (data?.inbound && data.inbound !== "connected") toast.error(`Incoming calls ${data.inbound}. Use "Connect incoming calls" in Plivo settings.`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not switch.");
      setView(key);
    } finally { setSwitching(false); }
  };

  return (
    <div className="stitch-page space-y-6">
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/integrations")} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.12)" }}>
              <Phone className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="stitch-kicker mb-0.5">Integrations</p>
              <h1 className="text-xl font-black tracking-tight text-app">Telephony Integration</h1>
              <p className="text-xs text-app-soft">Click-to-call, recordings and AI call summaries</p>
            </div>
          </div>
        </div>
      </div>

      <section className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-app">Calls go through</p>
            <p className="text-xs text-app-soft mt-0.5">Click-to-call from the CRM and the app uses this service. Call history stays the same either way.</p>
          </div>
          {switching && <Loader2 className="w-4 h-4 animate-spin text-app-soft" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const active = provider === p.key;
            return (
              <div key={p.key} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                style={{ border: `1px solid ${active ? "rgba(22,163,74,0.45)" : "var(--app-border)"}`, background: active ? "rgba(22,163,74,0.06)" : "var(--app-surface-low)" }}>
                <button type="button" className="text-left flex-1 min-w-0" onClick={() => setView(p.key)}>
                  <p className="text-sm font-semibold text-app">{p.label}{active && <span className="ml-2 text-xs font-semibold" style={{ color: "#15803d" }}>In use</span>}</p>
                  <p className="text-xs text-app-soft">{p.note}</p>
                </button>
                {isAdmin && provider && !active && (
                  <button type="button" disabled={switching} onClick={() => switchTo(p.key)}
                    className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold shrink-0 disabled:opacity-50">
                    Use {p.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div role="tablist" aria-label="Phone service settings" className="inline-flex gap-1 rounded-xl p-1"
        style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" }}>
        {PROVIDERS.map((p) => {
          const on = view === p.key;
          return (
            <button key={p.key} type="button" role="tab" aria-selected={on} onClick={() => setView(p.key)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={on ? { color: "var(--app-text)", background: "var(--app-surface-solid)", boxShadow: "0 0 0 1px rgba(var(--app-primary-rgb),0.45)" } : { color: "var(--app-text-soft)" }}>
              {p.label} settings
            </button>
          );
        })}
      </div>

      {view === "plivo" ? <PlivoSettings onSaved={load} /> : <EnableXSettings />}
    </div>
  );
}
