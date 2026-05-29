// Dashboard - v2
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock3,
  Globe,
  IndianRupee,
  MessageCircle,
  MoonStar,
  Pencil,
  Phone,
  Plus,
  Search,
  SunMedium,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import LeadForm from "../components/LeadForm";
import { useAuth } from "../context/AuthContext";
import { StatCard, PageLoader } from "../components/UI";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { fmtDate } from "../utils/constants";
import DateRangePicker from "../components/DateRangePicker";

const STATUS_CHART_COLORS = ["#6366f1", "#f59e0b", "#8b5cf6", "#f97316", "#22c55e", "#ef4444"];
const SOURCE_CHART_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6b7280"];

function PlatformLogo({ platform, size = 16 }) {
  const s = { width: size, height: size, flexShrink: 0, display: "block" };
  switch (platform) {
    case "Facebook": return (
      <svg viewBox="0 0 24 24" style={s} fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    );
    case "Google": return (
      <svg viewBox="0 0 24 24" style={s}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    );
    case "WhatsApp": return (
      <svg viewBox="0 0 24 24" style={s} fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    );
    case "Website Form": return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
      </svg>
    );
    default: return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }
}

// Config for each platform - drives both header pills and source cards
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

function fmtINR(val) {
  if (!val) return "₹0";
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)}Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function calcDelta(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}

function fmtResponseTime(ms) {
  if (!ms || ms <= 0) return "No data";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = ms / 3600000;
  if (hrs < 24) return `${hrs.toFixed(1)} hrs`;
  return `${(hrs / 24).toFixed(1)} days`;
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddLead, setShowAddLead] = useState(false);
  const [agents, setAgents] = useState([]);
  const [goalOverride, setGoalOverride] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(false);

  const fetchAnalytics = (retryCount = 0) => {
    setLoading(true);
    setAnalyticsError(false);
    api.get("/leads/analytics", { params: { dateRange } })
      .then((response) => setData(response.data.data))
      .catch((err) => {
        console.error("[analytics]", err?.response?.status, err?.message);
        if (retryCount < 1) {
          // Auto-retry once after 3s (handles Railway cold-start / transient DB reconnect)
          setTimeout(() => fetchAnalytics(1), 3000);
        } else {
          setAnalyticsError(true);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnalytics(); }, [dateRange, refreshKey]);

  useEffect(() => {
    api.get("/auth/agents").then((r) => setAgents(r.data.agents || [])).catch(() => {});
  }, []);

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

  const monthlyGoal = goalOverride !== null ? goalOverride : (data?.monthlyClosingGoal || 0);

  return (
    <div className="stitch-page space-y-6">
      <header className="stitch-topbar">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search: hidden on mobile/tablet, visible on desktop */}
            <div className="relative min-w-[260px] flex-1 max-w-xl hidden md:block">
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
            {/* Platform pills: always visible */}
            <div className="flex flex-wrap items-center gap-2">
              {activePlatforms.map((platform) => {
                const cfg = PLATFORM_CONFIG[platform];
                if (!cfg) return null;
                const count = data?.bySource?.[cfg.sourceKey] || 0;
                return (
                  <div key={platform} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${cfg.pillTone}`}>
                    <PlatformLogo platform={platform} size={13} />
                    {count}
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

        <div className="flex flex-nowrap items-center gap-2">
          <button type="button" onClick={() => setShowAddLead(true)}
            className="btn-primary flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap">
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>New Lead</span>
          </button>
          <button className="stitch-pill whitespace-nowrap" onClick={toggleTheme}>
            {isDark ? <MoonStar className="h-4 w-4 text-orange-500" /> : <SunMedium className="h-4 w-4 text-orange-500" />}
            {theme === "dark" ? "Dark" : "Light"}
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </header>

      {analyticsError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">Couldn't load dashboard data. Check your connection.</p>
          </div>
          <button
            className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
            onClick={() => fetchAnalytics()}
          >
            Retry
          </button>
        </div>
      )}

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
                logo={<PlatformLogo platform={platform} size={20} />}
                note={cfg.note}
                tone={cfg.tone}
                iconTone={cfg.iconTone}
                onClick={() => navigate("/leads", { state: { presetSource: cfg.presetSource } })}
              />
            );
          })}
        </div>
      )}

      {/* Agent with no leads assigned yet */}
      {!loading && data && user?.role === "agent" && data.allTimeTotal === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">No leads assigned to you yet</p>
            <p className="text-xs text-app-soft mt-0.5">Ask your manager to assign leads so they appear here.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Leads" value={data?.allTimeTotal || 0} icon={Users} color="text-orange-500"
          delta={data ? calcDelta(data.thisMonthLeads, data.lastMonthLeads) : undefined}
          onClick={() => navigate("/leads")} />
        <StatCard label="New" value={data?.allTimeNew || 0} icon={TrendingUp} color="text-indigo-400" sub="Uncontacted"
          onClick={() => navigate("/leads", { state: { presetStatus: "New" } })} />
        <StatCard label="Closed Won" value={data?.allTimeClosedWon || 0} icon={CheckCircle} color="text-emerald-400" sub="Converted"
          delta={data ? calcDelta(data.thisMonthClosedWon, data.lastMonthClosedWon) : undefined}
          onClick={() => navigate("/leads", { state: { presetStatus: "Closed Won" } })} />
        <StatCard label="Follow-ups Today" value={data?.todayFollowUps || 0} icon={Clock3} color="text-amber-400" sub={`${data?.totalFollowUps || 0} total scheduled`}
          onClick={() => navigate("/leads", { state: { presetFollowUpToday: true } })} />
      </div>
      <InsightStrip data={data} />
      <GoalMetricsRow
        goal={monthlyGoal}
        current={data?.thisMonthClosedWon || 0}
        avgResponseMs={data?.avgResponseMs}
        role={user?.role}
        onGoalUpdate={(n) => setGoalOverride(n)}
      />
      <UpcomingSchedule items={data?.upcomingItems || []} navigate={navigate} />

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
            <div className="flex flex-col gap-4">
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={85}
                      dataKey="value"
                      labelLine={false}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {sourceChartData.map((_, index) => (
                        <Cell key={index} fill={SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--app-border)",
                        background: "var(--app-card)",
                        color: "var(--app-text)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        fontSize: 12,
                        padding: "6px 12px",
                      }}
                      itemStyle={{ color: "var(--app-text)" }}
                      labelStyle={{ color: "var(--app-text)", fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-app">
                    {sourceChartData.reduce((s, d) => s + d.value, 0)}
                  </span>
                  <span className="text-xs text-app-soft">Total</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {sourceChartData.map(({ name, value }, index) => (
                  <div key={name} className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
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

      <DropoffFunnel allTimeByStatus={data?.allTimeByStatus} />

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

        <ActivityFeed items={data?.recentActivity || []} navigate={navigate} />
      </div>

      <LeadForm
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onSaved={() => { setShowAddLead(false); setRefreshKey((k) => k + 1); }}
        agents={agents}
      />
    </div>
  );
}

// ── Insight Strip ─────────────────────────────────────────────────────────────
function InsightStrip({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.10)" }}>
          <IndianRupee className="w-5 h-5 text-orange-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-app-soft uppercase tracking-wider font-semibold">Pipeline Value</p>
          <p className="text-xl font-bold text-app">{fmtINR(data?.pipelineValue)}</p>
          <p className="text-[10px] text-app-soft">{data?.pipelineLeads || 0} active leads</p>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34,197,94,0.10)" }}>
          <Target className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-app-soft uppercase tracking-wider font-semibold">Conversion Rate</p>
          <p className="text-xl font-bold text-emerald-400">{data?.conversionRate ?? 0}%</p>
          <p className="text-[10px] text-app-soft">{data?.allTimeClosedWon || 0} of {data?.allTimeTotal || 0} leads closed</p>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.10)" }}>
          <Zap className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-app-soft uppercase tracking-wider font-semibold">Today's Activity</p>
          <p className="text-xl font-bold text-indigo-400">{data?.todayCreated || 0} new leads</p>
          <p className="text-[10px] text-app-soft">{data?.todaySiteVisits || 0} site visits · {data?.todayFollowUps || 0} follow-ups</p>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming Schedule ─────────────────────────────────────────────────────────
function UpcomingSchedule({ items, navigate }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--app-border)" }}>
        <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-bold text-app">Upcoming 48 hours</span>
        <span className="badge bg-indigo-500/10 text-indigo-400 ml-auto">{items.length}</span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
        {items.map((lead) => {
          const date = lead.followUpDate || lead.siteVisitDate;
          const type = lead.followUpDate ? "Follow-up" : "Site Visit";
          return (
            <button key={lead._id} type="button"
              onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-orange-500/5 transition">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-app truncate">{lead.name}</p>
                <p className="text-xs text-app-soft">{type} · {lead.assignedToName || "Unassigned"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-indigo-400">
                  {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
                <p className="text-[10px] text-app-soft">{lead.status}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Goal Metrics Row ─────────────────────────────────────────────────────────
function GoalMetricsRow({ goal, current, avgResponseMs, role, onGoalUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = role === "admin" || role === "manager";
  const pct = goal > 0 ? Math.min(100, Math.round(current / goal * 100)) : 0;

  const save = async () => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    setSaving(true);
    try {
      await api.patch("/org/me/goal", { monthlyClosingGoal: n });
      onGoalUpdate(n);
      setEditing(false);
    } catch { toast.error("Failed to save goal. Please try again."); } finally { setSaving(false); setEditing(false); }
  };

  if (goal === 0 && !canEdit) return null;

  return (
    <section className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <Target className="w-4 h-4 text-orange-500" />
          <span className="text-[11px] font-bold text-app uppercase tracking-wider">Monthly Goal</span>
        </div>

        {goal > 0 ? (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg,#ff6b00,#ffaa00)" }} />
              </div>
              <span className={`text-xs font-bold shrink-0 ${pct >= 100 ? "text-emerald-400" : "text-orange-500"}`}>{pct}%</span>
            </div>
            <span className="text-xs text-app-soft shrink-0">
              <span className="font-bold text-app">{current}</span> / {goal} closings this month
            </span>
          </>
        ) : (
          <span className="text-xs text-app-soft flex-1">
            {canEdit ? "No goal set — click the pencil to set a monthly closing target." : "No monthly goal set."}
          </span>
        )}

        {canEdit && (
          editing ? (
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" min="1" value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="input w-20 text-center text-sm py-1" placeholder="Target"
                autoFocus />
              <button type="button" onClick={save} disabled={saving}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-3.5 h-3.5 text-app-soft" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setEditing(true); setVal(String(goal || "")); }}
              title="Set monthly goal"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 shrink-0">
              <Pencil className="w-3.5 h-3.5 text-app-soft" />
            </button>
          )
        )}

        {avgResponseMs !== null && avgResponseMs !== undefined && (
          <>
            <div className="hidden sm:block h-5 w-px shrink-0" style={{ background: "var(--app-border)" }} />
            <div className="flex items-center gap-2 shrink-0">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-app-soft">Avg first response · </span>
              <span className="text-xs font-bold text-emerald-400">{fmtResponseTime(avgResponseMs)}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ items, navigate }) {
  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
  const TYPE_COLOR = {
    status_changed: "#f59e0b", called: "#22c55e", site_visit: "#8b5cf6",
    note_added: "#06b6d4", assigned: "#3b82f6", follow_up_set: "#f97316",
    created: "#ff6b00", emailed: "#ec4899",
  };
  return (
    <section className="card p-6 xl:col-span-7">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="stitch-kicker mb-1">Live Feed</p>
          <h3 className="text-base font-bold text-app">Team Activity</h3>
        </div>
        <div className="stitch-pill text-xs">Last 10 actions</div>
      </div>
      {(!items || items.length === 0) ? (
        <p className="text-sm text-app-soft py-4">No activity recorded yet.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <button key={i} type="button"
              onClick={() => navigate("/leads", { state: { openLeadId: item.leadId } })}
              className="w-full flex items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-orange-500/5 transition">
              <div className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: TYPE_COLOR[item.type] || "#6b7280" }} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-app leading-snug">
                  <span className="font-semibold">{item.performedByName || "System"}</span>
                  <span className="text-app-soft"> · {item.description}</span>
                </p>
                <p className="text-[10px] text-app-soft mt-0.5">{item.leadName} · {timeAgo(item.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Pipeline Drop-off Funnel ──────────────────────────────────────────────────
function DropoffFunnel({ allTimeByStatus }) {
  const STAGES = [
    { key: "New",         color: "#6366f1" },
    { key: "Contacted",   color: "#f59e0b" },
    { key: "Site Visit",  color: "#8b5cf6" },
    { key: "Negotiation", color: "#f97316" },
    { key: "Closed Won",  color: "#22c55e" },
    { key: "Closed Lost", color: "#ef4444" },
  ];
  const total = STAGES.reduce((s, st) => s + (allTimeByStatus?.[st.key] || 0), 0);
  if (!total) return null;
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="stitch-kicker mb-1">Where leads get stuck</p>
          <h3 className="text-base font-bold text-app">Pipeline Drop-off</h3>
        </div>
        <div className="stitch-pill text-xs">{total} all-time</div>
      </div>
      <div className="space-y-2">
        {STAGES.map(({ key, color }) => {
          const count = allTimeByStatus?.[key] || 0;
          const pct = Math.round(count / total * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-24 text-xs text-app-soft text-right shrink-0">{key}</div>
              <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                  style={{ width: pct > 0 ? `${Math.max(pct, 4)}%` : "0%", background: color }}>
                  {pct >= 8 && <span className="text-[10px] font-bold text-white">{count}</span>}
                </div>
              </div>
              <div className="w-10 text-xs font-semibold text-app text-right shrink-0">{pct}%</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Follow-up Due Alert Panel ─────────────────────────────────────────────────
function FollowUpDuePanel({ user, navigate }) {
  const [leads, setLeads] = useState([]);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("fup_panel_dismissed") === "1"
  );
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem("fup_panel_minimized") !== "0"
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

        {/* Title - takes remaining space */}
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

        {/* Actions - compact on mobile */}
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
          onClick={() => setMinimized((v) => { const next = !v; localStorage.setItem("fup_panel_minimized", next ? "1" : "0"); return next; })}
          title={minimized ? "Expand" : "Minimize"}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ChevronDown className={`h-3.5 w-3.5 text-app-soft transition-transform duration-200 ${minimized ? "rotate-180" : ""}`} />
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
      {!minimized && <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
        {leads.slice(0, 10).map((lead) => (
          <div key={lead._id} className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">

            {/* Urgency badge - compact on mobile */}
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

            {/* Call + WA - icon-only on mobile, label on sm+ */}
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
      </div>}

      {/* Footer */}
      {!minimized && leads.length > 10 && (
        <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
          <button type="button" className="text-xs text-app-soft hover:text-orange-500 transition font-medium" onClick={() => navigate("/followups")}>
            +{leads.length - 10} more - view all in Follow-ups
          </button>
        </div>
      )}
    </section>
  );
}

function TopLeadSourceCard({ label, value, logo, note, tone, iconTone, onClick }) {
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
          {logo}
        </div>
      </div>
    </button>
  );
}

