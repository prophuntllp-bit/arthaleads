import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Spinner, EmptyState, AppSelect, AppDatePicker } from "../components/UI";
import UpgradeWall from "../components/UpgradeWall";
import { canAccess } from "../utils/plan";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Clock, ChevronLeft, ChevronRight, CalendarDays,
  Users, Timer, CheckCircle2, LogIn, Filter,
  Download, PlusCircle, X, Edit3, Settings, AlertTriangle,
} from "lucide-react";

function pad(n) { return String(n).padStart(2, "0"); }

function fmtTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", weekday: "short",
  });
}

function fmtDuration(mins) {
  if (mins == null) return "-";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function LiveTimer({ since }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!since) { setSecs(0); return; }
    setSecs(Math.floor((Date.now() - new Date(since)) / 1000));
    const iv = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [since]);
  return (
    <span className="tabular-nums">
      {pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}
    </span>
  );
}

function StatusBadge({ a }) {
  const isIn  = a?.clockIn && !a?.clockOut;
  const isOut = a?.clockIn && a?.clockOut;
  if (isOut) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
      <CheckCircle2 className="w-3 h-3" /> Done
    </span>
  );
  if (isIn) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
      Absent
    </span>
  );
}

function DayTypeBadge({ dayType, totalMinutes, clockIn, clockOut }) {
  if (!clockIn) return null;
  if (clockIn && !clockOut) return null; // still active — no badge yet
  if (dayType === "full") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
      Full Day
    </span>
  );
  if (dayType === "half") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
      Half Day
    </span>
  );
  if (dayType === "short") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
      Short Day
    </span>
  );
  return null;
}

function LateBadge({ isLate, lateByMinutes }) {
  if (!isLate) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
      <AlertTriangle className="w-2.5 h-2.5" />
      Late {lateByMinutes ? `+${fmtDuration(lateByMinutes)}` : ""}
    </span>
  );
}

function EarlyLeaveBadge({ isEarlyLeave, earlyLeaveByMinutes }) {
  if (!isEarlyLeave) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
      <AlertTriangle className="w-2.5 h-2.5" />
      Early {earlyLeaveByMinutes ? `-${fmtDuration(earlyLeaveByMinutes)}` : ""}
    </span>
  );
}

const EMPTY_ENTRY = { userId: "", date: todayStr(), clockIn: "", clockOut: "", note: "" };
const DEFAULT_SETTINGS = { shiftStartTime: "09:30", shiftEndTime: "19:00", bufferMinutes: 15, halfDayMinutes: 240, fullDayMinutes: 480 };

export default function Attendance() {
  const { user, org } = useAuth();
  if (!canAccess(org, "growth")) {
    return <UpgradeWall org={org} feature="Attendance Tracking"
      description="Track your team's clock-in/out times, view daily summaries, and monitor attendance history." />;
  }
  const isAdmin = ["admin", "manager", "super_admin"].includes(user?.role);

  // Today's own status
  const [status, setStatus]             = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [clocking, setClocking]         = useState(false);

  // Records list
  const [records, setRecords]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [listLoading, setListLoading] = useState(false);

  // Team today
  const [teamToday, setTeamToday]     = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Team member list
  const [teamMembers, setTeamMembers] = useState([]);

  // Filters
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [to, setTo]             = useState(todayStr);
  const [filterUser, setFilterUser] = useState("");
  const [tab, setTab]           = useState("team");

  // Admin entry modal
  const [entryModal, setEntryModal]     = useState(false);
  const [entryForm, setEntryForm]       = useState(EMPTY_ENTRY);
  const [entrySaving, setEntrySaving]   = useState(false);

  // Shift settings modal
  const [settingsModal, setSettingsModal] = useState(false);
  const [shiftSettings, setShiftSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving]   = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const r = await api.get("/attendance/status");
      setStatus(r.data.data);
    } catch { /**/ }
    finally { setStatusLoading(false); }
  }, []);

  const fetchRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 60 });
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      if (filterUser) params.set("userId", filterUser);
      const r = await api.get(`/attendance?${params}`);
      setRecords(r.data.data || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch { toast.error("Failed to load records"); }
    finally { setListLoading(false); }
  }, [page, from, to, filterUser]);

  const fetchTeamToday = useCallback(async () => {
    if (!isAdmin) return;
    setTeamLoading(true);
    try {
      const r = await api.get("/attendance/team-today");
      setTeamToday(r.data.data || []);
    } catch { /**/ }
    finally { setTeamLoading(false); }
  }, [isAdmin]);

  const fetchTeamMembers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await api.get("/auth/users");
      setTeamMembers(r.data.users || r.data.data || []);
    } catch { /**/ }
  }, [isAdmin]);

  const fetchShiftSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const r = await api.get("/org/me/attendance-settings");
      setShiftSettings({ ...DEFAULT_SETTINGS, ...r.data.settings });
    } catch { /**/ }
    finally { setSettingsLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchTeamToday(); fetchTeamMembers(); }, [fetchTeamToday, fetchTeamMembers]);
  useEffect(() => { setPage(1); }, [from, to, filterUser]);
  useEffect(() => { if (!isAdmin) setTab("records"); }, [isAdmin]);
  useEffect(() => { if (isAdmin) fetchShiftSettings(); }, [isAdmin, fetchShiftSettings]);

  const handleClockIn = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockin");
      setStatus(r.data.data);
      toast.success("Clocked in successfully!");
      fetchTeamToday(); fetchRecords();
    } catch (e) { toast.error(e.response?.data?.message || "Clock in failed"); }
    finally { setClocking(false); }
  };

  const handleClockOut = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockout");
      setStatus(r.data.data);
      toast.success("Clocked out! Great work today.");
      fetchTeamToday(); fetchRecords();
    } catch (e) { toast.error(e.response?.data?.message || "Clock out failed"); }
    finally { setClocking(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      if (filterUser) params.set("userId", filterUser);
      const r = await api.get(`/attendance/export?${params}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "text/csv" }));
      const a = document.createElement("a");
      const label = from && to ? `${from}_to_${to}` : "all";
      a.href = url; a.download = `attendance_${label}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  const handleAdminEntry = async (e) => {
    e.preventDefault();
    setEntrySaving(true);
    try {
      const toIso = (date, time) => time ? new Date(`${date}T${time}:00`).toISOString() : null;
      await api.post("/attendance/admin-entry", {
        userId:   entryForm.userId,
        date:     entryForm.date,
        clockIn:  toIso(entryForm.date, entryForm.clockIn),
        clockOut: toIso(entryForm.date, entryForm.clockOut),
        note:     entryForm.note,
      });
      toast.success("Attendance record saved");
      setEntryModal(false);
      setEntryForm(EMPTY_ENTRY);
      fetchRecords(); fetchTeamToday();
    } catch (e) { toast.error(e.response?.data?.message || "Failed to save entry"); }
    finally { setEntrySaving(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.patch("/org/me/attendance-settings", shiftSettings);
      toast.success("Shift settings saved");
      setSettingsModal(false);
    } catch (e) { toast.error(e.response?.data?.message || "Failed to save settings"); }
    finally { setSettingsSaving(false); }
  };

  const isClockedIn  = status?.clockIn && !status?.clockOut;
  const isClockedOut = status?.clockIn && status?.clockOut;

  // Summary from loaded records
  const summary = (() => {
    if (!records.length) return null;
    const totalMins   = records.reduce((s, r) => s + (r.totalMinutes || 0), 0);
    const daysPresent = records.filter(r => r.clockIn).length;
    const lateCount   = records.filter(r => r.isLate).length;
    const fullDays    = records.filter(r => r.dayType === "full").length;
    const halfDays    = records.filter(r => r.dayType === "half").length;
    const avgMins     = daysPresent ? Math.round(totalMins / daysPresent) : 0;
    return { totalMins, daysPresent, lateCount, fullDays, halfDays, avgMins };
  })();

  return (
    <div className="stitch-page">

      {/* ── Top bar ── */}
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10">
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-app leading-none">Attendance</h1>
            <p className="text-xs text-app-soft mt-0.5">
              Shift: {shiftSettings.shiftStartTime} - {shiftSettings.shiftEndTime} · {shiftSettings.bufferMinutes}m grace ·{" "}
              {(shiftSettings.halfDayMinutes / 60).toFixed(1)}h half · {(shiftSettings.fullDayMinutes / 60).toFixed(1)}h full
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shift settings (admin only) */}
          {isAdmin && (
            <button onClick={() => setSettingsModal(true)}
              className="p-2 rounded-xl border text-app-soft hover:text-orange-500 hover:border-orange-400 transition cursor-pointer"
              style={{ borderColor: "var(--app-border)" }} title="Shift Settings">
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Clock in/out */}
          {statusLoading ? (
            <Spinner size="sm" />
          ) : isClockedOut ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-app-soft">Done —</span>
              <span className="text-app font-semibold">{fmtDuration(status.totalMinutes)}</span>
              {status.dayType && <DayTypeBadge dayType={status.dayType} clockIn={status.clockIn} clockOut={status.clockOut} />}
            </div>
          ) : isClockedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {status.isLate && <LateBadge isLate={status.isLate} lateByMinutes={status.lateByMinutes} />}
                <span className="text-green-500 font-bold text-sm"><LiveTimer since={status.clockIn} /></span>
              </div>
              <button onClick={handleClockOut} disabled={clocking} className="btn-danger py-2 px-4 text-sm">
                {clocking ? <Spinner size="sm" /> : null} Clock Out
              </button>
            </div>
          ) : (
            <button onClick={handleClockIn} disabled={clocking} className="btn-primary py-2 px-5 text-sm">
              {clocking ? <Spinner size="sm" /> : <LogIn className="h-4 w-4" />} Clock In
            </button>
          )}
        </div>
      </div>

      {/* ── Today's own status cards ── */}
      {!statusLoading && status && (
        <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Clock In",  value: fmtTime(status.clockIn),  color: "text-green-500" },
            { label: "Clock Out", value: fmtTime(status.clockOut), color: "text-red-400" },
            { label: "Duration",  value: isClockedOut ? fmtDuration(status.totalMinutes) : isClockedIn ? "Active" : "-", color: "text-orange-500" },
            { label: "Status",    value: status.isLate ? `Late +${fmtDuration(status.lateByMinutes)}` : isClockedIn ? "On time" : isClockedOut ? (status.dayType === "full" ? "Full Day" : status.dayType === "half" ? "Half Day" : "Short Day") : "-", color: status.isLate ? "text-orange-500" : "text-app" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="pt-4">
        <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          {isAdmin && (
            <button onClick={() => setTab("team")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === "team" ? "text-white shadow-sm" : "text-app-soft hover:text-app"}`}
              style={tab === "team" ? { background: "var(--app-primary)" } : {}}>
              <Users className="w-3.5 h-3.5" /> Team Today
            </button>
          )}
          <button onClick={() => setTab("records")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === "records" ? "text-white shadow-sm" : "text-app-soft hover:text-app"}`}
            style={tab === "records" ? { background: "var(--app-primary)" } : {}}>
            <CalendarDays className="w-3.5 h-3.5" /> {isAdmin ? "All Records" : "My Records"}
          </button>
        </div>
      </div>

      {/* ── Team Today tab ── */}
      {tab === "team" && isAdmin && (
        <div className="pt-4 pb-6">
          {teamLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-sm font-bold text-app">Today's Attendance</p>
                <span className="stitch-kicker">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                      {["Member", "Clock In", "Clock Out", "Hours", "Day Type", "Status"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-app-soft">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamToday.map(({ user: u, attendance: a }) => {
                      const isIn  = a?.clockIn && !a?.clockOut;
                      const isOut = a?.clockIn && a?.clockOut;
                      return (
                        <tr key={u._id} className="border-b hover:bg-orange-500/5 transition" style={{ borderColor: "var(--app-border)" }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold flex-shrink-0">
                                {u.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-app">{u.name}</p>
                                <p className="text-app-soft text-[10px] capitalize">{u.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {a?.clockIn ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-green-500 font-semibold">{fmtTime(a.clockIn)}</span>
                                <LateBadge isLate={a?.isLate} lateByMinutes={a?.lateByMinutes} />
                              </div>
                            ) : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-5 py-3">
                            {a?.clockOut ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-red-400 font-semibold">{fmtTime(a.clockOut)}</span>
                                <EarlyLeaveBadge isEarlyLeave={a?.isEarlyLeave} earlyLeaveByMinutes={a?.earlyLeaveByMinutes} />
                              </div>
                            ) : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-5 py-3 font-bold text-app">
                            {isOut ? fmtDuration(a.totalMinutes)
                              : isIn ? <span className="text-green-500"><LiveTimer since={a.clockIn} /></span>
                              : "-"}
                          </td>
                          <td className="px-5 py-3">
                            <DayTypeBadge dayType={a?.dayType} clockIn={a?.clockIn} clockOut={a?.clockOut} />
                          </td>
                          <td className="px-5 py-3"><StatusBadge a={a} /></td>
                        </tr>
                      );
                    })}
                    {teamToday.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-app-soft text-xs">No team members found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Records tab ── */}
      {tab === "records" && (
        <div className="pt-4 pb-6">

          {/* Summary strip */}
          {summary && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
              {[
                { label: "Total Hours",   value: fmtDuration(summary.totalMins),  color: "text-orange-500" },
                { label: "Days Present",  value: summary.daysPresent,             color: "text-green-500" },
                { label: "Avg Hours/Day", value: fmtDuration(summary.avgMins),    color: "text-blue-500" },
                { label: "Full Days",     value: summary.fullDays,                color: "text-emerald-500" },
                { label: "Half Days",     value: summary.halfDays,                color: "text-amber-500" },
                { label: "Late",          value: summary.lateCount,               color: "text-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1">{label}</p>
                  <p className={`text-sm font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters + actions */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <Filter className="w-4 h-4 text-app-soft flex-shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">From</label>
              <AppDatePicker value={from} onChange={v => { setFrom(v); setPage(1); }} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">To</label>
              <AppDatePicker value={to} onChange={v => { setTo(v); setPage(1); }} className="w-36" />
            </div>
            {isAdmin && teamMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-app-soft font-medium">Member</label>
                <AppSelect
                  value={filterUser}
                  onChange={v => { setFilterUser(v); setPage(1); }}
                  placeholder="All members"
                  options={[{ value: "", label: "All members" }, ...teamMembers.map(m => ({ value: m._id, label: `${m.name} (${m.role})` }))]}
                  className="w-44"
                  triggerClassName="text-xs py-1.5"
                />
              </div>
            )}
            <span className="text-xs text-app-soft">{total} record{total !== 1 ? "s" : ""}</span>

            <div className="ml-auto flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => { setEntryForm({ ...EMPTY_ENTRY, date: todayStr() }); setEntryModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 cursor-pointer"
                  style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}>
                  <PlusCircle className="w-3.5 h-3.5" /> Add Entry
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition hover:opacity-90 cursor-pointer"
                  style={{ background: "var(--app-primary)" }}>
                  {exporting ? <Spinner size="sm" /> : <Download className="w-3.5 h-3.5" />}
                  Download Report
                </button>
              )}
            </div>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : records.length === 0 ? (
            <EmptyState icon={Timer} title="No attendance records" desc="No records found for the selected filters." />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[780px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                      {[
                        "Date",
                        ...(isAdmin ? ["Member"] : []),
                        "Clock In", "Clock Out", "Duration", "Day Type", "Status", "Note",
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-app-soft">{h}</th>
                      ))}
                      {isAdmin && <th className="px-3 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => {
                      const isIn  = rec.clockIn && !rec.clockOut;
                      return (
                        <tr key={rec._id} className="border-b hover:bg-orange-500/5 transition" style={{ borderColor: "var(--app-border)" }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-app whitespace-nowrap">{fmtDate(rec.date)}</p>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 text-[10px] font-bold flex-shrink-0">
                                  {rec.userId?.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-app">{rec.userId?.name}</p>
                                  <p className="text-app-soft capitalize text-[10px]">{rec.userId?.role}</p>
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-green-500 font-semibold">{fmtTime(rec.clockIn)}</span>
                              <LateBadge isLate={rec.isLate} lateByMinutes={rec.lateByMinutes} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {rec.clockOut ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-red-400 font-semibold">{fmtTime(rec.clockOut)}</span>
                                <EarlyLeaveBadge isEarlyLeave={rec.isEarlyLeave} earlyLeaveByMinutes={rec.earlyLeaveByMinutes} />
                              </div>
                            ) : isIn
                              ? <span className="text-green-500 font-bold"><LiveTimer since={rec.clockIn} /></span>
                              : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-app">{fmtDuration(rec.totalMinutes)}</td>
                          <td className="px-4 py-3">
                            <DayTypeBadge dayType={rec.dayType} clockIn={rec.clockIn} clockOut={rec.clockOut} />
                          </td>
                          <td className="px-4 py-3"><StatusBadge a={rec} /></td>
                          <td className="px-4 py-3 text-app-soft max-w-[140px] truncate">{rec.note || "-"}</td>
                          {isAdmin && (
                            <td className="px-3 py-3">
                              <button
                                onClick={() => {
                                  const toLocalTime = (d) => {
                                    if (!d) return "";
                                    const dt = new Date(d);
                                    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
                                  };
                                  setEntryForm({
                                    userId:   rec.userId?._id || rec.userId || "",
                                    date:     rec.date,
                                    clockIn:  toLocalTime(rec.clockIn),
                                    clockOut: toLocalTime(rec.clockOut),
                                    note:     rec.note || "",
                                  });
                                  setEntryModal(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-orange-500/10 text-app-soft hover:text-orange-500 transition cursor-pointer"
                                title="Edit entry">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-xs text-app-soft">Page {page} of {pages} · {total} total</p>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition cursor-pointer"
                      disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4 text-app" />
                    </button>
                    <span className="text-xs font-semibold text-app px-2">{page}</span>
                    <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition cursor-pointer"
                      disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4 text-app" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Shift Settings Modal ── */}
      {settingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSettingsModal(false); }}>
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-app flex items-center gap-2">
                <Settings className="w-4 h-4 text-orange-500" /> Shift & Attendance Settings
              </h2>
              <button onClick={() => setSettingsModal(false)}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-app-soft cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {settingsLoading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> : (
              <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Office Start Time</label>
                    <input type="time" className="input" value={shiftSettings.shiftStartTime}
                      onChange={e => setShiftSettings(s => ({ ...s, shiftStartTime: e.target.value }))} required />
                    <p className="text-xs text-app-soft mt-1">Expected clock-in time.</p>
                  </div>
                  <div>
                    <label className="label">Office End Time</label>
                    <input type="time" className="input" value={shiftSettings.shiftEndTime || "19:00"}
                      onChange={e => setShiftSettings(s => ({ ...s, shiftEndTime: e.target.value }))} required />
                    <p className="text-xs text-app-soft mt-1">Expected clock-out time.</p>
                  </div>
                </div>

                <div>
                  <label className="label">Grace / Buffer Period (minutes)</label>
                  <input type="number" className="input" min={0} max={120} value={shiftSettings.bufferMinutes}
                    onChange={e => setShiftSettings(s => ({ ...s, bufferMinutes: parseInt(e.target.value) || 0 }))} required />
                  <p className="text-xs text-app-soft mt-1">
                    Clock-ins within this window after start time are not marked late.
                    E.g. start 9:30 + 15 min grace → late after 9:45.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Half Day (hours)</label>
                    <input type="number" className="input" min={1} max={24} step={0.5}
                      value={(shiftSettings.halfDayMinutes / 60).toFixed(1)}
                      onChange={e => setShiftSettings(s => ({ ...s, halfDayMinutes: Math.round(parseFloat(e.target.value) * 60) }))} required />
                    <p className="text-xs text-app-soft mt-1">Min hours for half-day count.</p>
                  </div>
                  <div>
                    <label className="label">Full Day (hours)</label>
                    <input type="number" className="input" min={1} max={24} step={0.5}
                      value={(shiftSettings.fullDayMinutes / 60).toFixed(1)}
                      onChange={e => setShiftSettings(s => ({ ...s, fullDayMinutes: Math.round(parseFloat(e.target.value) * 60) }))} required />
                    <p className="text-xs text-app-soft mt-1">Min hours for full-day count.</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-2xl px-4 py-3 text-xs text-app-soft space-y-1"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                  <p className="font-semibold text-app mb-2">Preview</p>
                  <p>Shift: <strong>{shiftSettings.shiftStartTime}</strong> to <strong>{shiftSettings.shiftEndTime || "19:00"}</strong></p>
                  <p>On time: clock-in by <strong>{shiftSettings.shiftStartTime}</strong> + {shiftSettings.bufferMinutes} min grace</p>
                  <p>Early leave: clock-out before <strong>{shiftSettings.shiftEndTime || "19:00"}</strong></p>
                  <p>Half day: &ge; <strong>{(shiftSettings.halfDayMinutes / 60).toFixed(1)}h</strong> worked</p>
                  <p>Full day: &ge; <strong>{(shiftSettings.fullDayMinutes / 60).toFixed(1)}h</strong> worked</p>
                  <p>Short day: &lt; {(shiftSettings.halfDayMinutes / 60).toFixed(1)}h worked</p>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" className="btn-secondary" onClick={() => setSettingsModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={settingsSaving}>
                    {settingsSaving ? <Spinner size="sm" /> : null} Save Settings
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Admin Entry Modal ── */}
      {entryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEntryModal(false); }}>
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-app flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-orange-500" /> Manual Attendance Entry
              </h2>
              <button onClick={() => setEntryModal(false)}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-app-soft cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdminEntry} className="flex flex-col gap-4">
              <div>
                <label className="label">Member</label>
                <AppSelect
                  value={entryForm.userId}
                  onChange={v => setEntryForm(f => ({ ...f, userId: v }))}
                  placeholder="Select member"
                  options={[{ value: "", label: "Select member" }, ...teamMembers.map(m => ({ value: m._id, label: `${m.name} (${m.role})` }))]}
                />
              </div>
              <div>
                <label className="label">Date</label>
                <AppDatePicker value={entryForm.date} onChange={v => setEntryForm(f => ({ ...f, date: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Clock In</label>
                  <input type="time" className="input" value={entryForm.clockIn}
                    onChange={e => setEntryForm(f => ({ ...f, clockIn: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Clock Out</label>
                  <input type="time" className="input" value={entryForm.clockOut}
                    onChange={e => setEntryForm(f => ({ ...f, clockOut: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input type="text" className="input" placeholder="e.g. Work from home" value={entryForm.note}
                  onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <p className="text-xs text-app-soft">Late mark and day type are auto-calculated from the saved times against your shift settings.</p>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setEntryModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={entrySaving}>
                  {entrySaving ? <Spinner size="sm" /> : null} Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
