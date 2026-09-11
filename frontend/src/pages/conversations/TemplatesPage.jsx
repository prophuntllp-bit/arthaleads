import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  Plus, Loader2, Trash2, RefreshCw, FileText, AlertCircle, Settings, Sparkles, Compass, PlugZap,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { STAGES, byStage, VAR_LABELS, PER_LEAD_FIELDS } from "../../data/templateGallery";

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

const CATEGORY_STYLE = {
  MARKETING: { bg: "rgba(var(--app-primary-rgb),0.12)", fg: "var(--app-primary)", label: "Marketing" },
  UTILITY:   { bg: "rgba(59,130,246,0.12)",             fg: "#1d4ed8",            label: "Utility" },
};

function StatusPill({ status }) {
  // Unknown statuses still render — Meta adds them, and a card silently
  // vanishing is worse than an unfamiliar word.
  const s = STATUS_STYLE[status] || { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: status };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
      style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  );
}

function CategoryPill({ category }) {
  const c = CATEGORY_STYLE[category] || { bg: "var(--app-surface-low)", fg: "var(--app-text-soft)", label: category };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
      style={{ background: c.bg, color: c.fg }}>{c.label}</span>
  );
}

const bodyPreview = (t) => ((t.components || []).find((c) => c.type === "BODY") || {}).text || "";

/**
 * Gallery body with each {{n}} shown as the field it is bound to.
 *
 * "Hi [Lead name], your visit to [Preferred location]" tells you what the
 * message becomes; "Hi {{1}}, your visit to {{2}}" does not.
 */
function BoundBody({ body, varMap }) {
  const parts = body.split(/(\{\{\s*\d+\s*\}\})/);
  return (
    <p className="text-xs text-app-soft leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const m = part.match(/^\{\{\s*(\d+)\s*\}\}$/);
        if (!m) return <span key={i}>{part}</span>;
        const field = varMap?.[Number(m[1]) - 1];
        const label = VAR_LABELS[field] || `value ${m[1]}`;
        const perLead = PER_LEAD_FIELDS.has(field);
        return (
          <span key={i} className="font-semibold text-[11px] px-1.5 py-px rounded mx-px whitespace-nowrap"
            style={perLead
              ? { background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }
              : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
            {label}
          </span>
        );
      })}
    </p>
  );
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useOutletContext() || {};
  const canEdit = ["admin", "manager", "super_admin"].includes(user?.role);

  const [rows, setRows]    = useState([]);
  const [loading, setLoad] = useState(true);
  const [err, setErr]      = useState(null);   // { message, reconnect, settingsFix }
  const [filter, setFilter] = useState("ALL");
  const [view, setView]    = useState("yours");
  const [settled, setSettled] = useState(false);

  const load = useCallback(() => {
    setLoad(true); setErr(null);
    api.get("/whatsapp/templates")
      .then((r) => setRows(r.data.templates || []))
      .catch((e) => setErr({
        message: e.response?.data?.message || "Could not load templates.",
        reconnect: !!e.response?.data?.reconnect,
        settingsFix: !!e.response?.data?.settingsFix,
      }))
      .finally(() => { setLoad(false); setSettled(true); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Land on the gallery when there is nothing of your own to look at — whether
  // that is a new account or a broken connection. The gallery needs neither.
  useEffect(() => {
    if (settled && (err || rows.length === 0)) setView("explore");
  }, [settled, err, rows.length]);

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

  const useGalleryTemplate = (t) => navigate("/conversations/templates/new", { state: { preset: t } });

  const VIEWS = [
    { key: "explore", label: "Explore", icon: Compass },
    { key: "yours",   label: "Your templates", icon: FileText, count: rows.length },
  ];

  return (
    <div className="stitch-page !pt-2">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">Message templates</h1>
          <p className="text-xs text-app-soft">
            Required for any message outside the 24-hour reply window. Meta reviews each one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "yours" && (
            <button onClick={load} disabled={loading}
              className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          )}
          {canEdit && (
            <Link to="/conversations/templates/new"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" /> New template
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {VIEWS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setView(key)}
            className="px-3.5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-1.5"
            style={view === key
              ? { background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }
              : { color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && <span className="opacity-60 tabular-nums">{count}</span>}
          </button>
        ))}
      </div>

      {view === "explore" ? (
        <>
          {err && (
            <div className="card p-3.5 mb-4 flex items-start gap-2.5"
              style={{ borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.06)" }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
              <p className="text-xs text-app-soft flex-1">
                You can browse and build templates here, but submitting one needs a working WhatsApp
                connection. <button onClick={() => setView("yours")} className="font-semibold underline">See the problem</button>
              </p>
            </div>
          )}

          <div className="card p-4 mb-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-app">Written for property sales, not generic business</p>
              <p className="text-xs text-app-soft mt-0.5 leading-relaxed">
                Every template below is grouped by the lead stage it belongs to, and its blanks are
                already wired to your CRM fields — the ones tinted orange fill from each lead
                automatically, the grey ones you type once per campaign.
              </p>
            </div>
          </div>

          <div className="space-y-7">
            {STAGES.map((stage) => {
              const items = byStage(stage.key);
              if (!items.length) return null;
              return (
                <section key={stage.key}>
                  <div className="mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-app">{stage.label}</h2>
                      {stage.status && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                          style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
                          status: {stage.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-app-soft mt-0.5">{stage.blurb}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((t) => (
                      <div key={t.key} className="card p-4 flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-bold text-app">{t.title}</p>
                          <CategoryPill category={t.category} />
                        </div>
                        <p className="text-[11px] text-app-soft mb-2.5">{t.description}</p>
                        <div className="rounded-2xl p-3 flex-1" style={{ background: "var(--app-bg)" }}>
                          <BoundBody body={t.body} varMap={t.varMap} />
                          {t.footer && <p className="text-[10px] text-app-soft opacity-70 mt-1.5">{t.footer}</p>}
                        </div>
                        {!!t.buttons?.length && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.buttons.map((b, i) => (
                              <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                                style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                                {b.text}
                              </span>
                            ))}
                          </div>
                        )}
                        {canEdit && (
                          <button onClick={() => useGalleryTemplate(t)}
                            className="btn-secondary rounded-full w-full py-2 text-xs font-bold mt-3">
                            Use this
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {err && (
            <div className="card p-4 mb-4" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
              <div className="flex items-start gap-2.5 flex-wrap">
                {err.reconnect
                  ? <PlugZap className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-app">
                    {err.reconnect ? "Your WhatsApp connection has expired" : "Could not load your templates"}
                  </p>
                  <p className="text-xs text-app-soft mt-1">{err.message}</p>
                  {err.reconnect && (
                    <p className="text-xs text-app-soft mt-1.5">
                      Meta access tokens expire. Generate a new permanent token in Meta and save it in
                      settings — templates, campaigns and the inbox all use it.
                    </p>
                  )}
                  {err.settingsFix && !isAdmin && (
                    <p className="text-xs text-app-soft mt-1.5">Ask an admin to fix this in WhatsApp settings.</p>
                  )}
                </div>
                {err.settingsFix && isAdmin && (
                  <button onClick={() => navigate("/conversations/settings")}
                    className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                    <Settings className="w-3.5 h-3.5" /> Open settings
                  </button>
                )}
              </div>
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
          ) : rows.length === 0 && !err ? (
            <div className="card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
                <FileText className="w-5 h-5 text-app-soft" />
              </div>
              <p className="text-sm text-app font-bold">No templates yet</p>
              <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
                A template is what lets you message someone who has not written to you in the last
                24 hours — every campaign needs one.
              </p>
              <button onClick={() => setView("explore")}
                className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 mt-4">
                <Compass className="w-4 h-4" /> Browse ready-made templates
              </button>
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
        </>
      )}
    </div>
  );
}
