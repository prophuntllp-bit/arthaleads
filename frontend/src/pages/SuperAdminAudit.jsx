import { useState, useEffect, useCallback } from "react";
import { Spinner, AppSelect } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { ShieldCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const ACTION_LABELS = {
  plan_change:         { label: "Plan Changed",         color: "bg-violet-500/10 text-violet-600 border-violet-500/25" },
  org_activated:       { label: "Org Activated",        color: "bg-green-500/10 text-green-600 border-green-500/25" },
  org_deactivated:     { label: "Org Deactivated",      color: "bg-red-500/10 text-red-500 border-red-500/25" },
  trial_extended:      { label: "Trial Extended",       color: "bg-amber-500/10 text-amber-600 border-amber-500/25" },
  impersonate:         { label: "Impersonated",         color: "bg-blue-500/10 text-blue-600 border-blue-500/25" },
  org_name_changed:    { label: "Name Changed",         color: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
  logo_changed:        { label: "Logo Changed",         color: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
  brand_color_changed: { label: "Colour Changed",       color: "bg-pink-500/10 text-pink-600 border-pink-500/25" },
  broadcast_sent:      { label: "Broadcast Sent",       color: "bg-orange-500/10 text-orange-600 border-orange-500/25" },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function detailText(log) {
  const d = log.details || {};
  switch (log.action) {
    case "plan_change":         return `${d.from?.toUpperCase()} → ${d.to?.toUpperCase()}`;
    case "trial_extended":      return `+${d.days} day${d.days !== 1 ? "s" : ""}`;
    case "impersonate":         return `as ${log.targetUserName || "?"} (${d.adminEmail || ""})`;
    case "org_name_changed":    return `"${d.from}" → "${d.to}"`;
    case "brand_color_changed": return d.color || "";
    case "broadcast_sent":      return `${d.sent} sent · "${d.subject?.slice(0, 40)}"`;
    default:                    return "";
  }
}

const fmtFull = d => d ? new Date(d).toLocaleString("en-IN", {
  day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
}) : "—";

export default function SuperAdminAudit() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [action,  setAction]  = useState("");

  useEffect(() => { document.title = "Audit Log · Arthaleads Admin"; }, []);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50 });
      if (action) params.set("action", action);
      const { data } = await api.get(`/super-admin/audit?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { load(1); setPage(1); }, [action]);
  useEffect(() => { load(page); }, [page]);

  return (
    <div className="stitch-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
          <ShieldCheck className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-app">Audit Log</h1>
          <p className="text-xs text-app-soft mt-0.5">{total} admin action{total !== 1 ? "s" : ""} recorded</p>
        </div>
        <button onClick={() => load(page)} className="ml-auto btn-secondary gap-1.5 text-xs px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <AppSelect
          value={action}
          onChange={v => setAction(v)}
          placeholder="All Actions"
          options={[{ value: "", label: "All Actions" }, ...ALL_ACTIONS.map(a => ({ value: a, label: ACTION_LABELS[a]?.label }))]}
          className="w-52"
          triggerClassName="text-sm"
        />
        {action && (
          <button onClick={() => setAction("")}
            className="text-xs text-app-soft hover:text-app transition">
            Clear filter
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-app-soft text-center py-16">No audit events found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Organisation</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const meta = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-500/10 text-gray-500 border-gray-500/25" };
                  return (
                    <tr key={log._id}>
                      <td className="text-xs text-app-soft whitespace-nowrap">{fmtFull(log.createdAt)}</td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="text-xs font-semibold text-app">{log.performedByName || "—"}</td>
                      <td className="text-xs text-app">{log.targetOrgName || "—"}</td>
                      <td className="text-xs text-app-soft">{detailText(log) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
            <p className="text-xs text-app-soft">Page {page} of {pages} · {total} entries</p>
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4 text-app" />
              </button>
              <span className="text-xs font-semibold text-app px-2">{page}</span>
              <button className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4 text-app" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
