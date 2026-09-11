import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send, AlertTriangle, Users, Zap } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CustomSelect from "../../components/CustomSelect";

const rupees = (p) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUSES   = ["", "New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];
const SOURCES    = ["", "Website", "Facebook", "Google", "Referral", "Walk-in"];
const VAR_FIELDS = [
  { value: "name",  label: "Lead name" },
  { value: "phone", label: "Lead phone" },
];

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();          // present when reviewing an existing draft

  const [templates, setTemplates] = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);

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
      .then(r => setTemplates((r.data.templates || []).filter(t => t.status === "APPROVED")))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get("/whatsapp/campaigns").then(r => {
      const c = (r.data.campaigns || []).find(x => x._id === id);
      if (!c) return;
      setName(c.name); setTpl(c.templateName);
      setFilter(c.audienceFilter || {}); setMapping(c.variableMapping || []);
    }).catch(() => {});
  }, [id]);

  // Re-check whenever the template or audience changes — the number and the
  // cost on screen must be the ones that will actually be charged.
  useEffect(() => {
    if (!templateName) { setPrev(null); return; }
    let cancelled = false;
    setChk(true);
    api.post("/whatsapp/campaigns/preview", { templateName, filter })
      .then(r => { if (!cancelled) setPrev(r.data); })
      .catch(e => { if (!cancelled) { setPrev(null); toast.error(e.response?.data?.message || "Could not preview"); } })
      .finally(() => { if (!cancelled) setChk(false); });
    return () => { cancelled = true; };
  }, [templateName, filter]);

  // Keep the mapping the same length as the template's variable count.
  useEffect(() => {
    if (!prev) return;
    setMapping(m => {
      const next = [...m];
      next.length = prev.variablesExpected;
      return Array.from(next, v => v || "name");
    });
  }, [prev?.variablesExpected]);

  const saveDraft = async () => {
    const tpl = templates.find(t => t.name === templateName);
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

  return (
    <div className="stitch-page">
      <button onClick={() => navigate("/conversations/campaigns")}
        className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Campaigns
      </button>

      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">{id ? "Review campaign" : "New campaign"}</h1>
        <p className="text-xs text-app-soft">Nothing sends until you confirm the cost</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Campaign name</label>
              <input className="input w-full" placeholder="Diwali launch — Andheri"
                value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Template</label>
              {loadingTpl ? (
                <div className="flex items-center gap-2 text-xs text-app-soft py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading approved templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-2xl px-4 py-3 text-xs"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)", color: "#b45309" }}>
                  No approved templates yet. Create one and wait for Meta to approve it before running a campaign.
                </div>
              ) : (
                <CustomSelect
                  value={templateName} onChange={setTpl}
                  options={templates.map(t => ({ value: t.name, label: `${t.name} · ${(t.category || "").toLowerCase()}` }))}
                  placeholder="Choose an approved template"
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
                />
              )}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-app">Who gets it</h2>
              <p className="text-xs text-app-soft mt-0.5">The same filters you use on the Leads page</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Status</label>
                <CustomSelect value={filter.status || ""} onChange={v => setFilter(f => ({ ...f, status: v }))}
                  options={STATUSES.map(s => ({ value: s, label: s || "All statuses" }))}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Source</label>
                <CustomSelect value={filter.source || ""} onChange={v => setFilter(f => ({ ...f, source: v }))}
                  options={SOURCES.map(s => ({ value: s, label: s || "All sources" }))}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Created from</label>
                <input type="date" className="input w-full" value={filter.from || ""}
                  onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Created to</label>
                <input type="date" className="input w-full" value={filter.to || ""}
                  onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
          </div>

          {prev?.variablesExpected > 0 && (
            <div className="card p-5 space-y-3">
              <div>
                <h2 className="text-base font-bold text-app">Fill the blanks</h2>
                <p className="text-xs text-app-soft mt-0.5">
                  This template has {prev.variablesExpected} value{prev.variablesExpected > 1 ? "s" : ""} filled per person
                </p>
              </div>
              {Array.from({ length: prev.variablesExpected }, (_, i) => (
                <div key={i}>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">{`{{${i + 1}}}`}</label>
                  <CustomSelect
                    value={mapping[i] || "name"}
                    onChange={v => setMapping(m => { const n = [...m]; n[i] = v; return n; })}
                    options={VAR_FIELDS}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost + blockers */}
        <div className="lg:sticky lg:top-4 self-start w-full space-y-3">
          <div className="card p-5">
            <p className="text-xs font-semibold text-app-soft mb-3">Before you send</p>

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
                  <span className="text-2xl font-bold text-app">{prev.sendableCount.toLocaleString("en-IN")}</span>
                  <span className="text-xs text-app-soft">of {prev.total.toLocaleString("en-IN")}</span>
                </div>

                {/* Exclusions are shown, never silently applied — a shrinking
                    number with no reason reads as a bug. */}
                {(prev.skippedNoConsent > 0 || prev.skippedNoPhone > 0) && (
                  <div className="text-[11px] text-app-soft space-y-0.5 mb-3">
                    {prev.skippedNoConsent > 0 && (
                      <p>
                        {prev.skippedNoConsent.toLocaleString("en-IN")} excluded — no marketing consent.{" "}
                        {/* No bulk "grant all" here on purpose: one click cannot capture
                            consent on behalf of many people. Send them to the leads. */}
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

                <div className="rounded-2xl px-3 py-2.5 mb-3" style={{ background: "var(--app-surface-low)" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-app-soft">Cost</span>
                    <span className="text-app font-bold">{rupees(prev.costPaise)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1">
                    <span className="text-app-soft">{rupees(prev.ratePaise)} each · {prev.creditCategory}</span>
                    <span className="text-app-soft">balance {rupees(prev.availablePaise)}</span>
                  </div>
                </div>

                {prev.blockers.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl px-3 py-2 mb-2 text-[11px]"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c" }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}

                {prev.qualityRating && prev.qualityRating !== "RED" && (
                  <p className="text-[11px] text-app-soft mb-2">
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
            <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Credits are held for the whole run before the first message goes out, so a campaign never stops half-sent.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
