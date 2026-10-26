// MetaConversionsSection.jsx — send each lead's progress back to Meta so its ads
// can be aimed at people who turn into site visits and sales, not just form fills.
// Settings and the event log live in /api/meta-conversions.
import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/plan";
import CustomSelect from "./CustomSelect";
import WhatsAppLogo from "./WhatsAppLogo";

const CHANNEL = { lead_ads: "Lead form", whatsapp_ctwa: "WhatsApp ad" };
// The official Facebook glyph (same as components/site/BrandLogos.jsx, which is
// website-only), for the Instant Lead Forms tab.
function FacebookLogo({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="#1877F2" d="M22.676 0H1.324C.593 0 0 .593 0 1.324v21.352C0 23.408.593 24 1.324 24h11.494v-9.294H9.689v-3.621h3.129V8.41c0-3.099 1.894-4.785 4.659-4.785 1.325 0 2.464.097 2.796.141v3.24h-1.921c-1.5 0-1.792.721-1.792 1.771v2.311h3.584l-.465 3.63H16.56V24h6.115c.733 0 1.325-.592 1.325-1.324V1.324C24 .593 23.408 0 22.676 0" />
    </svg>
  );
}
const STATUS_TONE = {
  sent: { bg: "rgba(34,197,94,0.12)", fg: "#15803d", label: "Sent" },
  failed: { bg: "rgba(220,38,38,0.12)", fg: "#dc2626", label: "Failed" },
  pending: { bg: "rgba(245,158,11,0.14)", fg: "#b45309", label: "Waiting" },
  skipped: { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: "Skipped" },
};
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

export default function MetaConversionsSection() {
  const { user, org } = useAuth();
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ datasetId: "", accessToken: "", testEventCode: "" });
  const [events, setEvents] = useState([]);
  const [waEvents, setWaEvents] = useState([]);
  const [chatQualified, setChatQualified] = useState(true);
  const [tab, setTab] = useState("lead_ads");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState(null);

  const allowed = user?.role === "super_admin" || (user?.role === "admin" && canAccess(org, "growth"));
  const load = useCallback(() => {
    api.get("/meta-conversions").then((r) => {
      setD(r.data);
      setForm((f) => ({ ...f, datasetId: r.data.datasetId, testEventCode: r.data.testEventCode, accessToken: "" }));
      setEvents(r.data.events);
      setWaEvents(r.data.whatsappEvents || []);
      setChatQualified(r.data.whatsappQualified !== false);
    }).catch(() => {});
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (user?.role === "admin" && !canAccess(org, "growth")) {
    return (
      <section className="card p-6 flex items-start gap-3">
        <Lock className="w-4 h-4 mt-1 text-app-soft shrink-0" />
        <div>
          <h3 className="text-base font-bold text-app">Meta conversion tracking</h3>
          <p className="text-sm text-app-soft mt-1">Send site visits and closed deals back to Meta so your ads find more buyers. Available on Growth and above.</p>
        </div>
      </section>
    );
  }
  if (!allowed || !d) return null;

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      await api.put("/meta-conversions", { ...form, events, whatsappEvents: waEvents, whatsappQualified: chatQualified, ...extra });
      toast.success("Saved.");
      load();
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not save.");
      return false;
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setTestNote(null);
    try {
      if (!(await save())) return;
      const { data } = await api.post("/meta-conversions/test");
      setTestNote({ ok: true, text: "Meta received the test event. Check the Test Events tab in Events Manager." });
    } catch (e) {
      setTestNote({ ok: false, text: e?.response?.data?.message || "The test did not go through." });
    } finally { setTesting(false); }
  };

  const setEvent = (channel, stage, patch) => (channel === "lead_ads" ? setEvents : setWaEvents)((list) => {
    const has = list.some((e) => e.stage === stage);
    const blank = channel === "lead_ads" ? "" : "QualifiedLead";
    return has ? list.map((e) => (e.stage === stage ? { ...e, ...patch } : e)) : [...list, { stage, eventName: blank, enabled: true, ...patch }];
  });
  const stats = d.stats || {};
  const configured = (d.tokenSet && form.datasetId) || d.whatsappConnected;

  return (
    <section className="card p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="stitch-kicker mb-1">Meta ads</p>
          <h3 className="text-base font-bold text-app">Conversion tracking</h3>
          <p className="text-sm text-app-soft mt-1 max-w-xl">
            When a lead from a Facebook or Instagram lead form, or a click-to-WhatsApp ad, reaches a stage below,
            we tell Meta. Meta then learns which ads bring real buyers and shows them to more people like them.
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
          <span className="text-xs font-semibold text-app-soft">{d.enabled ? "On" : "Off"}</span>
          <input type="checkbox" className="sr-only peer" checked={d.enabled} disabled={saving || !configured}
            onChange={(e) => save({ enabled: e.target.checked })} />
          <span className="w-10 h-6 rounded-full relative transition peer-checked:bg-[var(--app-primary)] peer-disabled:opacity-40" style={{ background: "var(--app-border)" }}>
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: d.enabled ? "translateX(16px)" : "none" }} />
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Dataset ID (Instant Lead Forms)</label>
          <input className="input w-full" name="meta-dataset-id" autoComplete="off" data-lpignore="true" data-1p-ignore inputMode="numeric" placeholder="e.g. 1234567890123456" value={form.datasetId}
            onChange={(e) => setForm((f) => ({ ...f, datasetId: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Conversions API access token (Instant Lead Forms)</label>
          <input className="input w-full" name="meta-capi-token" type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore
            placeholder={d.tokenSet ? `Saved, ends in ${d.tokenLast4}. Paste a new one to replace it.` : "Paste the token from Events Manager"}
            value={form.accessToken} onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1.5 block">Test event code (needed for "Send a test event")</label>
          <input className="input w-full" name="meta-test-code" autoComplete="off" placeholder="e.g. TEST12345" value={form.testEventCode}
            onChange={(e) => setForm((f) => ({ ...f, testEventCode: e.target.value }))} />
        </div>
        <p className="text-xs text-app-soft self-end leading-relaxed">
          In Meta Events Manager, open your dataset, then Settings, then Conversions API, and choose Generate access token.
          The dataset ID is shown at the top of that page. Your token is stored encrypted and never shown again.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-app-soft mb-2">What to tell Meta</p>
        <div role="tablist" aria-label="Kind of Meta ad" className="inline-flex flex-wrap gap-1 rounded-xl p-1 mb-3"
          style={{ border: "1px solid var(--app-border-strong)", background: "var(--app-surface-low)" }}>
          {[{ key: "lead_ads", label: "Instant Lead Forms", Logo: FacebookLogo }, { key: "whatsapp_ctwa", label: "Click to WhatsApp Ads", Logo: WhatsAppLogo }].map(({ key, label, Logo }) => {
            const on = tab === key;
            return (
              <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setTab(key)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                style={on
                  ? { color: "var(--app-text)", background: "var(--app-surface-solid)", boxShadow: "0 0 0 1px rgba(var(--app-primary-rgb),0.45), 0 1px 2px rgba(16,24,40,0.06)" }
                  : { color: "var(--app-text-soft)" }}>
                <Logo className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-app-soft mb-2">
          {tab === "lead_ads"
            ? "For leads from Facebook and Instagram lead forms. Meta needs the first event (a lead arriving) plus at least two later stages before it starts learning from them."
            : "For leads who messaged you from a Click to WhatsApp ad. Meta accepts only its own event names for these, so pick one from each list."}
        </p>
        {tab === "whatsapp_ctwa" && (
          <p className="text-xs mb-2" style={{ color: d.whatsappConnected ? "#15803d" : "var(--app-text-soft)" }}>
            {d.whatsappConnected
              ? `Sent through your WhatsApp connection to your WhatsApp account's own dataset${d.whatsappDatasetId ? ` (${d.whatsappDatasetId})` : ""}. Nothing to paste.`
              : "Needs WhatsApp connected to Meta directly (WhatsApp Cloud API). AiSensy, Wati and Interakt don't pass on the ad click, so these leads can't be matched."}
          </p>
        )}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
          {d.stages.filter((s) => s !== "Closed Lost").map((stage, i) => {
            const list = tab === "lead_ads" ? events : waEvents;
            const e = list.find((x) => x.stage === stage) || { stage, eventName: "", enabled: false };
            return (
              <div key={stage} className="flex flex-wrap items-center gap-3 px-4 py-3" style={i ? { borderTop: "1px solid var(--app-border)" } : undefined}>
                <label className="flex items-center gap-2.5 w-44 cursor-pointer">
                  <input type="checkbox" checked={!!e.enabled} onChange={(ev) => setEvent(tab, stage, { enabled: ev.target.checked })} />
                  <span className="text-sm text-app">{stage === "New" ? <>Lead <b>arrives</b></> : <>Lead reaches <b>{stage}</b></>}</span>
                </label>
                <span className="text-xs text-app-soft">send event</span>
                {tab === "lead_ads" ? (
                  <input className="input w-48" style={{ padding: "8px 12px", borderRadius: "0.75rem" }} value={e.eventName} disabled={!e.enabled}
                    onChange={(ev) => setEvent(tab, stage, { eventName: ev.target.value })} />
                ) : (
                  <div className="w-48" style={e.enabled ? undefined : { opacity: 0.5, pointerEvents: "none" }}>
                    <CustomSelect value={e.eventName} options={d.whatsappEventNames} onChange={(v) => setEvent(tab, stage, { eventName: v })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "0.75rem", fontSize: 14 }} />
                  </div>
                )}
              </div>
            );
          })}
          {tab === "whatsapp_ctwa" && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--app-border)" }}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={chatQualified} onChange={(ev) => setChatQualified(ev.target.checked)} />
                <span className="text-sm text-app">Lead asks for a <b>site visit</b> or an <b>advisor</b>, or <b>registers</b>, in the chat</span>
              </label>
              <span className="text-xs text-app-soft">send event <b className="text-app">QualifiedLead</b></span>
            </div>
          )}
        </div>
        <p className="text-xs text-app-soft mt-2">Each event goes once per lead, so a lead counted as QualifiedLead in the chat is not counted again at Site Visit.</p>
        <p className="text-xs text-app-soft mt-2">
          {d.matchableLeads.toLocaleString("en-IN")} of your leads came from a Meta lead form or WhatsApp ad and can be matched.
          Website, manual and other leads are never sent.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => save()} disabled={saving} className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save settings
        </button>
        <button type="button" onClick={test} disabled={testing || saving || !form.datasetId || !form.testEventCode.trim() || !(d.tokenSet || form.accessToken)}
          title={form.testEventCode.trim() ? "" : "Add a test event code first, so the test is not counted as a real lead"}
          className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {testing && <Loader2 className="w-4 h-4 animate-spin" />} Send a test event
        </button>
        {testNote && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: testNote.ok ? "#15803d" : "#dc2626" }}>
            {testNote.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {testNote.text}
          </span>
        )}
      </div>

      {d.lastError && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Meta rejected the last event: {d.lastError}. Check the dataset ID and token.</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-app-soft">
            Recent events · {stats.sent || 0} sent{stats.failed ? `, ${stats.failed} failed` : ""}{stats.skipped ? `, ${stats.skipped} skipped` : ""}
          </p>
          {stats.failed > 0 && (
            <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: "var(--app-primary)" }}
              onClick={() => api.post("/meta-conversions/retry").then(() => { toast.success("Retrying failed events."); setTimeout(load, 2500); })}>
              Retry failed
            </button>
          )}
        </div>
        {d.recent.length === 0 ? (
          <p className="text-sm text-app-soft">Nothing yet. Events appear here as leads from your Meta ads move through the pipeline.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {d.recent.map((e) => {
                  const t = STATUS_TONE[e.status] || STATUS_TONE.pending;
                  return (
                    <tr key={e._id} style={{ borderTop: "1px solid var(--app-border)" }}>
                      <td className="py-2 pr-3 text-app font-medium">{e.leadName}</td>
                      <td className="py-2 pr-3 text-app-soft whitespace-nowrap">{e.stage} → {e.eventName}</td>
                      <td className="py-2 pr-3 text-app-soft whitespace-nowrap">{CHANNEL[e.channel]}</td>
                      <td className="py-2 pr-3 text-app-soft whitespace-nowrap">{when(e.at)}</td>
                      <td className="py-2 text-right whitespace-nowrap" title={e.error || ""}>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
