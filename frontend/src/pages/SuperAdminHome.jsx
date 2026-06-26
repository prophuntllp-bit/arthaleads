import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "../components/UI";
import api from "../services/api";
import {
  Building2, Users, BarChart3, CheckCircle2,
  AlertTriangle, Clock, TrendingUp, Plus,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PLAN_COLORS = {
  trial:      "#eab308",
  starter:    "#3b82f6",
  growth:     "#8b5cf6",
  pro:        "#8b5cf6",
  enterprise: "#f97316",
};

const MRR_PRICES = { starter: 999, growth: 2499, enterprise: 9999 };

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="card p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-3xl font-black ${color} mb-0.5`}>{value.toLocaleString("en-IN")}</p>
      <p className="text-xs text-app-soft">{label}</p>
    </div>
  );
}

export default function SuperAdminHome() {
  const { user }            = useAuth();
  const [orgs, setOrgs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard · Arthaleads Admin";
    api.get("/super-admin/orgs?limit=500")
      .then(({ data }) => setOrgs(data.orgs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Stats
  const totalUsers = orgs.reduce((s, o) => s + (o.userCount || 0), 0);
  const totalLeads = orgs.reduce((s, o) => s + (o.leadCount || 0), 0);
  const activeOrgs = orgs.filter(o => o.isActive && !o.trialExpired).length;

  // Trial alerts
  const expiringSoon = orgs
    .filter(o => o.plan === "trial" && o.trialEndsAt && new Date(o.trialEndsAt) > now && new Date(o.trialEndsAt) <= in7)
    .sort((a, b) => new Date(a.trialEndsAt) - new Date(b.trialEndsAt));
  const expired = orgs.filter(o => o.trialExpired);

  // Recent signups
  const recent = [...orgs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  // Plan distribution
  const planCounts = orgs.reduce((acc, o) => {
    const p = o.plan === "pro" ? "growth" : o.plan;
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const planData = [
    { name: "Trial",      value: planCounts.trial      || 0, color: "#eab308" },
    { name: "Starter",    value: planCounts.starter    || 0, color: "#3b82f6" },
    { name: "Growth",     value: planCounts.growth     || 0, color: "#8b5cf6" },
    { name: "Enterprise", value: planCounts.enterprise || 0, color: "#f97316" },
  ].filter(p => p.value > 0);

  // Signups by month (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear(), m = d.getMonth();
    return {
      month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      signups: orgs.filter(o => {
        const c = new Date(o.createdAt);
        return c.getFullYear() === y && c.getMonth() === m;
      }).length,
    };
  });

  // MRR
  const mrr = orgs.reduce((s, o) => s + (MRR_PRICES[o.plan === "pro" ? "growth" : o.plan] || 0), 0);
  const paidCount = orgs.filter(o => !["trial", ""].includes(o.plan)).length;

  return (
    <div className="stitch-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-app">Dashboard</h1>
        <p className="text-xs text-app-soft mt-0.5">
          Welcome back, <span className="font-semibold" style={{ color: "var(--app-primary)" }}>{user?.name}</span>
          {" · "}
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Organizations" value={orgs.length}  icon={Building2}    color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard label="Active Orgs"         value={activeOrgs}   icon={CheckCircle2} color="text-green-500"  bg="bg-green-500/10" />
        <StatCard label="Total Users"         value={totalUsers}   icon={Users}        color="text-blue-500"   bg="bg-blue-500/10" />
        <StatCard label="Total Leads"         value={totalLeads}   icon={BarChart3}    color="text-violet-500" bg="bg-violet-500/10" />
      </div>

      {/* MRR estimate */}
      {mrr > 0 && (
        <div className="card p-4 mb-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
            <TrendingUp className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-app-soft uppercase tracking-wide">Est. Monthly Revenue</p>
            <p className="text-2xl font-black text-app">₹{mrr.toLocaleString("en-IN")}</p>
          </div>
          <p className="text-xs text-app-soft ml-auto hidden sm:block">
            {paidCount} paid org{paidCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Middle row: alerts + plan donut + recent signups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Trial Alerts */}
        <div className="card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--app-border)" }}>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-app text-sm flex-1">Trial Alerts</h2>
            {(expiringSoon.length + expired.length) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                {expiringSoon.length + expired.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y" style={{ divideColor: "var(--app-border)" }}>
            {expired.length === 0 && expiringSoon.length === 0 && (
              <p className="text-xs text-app-soft text-center py-10">No alerts right now</p>
            )}
            {expired.slice(0, 5).map(org => (
              <div key={org._id} className="flex items-center gap-3 px-4 py-3">
                <Clock className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-app truncate">{org.name}</p>
                  <p className="text-[10px] text-red-500 font-medium">Trial expired</p>
                </div>
                <span className="text-[9px] font-bold bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full">Expired</span>
              </div>
            ))}
            {expiringSoon.map(org => {
              const daysLeft = Math.ceil((new Date(org.trialEndsAt) - now) / 86400000);
              return (
                <div key={org._id} className="flex items-center gap-3 px-4 py-3">
                  <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-app truncate">{org.name}</p>
                    <p className="text-[10px] text-amber-600 font-medium">{daysLeft}d remaining</p>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full">{daysLeft}d</span>
                </div>
              );
            })}
          </div>
          {(expiringSoon.length + expired.length) > 0 && (
            <div className="px-4 py-2.5 border-t flex-shrink-0" style={{ borderColor: "var(--app-border)" }}>
              <Link to="/super-admin/orgs" className="text-[11px] font-semibold hover:underline" style={{ color: "var(--app-primary)" }}>
                Manage in Organizations →
              </Link>
            </div>
          )}
        </div>

        {/* Plan Distribution */}
        <div className="card p-4">
          <h2 className="font-bold text-app text-sm mb-3">Plan Distribution</h2>
          {planData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={planData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {planData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} org${v !== 1 ? "s" : ""}`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                {planData.map(p => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-[11px] text-app-soft truncate">
                      {p.name}: <strong className="text-app">{p.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-app-soft text-center py-10">No data</p>
          )}
        </div>

        {/* Recent Signups */}
        <div className="card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--app-border)" }}>
            <Plus className="w-4 h-4 text-green-500" />
            <h2 className="font-bold text-app text-sm">Recent Signups</h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y" style={{ divideColor: "var(--app-border)" }}>
            {recent.length === 0 && (
              <p className="text-xs text-app-soft text-center py-10">No signups yet</p>
            )}
            {recent.map(org => (
              <div key={org._id} className="flex items-center gap-3 px-4 py-2.5">
                {org.logo ? (
                  <img src={org.logo} alt={org.name}
                    className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                    onError={e => e.currentTarget.style.display = "none"} />
                ) : (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#a04100,#ff6b00)" }}>
                    {org.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-app truncate">{org.name}</p>
                  <p className="text-[10px] text-app-soft">
                    {new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${PLAN_COLORS[org.plan] || "#888"}22`, color: PLAN_COLORS[org.plan] || "#888" }}>
                  {org.plan === "pro" ? "growth" : org.plan}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signups over time */}
      <div className="card p-5">
        <h2 className="font-bold text-app text-sm mb-4">New Signups — Last 6 Months</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(255,107,0,0.05)" }} />
            <Bar dataKey="signups" name="Signups" fill="var(--app-primary)" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
