import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { BarChart3, Target, Trophy, Users, RefreshCw, FolderKanban, Layers, FileDown, Phone, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import api from "../services/api";
import { PageLoader, AppSelect, Modal, StatusBadge } from "../components/UI";
import DateRangePicker, { rangeDays } from "../components/DateRangePicker";
import SourcePerformance from "../components/dashboard/SourcePerformance";
import { TopAgents, TeamActivity, MonthlyGoal, ClosingPace, ProjectBreakdown, AgentStatusToday } from "../components/dashboard/TeamSections";
import { describeRange, analyticsRangeParams } from "../components/dashboard/range";
import LeadDetail from "../components/LeadDetail";
import { useAuth } from "../context/AuthContext";
import UpgradeWall from "../components/UpgradeWall";
import { canAccess } from "../utils/plan";

export default function Performance() {
  useEffect(() => { document.title = "Performance - Arthaleads CRM"; }, []);
  const { org, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const allowed = canAccess(org, "growth");
  const [members,    setMembers]    = useState([]);
  const [teamTotals, setTeamTotals] = useState(null);   // whole team, each lead once
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // One date range picker (same as Attendance). "" = All time, as before.
  const [range,           setRange]           = useState("");
  const { from: dateFrom, to: dateTo } = rangeDays(range);
  const [filterMemberId,  setFilterMemberId]  = useState("");
  const [callAnalytics,   setCallAnalytics]   = useState(null);
  // Sections moved here from the Dashboard (30 Oct 2026): source quality, top
  // agents, team activity, monthly goal, closing pace, projects, who is in.
  const [analytics,  setAnalytics]  = useState(null);
  const [projects,   setProjects]   = useState(null);
  const [teamToday,  setTeamToday]  = useState(null);
  const [goalOverride, setGoalOverride] = useState(null);
  const [focusId, setFocusId] = useState(() => location.state?.focusUserId || "");
  const dateFilterMounted = useRef(false);
  // Drill-down: which tile was tapped, and the lead opened from that list.
  const [drill, setDrill]           = useState(null); // { title, userId, pipeline, metric }
  const [detailLead, setDetailLead] = useState(null);
  const [drillDirty, setDrillDirty] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const openDrill = (title, { userId = "", pipeline = "", metric }) => setDrill({ title, userId, pipeline, metric });
  const closeDrill = () => {
    setDrill(null); setDetailLead(null);
    // A lead edited from the list can move a tile (status changed), so
    // re-pull the numbers instead of leaving them stale.
    if (drillDirty) { setDrillDirty(false); fetchData(true); }
  };

  const displayMembers = useMemo(
    () => filterMemberId ? members.filter((m) => m._id === filterMemberId) : members,
    [members, filterMemberId]
  );

  const exportPDF = () => {
    // Escape any user-controlled value before interpolating it into the HTML
    // string written to the popup. Org name, member name/email/role are all
    // user-editable and would otherwise allow stored XSS in the same-origin
    // popup (full access to cookies, DOM, and the logged-in user's session).
    const esc = (v) => String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const now = new Date();
    const dateStr  = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
    const timeStr  = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    const dayLabel = (k) => new Date(`${k}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
    const orgName  = esc(org?.name || "Your Organisation");
    const orgLogo  = org?.logo && !org.logo.startsWith("data:") ? encodeURI(org.logo) : null;
    const rangeLabel = dateFrom || dateTo
      ? `${dateFrom ? dayLabel(dateFrom) : "Start"} → ${dateTo ? dayLabel(dateTo) : "Today"}`
      : "All time · Live data";

    const agentCards = displayMembers.map((m, idx) => {
      const p  = m.pipeline || {};
      const pr = m.project  || {};
      const pConv  = Math.min(p.conversionRate  || 0, 100);
      const prConv = Math.min(pr.conversionRate || 0, 100);
      const initial = esc((m.name || "?")[0].toUpperCase());
      const avatarColors = ["#f97316","#6366f1","#22c55e","#3b82f6","#ec4899","#f59e0b","#14b8a6"];
      const avatarBg = avatarColors[idx % avatarColors.length];
      return `
        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-name-area">
              <div class="agent-avatar" style="background:${avatarBg}">${initial}</div>
              <div>
                <div class="agent-name">${esc(m.name || "—")}</div>
                <div class="agent-email">${esc(m.email || "")}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="role-badge">${esc(m.role || "")}</span>
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
                  <td>${(pr.siteVisits||0).toLocaleString("en-IN")}${pr.siteVisitDone > 0 ? `<span style="display:block;font-size:9px;color:#14b8a6;font-weight:700;margin-top:2px;">${pr.siteVisitDone} done</span>` : ""}</td>
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
      ${displayMembers.length} team member${displayMembers.length !== 1 ? "s" : ""} · ${rangeLabel}
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
    <span style="font-weight:500;color:#94a3b8;text-transform:none;letter-spacing:0">${displayMembers.length} member${displayMembers.length !== 1 ? "s" : ""}</span>
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
      setTeamTotals(r.data.totals || null);
    } catch {
      toast.error("Failed to load team performance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial full load
  useEffect(() => {
    fetchData();
    api.get("/calls/analytics").then(r => setCallAnalytics(r.data)).catch(() => {});
    if (!allowed) return;
    api.get("/projects/stats", { timeout: 12000 }).then((r) => setProjects(r.data.data || [])).catch(() => setProjects([]));
    api.get("/attendance/team-today", { timeout: 12000 }).then((r) => setTeamToday(r.data.data || [])).catch(() => setTeamToday([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The Dashboard's lead analytics, for the same dates as this page.
  const rangeKey = typeof range === "object" ? `${range.from}|${range.to}` : range;
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    api.get("/leads/analytics", { params: analyticsRangeParams(range), timeout: 30000 })
      .then((r) => { if (!cancelled) setAnalytics(r.data.data || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rangeKey, allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  // A person picked from Top agents (here or on the Dashboard): bring their row into view.
  useEffect(() => {
    if (!focusId || loading) return;
    document.getElementById(`perf-row-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading]);

  // Auto-refetch when date filter changes (skip first render)
  useEffect(() => {
    if (!dateFilterMounted.current) { dateFilterMounted.current = true; return; }
    fetchData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const totals = useMemo(() => (teamTotals && displayMembers.length === members.length) ? teamTotals : displayMembers.reduce((acc, m) => {
    acc.totalAssigned += m.totalAssigned || 0;
    acc.closedWon     += m.closedWon     || 0;
    acc.siteVisits    += m.siteVisits    || 0;
    return acc;
  }, { totalAssigned: 0, closedWon: 0, siteVisits: 0 }), [displayMembers, members, teamTotals]);

  if (!allowed) {
    return <UpgradeWall org={org} feature="Performance" description="View team performance, conversion rates, booking metrics and individual agent tracking." />;
  }

  if (loading) return <PageLoader />;

  const scope = describeRange(range);
  const goal = goalOverride !== null ? goalOverride : (analytics?.monthlyClosingGoal || 0);

  return (
    <div className="stitch-page space-y-6">
      {/* Header */}
      <section className="card px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Performance</h1>
            <p className="page-subtitle">How each person is handling leads in the main and project pipelines.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            {/* Agent filter */}
            {members.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--app-text-soft)" }}>Agent</span>
                <AppSelect
                  value={filterMemberId}
                  onChange={setFilterMemberId}
                  placeholder="All Members"
                  options={[{ value: "", label: "All Members" }, ...members.map(m => ({ value: m._id, label: m.name }))]}
                  className="min-w-[140px]"
                  triggerClassName="text-xs py-1.5"
                />
                {filterMemberId && (
                  <button
                    onClick={() => setFilterMemberId("")}
                    className="text-xs font-medium text-orange-400 hover:text-orange-500 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {/* Date range filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--app-text-soft)" }}>Dates</span>
              <DateRangePicker value={range} onChange={setRange} compact />
              {range && (
                <button
                  onClick={() => setRange("")}
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
                Download Report
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Users}  label="Total Leads"  value={totals.totalAssigned} note="Pipeline + Project combined"
          onClick={() => openDrill("Total Leads", { userId: filterMemberId, metric: "assigned" })} />
        <MetricCard icon={Target} label="Site Visits"  value={totals.siteVisits}    note="Visit-stage across all pipelines"
          onClick={() => openDrill("Site Visits", { userId: filterMemberId, metric: "siteVisit" })} />
        <MetricCard icon={Trophy} label="Closed / Booked" value={totals.closedWon} note="Won in pipeline + Booked in projects"
          onClick={() => openDrill("Closed / Booked", { userId: filterMemberId, metric: "won" })} />
      </section>

      {/* One row per person */}
      {displayMembers.length > 0 && (
        <TeamTable members={displayMembers} focusId={focusId} openDrill={openDrill}
          calls={callAnalytics?.callsByAgent} onOpenCalls={() => navigate("/calls")} />
      )}

      {/* Which sources bring leads that go somewhere */}
      {analytics?.sourcePerformance?.length > 0 && (
        <SourcePerformance rows={analytics.sourcePerformance} scope={scope}
          onSelect={(source) => navigate("/leads", { state: { ...leadsRangeState(range), presetSource: source } })} />
      )}

      {/* Goal, closing pace and projects */}
      {analytics && (
        <MonthlyGoal
          goal={goal}
          current={analytics.thisMonthClosedWon || 0}
          role={user?.role}
          onGoalUpdate={(n) => setGoalOverride(n)}
        />
      )}
      {/* The forecast projects from closed deals; with none yet it could only show dashes. */}
      {analytics?.allTimeClosedWon > 0 && <ClosingPace data={analytics} goal={goal} />}
      <ProjectBreakdown projects={projects} onOpenProject={(id) => navigate(`/projects/${id}`)} onViewAll={() => navigate("/projects")} />

      {/* Who is doing what */}
      {analytics && (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
          <TopAgents agents={analytics.byAgent || []} scope={scope} onSelect={(id) => { setFilterMemberId(""); setFocusId(id); }} />
          <TeamActivity items={analytics.recentActivity || []} onOpenLead={(id) => navigate("/leads", { state: { openLeadId: id } })} />
        </div>
      )}
      <AgentStatusToday team={teamToday} onOpenAttendance={() => navigate("/attendance")} />

      <PerformanceLeadsModal
        drill={drill} hidden={!!detailLead}
        dateFrom={dateFrom} dateTo={dateTo}
        onClose={closeDrill}
        onOpenLead={setDetailLead}
        version={listVersion}
      />
      <LeadDetail
        open={!!detailLead}
        onClose={() => { setDetailLead(null); if (drillDirty) setListVersion((v) => v + 1); }}
        lead={detailLead}
        onUpdated={(u) => { setDetailLead((cur) => ({ ...cur, ...u })); setDrillDirty(true); }}
      />

      {!displayMembers.length && (
        <section className="card p-6 text-sm text-app-soft flex items-center gap-3">
          <BarChart3 className="h-4 w-4" /> {filterMemberId ? "No data for this agent." : "No performance data available yet."}
        </section>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note, onClick }) {
  const clickable = !!onClick && value > 0;
  return (
    <div className={`card p-5 ${clickable ? "cursor-pointer transition hover:border-orange-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60" : ""}`}
      {...(clickable ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } } : {})}>
      <div className="flex items-center justify-between gap-4">
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

// The Leads page reads these from navigation state, so a source clicked here
// opens Leads showing exactly the leads it counted.
function leadsRangeState(range) {
  if (range && typeof range === "object") return { presetFrom: range.from || "", presetTo: range.to || "" };
  return range ? { presetDateRange: range } : {};
}

// One number in the team table. A number above zero opens the leads behind it.
function Num({ value, label, onOpen, tone = "" }) {
  const n = value || 0;
  if (!n) return <span className="text-app-soft">0</span>;
  if (!onOpen) return <span className={tone || "text-app"}>{n.toLocaleString("en-IN")}</span>;
  return (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${n}. View leads`}
      className={`rounded-md px-1 font-semibold underline-offset-2 transition hover:underline hover:text-orange-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 ${tone || "text-app"}`}>
      {n.toLocaleString("en-IN")}
    </button>
  );
}

// Per-person numbers: one row each, main pipeline and project pipeline side
// by side. Replaces the tall card of tiles per person (same numbers, same
// drill-downs). Scrolls sideways on narrow screens with the name pinned.
// The call columns are each person's own calls over the last 30 days; the
// day-by-day chart lives on the Calls page only (owner, 31 Oct 2026: no
// duplicate of the Calls page here).
function TeamTable({ members, focusId, openDrill, calls, onOpenCalls }) {
  const callsOf = new Map((calls || []).map((c) => [String(c.userId), c]));
  const talk = (secs) => (secs > 0 ? (secs >= 60 ? `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s` : `${Math.round(secs)}s`) : null);
  const th = "px-2.5 py-2 text-right font-semibold whitespace-nowrap";
  const td = "px-2.5 py-2.5 text-right tabular-nums whitespace-nowrap";
  const groupStart = { borderLeft: "1px solid var(--app-border)" };
  const pinned = { background: "var(--app-surface-solid)" };
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--app-border)" }}>
        <h2 className="text-sm font-bold text-app">Each person</h2>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-app-soft">Click a number to see those leads.</p>
          {calls && (
            <button type="button" onClick={onOpenCalls} className="text-xs font-semibold hover:underline" style={{ color: "var(--app-primary)" }}>
              See all calls →
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-xs">
          <thead>
            <tr className="text-app-soft" style={{ background: "var(--app-surface-low)" }}>
              <th rowSpan={2} className="sticky left-0 z-[2] px-4 py-2 text-left font-semibold align-bottom"
                // Solid, so columns scrolled under the pinned name never show through.
                style={{ background: "linear-gradient(var(--app-surface-low), var(--app-surface-low)), var(--app-surface-solid)" }}>Person</th>
              <th colSpan={6} className="px-2.5 pt-2 pb-1 text-left font-bold text-app" style={groupStart}>
                <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-orange-500" /> Main pipeline</span>
              </th>
              <th colSpan={8} className="px-2.5 pt-2 pb-1 text-left font-bold text-app" style={groupStart}>
                <span className="inline-flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5 text-blue-500" /> Project pipeline</span>
              </th>
              <th colSpan={3} className="px-2.5 pt-2 pb-1 text-left font-bold text-app" style={groupStart}>
                <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-orange-500" /> Calls <span className="font-normal text-app-soft">· last 30 days</span></span>
              </th>
            </tr>
            <tr className="text-app-soft" style={{ background: "var(--app-surface-low)" }}>
              <th className={th} style={groupStart}>Assigned</th>
              <th className={th}>New</th>
              <th className={th}>Site visit</th>
              <th className={th}>Closed won</th>
              <th className={th}>Conversion</th>
              <th className={th}>Avg response</th>
              <th className={th} style={groupStart}>Assigned</th>
              <th className={th}>Interested</th>
              <th className={th}>Site visit</th>
              <th className={th}>Booked</th>
              <th className={th}>Call back</th>
              <th className={th}>Not interested</th>
              <th className={th}>Not reachable</th>
              <th className={th}>Booking rate</th>
              <th className={th} style={groupStart}>Made</th>
              <th className={th}>Answered</th>
              <th className={th}>Avg talk</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const p  = m.pipeline || {};
              const pr = m.project  || {};
              const focused = focusId === m._id;
              const open = (pipeline, metric, label) => () =>
                openDrill(`${m.name} · ${pipeline === "main" ? "Main Pipeline" : "Project Pipeline"} · ${label}`, { userId: m._id, pipeline, metric });
              return (
                <tr key={m._id} id={`perf-row-${m._id}`} className={focused ? "bg-orange-500/5" : ""}
                  style={{ borderTop: "1px solid var(--app-border)", ...(focused ? { boxShadow: "inset 3px 0 0 #f97316" } : {}) }}>
                  <td className="sticky left-0 z-[1] px-4 py-2.5" style={pinned}>
                    <div className="flex items-center gap-2.5 min-w-[160px] max-w-[220px]">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover border" style={{ borderColor: "var(--app-border)" }} />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-xs font-bold text-orange-500">
                          {m.name?.[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-app" title={m.email || undefined}>{m.name}</span>
                        <span className="block truncate text-[11px] text-app-soft capitalize">
                          {String(m.role || "").replace("_", " ")}{m.isActive ? "" : " · Inactive"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className={td} style={groupStart}><Num value={p.totalAssigned} label="Main pipeline assigned" onOpen={open("main", "assigned", "Assigned")} /></td>
                  <td className={td}><Num value={p.newLeads} label="Main pipeline new" onOpen={open("main", "new", "New")} /></td>
                  <td className={td}><Num value={p.siteVisits} label="Main pipeline site visit" onOpen={open("main", "siteVisit", "Site Visit")} /></td>
                  <td className={td}><Num value={p.closedWon} label="Main pipeline closed won" tone="text-green-500" onOpen={open("main", "closedWon", "Closed Won")} /></td>
                  <td className={td}>{p.totalAssigned > 0 ? <span className="font-semibold text-orange-500">{p.conversionRate || 0}%</span> : <span className="text-app-soft">—</span>}</td>
                  <td className={td}>{p.avgResponseTime && p.avgResponseTime !== "-" ? <span className="text-blue-400">{p.avgResponseTime}</span> : <span className="text-app-soft">—</span>}</td>
                  <td className={td} style={groupStart}><Num value={pr.totalAssigned} label="Project pipeline assigned" onOpen={open("project", "assigned", "Assigned")} /></td>
                  <td className={td}><Num value={pr.interested} label="Project pipeline interested" onOpen={open("project", "interested", "Interested")} /></td>
                  <td className={td}>
                    <Num value={pr.siteVisits} label="Project pipeline site visit" onOpen={open("project", "siteVisit", "Site Visit")} />
                    {pr.siteVisitDone > 0 && <span className="block text-[10px] font-semibold text-teal-500">{pr.siteVisitDone} done</span>}
                  </td>
                  <td className={td}><Num value={pr.booked} label="Project pipeline booked" tone="text-green-500" onOpen={open("project", "booked", "Booked")} /></td>
                  <td className={td}><Num value={pr.callBack} label="Project pipeline call back" onOpen={open("project", "callBack", "Call Back")} /></td>
                  <td className={td}><Num value={pr.notInterested} label="Project pipeline not interested" onOpen={open("project", "notInterested", "Not Interested")} /></td>
                  <td className={td}><Num value={pr.notReachable} label="Project pipeline not reachable" onOpen={open("project", "notReachable", "Not Reachable")} /></td>
                  <td className={td}>{pr.totalAssigned > 0 ? <span className="font-semibold text-blue-500">{pr.conversionRate || 0}%</span> : <span className="text-app-soft">—</span>}</td>
                  {(() => {
                    const c = callsOf.get(String(m._id));
                    const avg = c?.answered ? talk(c.talkSeconds / c.answered) : null;
                    return (
                      <>
                        <td className={td} style={groupStart}>{c?.made ? <span className="font-semibold text-app">{c.made}</span> : <span className="text-app-soft">—</span>}</td>
                        <td className={td}>{c?.made ? <span className="text-app">{c.answered}<span className="text-app-soft"> ({Math.round((c.answered / c.made) * 100)}%)</span></span> : <span className="text-app-soft">—</span>}</td>
                        <td className={td}>{avg ? <span className="text-app">{avg}</span> : <span className="text-app-soft">—</span>}</td>
                      </>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const LIST_LIMIT = 50;

function PerformanceLeadsModal({ drill, dateFrom, dateTo, onClose, onOpenLead, version, hidden }) {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const key = drill ? `${drill.userId}|${drill.pipeline}|${drill.metric}` : "";

  // A different tile means a different list, so start from page 1.
  useEffect(() => { setPage(1); setRows([]); setTotal(0); }, [key]);

  useEffect(() => {
    if (!drill) return;
    let cancelled = false;
    setLoading(true); setError(false);
    api.get("/auth/performance/leads", {
      params: {
        metric: drill.metric,
        ...(drill.userId && { userId: drill.userId }),
        ...(drill.pipeline && { pipeline: drill.pipeline }),
        ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }),
        page, limit: LIST_LIMIT,
      },
    }).then(({ data }) => {
      if (cancelled) return;
      setRows(data.leads || []); setTotal(data.total || 0); setPages(data.pages || 1);
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, page, dateFrom, dateTo, version]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={!!drill && !hidden} onClose={onClose} size="xl"
      title={drill ? `${drill.title}${loading && !rows.length ? "" : ` (${total.toLocaleString("en-IN")})`}` : ""}>
      {error ? (
        <p className="py-10 text-center text-sm text-app-soft">Couldn't load these leads. Close and try again.</p>
      ) : loading && !rows.length ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "var(--app-surface-low)" }} />)}</div>
      ) : !rows.length ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Inbox className="h-10 w-10 text-app-soft opacity-40 mb-3" />
          <p className="text-sm font-medium text-app">No leads here</p>
          <p className="text-xs text-app-soft mt-1">Nothing matches this number for the selected dates.</p>
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {rows.map((lead) => {
            const stage = lead._type === "project" ? lead.booking : lead.status;
            return (
              <button key={`${lead._type}-${lead._id}`} type="button" onClick={() => onOpenLead(lead)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:border-orange-400/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app">{lead.name || "Unnamed lead"}</p>
                  <p className="truncate text-xs text-app-soft">
                    {[lead.phone, lead._type === "project" ? lead.projectName : lead.source, lead.assignedToName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {stage && <div className="shrink-0"><StatusBadge status={stage} /></div>}
                <ChevronRight className="h-4 w-4 shrink-0 text-app-soft" />
              </button>
            );
          })}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-app-soft">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary rounded-xl px-2.5 py-1.5 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button className="btn-secondary rounded-xl px-2.5 py-1.5 disabled:opacity-40" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </Modal>
  );
}
