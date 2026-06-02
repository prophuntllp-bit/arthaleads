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
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const exportPDF = () => {
    const now = new Date();
    const dateStr  = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const timeStr  = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const orgName  = org?.name  || "Your Organisation";
    const orgLogo  = org?.logo && !org.logo.startsWith("data:") ? org.logo : null;
    const rangeLabel = dateFrom || dateTo
      ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Start"} → ${dateTo ? new Date(dateTo).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Today"}`
      : "All time · Live data";

    const agentCards = members.map((m, idx) => {
      const p  = m.pipeline || {};
      const pr = m.project  || {};
      const pConv  = Math.min(p.conversionRate  || 0, 100);
      const prConv = Math.min(pr.conversionRate || 0, 100);
      const initial = (m.name || "?")[0].toUpperCase();
      const avatarColors = ["#f97316","#6366f1","#22c55e","#3b82f6","#ec4899","#f59e0b","#14b8a6"];
      const avatarBg = avatarColors[idx % avatarColors.length];
      return `
        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-name-area">
              <div class="agent-avatar" style="background:${avatarBg}">${initial}</div>
              <div>
                <div class="agent-name">${m.name || "—"}</div>
                <div class="agent-email">${m.email || ""}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="role-badge">${m.role || ""}</span>
              <span style="font-size:10px;color:${m.isActive !== false ? "#22c55e" : "#94a3b8"};font-weight:600;">
                ${m.isActive !== false ? "● Active" : "○ Inactive"}
              </span>
            </div>
          </div>
          <div class="pipelines">
            <div class="pipeline-section">
              <div class="pipeline-label orange">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                Main Pipeline
              </div>
              <table class="stat-table">
                <thead><tr>
                  <th>Assigned</th><th>New</th><th>Site Visit</th><th>Closed Won</th><th>Avg Resp.</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(p.totalAssigned||0).toLocaleString("en-IN")}</td>
                  <td>${(p.newLeads||0).toLocaleString("en-IN")}</td>
                  <td>${(p.siteVisits||0).toLocaleString("en-IN")}</td>
                  <td class="won">${(p.closedWon||0).toLocaleString("en-IN")}</td>
                  <td class="blue">${p.avgResponseTime||"—"}</td>
                </tr></tbody>
              </table>
              <div class="prog-row">
                <div class="prog-lbl">Conversion Rate</div>
                <div class="prog-bar"><div class="prog-fill orange" style="width:${pConv}%"></div></div>
                <div class="prog-pct orange">${p.conversionRate||0}%</div>
              </div>
            </div>
            <div class="pipeline-section">
              <div class="pipeline-label indigo">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="9" width="6" height="12" rx="1"/><rect x="16" y="6" width="6" height="15" rx="1"/></svg>
                Project Pipeline
              </div>
              <table class="stat-table">
                <thead><tr>
                  <th>Assigned</th><th>Interested</th><th>Site Visit</th><th>Booked</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(pr.totalAssigned||0).toLocaleString("en-IN")}</td>
                  <td class="orange">${(pr.interested||0).toLocaleString("en-IN")}</td>
                  <td>${(pr.siteVisitBooked||0).toLocaleString("en-IN")}</td>
                  <td class="won">${(pr.booked||0).toLocaleString("en-IN")}</td>
                </tr></tbody>
              </table>
              <table class="stat-table secondary">
                <thead><tr>
                  <th>Call Back</th><th>Not Interested</th><th>Not Reachable</th>
                </tr></thead>
                <tbody><tr>
                  <td>${(pr.callBack||0).toLocaleString("en-IN")}</td>
                  <td>${(pr.notInterested||0).toLocaleString("en-IN")}</td>
                  <td>${(pr.notReachable||0).toLocaleString("en-IN")}</td>
                </tr></tbody>
              </table>
              <div class="prog-row">
                <div class="prog-lbl">Booking Rate</div>
                <div class="prog-bar"><div class="prog-fill indigo" style="width:${prConv}%"></div></div>
                <div class="prog-pct indigo">${pr.conversionRate||0}%</div>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Team Performance Report – Arthaleads</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',-apple-system,system-ui,sans-serif;color:#0f172a;background:#fff;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#f97316 0%,#c2410c 100%);color:#fff;padding:28px 40px 24px;display:flex;align-items:center;justify-content:space-between;}
  .logo-area{display:flex;align-items:center;gap:14px;}
  .logo-icon{width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex-shrink:0;}
  .logo-img{width:48px;height:48px;border-radius:14px;object-fit:cover;}
  .logo-name{font-size:20px;font-weight:900;letter-spacing:-0.5px;}
  .logo-sub{font-size:11px;opacity:0.78;margin-top:2px;font-weight:500;}
  .header-right{text-align:right;}
  .report-title{font-size:15px;font-weight:800;letter-spacing:-0.2px;}
  .report-meta{font-size:10px;opacity:0.72;margin-top:5px;line-height:1.6;}
  .content{padding:28px 40px;}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;}
  .metric{border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;border:1.5px solid #f1f5f9;}
  .metric-accent{position:absolute;top:0;left:0;right:0;height:4px;border-radius:14px 14px 0 0;}
  .m-orange .metric-accent{background:linear-gradient(90deg,#f97316,#fb923c);}
  .m-blue   .metric-accent{background:linear-gradient(90deg,#3b82f6,#60a5fa);}
  .m-green  .metric-accent{background:linear-gradient(90deg,#22c55e,#4ade80);}
  .metric-val{font-size:34px;font-weight:900;letter-spacing:-1.5px;line-height:1;margin-top:4px;}
  .m-orange .metric-val{color:#f97316;} .m-blue .metric-val{color:#3b82f6;} .m-green .metric-val{color:#22c55e;}
  .metric-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-top:6px;}
  .metric-note{font-size:10px;color:#94a3b8;margin-top:3px;}
  .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;}
  .agent-card{border:1.5px solid #f1f5f9;border-radius:16px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;}
  .agent-header{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:linear-gradient(135deg,#f8fafc,#fff);border-bottom:1.5px solid #f1f5f9;}
  .agent-name-area{display:flex;align-items:center;gap:11px;}
  .agent-avatar{width:36px;height:36px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;}
  .agent-name{font-size:13px;font-weight:700;color:#0f172a;}
  .agent-email{font-size:10px;color:#94a3b8;margin-top:1px;}
  .role-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:capitalize;background:rgba(249,115,22,0.1);color:#ea580c;letter-spacing:.02em;}
  .pipelines{display:grid;grid-template-columns:1fr 1fr;}
  .pipeline-section{padding:14px 18px;}
  .pipeline-section+.pipeline-section{border-left:1.5px solid #f1f5f9;}
  .pipeline-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;display:flex;align-items:center;gap:5px;}
  .pipeline-label.orange{color:#f97316;} .pipeline-label.indigo{color:#6366f1;}
  .stat-table{width:100%;border-collapse:collapse;margin:8px 0;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;}
  .stat-table thead tr{background:#f8fafc;}
  .stat-table th{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;padding:6px 10px;text-align:center;border-right:1.5px solid #e2e8f0;}
  .stat-table th:last-child{border-right:none;}
  .stat-table tbody tr{background:#fff;}
  .stat-table td{font-size:20px;font-weight:900;color:#0f172a;padding:10px 10px 8px;text-align:center;border-right:1.5px solid #f1f5f9;border-top:1.5px solid #e2e8f0;line-height:1;}
  .stat-table td:last-child{border-right:none;}
  .stat-table td.won{color:#22c55e;} .stat-table td.blue{color:#3b82f6;} .stat-table td.orange{color:#f97316;}
  .stat-table.secondary th{font-size:8px;} .stat-table.secondary td{font-size:15px;padding:7px 10px 6px;}
  .prog-row{margin-top:10px;display:flex;align-items:center;gap:8px;}
  .prog-lbl{font-size:9px;color:#94a3b8;font-weight:600;min-width:80px;}
  .prog-bar{flex:1;height:5px;background:#f1f5f9;border-radius:999px;overflow:hidden;}
  .prog-fill{height:100%;border-radius:999px;}
  .prog-fill.orange{background:linear-gradient(90deg,#f97316,#fb923c);}
  .prog-fill.indigo{background:linear-gradient(90deg,#6366f1,#818cf8);}
  .prog-pct{font-size:10px;font-weight:800;min-width:32px;text-align:right;}
  .prog-pct.orange{color:#f97316;} .prog-pct.indigo{color:#6366f1;}
  .footer{margin-top:28px;padding-top:14px;border-top:1.5px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;}
  .footer-left{font-size:10px;color:#94a3b8;}
  .footer-brand{font-size:11px;font-weight:800;color:#f97316;}
  @page{margin:0;size:A4;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    ${orgLogo
      ? `<img src="${orgLogo}" class="logo-img" alt="Logo" />`
      : `<div class="logo-icon">A</div>`}
    <div>
      <div class="logo-name">Arthaleads</div>
      <div class="logo-sub">${orgName}</div>
    </div>
  </div>
  <div class="header-right">
    <div class="report-title">Team Performance Report</div>
    <div class="report-meta">
      Generated ${dateStr} at ${timeStr}<br>
      ${members.length} team member${members.length !== 1 ? "s" : ""} · ${rangeLabel}
    </div>
  </div>
</div>

<div class="content">
  <div class="summary">
    <div class="metric m-orange">
      <div class="metric-accent"></div>
      <div class="metric-val">${totals.totalAssigned.toLocaleString("en-IN")}</div>
      <div class="metric-label">Total Leads</div>
      <div class="metric-note">Pipeline + Projects combined</div>
    </div>
    <div class="metric m-blue">
      <div class="metric-accent"></div>
      <div class="metric-val">${totals.siteVisits.toLocaleString("en-IN")}</div>
      <div class="metric-label">Site Visits</div>
      <div class="metric-note">Across all pipelines</div>
    </div>
    <div class="metric m-green">
      <div class="metric-accent"></div>
      <div class="metric-val">${totals.closedWon.toLocaleString("en-IN")}</div>
      <div class="metric-label">Closed / Booked</div>
      <div class="metric-note">Won in pipeline + Booked in projects</div>
    </div>
  </div>

  <div class="section-title">
    <span>Agent Performance Breakdown</span>
    <span style="font-weight:500;color:#94a3b8;text-transform:none;letter-spacing:0">${members.length} member${members.length !== 1 ? "s" : ""}</span>
  </div>

  ${agentCards}

  <div class="footer">
    <div class="footer-left">Confidential · Internal use only · ${orgName} · ${dateStr}</div>
    <div class="footer-brand">Arthaleads CRM · arthaleads.com</div>
  </div>
</div>
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
      const params = { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) };
      const r = await api.get("/auth/performance", { params });
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
          <div className="flex flex-col items-end gap-2">
            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--app-text-soft)" }}>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-orange-400"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text)", background: "var(--app-surface)" }}
              />
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--app-text-soft)" }}>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-orange-400"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text)", background: "var(--app-surface)" }}
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="text-xs font-medium text-orange-400 hover:text-orange-500 transition"
                >
                  Clear
                </button>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={exportPDF}
                disabled={!members.length}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-40"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
              >
                <FileDown className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
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
