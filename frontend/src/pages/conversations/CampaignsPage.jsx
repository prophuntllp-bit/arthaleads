import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, Megaphone, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const TZ = "Asia/Kolkata";
const STATUS = {
  draft:     { fg: "var(--app-text-soft)", bg: "var(--app-surface-low)",  label: "Draft",     Icon: Clock },
  sending:   { fg: "#b45309", bg: "rgba(251,191,36,0.14)", label: "Sending",   Icon: Loader2 },
  sent:      { fg: "#15803d", bg: "rgba(34,197,94,0.12)",  label: "Sent",      Icon: CheckCircle2 },
  failed:    { fg: "#b91c1c", bg: "rgba(239,68,68,0.12)",  label: "Failed",    Icon: XCircle },
  cancelled: { fg: "var(--app-text-soft)", bg: "var(--app-surface-low)",  label: "Cancelled", Icon: XCircle },
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const fmtStamp = (d) => new Date(d).toLocaleString("en-IN", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ,
});
const rupees = (p) => `₹${((p || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Time left from the rate the run has actually managed so far — not a guess
// baked into the UI. Needs a few sends before the number means anything.
function etaText(c) {
  const st = c.stats || {};
  const done = (st.sent || 0) + (st.failed || 0);
  const left = Math.max(0, (st.queued || 0) - done);
  if (!c.startedAt || done < 3 || !left) return "Broadcasting in progress";
  const perSec = done / Math.max(1, (Date.now() - new Date(c.startedAt).getTime()) / 1000);
  const secs = Math.round(left / perSec);
  return `Broadcasting in progress (~${secs < 90 ? `${secs}s` : `${Math.round(secs / 60)} min`} left)`;
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const canEdit = ["admin", "manager", "super_admin"].includes(user?.role);
  const [rows, setRows]    = useState([]);
  const [loading, setLoad] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoad(true);
    api.get("/whatsapp/campaigns")
      .then((r) => setRows(r.data.campaigns || []))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Only poll while something is actually sending.
  useEffect(() => {
    clearInterval(pollRef.current);
    if (rows.some((c) => c.status === "sending")) {
      pollRef.current = setInterval(() => load(true), 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [rows, load]);

  return (
    <div className="stitch-page !pt-2">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">Campaigns</h1>
          <p className="text-xs text-app-soft">Send an approved template to a filtered set of leads</p>
        </div>
        {canEdit && (
          <Link to="/conversations/campaigns/new"
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New campaign
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
            <Megaphone className="w-5 h-5 text-app-soft" />
          </div>
          <p className="text-sm text-app font-bold">No campaigns yet</p>
          <p className="text-xs text-app-soft mt-1 max-w-sm mx-auto">
            Pick an approved template, choose who it goes to using your usual lead filters,
            and see the cost before anything sends.
          </p>
          {canEdit && (
            <Link to="/conversations/campaigns/new"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 mt-4">
              <Plus className="w-4 h-4" /> Create a campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const s = STATUS[c.status] || STATUS.draft;
            const st = c.stats || {};
            const sending = c.status === "sending";
            return (
              <div key={c._id} className="card p-4 sm:p-5"
                style={sending ? { background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.35)" } : undefined}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-app">{c.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: s.bg, color: s.fg }}>
                        <s.Icon className={`w-2.5 h-2.5 ${sending ? "animate-spin" : ""}`} />
                        {s.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-app-soft mt-1">
                      {c.templateName} · {fmtDate(c.createdAt)}{c.createdByName ? ` · ${c.createdByName}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {c.status === "draft" && canEdit && (
                      <Link to={`/conversations/campaigns/${c._id}`}
                        className="btn-secondary rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                        Review &amp; send <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    {c.status === "sent" && c.finishedAt && (
                      <span className="text-[11px] text-app-soft font-mono">Completed {fmtStamp(c.finishedAt)}</span>
                    )}
                    {sending && (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{ background: "rgba(251,191,36,0.14)", color: "#b45309" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} /> {etaText(c)}
                      </span>
                    )}
                    {c.failureReason && (c.status === "failed" || st.failed > 0) && (
                      <span className="block max-w-[320px] truncate text-[11px] font-mono px-2.5 py-1 rounded-lg mt-1"
                        title={c.failureReason}
                        style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" }}>
                        {c.failureReason}
                      </span>
                    )}
                  </div>
                </div>

                {c.status !== "draft" && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <Stat label="Sent" value={sending ? `${st.sent || 0} / ${st.queued || 0}` : st.sent} />
                    <Stat label="Failed" value={st.failed} tone={st.failed ? "#b91c1c" : undefined} />
                    <Stat label="No consent" value={st.skippedNoConsent} />
                    {/* Meta drops marketing messages when a recipient has hit
                        their cap across all businesses — its own column so it is
                        not read as us failing. */}
                    <Stat label="Recipient limit" value={st.droppedByMeta} />
                    <Stat label={sending ? "Est. cost" : "Cost"} value={rupees(sending ? c.reservedPaise : c.spentPaise)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <p className="stitch-kicker">{label}</p>
      <p className="text-sm font-bold mt-1 tabular-nums" style={{ color: tone || "var(--app-text)" }}>{value ?? 0}</p>
    </div>
  );
}
