import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Plus, Search, Sparkles, Trash2, Pencil, Pause, Play, Star, ShieldCheck,
  WifiOff, Building2, Megaphone, Languages, Clock, CheckCircle2, Power,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

/**
 * Every WhatsApp assistant in the org.
 *
 * Replaces the single "Agent Studio" settings form, which had one assistant
 * per tenant and no way to add, name, pause or delete one.
 */

const STATUS = {
  active: { label: "Active",  fg: "#15803d", bg: "rgba(34,197,94,0.13)" },
  paused: { label: "Paused",  fg: "#b45309", bg: "rgba(251,191,36,0.16)" },
  draft:  { label: "Draft",   fg: "var(--app-text-soft)", bg: "var(--app-surface-low)" },
};

const FILTERS = [
  ["all",        "All"],
  ["active",     "Active"],
  ["incomplete", "Setup incomplete"],
  ["paused",     "Paused"],
  ["draft",      "Draft"],
];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    hour12: true, timeZone: "Asia/Kolkata",
  });
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 text-app-soft shrink-0">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="font-semibold text-app truncate text-right">{value}</span>
    </div>
  );
}

function AgentCard({ agent, onDelete, onStatus, onDefault, busy }) {
  const s = STATUS[agent.status] || STATUS.draft;
  const { score, total } = agent.readiness || { score: 0, total: 6 };
  const ready = score === total;
  const projectLabel = agent.projectIds?.length
    ? (agent.projectIds.length === 1
        ? (agent.projectIds[0]?.name || "1 project")
        : `${agent.projectIds.length} projects`)
    : `All ${agent.activeProjects ?? 0}`;

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-app truncate">{agent.name}</p>
              {agent.isDefault && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                  <Star className="w-2.5 h-2.5" /> DEFAULT
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
              style={{ background: s.bg, color: s.fg }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
              {s.label}
            </span>
          </div>
        </div>
        <button onClick={() => onDelete(agent)} disabled={busy} title="Delete this assistant"
          className="shrink-0 p-1.5 rounded-lg text-app-soft hover:text-red-500 transition disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-app-soft" style={{ minHeight: "2.4em" }}>
        {agent.description || <span className="italic opacity-60">No description yet.</span>}
      </p>

      <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
        <MetaRow icon={Building2} label="Knows" value={agent.usingCustomPrompt || agent.systemPrompt ? "Custom prompt" : projectLabel} />
        <MetaRow icon={Languages} label="Language" value={agent.language === "auto" || !agent.language ? "Matches customer" : agent.language} />
        <MetaRow icon={Megaphone} label="Ads routed" value={agent.adIds?.length || "—"} />
        <MetaRow icon={Clock} label="Updated" value={fmtDate(agent.updatedAt)} />
      </div>

      <div className="rounded-xl px-3 py-2.5"
        style={ready
          ? { background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.25)" }
          : { background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.3)" }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold" style={{ color: ready ? "#15803d" : "#b45309" }}>
            Setup {ready ? "complete" : "incomplete"}
          </span>
          <span className="text-xs font-bold tabular-nums" style={{ color: ready ? "#15803d" : "#b45309" }}>
            {score}/{total}
          </span>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: ready ? "#15803d" : "#b45309" }}>
          {ready
            ? "Ready to handle conversations."
            : (agent.readiness?.checks || []).filter((c) => !c.ok).map((c) => c.label).join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <Link to={`/conversations/agent/${agent._id}`}
          className="btn-primary rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 flex-1 justify-center">
          <Sparkles className="w-3.5 h-3.5" /> Open &amp; test
        </Link>
        <Link to={`/conversations/agent/${agent._id}`} title="Edit"
          className="btn-secondary rounded-full w-9 h-9 flex items-center justify-center shrink-0 !px-0 !py-0">
          <Pencil className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={() => onStatus(agent, agent.status === "active" ? "paused" : "active")}
          disabled={busy}
          title={agent.status === "active" ? "Pause this assistant" : "Make this assistant live"}
          className="btn-secondary rounded-full w-9 h-9 flex items-center justify-center shrink-0 !px-0 !py-0 disabled:opacity-40">
          {agent.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        {!agent.isDefault && agent.status === "active" && (
          <button onClick={() => onDefault(agent)} disabled={busy} title="Make this the default assistant"
            className="btn-secondary rounded-full w-9 h-9 flex items-center justify-center shrink-0 !px-0 !py-0 disabled:opacity-40">
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { isAdmin, connected } = useOutletContext();
  const [agents, setAgents]   = useState(null);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [busy, setBusy]       = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);

  const load = useCallback(() => {
    Promise.all([api.get("/whatsapp/agents"), api.get("/whatsapp/settings").catch(() => null)])
      .then(([a, s]) => {
        setAgents(a.data.agents || []);
        if (s) setBotEnabled(s.data.whatsapp?.botEnabled ?? true);
      })
      .catch(() => { setAgents([]); toast.error("Could not load your assistants"); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const l = agents || [];
    const incomplete = l.filter((a) => (a.readiness?.score ?? 0) < (a.readiness?.total ?? 6)).length;
    return {
      all: l.length,
      active: l.filter((a) => a.status === "active").length,
      paused: l.filter((a) => a.status === "paused").length,
      draft: l.filter((a) => a.status === "draft").length,
      incomplete,
    };
  }, [agents]);

  const shown = useMemo(() => {
    let l = agents || [];
    if (filter === "incomplete") l = l.filter((a) => (a.readiness?.score ?? 0) < (a.readiness?.total ?? 6));
    else if (filter !== "all") l = l.filter((a) => a.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      l = l.filter((a) =>
        a.name.toLowerCase().includes(q)
        || (a.description || "").toLowerCase().includes(q)
        || (a.projectIds || []).some((p) => (p?.name || "").toLowerCase().includes(q)));
    }
    return l;
  }, [agents, filter, search]);

  const setStatus = async (agent, status) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/whatsapp/agents/${agent._id}`, { status });
      setAgents((l) => l.map((a) => (a._id === agent._id ? { ...a, ...data.agent } : a)));
      toast.success(status === "active" ? `${agent.name} is live` : `${agent.name} is paused`);
    } catch (e) { toast.error(e.response?.data?.message || "Could not change that"); }
    finally { setBusy(false); }
  };

  const makeDefault = async (agent) => {
    setBusy(true);
    try {
      await api.post(`/whatsapp/agents/${agent._id}/default`);
      load();
      toast.success(`${agent.name} now answers anything not routed elsewhere`);
    } catch (e) { toast.error(e.response?.data?.message || "Could not change that"); }
    finally { setBusy(false); }
  };

  const remove = async (agent) => {
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/whatsapp/agents/${agent._id}`);
      load();
      toast.success(`${agent.name} deleted`);
    } catch (e) { toast.error(e.response?.data?.message || "Could not delete that"); }
    finally { setBusy(false); }
  };

  const toggleOrgBot = async () => {
    const next = !botEnabled;
    setBotEnabled(next);
    try {
      await api.patch("/whatsapp/settings", { botEnabled: next });
      toast.success(next ? "Assistants are answering again" : "All assistants paused");
    } catch { setBotEnabled(!next); toast.error("Could not change that"); }
  };

  if (!isAdmin) {
    return (
      <div className="stitch-page !pt-2">
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <ShieldCheck className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm font-bold text-app">Only admins can change the AI assistants</p>
          <p className="text-xs text-app-soft mt-1">Ask an admin in your organisation if something here needs to change.</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="stitch-page !pt-2">
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <WifiOff className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm font-bold text-app">Connect WhatsApp first</p>
          <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
            Your assistants reply over your WhatsApp number, so it needs one connected before there's
            anything for them to do.
          </p>
          <Link to="/conversations/settings"
            className="btn-primary inline-flex rounded-full px-4 py-2 text-sm font-semibold mt-4">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stitch-page !pt-2">
      <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">AI Agents</h1>
          <p className="text-xs text-app-soft">
            {agents === null ? "Loading…" : `${counts.all} assistant${counts.all === 1 ? "" : "s"}`}
            {counts.all > 0 && ` · ${counts.active} live`}
          </p>
        </div>
        <Link to="/conversations/agent/new"
          className="btn-primary rounded-full px-4 py-2 text-sm font-bold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New agent
        </Link>
      </div>

      {/* The org-wide kill switch. Each assistant has its own live/paused
          state; this stops all of them at once without editing any of them. */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={botEnabled ? { background: "rgba(34,197,94,0.12)" }
                                : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <Power className="w-4 h-4" style={{ color: botEnabled ? "#15803d" : "var(--app-text-soft)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-app">
                {botEnabled ? "Auto-replies are on" : "Auto-replies are off everywhere"}
              </p>
              <p className="text-xs text-app-soft">
                {botEnabled
                  ? "Your live assistants answer new messages automatically."
                  : "Nothing is auto-answered, whatever each assistant's own status says."}
              </p>
            </div>
          </div>
          <button type="button" onClick={toggleOrgBot} role="switch" aria-checked={botEnabled}
            className="relative shrink-0 rounded-full transition"
            style={{ width: 46, height: 26, background: botEnabled ? "#22c55e" : "var(--app-border-strong)" }}>
            <span className="absolute top-0.5 rounded-full bg-white transition-all"
              style={{ width: 22, height: 22, left: botEnabled ? 22 : 2 }} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-app-soft pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assistants, description or project"
            className="input w-full" style={{ paddingLeft: 36 }} />
        </div>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition"
              style={filter === key
                ? { background: "var(--app-primary)", color: "#fff" }
                : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
              {label}
              <span className="tabular-nums opacity-70">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {agents === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5 h-72 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
          ))}
        </div>
      ) : counts.all === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
            <Sparkles className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
          </div>
          <p className="text-sm font-bold text-app">No assistants yet</p>
          <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
            An assistant answers WhatsApp messages from your real project data. Build one per campaign,
            per language or per project — whatever matches how you sell.
          </p>
          <Link to="/conversations/agent/new"
            className="btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold mt-4 items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create your first agent
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-app-soft">
            No assistants match {search ? `"${search}"` : "that filter"}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <AgentCard key={a._id} agent={a} busy={busy}
              onDelete={remove} onStatus={setStatus} onDefault={makeDefault} />
          ))}
        </div>
      )}

      {counts.all > 0 && counts.active === 0 && (
        <div className="mt-5 rounded-2xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
          <p className="text-xs" style={{ color: "#b45309" }}>
            None of your assistants are live, so nothing is auto-answering. Press play on the one you
            want handling messages.
          </p>
        </div>
      )}
    </div>
  );
}
