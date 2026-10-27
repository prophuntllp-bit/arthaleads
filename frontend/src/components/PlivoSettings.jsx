// PlivoSettings.jsx — Plivo click-to-call credentials (27 Oct 2026). Settings live
// in /api/plivo/settings; the Auth Token is stored encrypted and never sent back.
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import CustomSelect from "./CustomSelect";

export default function PlivoSettings({ onSaved }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ authId: "", authToken: "", number: "", agentChannel: "" });
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState(null);

  const load = () => api.get("/plivo/settings").then((r) => {
    setD(r.data);
    setForm({ authId: r.data.plivo.authId, authToken: "", number: r.data.plivo.number, agentChannel: r.data.plivo.agentChannel || "" });
  }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;

  const save = async () => {
    setSaving(true);
    try {
      const body = { authId: form.authId, number: form.number, agentChannel: form.agentChannel };
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

  return (
    <section className="card p-6 space-y-5">
      <div>
        <p className="stitch-kicker mb-1">Plivo</p>
        <h3 className="text-base font-bold text-app">Plivo click-to-call</h3>
        <p className="text-sm text-app-soft mt-1 max-w-2xl">
          Your phone rings first; when you answer, the lead is dialled from your Plivo number and both sides are recorded on separate
          channels, so the transcript shows exactly who said what.
        </p>
      </div>

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
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Plivo number (caller ID)</label>
          <input className="input w-full" inputMode="tel" autoComplete="off" placeholder="e.g. +91 22 4012 3456"
            value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Agent's side of the recording</label>
          <CustomSelect value={form.agentChannel} onChange={(v) => setForm((f) => ({ ...f, agentChannel: v }))}
            options={[{ value: "", label: "Left channel (your phone, Plivo's default)" }, { value: "right", label: "Right channel" }]}
            style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
        </div>
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
