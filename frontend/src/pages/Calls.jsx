import { useEffect, useState, useCallback } from "react";
import {
  Phone, PhoneOff, PhoneMissed, Mic, AlignLeft,
  Loader2, RefreshCw, Sparkles, ChevronRight, X,
} from "lucide-react";
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

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col"
        style={{
          background:  "var(--app-surface)",
          border:      "1px solid var(--app-border)",
          maxHeight:   "90vh",
        }}
      >
        {/* Header */}
        <div className="p-5 shrink-0" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-app">{call.leadName || "Unknown"}</h2>
                {call.leadPhone && (
                  <span className="text-sm text-app-soft">{call.leadPhone}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
                  style={{ background: ss.bg, color: ss.color }}
                >
                  {status}
                </span>
                {sent && (
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
                    style={{ background: sent.bg, color: sent.color }}
                  >
                    {sent.label}
                  </span>
                )}
                {meta.duration > 0 && (
                  <span className="text-xs text-app-soft">{fmt(meta.duration)}</span>
                )}
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

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
            <div
              className="rounded-xl p-3 flex items-center gap-2 text-xs text-app-soft"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
            >
              <Mic className="w-4 h-4 shrink-0 opacity-40" />
              Recording will appear here once the recording server uploads it.
            </div>
          )}

          {/* AI Summary */}
          {meta.summary ? (
            <section>
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">AI Summary</span>
                </div>
                <p className="text-sm text-app leading-relaxed">{meta.summary}</p>
              </div>
            </section>
          ) : status === "answered" && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.25)" }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">AI Summary</span>
              </div>
              <p className="text-xs text-app-soft">
                AI summary is generated automatically once the recording is processed (calls over 10 seconds).
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
              <div
                className="rounded-xl p-4 text-sm text-app leading-relaxed whitespace-pre-wrap overflow-y-auto"
                style={{
                  background: "var(--app-surface-low)",
                  border: "1px solid var(--app-border)",
                  maxHeight: 280,
                }}
              >
                {meta.transcript}
              </div>
            </section>
          )}

          {/* Nothing to show */}
          {!meta.recordingUrl && !meta.summary && !meta.transcript && status !== "answered" && (
            <div className="text-center py-8">
              <p className="text-sm text-app-soft">No additional details available for this call.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Call list card (compact, clickable) ───────────────────────────────────────
function CallCard({ call, onClick }) {
  const meta   = call.meta || {};
  const status = meta.status || "initiated";
  const ss     = STATUS_STYLE[status] || STATUS_STYLE.initiated;
  const StIcon = ss.icon;
  const sent   = meta.sentiment ? SENTIMENT[meta.sentiment] : null;

  return (
    <button
      onClick={onClick}
      className="card p-4 w-full text-left transition-all hover:shadow-md active:scale-[0.998]"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ss.bg }}
        >
          <StIcon className="w-4 h-4" style={{ color: ss.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-app truncate">{call.leadName || "Unknown Lead"}</p>
            {call.leadPhone && (
              <span className="text-xs text-app-soft">{call.leadPhone}</span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: ss.bg, color: ss.color }}
            >
              {status}
            </span>
            {sent && (
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: sent.bg, color: sent.color }}
              >
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

        {/* Right-side indicators */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {meta.recordingUrl && <Mic      className="w-3.5 h-3.5 text-orange-400" />}
          {meta.summary      && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
          {meta.transcript   && <AlignLeft className="w-3.5 h-3.5 text-app-soft"  />}
          <ChevronRight className="w-4 h-4 text-app-soft" />
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Calls() {
  useEffect(() => { document.title = "Calls - Arthaleads CRM"; }, []);

  const [calls,    setCalls]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("all");
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [stats,    setStats]    = useState({ answered: 0, missed: 0 });
  const [selected, setSelected] = useState(null);
  const LIMIT = 30;

  const loadCalls = useCallback(async (status, pg) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (status !== "all") params.set("status", status);
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

  useEffect(() => { loadCalls(tab, page); }, [tab, page, loadCalls]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const switchTab = (id) => { setTab(id); setPage(1); };
  const refresh   = ()    => { loadCalls(tab, page); loadStats(); };

  return (
    <>
      <div className="stitch-page space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="stitch-kicker mb-1">EnableX Telephony</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Calls</h1>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >
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

        {/* Tabs */}
        <div
          className="flex gap-1 rounded-2xl p-1 w-fit"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
        >
          {STATUS_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                tab === id
                  ? { background: "var(--app-surface)", color: "var(--app-text)", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }
                  : { color: "var(--app-text-soft)" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-app-soft" />
          </div>
        ) : calls.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.10)" }}
            >
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
              <CallCard
                key={call.activityId || i}
                call={call}
                onClick={() => setSelected(call)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-40"
            >← Prev</button>
            <span className="text-sm text-app-soft">Page {page} of {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-40"
            >Next →</button>
          </div>
        )}

      </div>

      {/* Detail modal */}
      {selected && <CallDetailModal call={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
