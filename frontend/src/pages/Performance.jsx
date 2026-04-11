import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { BarChart3, Target, Trophy, Users } from "lucide-react";
import api from "../services/api";
import { PageLoader } from "../components/UI";

export default function Performance() {
  useEffect(() => { document.title = "Analytics & Reports — Arthaleads CRM"; }, []);
  const location = useLocation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/performance")
      .then((response) => setMembers(response.data.performance || []))
      .catch(() => toast.error("Failed to load team performance"))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => members.reduce((acc, member) => {
    acc.totalAssigned += member.totalAssigned || 0;
    acc.closedWon += member.closedWon || 0;
    acc.siteVisits += member.siteVisits || 0;
    return acc;
  }, { totalAssigned: 0, closedWon: 0, siteVisits: 0 }), [members]);

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <p className="stitch-kicker mb-2">Performance Board</p>
        <h1 className="text-3xl font-black tracking-tight text-app">Team Performance</h1>
        <p className="mt-2 max-w-2xl text-sm text-app-soft">Track how each team member is handling assigned leads, visits, and closures.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Users} label="Assigned Leads" value={totals.totalAssigned} note="Across the visible team" />
        <MetricCard icon={Target} label="Site Visits" value={totals.siteVisits} note="Visit-stage opportunities" />
        <MetricCard icon={Trophy} label="Closed Won" value={totals.closedWon} note="Successful conversions" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {members.map((member) => {
          const focused = location.state?.focusUserId === member._id;
          return (
            <article
              key={member._id}
              className={`card p-5 space-y-4 transition ${focused ? "ring-2 ring-orange-500/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="h-12 w-12 rounded-2xl object-cover border" style={{ borderColor: "var(--app-border)" }} />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-bold text-orange-500">
                      {member.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-app">{member.name}</h3>
                    <p className="truncate text-xs text-app-soft">{member.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="badge bg-orange-500/10 text-orange-400 capitalize">{member.role}</span>
                  <p className="mt-2 text-xs text-app-soft">{member.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <PerformanceTile label="Assigned" value={member.totalAssigned} />
                <PerformanceTile label="New" value={member.newLeads} />
                <PerformanceTile label="Visits" value={member.siteVisits} />
                <PerformanceTile label="Won" value={member.closedWon} />
              </div>

              <div className="rounded-[1.15rem] p-4 stitch-surface-muted">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-app">Conversion Rate</p>
                  <p className="text-sm font-bold text-orange-500">{member.conversionRate}%</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--app-border)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.min(member.conversionRate, 100)}%` }} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {!members.length && (
        <section className="card p-6 text-sm text-app-soft flex items-center gap-3"><BarChart3 className="h-4 w-4" /> No performance data available yet.</section>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="stitch-kicker mb-2">{label}</p>
          <p className="text-3xl font-black tracking-tight text-app">{value}</p>
          <p className="mt-2 text-xs text-app-soft">{note}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function PerformanceTile({ label, value }) {
  return (
    <div className="rounded-[1.15rem] p-4 stitch-surface-muted">
      <p className="text-xs text-app-soft">{label}</p>
      <p className="mt-2 text-xl font-bold text-app">{value}</p>
    </div>
  );
}
