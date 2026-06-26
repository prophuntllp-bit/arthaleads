import { useState, useEffect } from "react";
import { PageLoader } from "../components/UI";
import api from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { TrendingUp, TrendingDown, Building2, Users, IndianRupee, AlertTriangle } from "lucide-react";

const PLAN_PRICE = { starter: 999, growth: 2499, enterprise: 9999, pro: 2499 };
const PLAN_COLORS = {
  trial: "#eab308", starter: "#3b82f6", growth: "#8b5cf6", pro: "#8b5cf6", enterprise: "#f97316",
};

function MetricCard({ label, value, sub, icon: Icon, color, bg, trend }) {
  return (
    <div className="card p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-black ${color} mb-0.5`}>{value}</p>
      <p className="text-xs text-app-soft">{label}</p>
      {sub && <p className="text-[11px] text-app-soft mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)} vs last month
        </div>
      )}
    </div>
  );
}

export default function SuperAdminRevenue() {
  const [orgs, setOrgs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Revenue · Arthaleads Admin";
    api.get("/super-admin/orgs?limit=500")
      .then(({ data }) => setOrgs(data.orgs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

  // Paid orgs only
  const paidOrgs   = orgs.filter(o => PLAN_PRICE[o.plan]);
  const mrr        = paidOrgs.reduce((s, o) => s + (PLAN_PRICE[o.plan] || 0), 0);
  const arr        = mrr * 12;

  // New paid orgs this month
  const newThisMonth = orgs.filter(o => new Date(o.createdAt) >= startOfThisMonth).length;
  const newLastMonth = orgs.filter(o => {
    const d = new Date(o.createdAt);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  }).length;

  // Churned = trial expired and inactive
  const churned    = orgs.filter(o => o.trialExpired || (!o.isActive && o.plan !== "trial")).length;
  const activeRate = orgs.length > 0 ? Math.round((orgs.filter(o => o.isActive && !o.trialExpired).length / orgs.length) * 100) : 0;

  // Plan revenue breakdown
  const planRevenue = Object.entries(PLAN_PRICE).map(([plan, price]) => {
    const count = orgs.filter(o => o.plan === plan || (plan === "growth" && o.plan === "pro")).length;
    return { plan: plan === "pro" ? null : plan, count, revenue: count * price };
  }).filter(p => p.plan && p.count > 0);

  // MRR by month (estimated — orgs that existed each month × their plan price)
  const mrrHistory = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const activeThisMonth = orgs.filter(o => {
      const joined = new Date(o.createdAt);
      return joined <= end && PLAN_PRICE[o.plan];
    });
    const rev = activeThisMonth.reduce((s, o) => s + (PLAN_PRICE[o.plan] || 0), 0);
    return {
      month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      mrr: rev,
    };
  });

  // Orgs by plan for table
  const planBreakdown = [
    { plan: "Starter",    key: "starter",    price: 999  },
    { plan: "Growth",     key: "growth",     price: 2499 },
    { plan: "Enterprise", key: "enterprise", price: 9999 },
  ].map(p => {
    const count = orgs.filter(o => o.plan === p.key || (p.key === "growth" && o.plan === "pro")).length;
    return { ...p, count, revenue: count * p.price };
  });

  return (
    <div className="stitch-page">
      <div className="mb-6">
        <h1 className="text-xl font-black text-app">Revenue</h1>
        <p className="text-xs text-app-soft mt-0.5">Estimated metrics based on current plan subscriptions</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Monthly Recurring Revenue" icon={IndianRupee} color="text-green-500" bg="bg-green-500/10"
          value={`₹${mrr.toLocaleString("en-IN")}`}
          sub={`${paidOrgs.length} paid org${paidOrgs.length !== 1 ? "s" : ""}`}
        />
        <MetricCard
          label="Annual Run Rate" icon={TrendingUp} color="text-blue-500" bg="bg-blue-500/10"
          value={`₹${(arr / 100000).toFixed(1)}L`}
          sub={`₹${arr.toLocaleString("en-IN")} / year`}
        />
        <MetricCard
          label="New Orgs This Month" icon={Building2} color="text-orange-500" bg="bg-orange-500/10"
          value={newThisMonth}
          trend={newThisMonth - newLastMonth}
          sub={`${newLastMonth} last month`}
        />
        <MetricCard
          label="Active Rate" icon={Users} color="text-violet-500" bg="bg-violet-500/10"
          value={`${activeRate}%`}
          sub={`${churned} churned / inactive`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* MRR trend */}
        <div className="card p-5">
          <h2 className="font-bold text-app text-sm mb-4">Est. MRR Trend — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mrrHistory} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${v.toLocaleString("en-IN")}`, "Est. MRR"]} />
              <Area type="monotone" dataKey="mrr" stroke="#22c55e" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan revenue breakdown bars */}
        <div className="card p-5">
          <h2 className="font-bold text-app text-sm mb-4">Revenue by Plan</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={planBreakdown} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis dataKey="plan" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}
                fill="var(--app-primary)" maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plan breakdown table */}
      <div className="card overflow-hidden mb-5">
        <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
          Plan Breakdown
        </div>
        <table className="stitch-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th className="text-center">Orgs</th>
              <th className="text-right">Price / Month</th>
              <th className="text-right">Monthly Revenue</th>
              <th className="text-right">Annual Revenue</th>
            </tr>
          </thead>
          <tbody>
            {planBreakdown.map(p => (
              <tr key={p.plan}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[p.key] || "#888" }} />
                    <span className="font-semibold text-app text-sm">{p.plan}</span>
                  </div>
                </td>
                <td className="text-center font-bold text-app">{p.count}</td>
                <td className="text-right text-sm text-app-soft">₹{p.price.toLocaleString("en-IN")}</td>
                <td className="text-right font-bold text-app">₹{p.revenue.toLocaleString("en-IN")}</td>
                <td className="text-right font-bold text-green-600">₹{(p.revenue * 12).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            <tr className="font-black">
              <td>Total</td>
              <td className="text-center text-app">{paidOrgs.length}</td>
              <td></td>
              <td className="text-right text-green-600">₹{mrr.toLocaleString("en-IN")}</td>
              <td className="text-right text-green-600">₹{arr.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Churn / inactive */}
      {churned > 0 && (
        <div className="card p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-app">{churned} churned / inactive org{churned !== 1 ? "s" : ""}</p>
            <p className="text-xs text-app-soft mt-0.5">
              These orgs are on trial expired or deactivated status and generating ₹0 MRR.
              Consider reaching out via Broadcast.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
