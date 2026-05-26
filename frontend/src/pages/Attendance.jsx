import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Spinner, EmptyState } from "../components/UI";
import UpgradeWall from "../components/UpgradeWall";
import { canAccess } from "../utils/plan";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Clock, ChevronLeft, ChevronRight, CalendarDays,
  Users, Timer, CheckCircle2, LogIn, Filter
} from "lucide-react";

function pad(n) { return String(n).padStart(2, "0"); }

function fmtTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

function fmtDuration(mins) {
  if (mins == null) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Live elapsed timer - seeds correct elapsed time on mount/change (not just on first render)
function LiveTimer({ since }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!since) { setSecs(0); return; }
    setSecs(Math.floor((Date.now() - new Date(since)) / 1000));
    const iv = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [since]);
  return <span className="tabular-nums">{pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}</span>;
}

export default function Attendance() {
  const { user, org } = useAuth();
  if (!canAccess(org, "growth")) {
    return <UpgradeWall org={org} feature="Attendance Tracking" description="Track your team's clock-in/out times, view daily summaries, and monitor attendance history." />;
  }
  const isAdmin = ["admin", "manager", "super_admin"].includes(user?.role);

  // Today's own status
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [clocking, setClocking] = useState(false);

  // Records list
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);

  // Team today (admin/manager)
  const [teamToday, setTeamToday] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Team members list for filter (admin/manager)
  const [teamMembers, setTeamMembers] = useState([]);

  // Filters
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [to, setTo] = useState(todayStr);
  const [filterUser, setFilterUser] = useState(""); // admin: filter by member
  const [tab, setTab] = useState("team"); // "team" | "records" - admin default is team

  // Fetch today's own clock status
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const r = await api.get("/attendance/status");
      setStatus(r.data.data);
    } catch { /**/ }
    finally { setStatusLoading(false); }
  }, []);

  // Fetch records
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

  // Fetch team today
  const fetchTeamToday = useCallback(async () => {
    if (!isAdmin) return;
    setTeamLoading(true);
    try {
      const r = await api.get("/attendance/team-today");
      setTeamToday(r.data.data || []);
    } catch { /**/ }
    finally { setTeamLoading(false); }
  }, [isAdmin]);

  // Fetch team member list for filter dropdown
  const fetchTeamMembers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await api.get("/auth/users");
      setTeamMembers(r.data.users || r.data.data || []);
    } catch { /**/ }
  }, [isAdmin]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchTeamToday(); fetchTeamMembers(); }, [fetchTeamToday, fetchTeamMembers]);
  useEffect(() => { setPage(1); }, [from, to, filterUser]);

  // Non-admin defaults to records tab
  useEffect(() => { if (!isAdmin) setTab("records"); }, [isAdmin]);

  const handleClockIn = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockin");
      setStatus(r.data.data);
      toast.success("Clocked in successfully!");
      fetchTeamToday();
      fetchRecords();
    } catch (e) { toast.error(e.response?.data?.message || "Clock in failed"); }
    finally { setClocking(false); }
  };

  const handleClockOut = async () => {
    setClocking(true);
    try {
      const r = await api.post("/attendance/clockout");
      setStatus(r.data.data);
      toast.success("Clocked out! Great work today.");
      fetchTeamToday();
      fetchRecords();
    } catch (e) { toast.error(e.response?.data?.message || "Clock out failed"); }
    finally { setClocking(false); }
  };

  const isClockedIn  = status?.clockIn && !status?.clockOut;
  const isClockedOut = status?.clockIn && status?.clockOut;

  // ── Status badge helper ──────────────────────────────────────────────────────
  function StatusBadge({ a }) {
    const isIn  = a?.clockIn && !a?.clockOut;
    const isOut = a?.clockIn && a?.clockOut;
    if (isOut) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
        <CheckCircle2 className="w-3 h-3" /> Completed
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
            <p className="text-xs text-app-soft mt-0.5">Track your team's clock in/out hours</p>
          </div>
        </div>

        {/* Clock In / Out action */}
        <div className="flex items-center gap-3">
          {statusLoading ? (
            <Spinner size="sm" />
          ) : isClockedOut ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-app-soft">Done for today -</span>
              <span className="text-app font-semibold">{fmtDuration(status.totalMinutes)}</span>
            </div>
          ) : isClockedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-app-soft text-xs">Active -</span>
                <span className="text-green-500 font-bold text-sm"><LiveTimer since={status.clockIn} /></span>
              </div>
              <button onClick={handleClockOut} disabled={clocking} className="btn-danger py-2 px-4 text-sm">
                {clocking ? <Spinner size="sm" /> : null}
                Clock Out
              </button>
            </div>
          ) : (
            <button onClick={handleClockIn} disabled={clocking} className="btn-primary py-2 px-5 text-sm">
              {clocking ? <Spinner size="sm" /> : <LogIn className="h-4 w-4" />}
              Clock In
            </button>
          )}
        </div>
      </div>

      {/* ── Today's own status cards ── */}
      {!statusLoading && status && (
        <div className="px-4 lg:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Clock In",  value: fmtTime(status.clockIn),  color: "text-green-500" },
            { label: "Clock Out", value: fmtTime(status.clockOut), color: "text-red-400" },
            { label: "Duration",  value: isClockedOut ? fmtDuration(status.totalMinutes) : isClockedIn ? "Active" : "-", color: "text-orange-500" },
            { label: "Date",      value: fmtDate(status.date), color: "text-app" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="px-4 lg:px-6 pt-4">
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
        <div className="px-4 lg:px-6 pt-4 pb-6">
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
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                      {["Member", "Role", "Clock In", "Clock Out", "Hours", "Status"].map(h => (
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
                                <p className="text-app-soft text-[10px]">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 capitalize text-app-soft">{u.role}</td>
                          <td className="px-5 py-3">
                            {a?.clockIn ? (
                              <span className="text-green-500 font-semibold">{fmtTime(a.clockIn)}</span>
                            ) : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-5 py-3">
                            {a?.clockOut ? (
                              <span className="text-red-400 font-semibold">{fmtTime(a.clockOut)}</span>
                            ) : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-5 py-3 font-bold text-app">
                            {isOut ? fmtDuration(a.totalMinutes) :
                             isIn  ? <span className="text-green-500"><LiveTimer since={a.clockIn} /></span> : "-"}
                          </td>
                          <td className="px-5 py-3"><StatusBadge a={a} /></td>
                        </tr>
                      );
                    })}
                    {teamToday.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-app-soft text-xs">No team members found</td>
                      </tr>
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
        <div className="px-4 lg:px-6 pt-4 pb-6">

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <Filter className="w-4 h-4 text-app-soft flex-shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">From</label>
              <input type="date" className="input text-xs py-1.5 px-3" value={from}
                onChange={e => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">To</label>
              <input type="date" className="input text-xs py-1.5 px-3" value={to}
                onChange={e => { setTo(e.target.value); setPage(1); }} />
            </div>
            {isAdmin && teamMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-app-soft font-medium">Member</label>
                <select className="input text-xs py-1.5 px-3" value={filterUser}
                  onChange={e => { setFilterUser(e.target.value); setPage(1); }}>
                  <option value="">All members</option>
                  {teamMembers.map(m => (
                    <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs text-app-soft">{total} record{total !== 1 ? "s" : ""}</span>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : records.length === 0 ? (
            <EmptyState icon={Timer} title="No attendance records" desc="No records found for the selected filters." />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                      {[
                        "Date",
                        ...(isAdmin ? ["Member"] : []),
                        "Clock In", "Clock Out", "Duration", "Status",
                      ].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-app-soft">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => {
                      const isIn  = rec.clockIn && !rec.clockOut;
                      const isOut = rec.clockIn && rec.clockOut;
                      return (
                        <tr key={rec._id} className="border-b hover:bg-orange-500/5 transition" style={{ borderColor: "var(--app-border)" }}>
                          <td className="px-5 py-3">
                            <p className="font-semibold text-app">{fmtDate(rec.date)}</p>
                          </td>
                          {isAdmin && (
                            <td className="px-5 py-3">
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
                          <td className="px-5 py-3">
                            <span className="text-green-500 font-semibold">{fmtTime(rec.clockIn)}</span>
                          </td>
                          <td className="px-5 py-3">
                            {rec.clockOut
                              ? <span className="text-red-400 font-semibold">{fmtTime(rec.clockOut)}</span>
                              : isIn
                                ? <span className="text-green-500 font-bold"><LiveTimer since={rec.clockIn} /></span>
                                : <span className="text-app-soft">-</span>}
                          </td>
                          <td className="px-5 py-3 font-semibold text-app">{fmtDuration(rec.totalMinutes)}</td>
                          <td className="px-5 py-3"><StatusBadge a={rec} /></td>
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
                    <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
                      disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4 text-app" />
                    </button>
                    <span className="text-xs font-semibold text-app px-2">{page}</span>
                    <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
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
    </div>
  );
}
