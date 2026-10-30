// The deeper team and goal sections. They used to sit on the Dashboard; since
// 30 Oct 2026 they live on the Performance page so the Dashboard stays a short
// morning view. Data still comes from /leads/analytics, /projects/stats and
// /attendance/team-today, unchanged.
import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Building2, Check, ChevronDown, Pencil, Target, TrendingUp, X } from "lucide-react";
import api from "../../services/api";
import { InfoTip } from "../Tooltip";

const istTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

function fmtINR(val) {
  if (!val) return "₹0";
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)}Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

// ── Top agents (leads assigned in the selected dates) ────────────────────────
export function TopAgents({ agents = [], scope = "", onSelect }) {
  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
          Top agents
          <InfoTip text="The people with the most leads assigned from these dates. Deactivated users are left out." />
        </h3>
        {scope && <span className="stitch-pill min-w-0 max-w-[60%] truncate text-xs">{scope}</span>}
      </div>
      {agents.length === 0 ? (
        <p className="text-sm text-app-soft py-4">No agent activity yet.</p>
      ) : (
        <ol className="space-y-1">
          {agents.slice(0, 5).map((agent, index) => (
            <li key={agent._id}>
              <button type="button" onClick={() => onSelect?.(agent._id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--app-surface-low)]">
                <span className="w-4 text-xs font-bold text-app-soft tabular-nums">{index + 1}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">
                  {agent.name?.[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-app">{agent.name}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-app">{agent.count}<span className="ml-1 text-xs font-normal text-app-soft">leads</span></span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Team activity (last 10 actions) ──────────────────────────────────────────
const TYPE_COLOR = {
  status_changed: "#f59e0b", called: "#22c55e", site_visit: "#8b5cf6",
  note_added: "#06b6d4", assigned: "#3b82f6", follow_up_set: "#f97316",
  created: "#ff6b00", emailed: "#ec4899",
};
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function TeamActivity({ items = [], onOpenLead }) {
  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
          Team activity
          <InfoTip text="The 10 most recent actions on your leads: calls, status changes, notes, assignments. Click one to open the lead." />
        </h3>
        <span className="stitch-pill text-xs">Last 10 actions</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-app-soft py-4">No activity recorded yet.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <button key={i} type="button" onClick={() => onOpenLead?.(item.leadId)}
              className="w-full flex items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-orange-500/5 transition">
              <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLOR[item.type] || "#6b7280" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-app leading-snug">
                  <span className="font-semibold">{item.performedByName || "System"}</span>
                  <span className="text-app-soft"> · {item.description}</span>
                </span>
                <span className="block text-[10px] text-app-soft mt-0.5">{item.leadName} · {timeAgo(item.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Monthly closing goal ─────────────────────────────────────────────────────
export function MonthlyGoal({ goal, current, role, onGoalUpdate }) {
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
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <Target className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-app">Monthly goal</h3>
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
            {canEdit ? "No goal set. Click the pencil to set a monthly closing target." : "No monthly goal set."}
          </span>
        )}

        {canEdit && (
          editing ? (
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" min="1" value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="input w-20 text-center text-sm py-1" placeholder="Target" aria-label="Monthly closing target"
                autoFocus />
              <button type="button" onClick={save} disabled={saving} aria-label="Save goal"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setEditing(false)} aria-label="Cancel"
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-3.5 h-3.5 text-app-soft" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setEditing(true); setVal(String(goal || "")); }}
              title="Set monthly goal" aria-label="Set monthly goal"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 shrink-0">
              <Pencil className="w-3.5 h-3.5 text-app-soft" />
            </button>
          )
        )}
      </div>
    </section>
  );
}

// ── Revenue & closing pace (only once there is a closed deal to project from) ─
export function ClosingPace({ data, goal }) {
  if (!data) return null;
  // Day of the month in IST, whatever the browser's timezone.
  const ist = new Date(Date.now() + 5.5 * 3600000);
  const dayOfMonth  = ist.getUTCDate();
  const daysInMonth = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
  const pace        = dayOfMonth > 0 ? Math.round(((data.thisMonthClosedWon || 0) / dayOfMonth) * daysInMonth) : 0;
  const onTrack     = goal > 0 ? pace >= goal : null;
  const expectedRev = data.pipelineValue && data.conversionRate
    ? Math.round((data.pipelineValue * data.conversionRate) / 100)
    : 0;
  const monthUp = (data.thisMonthLeads || 0) >= (data.lastMonthSamePeriodLeads || 0);

  const Tile = ({ label, children, note, noteClass = "text-app-soft" }) => (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
      <p className="text-[10px] text-app-soft font-semibold">{label}</p>
      {children}
      <p className={`text-[10px] ${noteClass}`}>{note}</p>
    </div>
  );

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
          Revenue and closing pace
          <InfoTip text="This month so far, compared with the same number of days last month. Projected pace: closings this month at today's rate." />
        </h3>
        <TrendingUp className="h-4 w-4 text-indigo-400 shrink-0" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Expected revenue" note={expectedRev ? `At ${data.conversionRate}% conversion` : "Needs a closed deal to project from"}>
          <p className="text-lg font-black text-emerald-500 leading-none">{expectedRev ? fmtINR(expectedRev) : "—"}</p>
        </Tile>
        <Tile label="Leads this month" noteClass={`font-semibold ${monthUp ? "text-emerald-500" : "text-red-400"}`}
          note={(data.lastMonthSamePeriodLeads || 0) === 0 ? "Same days last month: 0" : `${monthUp ? "↑" : "↓"} vs ${data.lastMonthSamePeriodLeads} same days last month`}>
          <p className="text-lg font-black text-indigo-400 leading-none">{data.thisMonthLeads || 0}</p>
        </Tile>
        <Tile label="Closings vs last month" note="This month / same days last month">
          <p className="text-lg font-black text-orange-500 leading-none">{data.thisMonthClosedWon || 0} <span className="text-sm font-normal text-app-soft">/ {data.lastMonthSamePeriodClosedWon || 0}</span></p>
        </Tile>
        <Tile label="Projected pace" note={onTrack === null ? "No goal set" : onTrack ? "↑ On track" : "↓ Behind pace"}
          noteClass={onTrack === null ? "text-app-soft" : onTrack ? "text-emerald-500" : "text-red-400"}>
          <p className={`text-lg font-black leading-none ${onTrack === null ? "text-app" : onTrack ? "text-emerald-500" : "text-red-400"}`}>{pace}</p>
        </Tile>
      </div>
    </section>
  );
}

// ── Project-wise leads ───────────────────────────────────────────────────────
export function ProjectBreakdown({ projects, onOpenProject, onViewAll }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!projects || projects.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: collapsed ? "none" : "1px solid var(--app-border)" }}>
        <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-app leading-tight">Project-wise leads</h3>
          <p className="text-[11px] text-app-soft">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onViewAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-app-soft hover:text-app transition rounded-lg px-2.5 py-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            View all <ArrowRight className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed} aria-label={collapsed ? "Show projects" : "Hide projects"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
            <ChevronDown className={`h-4 w-4 text-app-soft transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-1">
          {projects.slice(0, 6).map((p) => {
            const pct = p.totalLeads > 0 ? Math.min(100, Math.round((p.closedWon / p.totalLeads) * 100)) : 0;
            return (
              <button key={String(p._id)} type="button" onClick={() => onOpenProject?.(p._id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-orange-500/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-app truncate">{p.name}</p>
                    <span className="text-xs font-bold text-app shrink-0">{p.totalLeads} leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 50 ? "#22c55e" : "#f97316" }} />
                    </div>
                    <span className="text-[10px] text-app-soft shrink-0">{pct}% won</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Who is clocked in today ──────────────────────────────────────────────────
export function AgentStatusToday({ team, onOpenAttendance }) {
  if (!team || team.length === 0) return null;
  const clocked = team.filter((m) => m.attendance?.clockIn && !m.attendance?.clockOut);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-app">Clocked in today</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}>
            {clocked.length} in now
          </span>
          <button type="button" onClick={onOpenAttendance}
            className="text-[11px] font-semibold text-app-soft hover:text-app transition rounded-lg px-2.5 py-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            Attendance →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {team.map((member) => {
          const isIn  = member.attendance?.clockIn && !member.attendance?.clockOut;
          const isDone = member.attendance?.clockIn && member.attendance?.clockOut;
          return (
            <div key={member.user._id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="relative flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: isIn ? "rgba(34,197,94,0.15)" : isDone ? "rgba(99,102,241,0.12)" : "rgba(107,114,128,0.12)",
                           color: isIn ? "#22c55e" : isDone ? "#6366f1" : "#6b7280" }}>
                  {member.user.name?.[0]?.toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: isIn ? "#22c55e" : isDone ? "#6366f1" : "#6b7280", borderColor: "var(--app-surface-low)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-app truncate">{member.user.name}</p>
                <p className="text-[10px] text-app-soft truncate">
                  {isIn ? `In since ${istTime(member.attendance.clockIn)}` : isDone ? "Done for today" : "Not checked in"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
