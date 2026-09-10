import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, Megaphone, CheckCircle2, XCircle, Clock } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const STATUS = {
  draft:     { fg: "var(--app-text-soft)", bg: "var(--app-surface-low)",  label: "Draft",     Icon: Clock },
  sending:   { fg: "#b45309", bg: "rgba(251,191,36,0.14)", label: "Sending",   Icon: Loader2 },
  sent:      { fg: "#15803d", bg: "rgba(34,197,94,0.12)",  label: "Sent",      Icon: CheckCircle2 },
  failed:    { fg: "#b91c1c", bg: "rgba(239,68,68,0.12)",  label: "Failed",    Icon: XCircle },
  cancelled: { fg: "var(--app-text-soft)", bg: "var(--app-surface-low)",  label: "Cancelled", Icon: XCircle },
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function CampaignsPage() {
  const { user } = useAuth();
  const canEdit = ["admin", "manager", "super_admin"].includes(user?.role);
  const [rows, setRows]    = useState([]);
  const [loading, setLoad] = useState(true);

  const load = useCallback(() => {
    setLoad(true);
    api.get("/whatsapp/campaigns")
      .then(r => setRows(r.data.campaigns || []))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="stitch-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">Campaigns</h1>
          <p className="text-xs text-app-soft">
            Send an approved template to a filtered set of leads
          </p>
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
          <Megaphone className="w-9 h-9 mx-auto text-app-soft opacity-40 mb-3" />
          <p className="text-sm text-app font-semibold">No campaigns yet</p>
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
          {rows.map(c => {
            const s = STATUS[c.status] || STATUS.draft;
            const st = c.stats || {};
            return (
              <div key={c._id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-app">{c.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: s.bg, color: s.fg }}>
                        <s.Icon className={`w-2.5 h-2.5 ${c.status === "sending" ? "animate-spin" : ""}`} />
                        {s.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-app-soft mt-1">
                      {c.templateName} · {fmtDate(c.createdAt)}
                      {c.createdByName ? ` · ${c.createdByName}` : ""}
                    </p>
                  </div>

                  {c.status === "draft" && canEdit && (
                    <Link to={`/conversations/campaigns/${c._id}`}
                      className="btn-secondary rounded-full px-4 py-1.5 text-xs font-semibold shrink-0">
                      Review &amp; send
                    </Link>
                  )}
                </div>

                {(c.status === "sent" || c.status === "sending" || c.status === "failed") && (
                  <div className="flex gap-5 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <Stat label="Sent"    value={st.sent} />
                    <Stat label="Failed"  value={st.failed} tone={st.failed ? "#b91c1c" : undefined} />
                    {st.skippedNoConsent > 0 && <Stat label="No consent" value={st.skippedNoConsent} />}
                    {/* Meta drops marketing messages when a recipient has hit
                        their cap across all businesses. Its own line so it is
                        not read as us failing. */}
                    {st.droppedByMeta > 0 && <Stat label="Recipient limit" value={st.droppedByMeta} />}
                    {c.spentPaise > 0 && (
                      <Stat label="Cost" value={`₹${(c.spentPaise / 100).toFixed(2)}`} />
                    )}
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
      <p className="text-[10px] text-app-soft">{label}</p>
      <p className="text-sm font-bold" style={{ color: tone || "var(--app-text)" }}>
        {value ?? 0}
      </p>
    </div>
  );
}
