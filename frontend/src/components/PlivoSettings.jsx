// PlivoSettings.jsx — Plivo click-to-call credentials (27 Oct 2026). Settings live
// in /api/plivo/settings; the Auth Token is stored encrypted and never sent back.
// Only the Auth ID and Token are asked for: the caller ID is fetched from the
// Plivo account, and the agent is always the recording's left side (owner, 27 Oct).
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import CustomSelect from "./CustomSelect";

// "918065492852" reads as "+91 80 6549 2852".
const showNumber = (n) => (/^91\d{10}$/.test(n) ? `+91 ${n.slice(2, 4)} ${n.slice(4, 8)} ${n.slice(8)}` : `+${n}`);

export default function PlivoSettings({ onSaved, bare = false }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ authId: "", authToken: "" });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const load = () => api.get("/plivo/settings").then((r) => {
    setD(r.data);
    setForm({ authId: r.data.plivo.authId, authToken: "" });
  }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;

  const save = async () => {
    setSaving(true);
    try {
      const body = { authId: form.authId };
      if (form.authToken.trim()) body.authToken = form.authToken.trim();
      await api.patch("/plivo/settings", body);
      toast.success("Plivo settings saved.");
      await load();
      onSaved?.();
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not save.");
      return false;
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setNote(null);
    try {
      if (!(await save())) return;
      const { data } = await api.post("/plivo/settings/test");
      setNote({ ok: true, text: data.message });
    } catch (e) {
      setNote({ ok: false, text: e?.response?.data?.message || "Could not reach Plivo." });
    } finally { setTesting(false); }
  };

  const setNumber = async (number) => {
    try {
      await api.patch("/plivo/settings", { number });
      toast.success(`Calls now go out from ${showNumber(number)}.`);
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not change the number."); }
  };

  const connectInbound = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post("/plivo/settings/inbound");
      toast.success(data.message);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not connect incoming calls.");
    } finally { setConnecting(false); }
  };

  return (
    <section className="card p-6 space-y-5" style={bare ? { boxShadow: "none" } : undefined}>
      {!bare && <div>
        <p className="stitch-kicker mb-1">Plivo</p>
        <h3 className="text-base font-bold text-app">Plivo click-to-call</h3>
        <p className="text-sm text-app-soft mt-1 max-w-2xl">
          Your phone rings first; when you answer, the lead is dialled from your Plivo number and both sides are recorded on separate
          channels, so the transcript shows exactly who said what.
        </p>
      </div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Auth ID</label>
          <input className="input w-full" autoComplete="off" data-lpignore="true" data-1p-ignore placeholder="From the Plivo console home page"
            value={form.authId} onChange={(e) => setForm((f) => ({ ...f, authId: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Auth Token</label>
          <div className="relative">
            <input className="input w-full pr-10" type={showToken ? "text" : "password"} autoComplete="new-password" data-lpignore="true" data-1p-ignore
              placeholder={d.plivo.hasAuthToken ? "Saved. Paste a new one to replace it." : "From the Plivo console home page"}
              value={form.authToken} onChange={(e) => setForm((f) => ({ ...f, authToken: e.target.value }))} />
            <button type="button" onClick={() => setShowToken((v) => !v)} aria-label={showToken ? "Hide token" : "Show token"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {d.plivo.number && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm text-app-soft">Calls go out from</span>
          {d.plivo.numbers?.length > 1 ? (
            <CustomSelect value={d.plivo.number} onChange={setNumber}
              options={d.plivo.numbers.map((n) => ({ value: n, label: showNumber(n) }))}
              style={{ minWidth: 220, padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
          ) : (
            <b className="text-sm text-app">{showNumber(d.plivo.number)}</b>
          )}
          <span className="text-xs text-app-soft">from your Plivo account</span>
        </div>
      )}

      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ border: "1px solid var(--app-border)" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app">Incoming calls</p>
          <p className="text-xs text-app-soft mt-0.5">
            {d.plivo.inboundConnected
              ? "Connected. A lead calling your Plivo number rings the agent who last called them, and the call is logged and recorded."
              : "Not connected yet. Calls to your Plivo number won't reach your team until you connect them."}
          </p>
        </div>
        <button type="button" onClick={connectInbound} disabled={connecting || !d.plivo.hasAuthToken || !d.plivo.number}
          className="btn-secondary rounded-full px-4 py-2 text-xs font-semibold shrink-0 flex items-center gap-2 disabled:opacity-50">
          {connecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {d.plivo.inboundConnected ? "Reconnect" : "Connect incoming calls"}
        </button>
      </div>

      <div className="rounded-xl px-4 py-3 text-xs text-app-soft leading-relaxed" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
        Plivo India rules: the account must be in the India data region with KYC approved, the caller ID must be your Plivo Indian
        number, and calls stay within India. Use a landline (Local) number for calls to people who enquired; cold or promotional calls
        are not allowed under TRAI rules.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || testing} className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          {saving && !testing && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
        <button type="button" onClick={test} disabled={saving || testing || !form.authId}
          className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {testing && <Loader2 className="w-4 h-4 animate-spin" />} Test connection
        </button>
        {note && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: note.ok ? "#15803d" : "#dc2626" }}>
            {note.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {note.text}
          </span>
        )}
      </div>
    </section>
  );
}
