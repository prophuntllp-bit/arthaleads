import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Plus, Loader2, Trash2, RefreshCw, FileText, AlertCircle, Settings } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const STATUS_STYLE = {
  APPROVED: { bg: "rgba(34,197,94,0.12)",   fg: "#15803d", label: "Approved" },
  PENDING:  { bg: "rgba(251,191,36,0.14)",  fg: "#b45309", label: "In review" },
  REJECTED: { bg: "rgba(239,68,68,0.12)",   fg: "#b91c1c", label: "Rejected" },
  PAUSED:   { bg: "rgba(148,163,184,0.16)", fg: "#475569", label: "Paused" },
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "APPROVED", label: "Approved" },
  { key: "PENDING", label: "In review" },
  { key: "REJECTED", label: "Rejected" },
];

function StatusPill({ status }) {
  // Unknown statuses still render — Meta adds them, and a card silently
  // vanishing is worse than an unfamiliar word.
  const s = STATUS_STYLE[status] || { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: status };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
      style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  );
}

const bodyPreview = (t) => ((t.components || []).find((c) => c.type === "BODY") || {}).text || "";

export default function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useOutletContext() || {};
  const canEdit = ["admin", "manager", "super_admin"].includes(user?.role);

  const [rows, setRows]    = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError]  = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(() => {
    setLoad(true); setError("");
    api.get("/whatsapp/templates")
      .then((r) => setRows(r.data.templates || []))
      .catch((e) => setError(e.response?.data?.message || "Could not load templates."))
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => rows.reduce((m, t) => ({ ...m, [t.status]: (m[t.status] || 0) + 1 }), {}), [rows]);
  const shown = filter === "ALL" ? rows : rows.filter((t) => t.status === filter);

  const remove = async (name) => {
    if (!confirm(`Delete the template "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/whatsapp/templates/${encodeURIComponent(name)}`);
      toast.success("Template deleted");
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not delete");
    }
  };

  // The two errors a tenant can actually fix both live in Settings, so point
  // straight there rather than leaving them at a dead message.
  const fixableInSettings = /Business Account ID|access token|Meta Cloud API provider/i.test(error);

  return (
    <div className="stitch-page !pt-2">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">Message templates</h1>
          <p className="text-xs text-app-soft">
            Required for any message outside the 24-hour reply window. Meta reviews each one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {canEdit && (
            <Link to="/conversations/templates/new"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> New template
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4 flex items-start gap-2.5 flex-wrap" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-app">{error}</p>
            {fixableInSettings && !isAdmin && (
              <p className="text-xs text-app-soft mt-1">Ask an admin to add it in WhatsApp settings.</p>
            )}
          </div>
          {fixableInSettings && isAdmin && (
            <button onClick={() => navigate("/conversations/settings")}
              className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0">
              <Settings className="w-3.5 h-3.5" /> Open settings
            </button>
          )}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const n = key === "ALL" ? rows.length : (counts[key] || 0);
            return (
              <button key={key} onClick={() => setFilter(key)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={filter === key
                  ? { background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }
                  : { color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                {label} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <FileText className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm text-app font-bold">No templates yet</p>
          <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
            A template is what lets you message someone who has not written to you in the last
            24 hours — every campaign needs one.
          </p>
          {canEdit && (
            <Link to="/conversations/templates/new"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 mt-4">
              <Plus className="w-4 h-4" /> Create your first template
            </Link>
          )}
        </div>
      ) : shown.length === 0 && rows.length > 0 ? (
        <p className="text-sm text-app-soft text-center py-12">Nothing in this status.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => {
            const rejected = t.status === "REJECTED";
            return (
              <div key={t.id || t.name} className="card p-4 flex flex-col"
                style={rejected ? { borderColor: "rgba(239,68,68,0.35)" } : undefined}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-app truncate">{t.name}</p>
                    <p className="text-[11px] text-app-soft mt-0.5 font-mono">
                      {(t.category || "").toLowerCase()} · {t.language}
                    </p>
                  </div>
                  <StatusPill status={t.status} />
                </div>

                <p className="text-xs text-app-soft leading-relaxed flex-1 line-clamp-4 whitespace-pre-wrap mt-1">
                  {bodyPreview(t) || "No body text"}
                </p>

                {rejected && t.rejected_reason && (
                  <p className="text-[11px] mt-3 px-2.5 py-2 rounded-xl flex items-start gap-1.5"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>reason: {String(t.rejected_reason).replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--app-border)" }}>
                  <span className="text-[10px] text-app-soft font-mono truncate">{t.id ? `ID: ${t.id}` : ""}</span>
                  {canEdit && (
                    <button onClick={() => remove(t.name)}
                      className="text-[11px] font-semibold text-app-soft hover:text-red-500 transition flex items-center gap-1 shrink-0">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
