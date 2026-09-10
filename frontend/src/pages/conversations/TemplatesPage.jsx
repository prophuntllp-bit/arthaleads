import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, Trash2, RefreshCw, LayoutTemplate, AlertCircle } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const STATUS_STYLE = {
  APPROVED: { bg: "rgba(34,197,94,0.12)",  fg: "#15803d", label: "Approved" },
  PENDING:  { bg: "rgba(251,191,36,0.14)", fg: "#b45309", label: "In review" },
  REJECTED: { bg: "rgba(239,68,68,0.12)",  fg: "#b91c1c", label: "Rejected" },
  PAUSED:   { bg: "rgba(148,163,184,0.16)", fg: "#475569", label: "Paused" },
};

function StatusPill({ status }) {
  // Unknown statuses still render — Meta adds them and a silent disappearance
  // is worse than an unfamiliar word.
  const s = STATUS_STYLE[status] || { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: status };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  );
}

function bodyPreview(t) {
  const body = (t.components || []).find(c => c.type === "BODY");
  return body?.text || "";
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const canEdit = ["admin", "manager", "super_admin"].includes(user?.role);

  const [rows, setRows]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState("");

  const load = useCallback(() => {
    setLoad(true); setError("");
    api.get("/whatsapp/templates")
      .then(r => setRows(r.data.templates || []))
      .catch(e => setError(e.response?.data?.message || "Could not load templates."))
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="stitch-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">Message templates</h1>
          <p className="text-xs text-app-soft">
            Required for any message outside the 24-hour reply window. Meta reviews each one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary rounded-full px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
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
        <div className="card p-4 mb-4 flex items-start gap-2.5" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
          <div>
            <p className="text-sm text-app">{error}</p>
            <p className="text-xs text-app-soft mt-1">
              Templates need the Meta Cloud API provider and a saved WhatsApp Business Account ID.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="card p-10 text-center">
          <LayoutTemplate className="w-9 h-9 mx-auto text-app-soft opacity-40 mb-3" />
          <p className="text-sm text-app font-semibold">No templates yet</p>
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(t => (
            <div key={t.id || t.name} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-app truncate">{t.name}</p>
                  <p className="text-[11px] text-app-soft mt-0.5">
                    {(t.category || "").toLowerCase()} · {t.language}
                  </p>
                </div>
                <StatusPill status={t.status} />
              </div>

              <p className="text-xs text-app-soft leading-relaxed flex-1 line-clamp-4 whitespace-pre-wrap">
                {bodyPreview(t) || "No body text"}
              </p>

              {t.status === "REJECTED" && t.rejected_reason && (
                <p className="text-[11px] mt-2 px-2 py-1.5 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c" }}>
                  {String(t.rejected_reason).replace(/_/g, " ").toLowerCase()}
                </p>
              )}

              {canEdit && (
                <button onClick={() => remove(t.name)}
                  className="mt-3 self-start text-[11px] font-semibold text-app-soft hover:text-red-500 transition flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
