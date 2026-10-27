// LeadRoutingSection.jsx — campaign routing rules: leads from a specific
// Facebook/Google campaign, WhatsApp ad or website page go straight to a team
// member or project (Growth). Moved out of pages/Automation.jsx on 27 Oct 2026
// so it can live on its own page (/integrations/routing). Backend: /api/routing-rules.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import api from "../services/api";
import { Spinner } from "./UI";
import CustomSelect from "./CustomSelect";

/* ─── Lead Routing Rules ───────────────────────────────────────────────────── */
const SOURCE_LABELS = {
  facebook: "Facebook Lead Ads",
  whatsapp: "WhatsApp (Click-to-WhatsApp Ads)",
  google:   "Google Ads",
  website:  "Website",
};

// Mirrors backend/models/RoutingRule.js MATCH_FIELDS_BY_SOURCE — keep in sync.
const MATCH_FIELDS_BY_SOURCE = {
  facebook: ["form_id", "campaign_id", "adset_id", "ad_id"],
  whatsapp: ["ad_id"],
  google:   ["campaign_id"],
  website:  ["domain", "page_path"],
};

const MATCH_FIELD_LABELS = {
  form_id:     "Form ID",
  campaign_id: "Campaign ID",
  adset_id:    "Ad Set ID",
  ad_id:       "Ad ID",
  domain:      "Website Domain",
  page_path:   "Page URL Contains",
};

const MATCH_FIELD_PLACEHOLDERS = {
  form_id:     "e.g. 9655855458173381",
  campaign_id: "e.g. 9655855458173381",
  adset_id:    "e.g. 9655855458173381",
  ad_id:       "e.g. 9655855458173381",
  domain:      "e.g. greenvalleyhomes.com",
  page_path:   "e.g. /projects/green-valley-villas",
};

function matchFieldHint(source, matchField) {
  if (source === "website") {
    return matchField === "domain"
      ? "Exact match against the domain the form was submitted from (no \"www.\", no https://)."
      : "Matches when the page URL contains this text — e.g. one project's landing page.";
  }
  if (source === "whatsapp") {
    return "Find this in Facebook Ads Manager → your Click-to-WhatsApp ad → Ad ID.";
  }
  if (source === "google") {
    return "Find this in Google Ads → Campaigns → Campaign ID column.";
  }
  return `Find this in Facebook Ads Manager → Campaign → ${MATCH_FIELD_LABELS[matchField]}.`;
}

export default function LeadRoutingSection({ bare = false }) {
  const [rules, setRules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [domains, setDomains] = useState([]);
  const [sitePages, setSitePages] = useState([]);
  // Real form/campaign/ad-set/ad IDs already seen on this org's leads, keyed
  // by source then matchField — e.g. campaignOptions.facebook.form_id — so
  // the rule form can offer a pick-from-real-leads dropdown instead of
  // making you dig the raw ID out of Ads Manager by hand.
  const [campaignOptions, setCampaignOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", source: "facebook", matchField: "form_id", matchValue: "", assignTo: "", assignToProject: "" });
  // Multiple real-lead values ticked in the quick-pick (e.g. several WhatsApp
  // ads that should all route the same way) — when non-empty this creates one
  // rule per ticked value instead of the single `form.matchValue`. Cleared
  // whenever Source or Match By changes, since the ticked values belong to
  // that specific field.
  const [matchValues, setMatchValues] = useState([]);
  // Editing an existing rule: only its name, agent and project can change.
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", assignTo: "", assignToProject: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/routing-rules"),
      api.get("/auth/agents"),
      // Same endpoint the Leads page filter uses — real domains/pages leads
      // have already come in from, so a rule can be picked instead of typed.
      api.get("/leads/domains"),
      api.get("/projects"),
      api.get("/leads/campaign-options"),
    ])
      .then(([rulesRes, agentsRes, domainsRes, projectsRes, campaignRes]) => {
        const agentList = agentsRes.data.agents || [];
        setRules(rulesRes.data.rules || []);
        setAgents(agentList);
        setDomains(domainsRes.data.domains || []);
        setSitePages(domainsRes.data.pages || []);
        setProjects(projectsRes.data.data || []);
        setCampaignOptions(campaignRes.data.options || {});
        if (agentList.length > 0) {
          setForm((f) => ({ ...f, assignTo: f.assignTo || agentList[0]._id }));
        }
      })
      .catch(() => { toast.error("Failed to load routing data"); })
      .finally(() => setLoading(false));
  }, []);

  // Flat, indented option list for the website quick-pick: one row per known
  // domain, one indented row per page under it (from real lead traffic).
  // Picking a domain fills matchField "domain"; picking a page fills
  // matchField "page_path" with just the path (works regardless of www./
  // protocol, since matching is a substring check against the full URL).
  const websiteQuickPickOptions = useMemo(() => {
    const opts = [{ value: "", label: "— Type manually below —" }];
    for (const d of domains) {
      const pagesOfD = sitePages.filter((p) => p.domain === d);
      const total = pagesOfD.reduce((n, p) => n + p.count, 0);
      opts.push({ value: `domain:${d}`, label: `🌐 ${d}${total ? ` (${total})` : ""}` });
      for (const p of pagesOfD) {
        if (p.path === "/") continue; // the bare domain row above already covers this
        opts.push({ value: `page:${p.path}`, label: `　↳ ${p.path} (${p.count})` });
      }
    }
    return opts;
  }, [domains, sitePages]);

  // Facebook/WhatsApp/Google quick-pick: the real form/campaign/ad-set/ad
  // IDs already seen on this org's leads for whichever source+matchField is
  // currently selected — picking one fills Value directly, no copy-pasting
  // out of Ads Manager. null when there's nothing to offer yet (brand-new
  // org, or a matchField that hasn't appeared on a lead yet), in which case
  // the form falls back to the plain manual input below it.
  const campaignQuickPickOptions = useMemo(() => {
    if (form.source === "website") return null;
    const list = campaignOptions[form.source]?.[form.matchField];
    if (!list?.length) return null;
    return list.map((o) => ({ value: o.value, label: o.label, count: o.count }));
  }, [form.source, form.matchField, campaignOptions]);

  // Ticked values belong to one specific source+matchField — switching
  // either one invalidates whatever was ticked for the previous field.
  useEffect(() => { setMatchValues([]); }, [form.source, form.matchField]);

  const toggleMatchValue = (value) => {
    setMatchValues((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || (matchValues.length === 0 && !form.matchValue.trim())) {
      toast.error("Please fill in all fields"); return;
    }
    if (!form.assignTo) {
      toast.error("No agents available to assign to"); return;
    }
    setSaving(true);
    try {
      if (matchValues.length > 0) {
        // One rule per ticked value, same label/source/matchField/agent/
        // project — each matched value gets a distinct rule row (so any one
        // of them can later be paused/deleted/reassigned on its own) rather
        // than one rule holding an array of values.
        const results = await Promise.allSettled(matchValues.map((value) => {
          const pick = campaignQuickPickOptions?.find((o) => o.value === value);
          const label = pick?.label && pick.label !== value ? `${form.label} — ${pick.label}` : form.label;
          return api.post("/routing-rules", { ...form, label, matchValue: value });
        }));
        const created = results.filter((r) => r.status === "fulfilled").map((r) => r.value.data.rule);
        const failed = results.length - created.length;
        if (created.length) setRules((prev) => [...created, ...prev]);
        if (failed) toast.error(`${created.length} of ${results.length} rules saved — ${failed} failed`);
        else toast.success(`${created.length} routing rule${created.length > 1 ? "s" : ""} added`);
      } else {
        const { data } = await api.post("/routing-rules", form);
        setRules((prev) => [data.rule, ...prev]);
        toast.success("Routing rule added");
      }
      setForm({ label: "", source: "facebook", matchField: "form_id", matchValue: "", assignTo: agents[0]?._id || "", assignToProject: "" });
      setMatchValues([]);
      setShowForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      const { data } = await api.patch(`/routing-rules/${rule._id}`, { isActive: !rule.isActive });
      setRules((prev) => prev.map((r) => r._id === rule._id ? data.rule : r));
    } catch { toast.error("Failed to update rule"); }
  };

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setEditForm({ label: rule.label || "", assignTo: String(rule.assignTo || ""), assignToProject: String(rule.assignToProject || "") });
  };

  const saveEdit = async (rule) => {
    if (!editForm.label.trim()) { toast.error("Give the rule a name"); return; }
    if (!editForm.assignTo) { toast.error("Pick who it should be assigned to"); return; }
    setSavingEdit(true);
    try {
      const { data } = await api.patch(`/routing-rules/${rule._id}`, {
        label: editForm.label.trim(),
        assignTo: editForm.assignTo,
        assignToProject: editForm.assignToProject || null,
      });
      setRules((prev) => prev.map((r) => r._id === rule._id ? data.rule : r));
      setEditingId(null);
      toast.success("Rule updated. New leads will follow it.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the rule");
    } finally { setSavingEdit(false); }
  };

  const deleteRule = async (id) => {
    if (!confirm("Delete this routing rule?")) return;
    try {
      await api.delete(`/routing-rules/${id}`);
      setRules((prev) => prev.filter((r) => r._id !== id));
      toast.success("Rule deleted");
    } catch { toast.error("Failed to delete rule"); }
  };

  return (
    <section className="card p-6 space-y-5" style={bare ? { boxShadow: "none" } : undefined}>
      <div className="flex items-center justify-between gap-4">
        {bare ? <p className="text-sm font-bold text-app">Your rules</p> : <div>
          <h2 className="text-lg font-bold text-app">Lead Routing Rules</h2>
          <p className="text-sm text-app-soft mt-0.5">
            Route leads from specific Facebook/Google campaigns, WhatsApp ads, or website domains and pages directly to a team member. All other leads follow the round-robin rotation.
          </p>
        </div>}
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {/* Add rule form */}
      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <p className="text-sm font-semibold text-app">New Routing Rule</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Rule Name</label>
              <input
                className="input"
                placeholder="e.g. Green Valley Villas Campaign"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="label">Source</label>
              <CustomSelect
                value={form.source}
                onChange={(v) => setForm((f) => ({ ...f, source: v, matchField: MATCH_FIELDS_BY_SOURCE[v][0] }))}
                options={Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>

            <div className="space-y-1">
              <label className="label">Assign To</label>
              <CustomSelect
                value={form.assignTo}
                onChange={(v) => setForm((f) => ({ ...f, assignTo: v }))}
                options={agents.map((a) => ({ value: a._id, label: a.name }))}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>

            <div className="space-y-1">
              <label className="label">Match By</label>
              <CustomSelect
                value={form.matchField}
                onChange={(v) => setForm((f) => ({ ...f, matchField: v }))}
                options={MATCH_FIELDS_BY_SOURCE[form.source].map((k) => ({ value: k, label: MATCH_FIELD_LABELS[k] }))}
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
            </div>

            {form.source === "website" && websiteQuickPickOptions.length > 1 && (
              <div className="space-y-1 sm:col-span-2">
                <label className="label">Pick from your website's actual traffic</label>
                <CustomSelect
                  value=""
                  onChange={(v) => {
                    if (!v) return;
                    const [kind, ...rest] = v.split(":");
                    const val = rest.join(":");
                    setForm((f) => ({ ...f, matchField: kind === "domain" ? "domain" : "page_path", matchValue: val }));
                  }}
                  options={websiteQuickPickOptions}
                  placeholder="— Type manually below —"
                  style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
                />
                <p className="text-xs text-app-soft">Only shows domains/pages that have already sent at least one lead — a brand-new page won't be listed yet, so type it in manually below.</p>
              </div>
            )}

            {campaignQuickPickOptions && (
              <div className="space-y-1 sm:col-span-2">
                <label className="label">
                  Pick from your real leads{matchValues.length > 0 ? ` (${matchValues.length} selected)` : ""}
                </label>
                <div className="rounded-xl divide-y max-h-56 overflow-y-auto" style={{ border: "1px solid var(--app-border)" }}>
                  {campaignQuickPickOptions.map((o) => (
                    <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--app-surface-low)]">
                      <input type="checkbox" className="shrink-0"
                        checked={matchValues.includes(o.value)} onChange={() => toggleMatchValue(o.value)} />
                      <span className="flex-1 min-w-0 truncate text-app">{o.label}</span>
                      {o.count > 0 && <span className="text-xs text-app-soft shrink-0">{o.count} lead{o.count === 1 ? "" : "s"}</span>}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-app-soft">
                  {matchValues.length > 0
                    ? `Tick as many as you need — Save will create ${matchValues.length} rule${matchValues.length > 1 ? "s" : ""}, all assigned to the same agent${form.assignToProject ? " and project" : ""}.`
                    : "Tick one or more to route them all the same way — leave everything unticked to type a single value manually below instead."}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="label">{MATCH_FIELD_LABELS[form.matchField]} Value</label>
              <input
                className="input font-mono text-sm"
                placeholder={matchValues.length > 0 ? "Using ticked selections above" : MATCH_FIELD_PLACEHOLDERS[form.matchField]}
                value={form.matchValue}
                disabled={matchValues.length > 0}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  setForm((f) => ({ ...f, matchValue: f.matchField === "domain" ? raw.toLowerCase() : raw }));
                }}
              />
              <p className="text-xs text-app-soft">
                {matchValues.length > 0 ? "Clear your ticked selections above to type a single value here instead." : matchFieldHint(form.source, form.matchField)}
              </p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="label">Also file into project (optional)</label>
              <CustomSelect
                value={form.assignToProject}
                onChange={(v) => setForm((f) => ({ ...f, assignToProject: v }))}
                options={[{ value: "", label: "— Don't file into a project —" }, ...projects.map((p) => ({ value: p._id, label: p.name }))]}
                placeholder="— Don't file into a project —"
                style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
              />
              <p className="text-xs text-app-soft">
                Besides assigning the agent, also drop a copy of the lead straight into this project's Leads tab — skips the manual "Transfer to Project" step. The lead still stays in the main pipeline too.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary rounded-xl" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary rounded-xl" disabled={saving}>
              {saving ? <><Spinner size="sm" /> Saving…</> : "Save Rule"}
            </button>
          </div>
        </form>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-app-soft" style={{ borderColor: "var(--app-border)" }}>
          No routing rules yet. Add one above to route specific campaigns, ads, or website pages to a team member.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => editingId === rule._id ? (
            <div key={rule._id} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--app-primary)", background: "var(--app-surface-low)" }}>
              <p className="text-xs text-app-soft">
                {SOURCE_LABELS[rule.source || "facebook"]} · {MATCH_FIELD_LABELS[rule.matchField]} <code className="text-orange-400 font-mono">{rule.matchValue}</code>
                {" "}(what it matches can't be changed here; add a new rule to match something else)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="label">Rule Name</label>
                  <input className="input" value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="label">Assign To</label>
                  <CustomSelect
                    value={editForm.assignTo}
                    onChange={(v) => setEditForm((f) => ({ ...f, assignTo: v }))}
                    options={agents.map((a) => ({ value: a._id, label: a.name }))}
                    style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label">Also file into project</label>
                  <CustomSelect
                    value={editForm.assignToProject}
                    onChange={(v) => setEditForm((f) => ({ ...f, assignToProject: v }))}
                    options={[{ value: "", label: "— Don't file into a project —" }, ...projects.map((p) => ({ value: p._id, label: p.name }))]}
                    placeholder="— Don't file into a project —"
                    style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
                  />
                </div>
              </div>
              <p className="text-xs text-app-soft">Applies to leads that arrive from now on. Leads already routed keep the agent they were given.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary rounded-xl" onClick={() => setEditingId(null)}>Cancel</button>
                <button type="button" className="btn-primary rounded-xl" disabled={savingEdit} onClick={() => saveEdit(rule)}>
                  {savingEdit ? <><Spinner size="sm" /> Saving…</> : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            <div key={rule._id} className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${rule.isActive ? "border-[var(--app-border)]" : "border-dashed border-[var(--app-border)] opacity-50"}`}>
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleRule(rule)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${rule.isActive ? "bg-emerald-500" : "bg-white/10"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${rule.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-app truncate">
                  {rule.label}
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-app-soft align-middle">
                    {SOURCE_LABELS[rule.source || "facebook"]}
                  </span>
                </p>
                <p className="text-xs text-app-soft">
                  {MATCH_FIELD_LABELS[rule.matchField]} <code className="text-orange-400 font-mono">{rule.matchValue}</code>
                  {" → "}
                  <span className="text-emerald-400 font-medium">{rule.assignToName}</span>
                  {rule.assignToProject && (
                    <> {" + filed into "}<span className="text-emerald-400 font-medium">{rule.assignToProjectName}</span></>
                  )}
                </p>
              </div>

              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${rule.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-app-soft"}`}>
                {rule.isActive ? "Active" : "Paused"}
              </span>

              <button type="button" onClick={() => startEdit(rule)} title="Edit rule" aria-label="Edit rule" className="text-app-soft hover:text-app transition shrink-0">
                <Pencil className="h-4 w-4" />
              </button>

              <button onClick={() => deleteRule(rule._id)} className="text-app-soft hover:text-red-400 transition shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <p className="text-xs text-app-soft text-center pt-1">
            All other leads (no match) → assigned via round-robin to your team
          </p>
        </div>
      )}
    </section>
  );
}

