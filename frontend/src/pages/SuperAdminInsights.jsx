import { useState, useEffect } from "react";
import { PageLoader } from "../components/UI";
import api from "../services/api";
import {
  Heart, AlertTriangle, TrendingDown, RefreshCw,
  MessageCircle, Phone, Zap, FolderOpen, BookOpen,
  Bot, BarChart3, Users, CheckCircle2, XCircle,
  Flame, Clock,
} from "lucide-react";

// ── Feature dot ───────────────────────────────────────────────────────────────
function Dot({ on, label }) {
  return (
    <span title={label}
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${on ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
  );
}

// ── Health bar ────────────────────────────────────────────────────────────────
function HealthBar({ score }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Healthy" : score >= 40 ? "At Risk" : "Churn Risk";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────
const PLAN_COLORS = {
  trial:      { bg: "rgba(234,179,8,0.12)",   color: "#ca8a04" },
  starter:    { bg: "rgba(59,130,246,0.12)",   color: "#3b82f6" },
  growth:     { bg: "rgba(139,92,246,0.12)",   color: "#8b5cf6" },
  pro:        { bg: "rgba(139,92,246,0.12)",   color: "#8b5cf6" },
  enterprise: { bg: "rgba(249,115,22,0.12)",   color: "#f97316" },
};
function PlanBadge({ plan }) {
  const p = PLAN_COLORS[plan] || { bg: "rgba(128,128,128,0.1)", color: "#6b7280" };
  return (
    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
      style={{ background: p.bg, color: p.color }}>
      {plan === "pro" ? "growth" : plan}
    </span>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <p className="text-xs text-app-soft mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-app-soft/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const FEATURES = [
  { key: "leads",       label: "Leads",       icon: BarChart3 },
  { key: "aiBot",       label: "Artha AI",    icon: Bot },
  { key: "whatsapp",    label: "WhatsApp",    icon: MessageCircle },
  { key: "telephony",   label: "Calls",       icon: Phone },
  { key: "automations", label: "Automations", icon: Zap },
  { key: "projects",    label: "Projects",    icon: FolderOpen },
  { key: "bookings",    label: "Bookings",    icon: BookOpen },
];

export default function SuperAdminInsights() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all"); // all | healthy | at-risk | churn
  const [search, setSearch]   = useState("");

  const load = () => {
    setLoading(true);
    api.get("/super-admin/insights")
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    document.title = "Insights · Arthaleads Admin";
    load();
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { orgs, summary } = data;

  const filtered = orgs.filter(o => {
    const matchFilter =
      filter === "all"     ? true :
      filter === "healthy" ? o.healthScore >= 70 :
      filter === "at-risk" ? (o.healthScore >= 40 && o.healthScore < 70) :
                             o.healthScore < 40;
    const matchSearch = !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const churnOrgs = orgs.filter(o => o.healthScore < 40 && o.isActive);
  const topChurnSignals = churnOrgs.flatMap(o =>
    o.churnSignals.map(s => ({ org: o.name, signal: s, score: o.healthScore }))
  ).slice(0, 12);

  // Feature adoption rates
  const featureRates = FEATURES.map(f => ({
    ...f,
    count: orgs.filter(o => o.features[f.key]).length,
    pct: orgs.length ? Math.round((orgs.filter(o => o.features[f.key]).length / orgs.length) * 100) : 0,
  }));

  return (
    <div className="stitch-page space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-app">Customer Insights</h1>
          <p className="text-xs text-app-soft mt-0.5">Health scores, feature adoption, and churn signals across all organisations</p>
        </div>
        <button onClick={load} className="btn-secondary gap-1.5 text-xs px-3 py-2 flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Orgs"   value={summary.totalOrgs}     icon={Users}        color="text-app"          bg="bg-orange-500/10" />
        <SummaryCard label="Healthy"      value={summary.healthyOrgs}   icon={Heart}        color="text-green-500"    bg="bg-green-500/10"  sub="Score ≥ 70" />
        <SummaryCard label="At Risk"      value={summary.atRiskOrgs}    icon={AlertTriangle} color="text-amber-500"   bg="bg-amber-500/10"  sub="Score 40–69" />
        <SummaryCard label="Churn Risk"   value={summary.churnRiskOrgs} icon={TrendingDown}  color="text-red-500"     bg="bg-red-500/10"    sub="Score < 40" />
      </div>

      {/* Two-col: Feature adoption + Churn feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Feature adoption */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--app-border)" }}>
            <Zap className="w-4 h-4 text-orange-500" />
            <h2 className="font-bold text-app text-sm flex-1">Feature Adoption</h2>
            <span className="text-[10px] text-app-soft">{orgs.length} orgs</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {featureRates.map(f => (
              <div key={f.key} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--app-surface-low)" }}>
                  <f.icon className="w-3.5 h-3.5 text-app-soft" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-app">{f.label}</span>
                    <span className="text-[10px] font-bold text-app-soft">{f.count}/{orgs.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${f.pct}%`,
                        background: f.pct >= 60 ? "#22c55e" : f.pct >= 30 ? "#f59e0b" : "#ef4444",
                      }} />
                  </div>
                </div>
                <span className="text-xs font-black w-8 text-right"
                  style={{ color: f.pct >= 60 ? "#22c55e" : f.pct >= 30 ? "#f59e0b" : "#ef4444" }}>
                  {f.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Churn signal feed */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--app-border)" }}>
            <Flame className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-app text-sm flex-1">Churn Signal Feed</h2>
            {churnOrgs.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                {churnOrgs.length} org{churnOrgs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {topChurnSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500/30 mb-3" />
              <p className="text-sm font-semibold text-app-soft">No churn signals</p>
              <p className="text-xs text-app-soft/60 mt-1">All active orgs look healthy</p>
            </div>
          ) : (
            <div className="divide-y overflow-y-auto" style={{ borderColor: "var(--app-border)", maxHeight: 340 }}>
              {topChurnSignals.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-app truncate">{s.org}</p>
                    <p className="text-[10px] text-red-500 font-medium">{s.signal}</p>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">
                    {s.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Org health table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap" style={{ borderColor: "var(--app-border)" }}>
          <h2 className="font-bold text-app text-sm">Org Health Scores</h2>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: "all",     label: "All",        count: summary.totalOrgs },
              { id: "healthy", label: "Healthy",    count: summary.healthyOrgs },
              { id: "at-risk", label: "At Risk",    count: summary.atRiskOrgs },
              { id: "churn",   label: "Churn Risk", count: summary.churnRiskOrgs },
            ].map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                  filter === tab.id
                    ? "text-white border-transparent"
                    : "text-app-soft border-transparent hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={filter === tab.id ? { background: "var(--app-primary)" } : {}}>
                {tab.label}
                <span className={`inline-flex items-center justify-center rounded-full min-w-[16px] h-4 px-1 text-[9px] font-black ${
                  filter === tab.id ? "bg-white/20 text-white" : "bg-black/8 dark:bg-white/10 text-app-soft"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          <input
            className="ml-auto input text-xs px-3 py-1.5 w-44"
            placeholder="Search org…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="stitch-table min-w-[900px]">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Plan</th>
                <th>Health</th>
                <th>Last Login</th>
                <th>Leads / Week</th>
                <th className="text-center" colSpan={FEATURES.length}>
                  <div className="flex items-center justify-start gap-3 px-1">
                    {FEATURES.map(f => (
                      <span key={f.key} title={f.label} className="text-[9px] font-bold text-app-soft uppercase tracking-wide w-2.5 text-center">
                        <f.icon className="w-3 h-3" />
                      </span>
                    ))}
                  </div>
                </th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-app-soft text-sm">No organisations match</td></tr>
              ) : filtered.map(org => {
                const daysSince = org.stats.daysSinceLogin;
                const loginColor = daysSince === null ? "text-red-400" : daysSince <= 1 ? "text-green-500" : daysSince <= 7 ? "text-amber-500" : "text-red-400";
                return (
                  <tr key={org._id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        {org.logo ? (
                          <img src={org.logo} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                            onError={e => e.currentTarget.style.display = "none"} />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#a04100,#ff6b00)" }}>
                            {org.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-app truncate">{org.name}</p>
                          <p className="text-[10px] text-app-soft">{org.stats.userCount} user{org.stats.userCount !== 1 ? "s" : ""} · {org.stats.totalLeads} leads</p>
                        </div>
                      </div>
                    </td>
                    <td><PlanBadge plan={org.plan} /></td>
                    <td><HealthBar score={org.healthScore} /></td>
                    <td>
                      <span className={`text-xs font-semibold ${loginColor}`}>
                        {daysSince === null ? "Never" : daysSince === 0 ? "Today" : `${daysSince}d ago`}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-bold ${org.stats.leadsThisWeek > 0 ? "text-green-500" : "text-app-soft"}`}>
                        +{org.stats.leadsThisWeek}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {FEATURES.map(f => (
                          <Dot key={f.key} on={org.features[f.key]} label={f.label} />
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {org.churnSignals.length === 0 ? (
                          <span className="text-[10px] text-green-500 font-semibold">All good</span>
                        ) : org.churnSignals.map((s, i) => (
                          <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 whitespace-nowrap">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
