import { useEffect, useState, useCallback, useRef } from "react";
import {
  Phone, PhoneOff, PhoneMissed, Mic, AlignLeft,
  Loader2, RefreshCw, Sparkles, ChevronRight, X,
  FileText, CalendarPlus, CheckCircle2, Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { fmtDateTime } from "../utils/constants";

const STATUS_TABS = [
  { id: "all",       label: "All Calls" },
  { id: "answered",  label: "Answered"  },
  { id: "missed",    label: "Missed"    },
  { id: "initiated", label: "Initiated" },
];

function fmt(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const SENTIMENT = {
  positive: { bg: "rgba(34,197,94,0.10)",   color: "#22c55e", label: "Positive" },
  negative: { bg: "rgba(239,68,68,0.10)",   color: "#ef4444", label: "Negative" },
  neutral:  { bg: "rgba(161,161,170,0.12)", color: "#a1a1aa", label: "Neutral"  },
};
const STATUS_STYLE = {
  answered:  { bg: "rgba(34,197,94,0.10)",  color: "#22c55e", icon: Phone       },
  missed:    { bg: "rgba(239,68,68,0.10)",  color: "#ef4444", icon: PhoneMissed },
  initiated: { bg: "rgba(249,115,22,0.10)", color: "#f97316", icon: Phone       },
};

// ── Call detail modal ──────────────────────────────────────────────────────────
function CallDetailModal({ call, onClose }) {
  const meta   = call.meta || {};
  const status = meta.status || "initiated";
  const ss     = STATUS_STYLE[status] || STATUS_STYLE.initiated;
  const sent   = meta.sentiment ? SENTIMENT[meta.sentiment] : null;

  const [notes,         setNotes]         = useState(meta.notes || "");
  const [savingNotes,   setSavingNotes]   = useState(false);

  const [showFollowup,  setShowFollowup]  = useState(false);
  const [followupTitle, setFollowupTitle] = useState(`Follow up with ${call.leadName}`);
  const [followupDate,  setFollowupDate]  = useState("");
  const [followupDesc,  setFollowupDesc]  = useState("");
  const [creatingTask,  setCreatingTask]  = useState(false);
  const [taskDone,      setTaskDone]      = useState(false);

  const [calling,       setCalling]       = useState(false);

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/calls/${call.leadId}/${call.activityId}/notes`, { notes });
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally { setSavingNotes(false); }
  };

  const createFollowup = async () => {
    if (!followupDate) return;
    setCreatingTask(true);
    try {
      await api.post(`/calls/${call.leadId}/followup`, {
        title:       followupTitle,
        dueDate:     followupDate,
        description: followupDesc,
      });
      toast.success("Follow-up task created");
      setTaskDone(true);
      setShowFollowup(false);
    } catch {
      toast.error("Failed to create task");
    } finally { setCreatingTask(false); }
  };

  const callBack = async () => {
    setCalling(true);
    try {
      await api.post("/calls/initiate", { leadId: call.leadId });
      toast.success("Calling back — check your phone.");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Call failed");
    } finally { setCalling(false); }
  };

  const notesDirty = notes !== (meta.notes || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="p-5 shrink-0" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-app">{call.leadName || "Unknown"}</h2>
                {call.leadPhone && <span className="text-sm text-app-soft">{call.leadPhone}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
                  style={{ background: ss.bg, color: ss.color }}>
                  {status}
                </span>
                {sent && (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
                    style={{ background: sent.bg, color: sent.color }}>
                    {sent.label}
                  </span>
                )}
                {meta.duration > 0 && <span className="text-xs text-app-soft">{fmt(meta.duration)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 mt-2 text-xs text-app-soft">
                <span>{fmtDateTime(call.createdAt)}</span>
                {call.performedBy && <span>· Agent: {call.performedBy}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-app-soft hover:text-app transition p-1 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Callback — missed calls */}
          {status === "missed" && (
            <button
              onClick={callBack}
              disabled={calling}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {calling
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <PhoneMissed className="w-4 h-4" />}
              Call Back Now
            </button>
          )}

          {/* Recording */}
          {meta.recordingUrl ? (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-app-soft">Recording</span>
              </div>
              <audio controls src={meta.recordingUrl} className="w-full rounded-xl" style={{ height: 36 }} />
            </section>
          ) : status === "answered" && (
            <div className="rounded-xl p-3 flex items-center gap-2 text-xs text-app-soft"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <Mic className="w-4 h-4 shrink-0 opacity-40" />
              Recording will appear here once uploaded by the recording server.
            </div>
          )}

          {/* AI Summary */}
          {meta.summary ? (
            <section>
              <div className="rounded-xl p-4"
                style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">AI Summary</span>
                </div>
                <p className="text-sm text-app leading-relaxed">{meta.summary}</p>
              </div>
            </section>
          ) : status === "answered" && (
            <div className="rounded-xl p-4"
              style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.25)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">AI Summary</span>
              </div>
              <p className="text-xs text-app-soft">
                AI summary generates automatically after the call recording is processed (calls over 10s).
              </p>
            </div>
          )}

          {/* Transcript */}
          {meta.transcript && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <AlignLeft className="w-3.5 h-3.5 text-app-soft" />
                <span className="text-xs font-bold uppercase tracking-wider text-app-soft">Transcript</span>
              </div>
              <div className="rounded-xl p-4 text-sm text-app leading-relaxed whitespace-pre-wrap overflow-y-auto"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", maxHeight: 220 }}>
                {meta.transcript}
              </div>
            </section>
          )}

          {/* Call Notes */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-app-soft" />
              <span className="text-xs font-bold uppercase tracking-wider text-app-soft">Call Notes</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this call…"
              rows={3}
              className="input w-full resize-none text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes || !notesDirty}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                style={{ background: "var(--app-primary)", color: "#fff" }}
              >
                {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            </div>
          </section>

          {/* Follow-up scheduler */}
          <section>
            {taskDone ? (
              <div className="flex items-center gap-2 text-green-500 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Follow-up task created
              </div>
            ) : !showFollowup ? (
              <button
                onClick={() => setShowFollowup(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition"
                style={{ background: "rgba(249,115,22,0.07)", color: "var(--app-primary)", border: "1px dashed rgba(249,115,22,0.3)" }}
              >
                <CalendarPlus className="w-4 h-4" />
                Schedule Follow-up Task
              </button>
            ) : (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                <p className="text-xs font-bold uppercase tracking-wider text-app-soft">Schedule Follow-up</p>
                <input
                  type="text"
                  value={followupTitle}
                  onChange={e => setFollowupTitle(e.target.value)}
                  placeholder="Task title"
                  className="input w-full"
                />
                <input
                  type="datetime-local"
                  value={followupDate}
                  onChange={e => setFollowupDate(e.target.value)}
                  className="input w-full"
                />
                <textarea
                  value={followupDesc}
                  onChange={e => setFollowupDesc(e.target.value)}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="input w-full resize-none text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowFollowup(false)}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={createFollowup}
                    disabled={creatingTask || !followupDate}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ background: "var(--app-primary)", color: "#fff" }}
                  >
                    {creatingTask ? "Creating…" : "Create Task"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Compact list card ──────────────────────────────────────────────────────────
function CallCard({ call, onClick }) {
  const meta   = call.meta || {};
  const status = meta.status || "initiated";
  const ss     = STATUS_STYLE[status] || STATUS_STYLE.initiated;
  const StIcon = ss.icon;
  const sent   = meta.sentiment ? SENTIMENT[meta.sentiment] : null;

  return (
    <button onClick={onClick} className="card p-4 w-full text-left transition-all hover:shadow-md active:scale-[0.998]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ss.bg }}>
          <StIcon className="w-4 h-4" style={{ color: ss.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-app truncate">{call.leadName || "Unknown Lead"}</p>
            {call.leadPhone && <span className="text-xs text-app-soft">{call.leadPhone}</span>}
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: ss.bg, color: ss.color }}>
              {status}
            </span>
            {sent && (
              <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: sent.bg, color: sent.color }}>
                {sent.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-app-soft">
            <span>{fmtDateTime(call.createdAt)}</span>
            {call.performedBy && <span>· {call.performedBy}</span>}
            {meta.duration > 0 && <span>· {fmt(meta.duration)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {meta.recordingUrl && <Mic       className="w-3.5 h-3.5 text-orange-400"  />}
          {meta.summary      && <Sparkles  className="w-3.5 h-3.5 text-indigo-400"  />}
          {(meta.notes || meta.transcript) && <FileText className="w-3.5 h-3.5 text-app-soft" />}
          <ChevronRight className="w-4 h-4 text-app-soft" />
        </div>
      </div>
    </button>
  );
}

// ── Call analytics mini section ───────────────────────────────────────────────
function CallAnalytics({ data }) {
  if (!data) return null;
  const { volumeByDay = [], durationByAgent = [] } = data;
  const recent   = volumeByDay.slice(-14);
  const maxTotal = Math.max(...recent.map(d => d.total), 1);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Volume by day */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-app-soft mb-3">Daily Call Volume (last 14 days)</p>
        {recent.length === 0 ? (
          <p className="text-sm text-app-soft">No calls in the last 30 days.</p>
        ) : recent.map((d, i) => {
          const date  = new Date(d._id.y, d._id.m - 1, d._id.d);
          const label = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          return (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-app-soft w-10 shrink-0 text-right">{label}</span>
              <div className="flex-1 flex gap-0.5 h-4">
                <div className="h-full rounded-full bg-green-500/70 transition-all"
                  style={{ width: `${(d.answered / maxTotal) * 100}%`, minWidth: d.answered ? 4 : 0 }} />
                <div className="h-full rounded-full bg-red-400/50 transition-all"
                  style={{ width: `${(d.missed / maxTotal) * 100}%`, minWidth: d.missed ? 4 : 0 }} />
              </div>
              <span className="text-[10px] font-semibold text-app w-5 text-right">{d.total}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-app-soft">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/70 inline-block" /> Answered</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400/50 inline-block" /> Missed</span>
        </div>
      </div>

      {/* Avg duration by agent */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-app-soft mb-3">Answered Calls by Agent</p>
        {durationByAgent.length === 0 ? (
          <p className="text-sm text-app-soft">No answered calls with duration yet.</p>
        ) : durationByAgent.map((a) => (
          <div key={a._id} className="flex items-center justify-between py-2 border-b last:border-0"
            style={{ borderColor: "var(--app-border)" }}>
            <span className="text-sm text-app font-medium">{a.name || "Unknown"}</span>
            <div className="text-right">
              <span className="text-sm font-bold text-app">{a.totalCalls} calls</span>
              {a.avgDuration > 0 && (
                <span className="text-xs text-app-soft ml-1.5">{fmt(Math.round(a.avgDuration))} avg</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Calls() {
  useEffect(() => { document.title = "Calls - Arthaleads CRM"; }, []);

  const [calls,     setCalls]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("all");
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [stats,     setStats]     = useState({ answered: 0, missed: 0 });
  const [agents,    setAgents]    = useState([]);
  const [agentId,   setAgentId]   = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const LIMIT = 30;

  const loadCalls = useCallback(async (status, pg, agId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (status !== "all") params.set("status", status);
      if (agId) params.set("agentId", agId);
      const { data } = await api.get(`/calls?${params}`);
      setCalls(data.calls || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { setCalls([]); }
    finally   { setLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        api.get("/calls?status=answered&page=1&limit=1"),
        api.get("/calls?status=missed&page=1&limit=1"),
      ]);
      setStats({ answered: a.data.total || 0, missed: m.data.total || 0 });
    } catch {}
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get("/calls/analytics");
      setAnalytics(data);
    } catch {}
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/agents");
      setAgents(data.agents || []);
    } catch {}
  }, []);

  useEffect(() => { loadCalls(tab, page, agentId); }, [tab, page, agentId, loadCalls]);
  useEffect(() => { loadStats(); loadAnalytics(); loadAgents(); }, [loadStats, loadAnalytics, loadAgents]);

  const switchTab = (id) => { setTab(id); setPage(1); };
  const refresh   = ()    => { loadCalls(tab, page, agentId); loadStats(); loadAnalytics(); };

  return (
    <>
      <div className="stitch-page space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="stitch-kicker mb-1">EnableX Telephony</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Calls</h1>
          </div>
          <button onClick={refresh} disabled={loading}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Calls", value: total,          color: "var(--app-primary)" },
            { label: "Answered",    value: stats.answered, color: "#22c55e"            },
            { label: "Missed",      value: stats.missed,   color: "#ef4444"            },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-xs text-app-soft mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Analytics */}
        <CallAnalytics data={analytics} />

        {/* Filters row: tabs + agent filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-2xl p-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            {STATUS_TABS.map(({ id, label }) => (
              <button key={id} onClick={() => switchTab(id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={tab === id
                  ? { background: "var(--app-surface)", color: "var(--app-text)", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }
                  : { color: "var(--app-text-soft)" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Agent filter */}
          {agents.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-app-soft" />
              <select
                value={agentId}
                onChange={e => { setAgentId(e.target.value); setPage(1); }}
                className="input py-2 text-sm"
                style={{ padding: "8px 12px", minWidth: 140 }}
              >
                <option value="">All Agents</option>
                {agents.map(a => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
              {agentId && (
                <button onClick={() => setAgentId("")} className="text-xs text-orange-400 hover:text-orange-500 font-semibold">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-app-soft" />
          </div>
        ) : calls.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.10)" }}>
              <PhoneOff className="w-7 h-7 text-orange-400" />
            </div>
            <p className="text-base font-bold text-app">No calls yet</p>
            <p className="text-sm text-app-soft max-w-xs mx-auto">
              {tab === "all"
                ? "Make your first call from any lead's profile. Recordings and AI summaries will appear here."
                : `No ${tab} calls found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call, i) => (
              <CallCard key={call.activityId || i} call={call} onClick={() => setSelected(call)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-40">← Prev</button>
            <span className="text-sm text-app-soft">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}

      </div>

      {selected && <CallDetailModal call={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
