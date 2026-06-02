import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { BarChart3, Target, Trophy, Users, RefreshCw, FolderKanban, Layers, FileDown } from "lucide-react";
import api from "../services/api";
import { PageLoader } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import UpgradeWall from "../components/UpgradeWall";
import { canAccess } from "../utils/plan";

export default function Performance() {
  useEffect(() => { document.title = "Analytics & Reports - Arthaleads CRM"; }, []);
  const { org } = useAuth();
  const location = useLocation();
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const exportPDF = () => {
    const now = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const rows = members.map((m) => {
      const p = m.pipeline || {};
      const pr = m.project  || {};
      return `
        <tr>
          <td>${m.name}</td>
          <td class="center">${m.role}</td>
          <td class="center">${p.totalAssigned || 0}</td>
          <td class="center">${p.siteVisits || 0}</td>
          <td class="center">${p.closedWon || 0}</td>
          <td class="center">${p.conversionRate || 0}%</td>
          <td class="center">${pr.totalAssigned || 0}</td>
          <td class="center">${pr.siteVisitBooked || 0}</td>
          <td class="center">${pr.booked || 0}</td>
          <td class="center">${pr.conversionRate || 0}%</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Arthaleads – Team Performance Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Inter, Arial, sans-serif; color: #111; padding: 32px; font-size: 13px; }
        h1 { font-size: 22px; font-weight: 800; color: #f97316; margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
        .summary { display: flex; gap: 16px; margin-bottom: 28px; }
        .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
        .card .val { font-size: 28px; font-weight: 800; color: #111; }
        .card .lbl { font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f97316; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        th.center, td.center { text-align: center; }
        td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; }
        tr:nth-child(even) td { background: #fafafa; }
        .section-head { background: #f9fafb; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #666; padding: 6px 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Arthaleads CRM</h1>
      <p class="meta">Team Performance Report &nbsp;·&nbsp; Generated ${now}</p>
      <div class="summary">
        <div class="card"><div class="val">${totals.totalAssigned.toLocaleString("en-IN")}</div><div class="lbl">Total Leads</div></div>
        <div class="card"><div class="val">${totals.siteVisits.toLocaleString("en-IN")}</div><div class="lbl">Site Visits</div></div>
        <div class="card"><div class="val">${totals.closedWon.toLocaleString("en-IN")}</div><div class="lbl">Closed / Booked</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Agent</th><th rowspan="2" class="center">Role</th>
            <th colspan="4" class="center" style="background:#ea6c00">Main Pipeline</th>
            <th colspan="4" class="center" style="background:#4f46e5">Project Pipeline</th>
          </tr>
          <tr>
            <th class="center" style="background:#fb923c">Assigned</th>
            <th class="center" style="background:#fb923c">Site Visits</th>
            <th class="center" style="background:#fb923c">Closed Won</th>
            <th class="center" style="background:#fb923c">Conv %</th>
            <th class="center" style="background:#6366f1">Assigned</th>
            <th class="center" style="background:#6366f1">Site Visit</th>
            <th class="center" style="background:#6366f1">Booked</th>
            <th class="center" style="background:#6366f1">Book %</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Allow pop-ups to export the PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await api.get("/auth/performance");
      setMembers(r.data.performance || []);
    } catch {
      toast.error("Failed to load team performance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totals = useMemo(() => members.reduce((acc, m) => {
    acc.totalAssigned += m.totalAssigned || 0;
    acc.closedWon     += m.closedWon     || 0;
    acc.siteVisits    += m.siteVisits    || 0;
    return acc;
  }, { totalAssigned: 0, closedWon: 0, siteVisits: 0 }), [members]);

  if (!canAccess(org, "growth")) {
    return <UpgradeWall org={org} feature="Analytics & Reports" description="View team performance, conversion rates, booking metrics and individual agent tracking." />;
  }

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page space-y-6">
      {/* Header */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="stitch-kicker mb-2">Performance Board</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Team Performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">
              Track how each team member is handling leads across both the main pipeline and project pipelines - updated live.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              disabled={!members.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-40"
              style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50"
              style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Users}  label="Total Leads"  value={totals.totalAssigned} note="Pipeline + Project combined" />
        <MetricCard icon={Target} label="Site Visits"  value={totals.siteVisits}    note="Visit-stage across all pipelines" />
        <MetricCard icon={Trophy} label="Closed / Booked" value={totals.closedWon} note="Won in pipeline + Booked in projects" />
      </section>

      {/* Member cards */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {members.map((member) => {
          const focused  = location.state?.focusUserId === member._id;
          const pipeline = member.pipeline || {};
          const project  = member.project  || {};
          const hasPipeline = pipeline.totalAssigned > 0;
          const hasProject  = project.totalAssigned  > 0;

          return (
            <article
              key={member._id}
              className={`card p-5 space-y-4 transition ${focused ? "ring-2 ring-orange-500/60" : ""}`}
            >
              {/* Name / role */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name}
                      className="h-12 w-12 rounded-2xl object-cover border"
                      style={{ borderColor: "var(--app-border)" }} />
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
                <div className="text-right shrink-0">
                  <span className="badge bg-orange-500/10 text-orange-400 capitalize">{member.role}</span>
                  <p className="mt-2 text-xs text-app-soft">{member.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>

              {/* ── Main Pipeline Section ── */}
              <div className="rounded-[1.15rem] overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-app">Main Pipeline</span>
                  <span className="ml-auto text-xs text-app-soft">{pipeline.totalAssigned || 0} leads</span>
                </div>
                <div className="p-3 grid grid-cols-5 gap-2">
                  <SmallTile label="Assigned"     value={pipeline.totalAssigned || 0} />
                  <SmallTile label="New"           value={pipeline.newLeads      || 0} />
                  <SmallTile label="Site Visit"    value={pipeline.siteVisits    || 0} />
                  <SmallTile label="Closed Won"    value={pipeline.closedWon     || 0} highlight={pipeline.closedWon > 0} />
                  <SmallTile label="Avg Response"  value={pipeline.avgResponseTime || "-"} valueClass="text-blue-400" />
                </div>
                {hasPipeline && (
                  <div className="px-3 pb-3">
                    <div className="flex justify-between text-[10px] text-app-soft mb-1">
                      <span>Conversion Rate</span>
                      <span className="text-orange-500 font-semibold">{pipeline.conversionRate}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--app-border)" }}>
                      <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                        style={{ width: `${Math.min(pipeline.conversionRate, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Project Pipeline Section ── */}
              <div className="rounded-[1.15rem] overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-app">Project Pipeline</span>
                  <span className="ml-auto text-xs text-app-soft">{project.totalAssigned || 0} leads</span>
                </div>
                <div className="p-3 grid grid-cols-4 gap-2">
                  <SmallTile label="Assigned"     value={project.totalAssigned   || 0} />
                  <SmallTile label="Interested"   value={project.interested      || 0} />
                  <SmallTile label="Site Visit"   value={project.siteVisitBooked || 0} />
                  <SmallTile label="Booked"       value={project.booked          || 0} highlight={project.booked > 0} />
                </div>
                <div className="p-3 pt-0 grid grid-cols-3 gap-2">
                  <SmallTile label="Call Back"      value={project.callBack      || 0} />
                  <SmallTile label="Not Interested" value={project.notInterested || 0} />
                  <SmallTile label="Not Reachable"  value={project.notReachable  || 0} />
                </div>
                {hasProject && (
                  <div className="px-3 pb-3">
                    <div className="flex justify-between text-[10px] text-app-soft mb-1">
                      <span>Booking Rate</span>
                      <span className="text-blue-500 font-semibold">{project.conversionRate}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--app-border)" }}>
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                        style={{ width: `${Math.min(project.conversionRate, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!members.length && (
        <section className="card p-6 text-sm text-app-soft flex items-center gap-3">
          <BarChart3 className="h-4 w-4" /> No performance data available yet.
        </section>
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
          <p className="text-3xl font-black tracking-tight text-app">{value.toLocaleString("en-IN")}</p>
          <p className="mt-2 text-xs text-app-soft">{note}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SmallTile({ label, value, highlight = false, valueClass = "" }) {
  const isNum = typeof value === "number";
  return (
    <div className="rounded-xl p-3 stitch-surface-muted">
      <p className="text-[10px] text-app-soft leading-none">{label}</p>
      <p className={`mt-1.5 text-base font-bold truncate ${valueClass || (highlight && value > 0 ? "text-green-500" : "text-app")}`}>
        {isNum ? value.toLocaleString("en-IN") : value}
      </p>
    </div>
  );
}
