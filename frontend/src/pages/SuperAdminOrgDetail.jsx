import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageLoader, Spinner } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, Building2, Users, BarChart3, FolderOpen,
  CheckCircle2, XCircle, Clock, ExternalLink, LogIn,
  Mail, Phone, Shield, Zap, RefreshCw, HardDrive,
  ShieldCheck, ChevronLeft, ChevronRight, Activity,
} from "lucide-react";

const PLAN_COLORS = {
  trial: "bg-yellow-500/10 text-yellow-600 border-yellow-500/25",
  starter: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  growth: "bg-violet-500/10 text-violet-600 border-violet-500/25",
  pro: "bg-violet-500/10 text-violet-600 border-violet-500/25",
  enterprise: "bg-orange-500/10 text-orange-600 border-orange-500/25",
};

const LEAD_STATUS_COLORS = {
  "New":          "#f97316",
  "Contacted":    "#3b82f6",
  "Interested":   "#8b5cf6",
  "Site Visit Booked": "#06b6d4",
  "Site Visit Done":   "#10b981",
  "Booked":       "#22c55e",
  "Not Interested":"#ef4444",
  "Not Reachable":"#78716c",
  "Call Back":    "#eab308",
  "Low Budget":   "#ec4899",
};

const ACTION_LABELS = {
  plan_change:         { label: "Plan Changed",    color: "bg-violet-500/10 text-violet-600 border-violet-500/25" },
  org_activated:       { label: "Org Activated",   color: "bg-green-500/10 text-green-600 border-green-500/25" },
  org_deactivated:     { label: "Org Deactivated", color: "bg-red-500/10 text-red-500 border-red-500/25" },
  trial_extended:      { label: "Trial Extended",  color: "bg-amber-500/10 text-amber-600 border-amber-500/25" },
  impersonate:         { label: "Impersonated",    color: "bg-blue-500/10 text-blue-600 border-blue-500/25" },
  org_name_changed:    { label: "Name Changed",    color: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
  logo_changed:        { label: "Logo Changed",    color: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
  brand_color_changed: { label: "Colour Changed",  color: "bg-pink-500/10 text-pink-600 border-pink-500/25" },
  broadcast_sent:      { label: "Broadcast Sent",  color: "bg-orange-500/10 text-orange-600 border-orange-500/25" },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function auditDetailText(log) {
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

function fmtBytes(bytes) {
  if (!bytes) return "< 1 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function RoleBadge({ role }) {
  const cls = {
    admin:       "bg-orange-500/10 text-orange-600 border-orange-500/25",
    manager:     "bg-blue-500/10 text-blue-600 border-blue-500/25",
    agent:       "bg-gray-500/10 text-gray-500 border-gray-500/25",
    super_admin: "bg-red-500/10 text-red-600 border-red-500/25",
  }[role] || "bg-gray-500/10 text-gray-500 border-gray-500/25";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {role?.replace("_", " ")}
    </span>
  );
}

const fmtDate     = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = d => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
const fmtFull     = d => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function SuperAdminOrgDetail() {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("overview");
  const [impersonating, setImp] = useState(false);

  // Activity tab state
  const [actLogs,    setActLogs]    = useState([]);
  const [actTotal,   setActTotal]   = useState(0);
  const [actPages,   setActPages]   = useState(1);
  const [actPage,    setActPage]    = useState(1);
  const [actLoading, setActLoading] = useState(false);
  const [actAction,  setActAction]  = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/super-admin/orgs/${id}`);
      setData(res);
    } catch {
      toast.error("Failed to load organisation detail");
      navigate("/super-admin/orgs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Org Detail · Arthaleads Admin";
    load();
  }, [id]);

  const loadActivity = useCallback(async (p = actPage) => {
    setActLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 25, orgId: id });
      if (actAction) params.set("action", actAction);
      const { data: res } = await api.get(`/super-admin/audit?${params}`);
      setActLogs(res.logs || []);
      setActTotal(res.total || 0);
      setActPages(res.pages || 1);
    } catch {
      toast.error("Failed to load activity log");
    } finally {
      setActLoading(false);
    }
  }, [id, actPage, actAction]);

  useEffect(() => {
    if (tab === "activity") {
      loadActivity(1);
      setActPage(1);
    }
  }, [tab, actAction]);

  useEffect(() => {
    if (tab === "activity") loadActivity(actPage);
  }, [actPage]);

  const handleImpersonate = async () => {
    if (!window.confirm(`Login as the admin of "${data.org.name}"? Your current admin session will end.`)) return;
    setImp(true);
    try {
      const { data: res } = await api.post(`/super-admin/orgs/${id}/impersonate`);
      sessionStorage.setItem("impersonating", JSON.stringify({
        orgName: res.orgName,
        adminName: res.adminName,
        adminEmail: res.adminEmail,
      }));
      toast.success(`Logged in as ${res.adminName} (${res.orgName})`);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err.response?.data?.message || "Impersonation failed");
      setImp(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data)   return null;

  const { org, users, leadByStatus, totalLeads, projectCount, automations, storageBytes } = data;
  const isTrialExpired = org.trialStatus === "expired";
  const effectivelyActive = org.isActive && !isTrialExpired;
  const planLabel = org.plan === "pro" ? "growth" : org.plan;

  const leadEntries = Object.entries(leadByStatus).sort((a, b) => b[1] - a[1]);
  const fbAutomation = automations?.find(a => a.platform === "facebook");

  return (
    <div className="stitch-page">
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-6">
        <Link to="/super-admin/orgs"
          className="mt-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-app-soft" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {org.logo
              ? <img src={org.logo} alt={org.name} className="w-12 h-12 rounded-2xl object-cover border flex-shrink-0"
                  style={{ borderColor: "var(--app-border)" }}
                  onError={e => e.currentTarget.style.display = "none"} />
              : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#a04100,#ff6b00)" }}>
                  {org.name?.charAt(0).toUpperCase()}
                </div>
            }
            <div className="min-w-0">
              <h1 className="text-xl font-black text-app truncate">{org.name}</h1>
              <p className="text-xs text-app-soft">{org.slug} · Joined {fmtDate(org.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PLAN_COLORS[org.plan] || ""}`}>
                {planLabel}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                isTrialExpired ? "bg-amber-500/10 text-amber-600 border-amber-500/25"
                : effectivelyActive ? "bg-green-500/10 text-green-600 border-green-500/25"
                : "bg-red-500/10 text-red-500 border-red-500/25"
              }`}>
                {isTrialExpired ? <><Clock className="w-2.5 h-2.5" /> Trial Expired</>
                  : effectivelyActive ? <><CheckCircle2 className="w-2.5 h-2.5" /> Active</>
                  : <><XCircle className="w-2.5 h-2.5" /> Inactive</>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trial info */}
      {org.plan === "trial" && org.trialEndsAt && (
        <div className={`rounded-2xl px-4 py-3 mb-5 text-sm font-medium flex items-center gap-2 ${
          isTrialExpired ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}>
          <Clock className="w-4 h-4 flex-shrink-0" />
          {isTrialExpired
            ? `Trial expired on ${fmtDate(org.trialEndsAt)}`
            : `Trial ends on ${fmtDate(org.trialEndsAt)}`}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        {[
          { label: "Team Members", value: users.length,           icon: Users,      color: "text-blue-500",   bg: "bg-blue-500/10" },
          { label: "Total Leads",  value: totalLeads,             icon: BarChart3,  color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Projects",     value: projectCount,           icon: FolderOpen, color: "text-green-500",  bg: "bg-green-500/10" },
          { label: "Automations",  value: automations?.length || 0, icon: Zap,      color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Storage Used", value: fmtBytes(storageBytes), icon: HardDrive,  color: "text-teal-500",   bg: "bg-teal-500/10",  isText: true },
        ].map(({ label, value, icon: Icon, color, bg, isText }) => (
          <div key={label} className="card p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`${isText ? "text-lg" : "text-2xl"} font-black ${color}`}>{value}</p>
            <p className="text-xs text-app-soft mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Impersonate button */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <div>
          <p className="text-sm font-bold text-app">Login As This Organisation</p>
          <p className="text-xs text-app-soft mt-0.5">Open the CRM as their admin to debug or assist. Your admin session will end — log back in via /admin-login.</p>
        </div>
        <button
          onClick={handleImpersonate}
          disabled={impersonating || !effectivelyActive}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 flex-shrink-0 cursor-pointer"
          style={{ background: effectivelyActive ? "var(--app-primary)" : undefined }}>
          {impersonating ? <><Spinner size="sm" /> Switching…</> : <><LogIn className="w-4 h-4" /> Login As</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl mb-4 w-fit" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
        {[
          { key: "overview",      label: "Overview" },
          { key: "users",         label: `Users (${users.length})` },
          { key: "integrations",  label: "Integrations" },
          { key: "activity",      label: `Activity (${actTotal > 0 ? actTotal : "…"})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              tab === key ? "text-white" : "text-app-soft hover:text-app"}`}
            style={tab === key ? { background: "var(--app-primary)" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Lead breakdown */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
              Lead Pipeline
            </div>
            {leadEntries.length === 0
              ? <p className="text-xs text-app-soft text-center py-10">No leads yet</p>
              : <div className="p-4 space-y-2">
                  {leadEntries.map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: LEAD_STATUS_COLORS[status] || "#888" }} />
                      <span className="text-xs text-app flex-1">{status}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.round((count / totalLeads) * 100)}%`, background: LEAD_STATUS_COLORS[status] || "#888" }} />
                      </div>
                      <span className="text-xs font-bold text-app w-8 text-right">{count}</span>
                    </div>
                  ))}
                  <p className="text-xs text-app-soft pt-1">Total: <strong className="text-app">{totalLeads}</strong> leads</p>
                </div>
            }
          </div>

          {/* Org details */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
              Organisation Info
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Plan",         value: planLabel.toUpperCase() },
                { label: "Status",       value: effectivelyActive ? "Active" : isTrialExpired ? "Trial Expired" : "Inactive" },
                { label: "Created",      value: fmtDate(org.createdAt) },
                { label: "Trial Ends",   value: org.trialEndsAt ? fmtDate(org.trialEndsAt) : "N/A" },
                { label: "Storage",      value: fmtBytes(storageBytes) },
                { label: "Brand Colour", value: org.brandColor || "Default" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <p className="text-xs text-app-soft w-28 flex-shrink-0">{label}</p>
                  <p className="text-xs font-semibold text-app flex items-center gap-1.5">
                    {label === "Brand Colour" && org.brandColor && (
                      <span className="inline-block w-3 h-3 rounded-full border border-white/20"
                        style={{ background: org.brandColor }} />
                    )}
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[700px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0
                  ? <tr><td colSpan={7} className="text-center py-10 text-app-soft text-sm">No users found</td></tr>
                  : users.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {u.avatar
                            ? <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                                onError={e => e.currentTarget.style.display = "none"} />
                            : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#a04100,#ff6b00)" }}>
                                {u.name?.charAt(0)?.toUpperCase()}
                              </div>
                          }
                          <span className="text-sm font-semibold text-app">{u.name}</span>
                        </div>
                      </td>
                      <td>
                        <a href={`mailto:${u.email}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
                        </a>
                      </td>
                      <td>
                        {u.phone
                          ? <a href={`tel:${u.phone}`} className="text-xs text-app flex items-center gap-1 hover:text-orange-500">
                              <Phone className="w-3 h-3 flex-shrink-0" />{u.phone}
                            </a>
                          : <span className="text-xs text-app-soft">—</span>
                        }
                      </td>
                      <td><RoleBadge role={u.role} /></td>
                      <td className="text-xs text-app-soft">{fmtDateTime(u.lastLogin)}</td>
                      <td className="text-xs text-app-soft">{fmtDate(u.createdAt)}</td>
                      <td className="text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.isActive ? "bg-green-500/10 text-green-600 border-green-500/25" : "bg-red-500/10 text-red-500 border-red-500/25"}`}>
                          {u.isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrations tab */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {/* Facebook */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#1877f2" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-app">Facebook Integration</p>
                <p className="text-xs text-app-soft">Lead ads & page connection</p>
              </div>
              {fbAutomation ? (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  fbAutomation.status === "active"
                    ? "bg-green-500/10 text-green-600 border-green-500/25"
                    : "bg-gray-500/10 text-gray-500 border-gray-500/25"
                }`}>
                  {fbAutomation.status?.toUpperCase()}
                </span>
              ) : (
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-500/10 text-gray-500 border-gray-500/25">
                  NOT CONNECTED
                </span>
              )}
            </div>
            {fbAutomation && (
              <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
                {fbAutomation.pageName && (
                  <p className="text-xs text-app-soft">Page: <strong className="text-app">{fbAutomation.pageName}</strong></p>
                )}
                {fbAutomation.pageId && (
                  <p className="text-xs text-app-soft">Page ID: <strong className="text-app">{fbAutomation.pageId}</strong></p>
                )}
                <p className="text-xs text-app-soft">Connected: <strong className="text-app">{fmtDate(fbAutomation.createdAt)}</strong></p>
              </div>
            )}
          </div>

          {/* WhatsApp placeholder */}
          <div className="card p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#25d366" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-app">WhatsApp</p>
              <p className="text-xs text-app-soft">Not tracked yet</p>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-500/10 text-gray-500 border-gray-500/25">
              N/A
            </span>
          </div>
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div>
          {/* Filter + refresh */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select
              className="input text-sm px-3 py-2 w-52"
              value={actAction}
              onChange={e => { setActAction(e.target.value); setActPage(1); }}
            >
              <option value="">All Actions</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]?.label}</option>
              ))}
            </select>
            {actAction && (
              <button onClick={() => { setActAction(""); setActPage(1); }}
                className="text-xs text-app-soft hover:text-app transition cursor-pointer">
                Clear filter
              </button>
            )}
            <button onClick={() => loadActivity(actPage)}
              className="ml-auto btn-secondary gap-1.5 text-xs px-3 py-2 cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="card overflow-hidden">
            {actLoading ? (
              <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
            ) : actLogs.length === 0 ? (
              <div className="text-center py-16">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-app-soft opacity-40" />
                <p className="text-sm text-app-soft">No admin activity recorded for this organisation</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="stitch-table min-w-[600px]">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Performed By</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actLogs.map(log => {
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
                          <td className="text-xs text-app-soft">{auditDetailText(log) || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {actPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">Page {actPage} of {actPages} · {actTotal} events</p>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                    disabled={actPage <= 1} onClick={() => setActPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 text-app" />
                  </button>
                  <span className="text-xs font-semibold text-app px-2">{actPage}</span>
                  <button
                    className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                    disabled={actPage >= actPages} onClick={() => setActPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4 text-app" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
