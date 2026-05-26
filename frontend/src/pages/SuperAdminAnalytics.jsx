import { useState, useEffect } from "react";
import { PageLoader } from "../components/UI";
import api from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import { BarChart3, TrendingUp, Users, Building2 } from "lucide-react";

const PLAN_COLORS = {
  trial:      "#eab308",
  starter:    "#3b82f6",
  growth:     "#8b5cf6",
  enterprise: "#f97316",
};

const MRR_PRICES = { starter: 999, growth: 2499, enterprise: 9999 };

export default function SuperAdminAnalytics() {
  const [orgs, setOrgs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Analytics · Arthaleads Admin";
    api.get("/super-admin/orgs?limit=500")
      .then(({ data }) => setOrgs(data.orgs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  // Signups by month (last 12 months)
  const monthlySignups = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    const y = d.getFullYear(), m = d.getMonth();
    return {
      month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      signups: orgs.filter(o => {
        const c = new Date(o.createdAt);
        return c.getFullYear() === y && c.getMonth() === m;
      }).length,
    };
  });

  // Cumulative orgs over time
  let cumulative = 0;
  const cumulativeData = monthlySignups.map(d => {
    cumulative += d.signups;
    return { ...d, total: cumulative };
  });

  // Plan distribution
  const planCounts = orgs.reduce((acc, o) => {
    const p = o.plan === "pro" ? "growth" : o.plan;
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const planData = Object.entries(planCounts)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: PLAN_COLORS[name] || "#888" }))
    .sort((a, b) => b.value - a.value);

  // MRR by month (estimate based on plan switches — approximate since we only have createdAt)
  const mrr = orgs.reduce((s, o) => s + (MRR_PRICES[o.plan === "pro" ? "growth" : o.plan] || 0), 0);

  // Lead distribution by org (top 10)
  const topByLeads = [...orgs]
    .sort((a, b) => (b.leadCount || 0) - (a.leadCount || 0))
    .slice(0, 10)
    .map(o => ({ name: o.name.length > 18 ? o.name.slice(0, 18) + "…" : o.name, leads: o.leadCount || 0, users: o.userCount || 0 }));

  // Users by org (top 10)
  const topByUsers = [...orgs]
    .sort((a, b) => (b.userCount || 0) - (a.userCount || 0))
    .slice(0, 10)
    .map(o => ({ name: o.name.length > 18 ? o.name.slice(0, 18) + "…" : o.name, users: o.userCount || 0 }));

  const totalLeads = orgs.reduce((s, o) => s + (o.leadCount || 0), 0);
  const totalUsers = orgs.reduce((s, o) => s + (o.userCount || 0), 0);

  return (
    <div className="stitch-page">
      <div className="mb-6">
        <h1 className="text-xl font-black text-app">Analytics</h1>
        <p className="text-xs text-app-soft mt-0.5">Platform-wide metrics across all {orgs.length} organizations</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Orgs",  value: orgs.length,  icon: Building2, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Total Users", value: totalUsers,   icon: Users,     color: "text-blue-500",   bg: "bg-blue-500/10" },
          { label: "Total Leads", value: totalLeads,   icon: BarChart3, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Est. MRR",    value: `₹${mrr.toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-black ${color} mb-0.5`}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
            <p className="text-xs text-app-soft">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Signups per month */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-bold text-app text-sm mb-4">New Signups — Last 12 Months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySignups} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(255,107,0,0.05)" }} />
              <Bar dataKey="signups" name="Signups" fill="var(--app-primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution */}
        <div className="card p-5">
          <h2 className="font-bold text-app text-sm mb-4">Plan Distribution</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={planData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                dataKey="value" paddingAngle={3}>
                {planData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} org${v !== 1 ? "s" : ""}`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {planData.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-xs text-app-soft flex-1">{p.name}</span>
                <span className="text-xs font-bold text-app">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Top orgs by leads */}
        <div className="card p-5">
          <h2 className="font-bold text-app text-sm mb-4">Top Organizations by Leads</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topByLeads} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip />
              <Bar dataKey="leads" name="Leads" fill="#8b5cf6" radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative orgs */}
        <div className="card p-5">
          <h2 className="font-bold text-app text-sm mb-4">Cumulative Organizations — Last 12 Months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulativeData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--app-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--app-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="total" name="Total Orgs"
                stroke="var(--app-primary)" fill="url(#areaGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top orgs by users */}
      <div className="card p-5">
        <h2 className="font-bold text-app text-sm mb-4">Top Organizations by Team Size</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topByUsers} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="users" name="Users" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
