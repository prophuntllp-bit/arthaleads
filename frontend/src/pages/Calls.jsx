import { useEffect, useState, useCallback } from "react";
import { Phone, PhoneOff, PhoneMissed, Mic, AlignLeft, Loader2, RefreshCw } from "lucide-react";
import { Sparkles } from "lucide-react";
import api from "../services/api";
import { fmtDateTime } from "../utils/constants";

const STATUS_TABS = [
  { id: "all",      label: "All Calls" },
  { id: "answered", label: "Answered"  },
  { id: "missed",   label: "Missed"    },
  { id: "initiated",label: "Initiated" },
];

function duration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const SENTIMENT_STYLE = {
  positive: { bg: "rgba(34,197,94,0.10)",  color: "#22c55e", label: "Positive" },
  negative: { bg: "rgba(239,68,68,0.10)",  color: "#ef4444", label: "Negative" },
  neutral:  { bg: "rgba(161,161,170,0.12)", color: "#a1a1aa", label: "Neutral"  },
};

const STATUS_STYLE = {
  answered: { bg: "rgba(34,197,94,0.10)",  color: "#22c55e",  icon: Phone      },
  missed:   { bg: "rgba(239,68,68,0.10)",  color: "#ef4444",  icon: PhoneMissed },
  initiated:{ bg: "rgba(249,115,22,0.10)", color: "#f97316",  icon: Phone       },
};

function CallCard({ call }) {
  const [open, setOpen] = useState(false);
  const meta   = call.meta || {};
  const status = meta.status || "initiated";
  const ss     = STATUS_STYLE[status] || STATUS_STYLE.initiated;
  const StIcon = ss.icon;
  const sent   = meta.sentiment ? SENTIMENT_STYLE[meta.sentiment] : null;

  return (
    <div className="card p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ss.bg }}>
          <StIcon className="w-4 h-4" style={{ color: ss.color }} />
        </div>

        {/* Lead info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-app truncate">{call.leadName || "Unknown Lead"}</p>
            {call.leadPhone && (
              <span className="text-xs text-app-soft">{call.leadPhone}</span>
            )}
            {/* Status badge */}
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: ss.bg, color: ss.color }}>
              {status}
            </span>
            {/* Sentiment badge */}
            {sent && (
              <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: sent.bg, color: sent.color }}>
                {sent.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-app-soft">
            <span>{fmtDateTime(call.createdAt)}</span>
            {call.performedBy && <span>· {call.performedBy}</span>}
            {meta.duration > 0 && <span>· {duration(meta.duration)}</span>}
          </div>
        </div>
      </div>

      {/* Recording player */}
      {meta.recordingUrl && (
        <div className="pl-12">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-3 h-3 text-orange-500 shrink-0" />
            <span className="text-[11px] font-semibold text-app-soft uppercase tracking-wider">Recording</span>
          </div>
          <audio controls src={meta.recordingUrl} className="w-full" style={{ height: 36 }} />
        </div>
      )}

      {/* AI Summary */}
      {meta.summary && (
        <div className="pl-12">
          <div className="rounded-xl p-3" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Summary</span>
            </div>
            <p className="text-xs text-app leading-relaxed">{meta.summary}</p>
          </div>
        </div>
      )}

      {/* Transcript (collapsible) */}
      {meta.transcript && (
        <div className="pl-12">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition"
          >
            <AlignLeft className="w-3 h-3" />
            {open ? "Hide Transcript" : "View Transcript"}
          </button>
          {open && (
            <p className="mt-2 text-xs text-app-soft leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
              style={{ borderColor: "var(--app-border)" }}>
              {meta.transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Calls() {
  useEffect(() => { document.title = "Calls - Arthaleads CRM"; }, []);

  const [calls,    setCalls]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("all");
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const LIMIT = 30;

  const fetch = useCallback(async (status, pg) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (status !== "all") params.set("status", status);
      const { data } = await api.get(`/calls?${params}`);
      setCalls(data.calls || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(tab, page); }, [tab, page, fetch]);

  const switchTab = (id) => { setTab(id); setPage(1); };

  const answered  = calls.filter(c => c.meta?.status === "answered").length;
  const missed    = calls.filter(c => c.meta?.status === "missed").length;

  return (
    <div className="stitch-page space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="stitch-kicker mb-1">EnableX Telephony</p>
          <h1 className="text-3xl font-black tracking-tight text-app">Calls</h1>
        </div>
        <button onClick={() => fetch(tab, page)} disabled={loading}
          className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Calls",  value: total,    color: "var(--app-primary)" },
          { label: "Answered",     value: answered, color: "#22c55e" },
          { label: "Missed",       value: missed,   color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-xs text-app-soft mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl p-1 w-fit"
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
            <CallCard key={call.activityId || i} call={call} />
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
  );
}
