import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send, AlertTriangle, Users, Zap, CheckCircle2 } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CustomSelect from "../../components/CustomSelect";
import { AppDatePicker } from "../../components/UI";
import { STATUS_OPTIONS, SOURCE_OPTIONS } from "../../utils/constants";

const rupees = (p) => `₹${((p || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FORM_SELECT = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };
const VAR_FIELDS = [
  { value: "name",  label: "Lead name" },
  { value: "phone", label: "Lead phone" },
];

// The words around a {{n}} in the template, so "{{2}}" reads as "…visit to
// {{2}} on…" and the person mapping it knows what it is for.
function contextFor(body, n) {
  const token = new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`);
  const m = body.match(token);
  if (!m) return "";
  const i = m.index;
  const start = Math.max(0, i - 28);
  const end = Math.min(body.length, i + m[0].length + 28);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();          // present when reviewing an existing draft

  const [templates, setTemplates]   = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [counts, setCounts]         = useState(null);

  const [name, setName]         = useState("");
  const [templateName, setTpl]  = useState("");
  const [filter, setFilter]     = useState({ status: "", source: "", from: "", to: "" });
  const [mapping, setMapping]   = useState([]);

  const [prev, setPrev]     = useState(null);
  const [checking, setChk]  = useState(false);
  const [sending, setSend]  = useState(false);
  const [campaignId, setCampaignId] = useState(id || null);

  useEffect(() => {
    api.get("/whatsapp/templates")
      .then((r) => setTemplates((r.data.templates || []).filter((t) => t.status === "APPROVED")))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
    api.get("/whatsapp/campaigns/audience-counts").then((r) => setCounts(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get("/whatsapp/campaigns").then((r) => {
      const c = (r.data.campaigns || []).find((x) => x._id === id);
      if (!c) return;
      setName(c.name); setTpl(c.templateName);
      setFilter({ status: "", source: "", from: "", to: "", ...(c.audienceFilter || {}) });
      setMapping(c.variableMapping || []);
    }).catch(() => {});
  }, [id]);

  // Re-check whenever the template or audience changes — the number and the
  // cost on screen must be the ones that will actually be charged.
  useEffect(() => {
    if (!templateName) { setPrev(null); return undefined; }
    let cancelled = false;
    setChk(true);
    api.post("/whatsapp/campaigns/preview", { templateName, filter })
      .then((r) => { if (!cancelled) setPrev(r.data); })
      .catch((e) => { if (!cancelled) { setPrev(null); toast.error(e.response?.data?.message || "Could not preview"); } })
      .finally(() => { if (!cancelled) setChk(false); });
    return () => { cancelled = true; };
  }, [templateName, filter]);

  // Keep the mapping the same length as the template's variable count.
  useEffect(() => {
    if (!prev) return;
    setMapping((m) => {
      const next = [...m];
      next.length = prev.variablesExpected;
      return Array.from(next, (v) => v || "name");
    });
  }, [prev?.variablesExpected]);

  const withCount = (map, v) => (map && map[v] != null ? `${v} (${map[v].toLocaleString("en-IN")})` : v);
  const statusOptions = [{ value: "", label: "All statuses" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: withCount(counts?.status, s) }))];
  const sourceOptions = [{ value: "", label: "All sources" }, ...SOURCE_OPTIONS.map((s) => ({ value: s, label: withCount(counts?.source, s) }))];

  const saveDraft = async () => {
    const tpl = templates.find((t) => t.name === templateName);
    const { data } = await api.post("/whatsapp/campaigns", {
      name, templateName,
      templateLanguage: tpl?.language, templateCategory: tpl?.category,
      variableMapping: mapping, audienceFilter: filter,
    });
    setCampaignId(data.campaign._id);
    return data.campaign._id;
  };

  const sendNow = async () => {
    if (!name.trim())   return toast.error("Give the campaign a name");
    if (!prev?.canSend) return toast.error(prev?.blockers?.[0] || "Nothing to send");
    if (!confirm(`Send to ${prev.sendableCount} people for ${rupees(prev.costPaise)}?`)) return;

    setSend(true);
    try {
      const cid = campaignId || await saveDraft();
      const { data } = await api.post(`/whatsapp/campaigns/${cid}/send`);
      toast.success(`Sent to ${data.campaign.stats.sent} people`);
      navigate("/conversations/campaigns");
    } catch (e) {
      toast.error(e.response?.data?.message || "Campaign failed", { duration: 8000 });
    } finally { setSend(false); }
  };

  const body = prev?.template?.body || "";

  return (
    <div className="stitch-page">
      <button onClick={() => navigate("/conversations/campaigns")}
        className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Campaigns
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app">{id ? "Review campaign" : "New campaign"}</h1>
        <p className="text-xs text-app-soft mt-0.5">Nothing sends until you confirm the cost.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-app">Campaign details</h2>
              <p className="text-xs text-app-soft mt-0.5">Pick a template Meta has approved to begin the broadcast</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Campaign name</label>
              <input className="input w-full" placeholder="Diwali launch — Andheri"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-app-soft">Template</label>
                {templateName && (
                  <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: "#15803d" }}>
                    <CheckCircle2 className="w-3 h-3" /> Approved by Meta
                  </span>
                )}
              </div>
              {loadingTpl ? (
                <div className="flex items-center gap-2 text-xs text-app-soft py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading approved templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-2xl px-4 py-3 text-xs flex items-start gap-2 flex-wrap"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)", color: "#b45309" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span className="flex-1">No approved templates yet. Create one and wait for Meta to approve it before running a campaign.</span>
                  <button onClick={() => navigate("/conversations/templates/new")} className="font-semibold underline">Create a template</button>
                </div>
              ) : (
                <CustomSelect
                  value={templateName} onChange={setTpl}
                  options={templates.map((t) => ({ value: t.name, label: `${t.name} · ${(t.category || "").toLowerCase()}` }))}
                  placeholder="Choose an approved template"
                  style={FORM_SELECT}
                />
              )}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-app">Who gets it</h2>
                <p className="text-xs text-app-soft mt-0.5">The same filters you use on the Leads page</p>
              </div>
              {prev && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full stitch-surface-muted text-app">
                  {prev.total.toLocaleString("en-IN")} leads matched
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Lead status</label>
                <CustomSelect value={filter.status || ""} onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
                  options={statusOptions} style={FORM_SELECT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Lead source</label>
                <CustomSelect value={filter.source || ""} onChange={(v) => setFilter((f) => ({ ...f, source: v }))}
                  options={sourceOptions} style={FORM_SELECT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Created from</label>
                <AppDatePicker value={filter.from || ""} onChange={(v) => setFilter((f) => ({ ...f, from: v || "" }))}
                  max={filter.to || undefined} className="w-full"
                  triggerStyle={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Created to</label>
                <AppDatePicker value={filter.to || ""} onChange={(v) => setFilter((f) => ({ ...f, to: v || "" }))}
                  min={filter.from || undefined} className="w-full"
                  triggerStyle={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
            </div>
            {(filter.from || filter.to) && (
              <button onClick={() => setFilter((f) => ({ ...f, from: "", to: "" }))}
                className="text-xs font-semibold" style={{ color: "var(--app-primary)" }}>Clear dates</button>
            )}
          </div>

          {prev?.variablesExpected > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-app">Fill the blanks</h2>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                  {prev.variablesExpected} dynamic tag{prev.variablesExpected > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-app-soft -mt-1">
                This template has {prev.variablesExpected} value{prev.variablesExpected > 1 ? "s" : ""} filled per person
              </p>
              {Array.from({ length: prev.variablesExpected }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl p-3 flex-wrap sm:flex-nowrap stitch-surface-muted">
                  <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg shrink-0"
                    style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>{`{{${i + 1}}}`}</span>
                  <p className="text-xs text-app-soft flex-1 min-w-0 truncate" title={contextFor(body, i + 1)}>
                    {contextFor(body, i + 1) || "Value for this position"}
                  </p>
                  <div className="w-full sm:w-44 shrink-0">
                    <CustomSelect
                      value={mapping[i] || "name"}
                      onChange={(v) => setMapping((m) => { const n = [...m]; n[i] = v; return n; })}
                      options={VAR_FIELDS} style={{ width: "100%", padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 self-start w-full space-y-3">
          <div className="card p-5">
            <p className="stitch-kicker mb-3">Before you send</p>

            {checking ? (
              <div className="flex items-center gap-2 text-xs text-app-soft py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking…
              </div>
            ) : !prev ? (
              <p className="text-xs text-app-soft py-6 text-center">Pick a template to see the audience and cost.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-app-soft" />
                  <span className="text-2xl font-bold text-app tabular-nums">{prev.sendableCount.toLocaleString("en-IN")}</span>
                  <span className="text-xs text-app-soft">of {prev.total.toLocaleString("en-IN")}</span>
                </div>

                {/* Exclusions are shown, never silently applied — a shrinking
                    number with no reason reads as a bug. */}
                {(prev.skippedNoConsent > 0 || prev.skippedNoPhone > 0) && (
                  <div className="text-[11px] text-app-soft space-y-0.5 mb-3">
                    {prev.skippedNoConsent > 0 && (
                      <p>
                        {prev.skippedNoConsent.toLocaleString("en-IN")} excluded — no marketing consent.{" "}
                        {/* No bulk "grant all" here on purpose: one click cannot
                            capture consent on behalf of many people. */}
                        <button type="button"
                          onClick={() => navigate("/leads", { state: { presetConsent: "unknown", presetStatus: filter.status || "", presetSource: filter.source || "" } })}
                          className="font-semibold underline" style={{ color: "var(--app-primary)" }}>
                          Record consent
                        </button>
                      </p>
                    )}
                    {prev.skippedNoPhone > 0 && <p>{prev.skippedNoPhone.toLocaleString("en-IN")} excluded — no phone number</p>}
                  </div>
                )}

                <div className="rounded-2xl px-3.5 py-3 mb-3 stitch-surface-muted">
                  {prev.billedDirectlyByMeta ? (
                    <p className="text-xs text-app-soft">Billed directly to your Meta account, not through credits.</p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-app-soft">Cost</span>
                        <span className="text-app font-bold tabular-nums">{rupees(prev.costPaise)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] mt-1">
                        <span className="text-app-soft">{rupees(prev.ratePaise)} each · {prev.creditCategory}</span>
                        <span className="text-app-soft">balance {rupees(prev.availablePaise)}</span>
                      </div>
                    </>
                  )}
                </div>

                {prev.blockers.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl px-3 py-2 mb-2 text-[11px]"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{b}</span>
                  </div>
                ))}

                {prev.qualityRating && prev.qualityRating !== "RED" && (
                  <p className="text-[11px] text-app-soft mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: prev.qualityRating === "GREEN" ? "#22c55e" : "#f59e0b" }} />
                    Number quality: {prev.qualityRating.toLowerCase()}
                    {prev.tierCap ? ` · ${prev.tierCap.toLocaleString("en-IN")} per 24h limit` : ""}
                  </p>
                )}

                <button onClick={sendNow} disabled={sending || !prev.canSend || !name.trim()}
                  className="btn-primary w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending…" : `Send to ${prev.sendableCount.toLocaleString("en-IN")}`}
                </button>
              </>
            )}
          </div>

          <p className="text-[11px] text-app-soft flex items-start gap-1.5 px-1">
            <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <span>Credits are held for the whole run before the first message goes out, so a campaign never stops half-sent.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
