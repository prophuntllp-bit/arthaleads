// VistrowOutboundSection.jsx - owner controls for sending NEW leads to Vistrow
// Voice, and deciding which of them its agents may phone.
//
// A guided four-step setup: connect, choose sources (all off), choose agents by name, review and switch on.
//   1. "Send new leads to Vistrow" - every new lead reaches Vistrow as a Contact.
//   2. Per source (Website / Facebook / WhatsApp) - "Auto-call": a lead is only
//      phoned when its source is on AND a rule below matches it AND that rule
//      names an agent. No rule, no agent, no call: there is no default agent.
//
// Rules work like the Website Widget's Page rules in Vistrow: a match on the
// left, the agent on the right. Settings and the delivery log live in
// /api/integrations/vistrow-outbound.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Globe, Loader2, Megaphone, MessageCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ConfirmDialog, Spinner } from "./UI";
import CustomSelect from "./CustomSelect";

const BASE = "/integrations/vistrow-outbound";
const DEFAULT_ADDRESS = "https://api.vistrowvoice.com";
const FORM_SELECT = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };

const SOURCES = [
  { key: "website", label: "Website", icon: Globe, how: "Matched by the page the form was filled on", noun: "website form" },
  { key: "facebook", label: "Facebook", icon: Megaphone, how: "Matched by the project the lead is filed under", noun: "Facebook lead-ad" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, how: "Matched by the project or the ad the chat started from", noun: "WhatsApp" },
];

// Why a lead was sent as a Contact only.
const WHY = {
  source_disabled: "Source is off", no_route: "No matching rule", ambiguous_route: "Two rules tie", agent_missing: "Rule has no agent",
  not_auto_source: "Not a Website / Facebook / WhatsApp lead", recent_duplicate_phone: "Called recently", changed_before_send: "Changed before sending",
  test_event: "Test event",
};
const SKIP = { stale_lead: "Enquiry too old", invalid_phone: "No dialable phone", integration_disabled: "Switched off", config_changed: "Settings changed" };
const STATUS_TONE = {
  delivered: { bg: "rgba(34,197,94,0.12)", fg: "#15803d", label: "Delivered" },
  pending: { bg: "rgba(245,158,11,0.14)", fg: "#b45309", label: "Retrying" },
  sending: { bg: "rgba(245,158,11,0.14)", fg: "#b45309", label: "Sending" },
  failed: { bg: "rgba(220,38,38,0.12)", fg: "#dc2626", label: "Failed" },
  dead: { bg: "rgba(220,38,38,0.12)", fg: "#dc2626", label: "Gave up" },
  skipped: { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: "Not sent" },
  cancelled: { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: "Cancelled" },
};
const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "-");
const secs = (ms) => (ms == null ? "-" : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`);
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

function Switch({ on, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

// Searchable dropdown of Vistrow agents. Shows "name - knowledge base"; the value is an
// opaque ref and the real Vistrow id never reaches the browser.
function AgentPicker({ value, onChange, agents, placeholder = "Choose an agent", allowNone = false, compact = false, fallbackLabel = "", testId }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const picked = agents.find((a) => a.ref === value);
  const shown = picked ? `${picked.name} - ${picked.knowledgeBase}` : value && fallbackLabel ? (agents.length ? `${fallbackLabel} (not in your Vistrow list now)` : fallbackLabel) : placeholder;
  const needle = q.trim().toLowerCase();
  const list = agents.filter((a) => !needle || `${a.name} ${a.knowledgeBase}`.toLowerCase().includes(needle));
  const pick = (ref) => { setOpen(false); setQ(""); onChange(ref); };
  const style = compact ? { padding: "5px 10px", borderRadius: "0.75rem", fontSize: 13 } : FORM_SELECT;
  return (
    <div className="relative" ref={box} data-testid={testId}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setQ(""); setOpen((o) => !o); }} style={{ ...style, border: "1px solid var(--app-border)", background: "var(--app-surface)", textAlign: "left", display: "flex", alignItems: "center", gap: 8, color: picked || value ? "var(--app-text)" : "var(--app-text-soft)" }}>
        <span className="flex-1 truncate">{shown}</span><ChevronDown className="w-4 h-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-2xl border shadow-lg p-2" style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-2 px-2 pb-2"><Search className="w-4 h-4 text-app-soft" />
            <input autoFocus className="flex-1 bg-transparent outline-none text-sm" placeholder="Search by agent or knowledge base" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div role="listbox" className="max-h-60 overflow-auto">
            {allowNone && <button type="button" role="option" className="w-full text-left px-3 py-2 rounded-xl text-sm text-app-soft hover:bg-black/5" onClick={() => pick("")}>No agent - won't call</button>}
            {list.map((a) => (
              <button key={a.ref} type="button" role="option" aria-selected={a.ref === value} className="w-full text-left px-3 py-2 rounded-xl hover:bg-black/5" onClick={() => pick(a.ref)}>
                <span className="block text-sm font-semibold text-app">{a.name}</span><span className="block text-xs text-app-soft">{a.knowledgeBase}</span>
              </button>
            ))}
            {list.length === 0 && <p className="px-3 py-2 text-sm text-app-soft">No agent matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ tone = "red", children }) {
  const c = tone === "red" ? { bg: "rgba(220,38,38,0.08)", bd: "rgba(220,38,38,0.25)", fg: "#b91c1c" } : { bg: "rgba(245,158,11,0.10)", bd: "rgba(245,158,11,0.30)", fg: "#92400e" };
  return (
    <div className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm" style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg }}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div>{children}</div>
    </div>
  );
}

export default function VistrowOutboundSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [st, setSt] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pages, setPages] = useState([]);
  const [ads, setAds] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [conn, setConn] = useState({ baseUrl: "", accountId: "", secret: "", authMode: "header" });
  const [adv, setAdv] = useState({ dedupeWindowHours: 24, maxLeadAgeMinutes: 15, defaultCountryCode: "91", emitImports: false });
  const [showAdv, setShowAdv] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, run }
  const [draft, setDraft] = useState({ website: {}, facebook: {}, whatsapp: {} });
  const [check, setCheck] = useState({ source: "website", pageUrl: "", projectId: "", adId: "", result: null });
  const [testOut, setTestOut] = useState(null);
  const [agentList, setAgentList] = useState({ state: "idle", agents: [], problem: null }); // state: idle | loading | ok | error

  const apply = useCallback((status) => {
    setSt(status);
    setConn((c) => ({ ...c, baseUrl: status.config.baseUrl, accountId: status.config.accountId, authMode: status.config.authMode, secret: "" }));
    setAdv({ dedupeWindowHours: status.config.dedupeWindowHours, maxLeadAgeMinutes: status.config.maxLeadAgeMinutes, defaultCountryCode: status.config.defaultCountryCode, emitImports: status.config.emitImports });
  }, []);

  const loadDeliveries = useCallback(() => api.get(`${BASE}/deliveries?limit=20`).then((r) => setDeliveries(r.data.deliveries || [])).catch(() => {}), []);

  const loadAgents = useCallback(() => {
    setAgentList((a) => ({ ...a, state: "loading", problem: null }));
    return api.get(`${BASE}/agents`)
      .then((r) => setAgentList(r.data.problem ? { state: "error", agents: [], problem: r.data.problem } : { state: "ok", agents: r.data.agents || [], problem: null }))
      .catch(() => setAgentList({ state: "error", agents: [], problem: { code: "unreachable", message: "Could not load your Vistrow agents. Try again in a minute." } }));
  }, []);

  // Fetch the agent list once a connection is saved, and again whenever the connection changes.
  const connKey = st?.configured ? `${st.config.accountId}|${st.config.baseUrl}|${st.config.authMode}|${st.config.secretUpdatedAt || ""}` : "";
  useEffect(() => { if (isAdmin && connKey) loadAgents(); else setAgentList({ state: "idle", agents: [], problem: null }); }, [isAdmin, connKey, loadAgents]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      api.get(BASE),
      api.get("/projects").catch(() => ({ data: { data: [] } })),
      api.get("/leads/domains").catch(() => ({ data: { pages: [] } })),
      api.get("/leads/campaign-options").catch(() => ({ data: { options: {} } })),
    ]).then(([s, p, d, c]) => {
      apply(s.data.status);
      setProjects(p.data.data || []);
      setPages(d.data.pages || []);
      setAds(c.data.options?.whatsapp?.ad_id || []);
    }).catch(() => toast.error("Could not load the Vistrow settings")).finally(() => setLoading(false));
    loadDeliveries();
  }, [isAdmin, apply, loadDeliveries]);

  const call = useCallback(async (key, fn, ok) => {
    setBusy(key);
    try { const r = await fn(); if (r?.data?.status) apply(r.data.status); if (ok) toast.success(typeof ok === "function" ? ok(r) : ok); return r; }
    catch (e) { toast.error(errMsg(e, "Something went wrong")); return null; }
    finally { setBusy(""); }
  }, [apply]);

  const projectOptions = useMemo(() => projects.map((p) => ({ value: p._id, label: p.name })), [projects]);
  const pageOptions = useMemo(() => [...new Set(pages.map((p) => p.path).filter((p) => p && p !== "/"))], [pages]);

  if (!isAdmin) return null;
  if (loading) return <section className="card p-6 flex justify-center"><Spinner /></section>;
  if (!st) return null;

  // Rows are sent without an agent so the server keeps the current one; only a deliberate choice adds `agentRef`.
  const toRow = (r) => ({ _id: r.id, label: r.customLabel, matchKind: r.matchKind, matchValue: r.matchValue, projectId: r.projectId || undefined });
  const saveRoutes = (source, routes, ok) => call(`routes-${source}`, () => api.put(`${BASE}/routing`, { [source]: { routes } }), ok);
  const setDraftField = (source, patch) => setDraft((d) => ({ ...d, [source]: { ...d[source], ...patch } }));

  const addRoute = async (source) => {
    const d = draft[source];
    const kind = source === "website" ? "url_contains" : source === "facebook" ? "project" : (d.kind || "project");
    const row = { matchKind: kind, label: "" };
    if (kind === "url_contains") { row.matchValue = (d.url || "").trim(); if (d.projectId) row.projectId = d.projectId; }
    else if (kind === "project") { row.projectId = d.projectId; row.matchValue = d.projectId; }
    else row.matchValue = (d.adId || "").trim();
    if (!row.matchValue) return toast.error(kind === "url_contains" ? "Enter the page to match" : kind === "project" ? "Choose a project" : "Choose an ad");
    if (!d.agent) return toast.error("Choose which agent should call these leads");
    row.agentRef = d.agent;
    const r = await saveRoutes(source, [...st.routing[source].routes.map(toRow), row], "Saved");
    if (r) setDraft((x) => ({ ...x, [source]: {} }));
  };

  const removeRoute = (source, id) => saveRoutes(source, st.routing[source].routes.filter((r) => r.id !== id).map(toRow), "Removed");
  const changeAgent = (source, id, agentRef) =>
    saveRoutes(source, st.routing[source].routes.map((r) => (r.id === id ? { ...toRow(r), agentRef } : toRow(r))), agentRef ? "Agent changed" : "Saved - this rule will not call anyone");

  // Switching a source on only records the choice; nothing is sent until step 4 is confirmed.
  // If sending is already live, ask first.
  const toggleSource = (src, next) => {
    const save = () => call(`src-${src.key}`, () => api.put(`${BASE}/routing`, { [src.key]: next ? { enabled: true } : { enabled: false }, ...(next ? { confirm: true } : {}) }),
      next ? (st.enabled ? `${src.label} leads can now be called` : `${src.label} chosen. Nothing happens until you switch on in step 4.`) : `${src.label} leads will not be called`);
    if (next && st.enabled) {
      return setConfirm({ title: `Start calling new ${src.label} leads?`, label: "Yes, start calling", message: `New ${src.noun} leads that match a rule in step 3 will be phoned by that rule's agent within moments of arriving. Leads that match nothing are never called. Existing leads are never called.`, run: save });
    }
    return save();
  };

  const toggleMaster = () => {
    if (st.enabled) return call("master", () => api.post(`${BASE}/disable`), "Sending to Vistrow is off");
    setConfirm({
      title: "Switch on Vistrow for new leads?",
      label: "Yes, switch on",
      message: "From now on, every NEW lead created in ArthaLeads is added to Vistrow as a contact. Only the sources you chose, and only leads that match a rule with an agent, will be phoned. Leads that already exist are never sent or called.",
      run: () => call("master", () => api.post(`${BASE}/enable`, { confirm: true }), "Sending to Vistrow is on"),
    });
  };

  const saveConn = () => call("conn", () => api.put(`${BASE}/config`, { baseUrl: (conn.baseUrl || "").trim() || DEFAULT_ADDRESS, accountId: conn.accountId, authMode: conn.authMode, ...(conn.secret ? { secret: conn.secret } : {}) }),
    (r) => (r.data.disabledByChange ? "Saved. Sending was switched off because the connection changed - turn it on again when ready." : "Connection saved"));
  const saveAdv = () => call("adv", () => api.put(`${BASE}/config`, { ...adv, dedupeWindowHours: Number(adv.dedupeWindowHours), maxLeadAgeMinutes: Number(adv.maxLeadAgeMinutes) }), "Saved");

  const runTest = async (mode) => {
    const r = await call(`test-${mode}`, () => api.post(`${BASE}/test`, { mode, confirm: mode === "send" }));
    if (r) { setTestOut(r.data.result); if (mode === "send") loadDeliveries(); }
  };
  const runCheck = async () => {
    const r = await call("check", () => api.post(`${BASE}/simulate`, { source: check.source, pageUrl: check.pageUrl, projectId: check.projectId, adId: check.adId }));
    if (r) setCheck((c) => ({ ...c, result: r.data.decision }));
  };

  const h = st.health;
  const s = st.stats24h;
  const configured = st.configured;
  const anySourceOn = SOURCES.some((x) => st.routing[x.key].enabled);
  const adName = (v) => ads.find((a) => a.value === v)?.label || `ad ${v}`;
  const describe = (r) => (r.matchKind === "url_contains" ? `a page whose address contains “${r.matchValue}”${r.projectName ? ` (${r.projectName})` : ""}` : r.matchKind === "project" ? `project “${r.projectName || "unknown"}”` : adName(r.matchValue));
  const agentsReady = agentList.state === "ok";
  const stepHead = (n, title, done, sub) => (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={done ? { background: "rgba(34,197,94,0.15)", color: "#15803d" } : { background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}>{done ? <CheckCircle2 className="w-4 h-4" /> : n}</span>
      <div><p className="text-sm font-semibold text-app">{title}</p>{sub && <p className="text-xs text-app-soft mt-0.5">{sub}</p>}</div>
    </div>
  );

  return (
    <section className="card p-6 space-y-8" data-testid="vistrow-outbound">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-app-soft">Four quick steps. Nothing is called until you finish step 4, and only brand-new leads are ever included - never the leads you already have.</p>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" data-testid="master-state" style={st.enabled ? { background: "rgba(34,197,94,0.12)", color: "#15803d" } : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
          {st.enabled ? `Live since ${when(st.enabledAt)}` : "Not switched on"}
        </span>
      </div>

      {st.server.killSwitch && <Banner>Sending is paused by the server administrator. Nothing will be sent until they lift it.</Banner>}
      {h.lastError && h.lastFailureAt && (!h.lastSuccessAt || new Date(h.lastFailureAt) > new Date(h.lastSuccessAt)) && (
        <Banner>The last lead could not be passed to Vistrow ({h.lastError.code}) at {when(h.lastFailureAt)}. It is still saved here. Open "Technical details" below to see why.</Banner>
      )}
      {h.lastWarning && <Banner tone="amber">Vistrow received a lead but did not place the call. Check that the agent chosen in step 3 exists in Vistrow and has a phone number to call from.</Banner>}

      {/* 1 Connect */}
      <div className="space-y-3" data-testid="step-connect">
        {stepHead(1, "Connect ArthaLeads to Vistrow", configured, configured ? "Connected. You can change this any time." : "Paste two things from your Vistrow account.")}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:pl-10">
          <div><label className="label">Vistrow account number</label>
            <input className="input" value={conn.accountId} onChange={(e) => setConn({ ...conn, accountId: e.target.value })} /></div>
          <div><label className="label">Connection key</label>
            <input className="input" type="password" autoComplete="new-password" value={conn.secret} onChange={(e) => setConn({ ...conn, secret: e.target.value })}
              placeholder={st.config.hasSecret ? "Saved - type a new one only to replace it" : "Paste the key from Vistrow"} /></div>
        </div>
        <div className="md:pl-10 space-y-3">
          <div><button type="button" className="text-xs font-semibold underline text-app-soft hover:text-app" onClick={() => setShowHelp((v) => !v)}>{showHelp ? "Hide help" : "Where do I find these?"}</button></div>
          {showHelp && <p className="text-xs text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>In Vistrow Voice, open your account's lead-import (ArthaLeads) settings. It shows the account number and a connection key to copy. Ask your Vistrow contact if you cannot see it. Never share the key in chat or email.</p>}
          {configured && (
            <p className="text-xs flex items-center gap-1.5" data-testid="connection-check" style={{ color: agentList.state === "ok" ? "#15803d" : agentList.state === "error" ? "#b45309" : "var(--app-text-soft)" }}>
              {agentList.state === "loading" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your Vistrow agents…</>}
              {agentList.state === "ok" && <><CheckCircle2 className="w-3.5 h-3.5" /> Connected. Found {agentList.agents.length} agent{agentList.agents.length === 1 ? "" : "s"} you can use.</>}
              {agentList.state === "error" && <><AlertTriangle className="w-3.5 h-3.5" /> {agentList.problem?.message}</>}
            </p>
          )}
          <div><button type="button" className="btn-primary rounded-xl" disabled={busy === "conn" || !conn.accountId || (!conn.secret && !st.config.hasSecret)} onClick={saveConn}>{busy === "conn" ? <Loader2 className="w-4 h-4 animate-spin" /> : configured ? "Save changes" : "Connect"}</button></div>
        </div>
      </div>

      {/* 2 Sources */}
      <div className="space-y-3" data-testid="step-sources">
        {stepHead(2, "Which new leads should Vistrow call?", anySourceOn, "All off to begin with. Leads from a source you leave off are still added to Vistrow as contacts, but never called.")}
        <div className="md:pl-10 space-y-2">
          {SOURCES.map((src) => {
            const Icon = src.icon;
            const on = st.routing[src.key].enabled;
            return (
              <div key={src.key} className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--app-border)" }} data-testid={`toggle-${src.key}`}>
                <Icon className="w-4 h-4" style={{ color: "#7c3aed" }} />
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-app">{src.label} leads</p><p className="text-xs text-app-soft">{src.how}</p></div>
                <span className="text-xs font-medium" style={{ color: on ? "#15803d" : "var(--app-text-soft)" }}>{on ? "Call them" : "Don't call"}</span>
                <Switch on={on} disabled={busy === `src-${src.key}`} onChange={(v) => toggleSource(src, v)} label={`Call new ${src.label} leads`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Agents */}
      <div className="space-y-3" data-testid="step-agents">
        {stepHead(3, "Choose who calls", SOURCES.some((x) => st.routing[x.key].enabled && st.routing[x.key].routes.some((r) => !r.unassigned)), "Pick an agent for each website page, project or ad - the same idea as the Page rules on your Vistrow website widget. Use the agent whose knowledge covers that project.")}
        <div className="md:pl-10 space-y-4">
          {!anySourceOn && <p className="text-xs text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>Switch on at least one source in step 2 to choose its agents.</p>}
          {anySourceOn && agentList.state === "loading" && <p className="text-xs text-app-soft flex items-center gap-2" data-testid="agents-loading"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your Vistrow agents…</p>}
          {anySourceOn && agentList.state === "error" && (
            <div data-testid="agents-problem"><Banner tone="amber">{agentList.problem?.message}</Banner>
              <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app" onClick={loadAgents}><RefreshCw className="w-3.5 h-3.5" /> Try again</button></div>
          )}
          {anySourceOn && agentsReady && <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app" onClick={loadAgents}><RefreshCw className="w-3.5 h-3.5" /> Refresh agent list</button>}
          {SOURCES.filter((src) => st.routing[src.key].enabled).map((src) => {
            const cfg = st.routing[src.key];
            const d = draft[src.key];
            const kind = src.key === "whatsapp" ? (d.kind || "project") : src.key === "facebook" ? "project" : "url_contains";
            return (
              <div key={src.key} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--app-border)" }} data-testid={`source-${src.key}`}>
                <p className="text-sm font-semibold text-app">{src.label} leads</p>
                {cfg.routes.length === 0
                  ? <p className="text-xs text-app-soft">No agent chosen yet, so {src.label} leads will not be called.</p>
                  : cfg.routes.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2" data-testid="route-row">
                      <span className="text-sm text-app">{r.matchKind === "url_contains" ? "Page" : r.matchKind === "project" ? "Project" : "Ad"}:</span>
                      <span className="text-sm font-semibold text-app">{r.matchKind === "url_contains" ? r.matchValue : r.matchKind === "project" ? (r.projectName || "Unknown project") : adName(r.matchValue)}</span>
                      {r.projectName && r.matchKind !== "project" && <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>{r.projectName}</span>}
                      <span className="text-app-soft">&rarr;</span>
                      <div className="min-w-[240px]"><AgentPicker compact allowNone testId="row-agent" value={r.agentRef} agents={agentList.agents} fallbackLabel={r.agentLabel} placeholder="No agent - won't call" onChange={(v) => changeAgent(src.key, r.id, v)} /></div>
                      {r.unassigned && <span className="text-xs font-semibold" style={{ color: "#b45309" }}>Won't call</span>}
                      <span className="flex-1" />
                      <button type="button" className="text-app-soft hover:text-red-400" title="Remove" aria-label="Remove" disabled={busy === `routes-${src.key}`} onClick={() => removeRoute(src.key, r.id)}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
                  {src.key === "website" && (<>
                    <div className="md:col-span-4"><label className="label">When the form is on a page containing</label>
                      <input className="input" list="vo-pages" placeholder="/shapoorji-pallonji-khopoli/" value={d.url || ""} onChange={(e) => setDraftField(src.key, { url: e.target.value })} />
                      <datalist id="vo-pages">{pageOptions.map((p) => <option key={p} value={p} />)}</datalist></div>
                    <div className="md:col-span-3"><label className="label">Project (optional)</label>
                      <CustomSelect value={d.projectId || ""} onChange={(v) => setDraftField(src.key, { projectId: v })} options={[{ value: "", label: "None" }, ...projectOptions]} placeholder="None" style={FORM_SELECT} /></div>
                  </>)}
                  {src.key === "facebook" && (
                    <div className="md:col-span-7"><label className="label">When the lead is for project</label>
                      <CustomSelect value={d.projectId || ""} onChange={(v) => setDraftField(src.key, { projectId: v })} options={projectOptions} placeholder="Choose a project" style={FORM_SELECT} /></div>
                  )}
                  {src.key === "whatsapp" && (<>
                    <div className="md:col-span-3"><label className="label">When the chat is about</label>
                      <CustomSelect value={kind} onChange={(v) => setDraftField(src.key, { kind: v })} options={[{ value: "project", label: "A project" }, { value: "ad_id", label: "An ad" }]} style={FORM_SELECT} /></div>
                    <div className="md:col-span-4"><label className="label">{kind === "project" ? "Project" : "Ad"}</label>
                      {kind === "project"
                        ? <CustomSelect value={d.projectId || ""} onChange={(v) => setDraftField(src.key, { projectId: v })} options={projectOptions} placeholder="Choose a project" style={FORM_SELECT} />
                        : <CustomSelect value={d.adId || ""} onChange={(v) => setDraftField(src.key, { adId: v })} options={ads.map((a) => ({ value: a.value, label: a.label }))} placeholder="Choose an ad" style={FORM_SELECT} />}</div>
                  </>)}
                  <div className="md:col-span-5"><label className="label">Agent who calls</label>
                    <AgentPicker testId="add-agent" value={d.agent || ""} agents={agentList.agents} onChange={(v) => setDraftField(src.key, { agent: v })} placeholder={agentsReady ? "Choose an agent" : "Agents not loaded yet"} /></div>
                  <div className="md:col-span-2"><button type="button" className="btn-primary rounded-xl w-full" disabled={busy === `routes-${src.key}` || !agentsReady} onClick={() => addRoute(src.key)}>
                    {busy === `routes-${src.key}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add</>}</button></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Preview and switch on */}
      <div className="space-y-3" data-testid="step-preview">
        {stepHead(4, "Review and switch on", st.enabled, "This is exactly what will happen.")}
        <div className="md:pl-10 space-y-3">
          <ul className="text-sm text-app space-y-1.5 list-disc pl-5" data-testid="preview">
            <li>Every <strong>new</strong> lead from now on is added to Vistrow as a contact. Existing leads are never sent or called.</li>
            {SOURCES.map((src) => {
              const cfg = st.routing[src.key];
              if (!cfg.enabled) return <li key={src.key}>{src.label} leads: <strong>not called</strong>.</li>;
              const live = cfg.routes.filter((r) => !r.unassigned);
              if (!live.length) return <li key={src.key}>{src.label} leads: <strong>not called</strong> - no agent chosen yet.</li>;
              return (
                <li key={src.key}>{src.label} leads:
                  <ul className="list-[circle] pl-5 mt-1 space-y-1">
                    {live.map((r) => <li key={r.id}>for {describe(r)} &rarr; called by <strong>{r.agentLabel || "the chosen agent"}</strong>{r.agentKb ? ` (${r.agentKb})` : ""}</li>)}
                    <li className="text-app-soft">any other {src.label} lead &rarr; added as a contact, not called</li>
                  </ul>
                </li>
              );
            })}
            <li>Leads from anywhere else, or that arrive late or without a valid phone number, are never called.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {st.enabled
              ? <button type="button" className="btn-secondary rounded-xl" disabled={busy === "master"} onClick={toggleMaster}>{busy === "master" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Switch off"}</button>
              : <button type="button" className="btn-primary rounded-xl" disabled={busy === "master" || !configured} onClick={toggleMaster} title={!configured ? "Finish step 1 first" : ""}>{busy === "master" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Switch on…"}</button>}
            {!configured && <span className="text-xs text-app-soft">Finish step 1 first.</span>}
            {configured && !st.enabled && <span className="text-xs text-app-soft">You'll be asked to confirm.</span>}
          </div>
        </div>
      </div>

      {/* Technical details */}
      <div className="border-t pt-4" style={{ borderColor: "var(--app-border)" }}>
        <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-app" onClick={() => setShowAdv((v) => !v)} data-testid="adv-toggle">
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdv ? "rotate-180" : ""}`} /> Technical details (optional)
        </button>
        {showAdv && (
          <div className="mt-4 space-y-6" data-testid="adv-body">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-app">Connection details</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><label className="label">Vistrow web address</label>
                  <input className="input" placeholder={DEFAULT_ADDRESS} value={conn.baseUrl} onChange={(e) => setConn({ ...conn, baseUrl: e.target.value })} /></div>
                <div><label className="label">Send the key as</label>
                  <CustomSelect value={conn.authMode} onChange={(v) => setConn({ ...conn, authMode: v })} style={FORM_SELECT}
                    options={[{ value: "header", label: "X-Vistrow-Webhook-Token header" }, { value: "bearer", label: "Authorization: Bearer header" }]} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-secondary rounded-xl" disabled={busy === "conn" || !conn.accountId} onClick={saveConn}>Save connection details</button>
                <button type="button" className="btn-secondary rounded-xl" disabled={!configured || busy === "test-dry_run"} onClick={() => runTest("dry_run")}>Check settings (sends nothing)</button>
                {st.server.testSendAllowed && <button type="button" className="btn-secondary rounded-xl" disabled={!configured || busy === "test-send"} onClick={() => runTest("send")}>Send a test event</button>}
              </div>
              <p className="text-xs text-app-soft">The key travels in a header, never in the web address. Changing the account, address or key switches sending off until you confirm again.</p>
              {testOut && (
                <div className="rounded-2xl p-4 text-sm space-y-2" style={{ background: "var(--app-surface-low)" }}>
                  <p className="font-semibold text-app flex items-center gap-2">
                    {testOut.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {testOut.sent ? (testOut.ok ? `Vistrow accepted the test event (${testOut.latencyMs} ms)` : `Vistrow did not accept it: ${testOut.code}${testOut.message ? ` - ${testOut.message}` : ""}`) : testOut.ok ? "Settings look valid. Nothing was sent." : "Not ready yet"}
                  </p>
                  {(testOut.problems || []).map((p) => <p key={p} className="text-app-soft">- {p}</p>)}
                  {testOut.request && <details><summary className="cursor-pointer text-app-soft">Show the request that would be sent (key hidden)</summary>
                    <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify({ POST: testOut.request.url, headers: testOut.request.headers, body: testOut.request.body }, null, 2)}</pre></details>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div><p className="text-sm font-semibold text-app">Check a lead</p>
                <p className="text-xs text-app-soft mt-0.5">See which agent a lead like this would get. Nothing is sent and no lead is touched.</p></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end">
                <div className="md:col-span-3"><label className="label">Source</label>
                  <CustomSelect value={check.source} onChange={(v) => setCheck({ ...check, source: v, result: null })} style={FORM_SELECT}
                    options={[{ value: "website", label: "Website" }, { value: "facebook", label: "Facebook" }, { value: "whatsapp", label: "WhatsApp" }, { value: "other", label: "Anything else" }]} /></div>
                {check.source === "website" && <div className="md:col-span-6"><label className="label">Page the form was on</label><input className="input" placeholder="https://yoursite.com/shapoorji-pallonji-khopoli/" value={check.pageUrl} onChange={(e) => setCheck({ ...check, pageUrl: e.target.value, result: null })} /></div>}
                {(check.source === "facebook" || check.source === "whatsapp") && <div className="md:col-span-3"><label className="label">Project</label><CustomSelect value={check.projectId} onChange={(v) => setCheck({ ...check, projectId: v, result: null })} options={[{ value: "", label: "No project" }, ...projectOptions]} style={FORM_SELECT} /></div>}
                {check.source === "whatsapp" && <div className="md:col-span-3"><label className="label">Ad ID</label><input className="input font-mono text-sm" value={check.adId} onChange={(e) => setCheck({ ...check, adId: e.target.value, result: null })} /></div>}
                <div className="md:col-span-2"><button type="button" className="btn-secondary rounded-xl w-full" disabled={busy === "check" || !configured} onClick={runCheck}>Check</button></div>
              </div>
              {check.result && (
                <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }} data-testid="check-result">
                  {check.result.autoCall
                    ? <><CheckCircle2 className="inline w-4 h-4 text-emerald-500 mr-1.5" />Would be called by <strong>{check.result.agentLabel || "the chosen agent"}</strong> via “{check.result.route.label}”.</>
                    : <>Added as a contact only - <strong>{WHY[check.result.reason] || check.result.reason}</strong>{check.result.route ? ` (“${check.result.route.label}”)` : ""}. No call.</>}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-app">Safety settings</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><label className="label">Don't call the same number twice within (hours)</label><input className="input" type="number" min="0" max="720" value={adv.dedupeWindowHours} onChange={(e) => setAdv({ ...adv, dedupeWindowHours: e.target.value })} /></div>
                <div><label className="label">Ignore enquiries older than (minutes)</label><input className="input" type="number" min="1" max="180" value={adv.maxLeadAgeMinutes} onChange={(e) => setAdv({ ...adv, maxLeadAgeMinutes: e.target.value })} /></div>
                <div><label className="label">Country code for numbers without one</label><input className="input" value={adv.defaultCountryCode} onChange={(e) => setAdv({ ...adv, defaultCountryCode: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-app"><input type="checkbox" checked={adv.emitImports} onChange={(e) => setAdv({ ...adv, emitImports: e.target.checked })} /> Also add small spreadsheet imports (25 rows or fewer) to Vistrow as contacts. Imported leads are never called.</label>
              <button type="button" className="btn-secondary rounded-xl" disabled={busy === "adv"} onClick={saveAdv}>Save safety settings</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-app">Last 24 hours</p>
                <button type="button" className="text-xs font-semibold text-app-soft hover:text-app" onClick={loadDeliveries}>Refresh</button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  ["Delivered", s.counts.delivered || 0], ["Calls requested", s.callsRequested], ["Declined by Vistrow", s.callsDeclinedByVistrow],
                  ["Failed", (s.counts.failed || 0) + (s.counts.dead || 0)], ["Reached Vistrow in 30s", s.within30sPct == null ? "-" : `${s.within30sPct}%`],
                ].map(([k, v]) => <div key={k} className="rounded-xl p-3" style={{ background: "var(--app-surface-low)" }}><p className="text-xs text-app-soft">{k}</p><p className="text-lg font-bold text-app">{v}</p></div>)}
              </div>
              {deliveries.length === 0 ? <p className="text-sm text-app-soft">Nothing has been sent yet.</p> : (
                <div className="space-y-2">
                  {deliveries.map((d) => {
                    const tone = STATUS_TONE[d.status] || STATUS_TONE.skipped;
                    return (
                      <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--app-border)" }}>
                        <span className="text-app-soft w-36 shrink-0">{when(d.createdAt)}</span>
                        <span className="font-mono text-app w-28 shrink-0">{d.phone || "-"}</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full" style={{ background: tone.bg, color: tone.fg }}>{d.isTest ? "Test - " : ""}{tone.label}</span>
                        <span className="text-app">
                          {d.status === "skipped" || d.status === "cancelled" ? (SKIP[d.skipReason] || d.skipReason)
                            : d.autoCall ? <>Call &rarr; <strong>{d.agentLabel || "the chosen agent"}</strong>{d.routeLabel ? <span className="text-app-soft"> via {d.routeLabel}</span> : null}</>
                            : <span className="text-app-soft">Contact only - {WHY[d.autoCallReason] || d.autoCallReason || "-"}</span>}
                        </span>
                        {d.callQueued === false && d.autoCall && <span style={{ color: "#b45309" }}>Vistrow did not queue the call{d.callReason ? ` (${d.callReason})` : ""}</span>}
                        {d.lastErrorCode && d.status !== "delivered" && <span style={{ color: "#dc2626" }}>{d.lastErrorCode}{d.lastErrorMessage ? `: ${d.lastErrorMessage}` : ""}</span>}
                        <span className="flex-1" />
                        <span className="text-app-soft">{d.status === "delivered" ? `reached Vistrow in ${secs(d.endToEndMs)}` : d.attempts ? `${d.attempts} attempt${d.attempts > 1 ? "s" : ""}` : ""}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.label} confirmTone="primary"
        onConfirm={() => { const run = confirm?.run; setConfirm(null); run?.(); }} />
    </section>
  );
}
