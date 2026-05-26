// Dashboard - v2
import { useEffect, useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Clock3,
  Globe,
  MessageCircle,
  MoonStar,
  Phone,
  Search,
  SunMedium,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { StatCard, PageLoader } from "../components/UI";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDate } from "../utils/constants";
import DateRangePicker from "../components/DateRangePicker";

const STATUS_CHART_COLORS = ["#6366f1", "#f59e0b", "#8b5cf6", "#f97316", "#22c55e", "#ef4444"];
const SOURCE_CHART_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6b7280"];
// Config for each platform — drives both header pills and source cards
const PLATFORM_CONFIG = {
  "Facebook":     { label: "Facebook Leads",  note: "Meta Lead Ads",        shortLabel: "FB",    sourceKey: "Facebook",  icon: TrendingUp,   tone: "from-blue-500/20 via-blue-500/10 to-transparent",   iconTone: "bg-blue-500/15 text-blue-400",   dot: "bg-blue-500",   pillTone: "bg-blue-500/10 text-blue-400 border-blue-500/20",   presetSource: "Facebook"  },
  "Google":       { label: "Google Leads",    note: "Ads and landing forms", shortLabel: "GGL",   sourceKey: "Google",    icon: Users,        tone: "from-red-500/20 via-red-500/10 to-transparent",     iconTone: "bg-red-500/15 text-red-400",     dot: "bg-red-500",    pillTone: "bg-red-500/10 text-red-400 border-red-500/20",     presetSource: "Google"    },
  "WhatsApp":     { label: "WhatsApp Leads",  note: "Chats and inquiries",   shortLabel: "WA",    sourceKey: "WhatsApp",  icon: MessageCircle, tone: "from-green-500/20 via-green-500/10 to-transparent",  iconTone: "bg-green-500/15 text-green-400", dot: "bg-green-500",  pillTone: "bg-green-500/10 text-green-400 border-green-500/20", presetSource: "WhatsApp"  },
  "Website Form": { label: "Website Leads",   note: "Landing page forms",    shortLabel: "WEB",   sourceKey: "Website",   icon: Globe,        tone: "from-violet-500/20 via-violet-500/10 to-transparent", iconTone: "bg-violet-500/15 text-violet-400", dot: "bg-violet-500", pillTone: "bg-violet-500/10 text-violet-400 border-violet-500/20", presetSource: "Website" },
  "Custom":       { label: "Custom Leads",    note: "Other integrations",    shortLabel: "OTHER", sourceKey: "Other",     icon: Zap,          tone: "from-amber-500/20 via-amber-500/10 to-transparent",  iconTone: "bg-amber-500/15 text-amber-400", dot: "bg-amber-500",  pillTone: "bg-amber-500/10 text-amber-400 border-amber-500/20", presetSource: "Other"    },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export default function Dashboard() {
  useEffect(() => { document.title = "Dashboard - Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [greeting, setGreeting] = useState(getGreeting());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setGreeting(getGreeting()), 30 * 60 * 1000); // 30 min - greeting only changes AM/PM
    return () => clearInterval(timer);
  }, []);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("last30days");
  const [connectedPlatforms, setConnectedPlatforms] = useState(null); // null = loading

  useEffect(() => {
    setLoading(true);
    api.get("/leads/analytics", { params: { dateRange } })
      .then((response) => setData(response.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateRange]);

  // Fetch connected automations to drive dynamic source cards
  useEffect(() => {
    api.get("/automations")
      .then((res) => {
        const list = res.data.automations || [];
        const active = list.filter((a) => a.status === "connected" && a.isActive !== false);
        // Deduplicate by platform (multiple Facebook automations = one card)
        const seen = new Set();
        const unique = [];
        for (const a of active) {
          if (!seen.has(a.platform)) { seen.add(a.platform); unique.push(a.platform); }
        }
        setConnectedPlatforms(unique);
      })
      .catch(() => setConnectedPlatforms([])); // agents/errors → fall back to bySource
  }, []);

  if (loading) return <PageLoader />;

  const statusChartData = Object.entries(data?.byStatus || {}).map(([name, value]) => ({ name, value }));
  const sourceChartData = Object.entries(data?.bySource || {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // Which platforms to show: connected automations first; fallback to platforms with lead data
  const activePlatforms = (connectedPlatforms && connectedPlatforms.length > 0)
    ? connectedPlatforms
    : Object.keys(PLATFORM_CONFIG).filter(
        (p) => (data?.bySource?.[PLATFORM_CONFIG[p].sourceKey] || 0) > 0
      );

  return (
    <div className="stitch-page space-y-6">
      <header className="stitch-topbar">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" />
              <input
                className="input rounded-full pl-11 pr-4"
                placeholder="Search leads by name, phone or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    navigate("/leads", { state: { presetSearch: searchQuery.trim() } });
                  }
                }}
              />
            </div>
            <div className="hidden h-4 w-px lg:block" style={{ background: "var(--app-border)" }} />
            <div className="flex flex-wrap items-center gap-2">
              {activePlatforms.map((platform) => {
                const cfg = PLATFORM_CONFIG[platform];
                if (!cfg) return null;
                const count = data?.bySource?.[cfg.sourceKey] || 0;
                return (
                  <div key={platform} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${cfg.pillTone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.shortLabel}: {count}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="stitch-kicker mb-1 sm:mb-2">Overview</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-app">{greeting}, {user?.name?.split(" ")[0]}</h1>
            <p className="mt-1 max-w-2xl text-sm text-app-soft hidden sm:block">
              Track source performance, team momentum, and recent lead movement across all your active channels in real time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="stitch-pill" onClick={toggleTheme}>
            {isDark ? <MoonStar className="h-4 w-4 text-orange-500" /> : <SunMedium className="h-4 w-4 text-orange-500" />}
            {theme === "dark" ? "Dark" : "Light"}
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </header>

      <FollowUpDuePanel user={user} navigate={navigate} />

      {activePlatforms.length > 0 && (
        <div
          className="grid gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(activePlatforms.length, 4)}, minmax(0, 1fr))` }}
        >
          {activePlatforms.map((platform) => {
            const cfg = PLATFORM_CONFIG[platform];
            if (!cfg) return null;
            return (
              <TopLeadSourceCard
                key={platform}
                label={cfg.label}
                value={data?.bySource?.[cfg.sourceKey] || 0}
                icon={cfg.icon}
                note={cfg.note}
                tone={cfg.tone}
                iconTone={cfg.iconTone}
                onClick={() => navigate("/leads", { state: { presetSource: cfg.presetSource } })}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Leads" value={data?.totalLeads || 0} icon={Users} color="text-orange-500"
          onClick={() => navigate("/leads")} />
        <StatCard label="New" value={data?.byStatus?.New || 0} icon={TrendingUp} color="text-indigo-400" sub="Uncontacted"
          onClick={() => navigate("/leads", { state: { presetStatus: "New" } })} />
        <StatCard label="Closed Won" value={data?.byStatus?.["Closed Won"] || 0} icon={CheckCircle} color="text-emerald-400" sub="Converted"
          onClick={() => navigate("/leads", { state: { presetStatus: "Closed Won" } })} />
        <StatCard label="Follow-ups Today" value={data?.todayFollowUps || 0} icon={Clock3} color="text-amber-400" sub={`${data?.totalFollowUps || 0} total scheduled`}
          onClick={() => navigate("/leads", { state: { presetFollowUpToday: true } })} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="card p-4 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="stitch-kicker mb-1">Performance</p>
              <h3 className="text-base font-bold text-app">Leads by Status</h3>
            </div>
            <div className="stitch-pill text-xs">Live pipeline</div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(80, statusChartData.length * 44)}>
            <BarChart
              data={statusChartData}
              layout="vertical"
              barCategoryGap="18%"
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--app-text-soft)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--app-text-soft)" }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--app-border)",
                  background: "var(--app-bg)",
                  color: "var(--app-text)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  fontSize: 12,
                }}
                itemStyle={{ color: "var(--app-text)" }}
                labelStyle={{ color: "var(--app-text)", fontWeight: 600 }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {statusChartData.map((_, index) => (
                  <Cell key={index} fill={STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card p-4 xl:col-span-5">
          <div className="mb-3">
            <p className="stitch-kicker mb-1">Acquisition Mix</p>
            <h3 className="text-base font-bold text-app">Leads by Source</h3>
          </div>
          {sourceChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-app-soft">No data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* scaleY squish = reliable cross-browser 3D coin illusion */}
              <div className="relative" style={{ paddingBottom: 10 }}>
                <div style={{
                  transform: "scaleY(0.65)",
                  transformOrigin: "50% 80%",
                  filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.32))",
                }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={sourceChartData}
                        cx="50%"
                        cy="52%"
                        innerRadius={36}
                        outerRadius={68}
                        dataKey="value"
                        labelLine={false}
                        strokeWidth={2}
                        stroke="var(--app-bg)"
                      >
                        {sourceChartData.map((_, index) => (
                          <Cell key={index} fill={SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--app-border)",
                          background: "var(--app-bg)",
                          color: "var(--app-text)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                          fontSize: 12,
                        }}
                        itemStyle={{ color: "var(--app-text)" }}
                        labelStyle={{ color: "var(--app-text)", fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Cylinder base — bottom rim shadow */}
                <div style={{
                  position: "absolute", bottom: 0, left: "50%",
                  transform: "translateX(-50%)",
                  width: "55%", height: 10,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.22)",
                  filter: "blur(5px)",
                }} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {sourceChartData.map(({ name, value }, index) => (
                  <div key={name} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length] }}
                    />
                    <span className="truncate text-xs text-app-soft">{name}</span>
                    <span className="ml-auto text-xs font-semibold text-app">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="card p-6 xl:col-span-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="stitch-kicker mb-2">Team Focus</p>
              <h3 className="text-lg font-bold text-app">Top Agents</h3>
            </div>
            <div className="stitch-pill">Leaderboard</div>
          </div>
          <div className="space-y-4">
            {(data?.byAgent || []).slice(0, 5).map((agent, index) => (
              <button
                key={agent._id}
                type="button"
                onClick={() => navigate("/performance", { state: { focusUserId: agent._id } })}
                className="flex w-full items-center gap-4 rounded-[1.25rem] p-3 text-left stitch-surface-muted transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-orange-500/5"
              >
                <span className="w-4 text-xs font-bold text-app-soft">{index + 1}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-500">
                  {agent.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app">{agent.name}</p>
                  <p className="text-xs text-app-soft">Active agent</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-app">{agent.count}</p>
                  <p className="text-xs text-app-soft">leads</p>
                </div>
              </button>
            ))}
            {(data?.byAgent || []).length === 0 && <p className="text-sm text-app-soft">No agent activity yet.</p>}
          </div>
        </section>

        <section className="card p-6 xl:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="stitch-kicker mb-2">Fresh Activity</p>
              <h3 className="text-lg font-bold text-app">Recent Leads</h3>
            </div>
            <div className="stitch-pill">{sourceChartData.length} active sources</div>
          </div>
          <div className="space-y-3">
            {data?.recentLeads?.length === 0 && <p className="text-sm text-app-soft">No leads yet</p>}
            {data?.recentLeads?.map((lead) => (
              <button
                key={lead._id}
                type="button"
                onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
                className="flex w-full items-center justify-between gap-4 rounded-[1.35rem] p-4 text-left stitch-surface-muted transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-orange-500/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-app">{lead.name}</p>
                  <p className="mt-1 text-xs text-app-soft">{fmtDate(lead.createdAt)}</p>
                </div>
                <span className={`badge ${
                  lead.status === "New"
                    ? "bg-blue-500/10 text-blue-400"
                    : lead.status === "Closed Won"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-white/5 text-app-soft"
                }`}>
                  {lead.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Follow-up Due Alert Panel ─────────────────────────────────────────────────
function FollowUpDuePanel({ user, navigate }) {
  const [leads, setLeads] = useState([]);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("fup_panel_dismissed") === "1"
  );

  useEffect(() => {
    if (dismissed) return;
    api.get("/leads/followups-due")
      .then((r) => setLeads(r.data.data || []))
      .catch(() => {});
  }, [dismissed]);

  if (dismissed || !leads.length) return null;

  const overdue = leads.filter((l) => l.urgency === "overdue");
  const today   = leads.filter((l) => l.urgency === "today");

  const dismiss = () => {
    sessionStorage.setItem("fup_panel_dismissed", "1");
    setDismissed(true);
  };

  const toWa = (phone = "") => {
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) return `91${d}`;
    if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
    return d;
  };

  const accentColor = overdue.length ? "#ef4444" : "#f59e0b";
  const accentBg    = overdue.length ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)";
  const accentBorder= overdue.length ? "rgba(239,68,68,0.3)"  : "rgba(245,158,11,0.3)";

  return (
    <section className="card overflow-hidden" style={{ borderColor: accentBorder }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(to right, ${accentBg}, transparent)`, borderBottom: "1px solid var(--app-border)" }}
      >
        {/* Icon */}
        <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: overdue.length ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)" }}>
          <AlertTriangle className="h-4 w-4" style={{ color: accentColor }} />
        </div>

        {/* Title — takes remaining space */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-app leading-tight">
            {overdue.length > 0 && today.length > 0
              ? `${overdue.length} overdue · ${today.length} due today`
              : overdue.length > 0
              ? `${overdue.length} overdue follow-up${overdue.length > 1 ? "s" : ""}`
              : `${today.length} follow-up${today.length > 1 ? "s" : ""} due today`}
          </p>
          <p className="text-[11px] text-app-soft">
            {user?.role === "agent" ? "Your action list" : "Across your team"}
          </p>
        </div>

        {/* Actions — compact on mobile */}
        <button
          type="button"
          onClick={() => navigate("/followups")}
          className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}
        >
          View all
        </button>
        <button
          type="button"
          onClick={dismiss}
          title="Dismiss"
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X className="h-3.5 w-3.5 text-app-soft" />
        </button>
      </div>

      {/* ── Lead rows ── */}
      <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
        {leads.slice(0, 10).map((lead) => (
          <div key={lead._id} className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">

            {/* Urgency badge — compact on mobile */}
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
              style={
                lead.urgency === "overdue"
                  ? { background: "rgba(239,68,68,0.12)", color: "#ef4444" }
                  : { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }
              }
            >
              {lead.urgency === "overdue" ? `${lead.daysOverdue}d` : "Today"}
            </span>

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="w-full text-left text-sm font-semibold text-app hover:text-orange-500 transition truncate block leading-tight"
                onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
              >
                {lead.name}
              </button>
              <p className="text-[11px] text-app-soft truncate leading-tight mt-0.5">
                {[lead.source, lead.status, lead.assignedToName && user?.role !== "agent" ? lead.assignedToName : null]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Call + WA — icon-only on mobile, label on sm+ */}
            {lead.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${lead.phone}`}
                  title={lead.phone}
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
                  style={{ borderColor: "rgba(249,115,22,0.25)", color: "var(--app-primary)", background: "rgba(249,115,22,0.06)" }}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{lead.phone}</span>
                </a>
                <a
                  href={`https://wa.me/${toWa(lead.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
                  style={{ borderColor: "rgba(34,197,94,0.25)", color: "#16a34a", background: "rgba(34,197,94,0.06)" }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">WA</span>
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {leads.length > 10 && (
        <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
          <button type="button" className="text-xs text-app-soft hover:text-orange-500 transition font-medium" onClick={() => navigate("/followups")}>
            +{leads.length - 10} more — view all in Follow-ups
          </button>
        </div>
      )}
    </section>
  );
}

function TopLeadSourceCard({ label, value, icon: Icon, note, tone, iconTone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card relative w-full overflow-hidden p-3 sm:p-6 bg-gradient-to-br text-left transition hover:-translate-y-1 hover:border-orange-500/30 ${tone}`}
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/5 to-transparent dark:from-white/[0.04]" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="stitch-kicker mb-1 sm:mb-2 text-[8px] sm:text-[11px] truncate">{label}</p>
          <p className="text-2xl sm:text-4xl font-black tracking-tight text-app">{value}</p>
          <p className="mt-1 sm:mt-2 text-[9px] sm:text-xs text-app-soft hidden sm:block">{note}</p>
        </div>
        <div className={`shrink-0 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl ${iconTone}`}>
          <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
        </div>
      </div>
    </button>
  );
}

