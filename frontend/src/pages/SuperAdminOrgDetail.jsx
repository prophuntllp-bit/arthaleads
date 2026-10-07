import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageLoader, Spinner, AppSelect, SmartImage, RoleBadge } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, Building2, Users, BarChart3, FolderOpen,
  CheckCircle2, XCircle, Clock, ExternalLink, LogIn,
  Mail, Phone, Shield, Zap, RefreshCw, HardDrive,
  ShieldCheck, ChevronLeft, ChevronRight, Activity, Sparkles, MessageCircle, Save,
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
  storage_updated:     { label: "Storage Changed", color: "bg-teal-500/10 text-teal-600 border-teal-500/25" },
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
    case "storage_updated":     return [d.extraGb !== undefined && `extra ${d.extraGb} GB`, d.limitGb !== undefined && `limit ${d.limitGb ?? "plan default"} GB`, d.recordingDays !== undefined && `recordings ${d.recordingDays ?? "plan default"} d`].filter(Boolean).join(" · ");
    default:                    return "";
  }
}

function fmtBytes(bytes) {
  if (!bytes) return "< 1 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const fmtSize = (bytes) => {
  const b = Number(bytes) || 0;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
};
const CATEGORY_LABELS = { project_media: "Project photos, PDFs, videos", recordings: "Call recordings", attendance: "Attendance selfies", logo: "Logo", other: "Other" };
const fmtRupees = (paise) => `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Meter({ pct, danger }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: danger ? "#dc2626" : pct >= 80 ? "#f59e0b" : "var(--app-primary)" }} />
    </div>
  );
}

const fmtDate     = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = d => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
const fmtFull     = d => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtMonth    = m => { if (!m) return "—"; const [y, mo] = m.split("-"); return new Date(+y, +mo - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };

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
    if (!window.confirm(`Login as the admin of "${data.org.name}"?`)) return;
    setImp(true);
    try {
      const { data: res } = await api.post(`/super-admin/orgs/${id}/impersonate`);
      sessionStorage.setItem("impersonating", JSON.stringify({
        orgName: res.orgName,
        adminName: res.adminName,
        adminEmail: res.adminEmail,
        superAdminToken: res.superAdminToken,
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

  const { org, users, totalLeads, projectCount, automations = [], storageBytes, aiUsage = [], storage, limits, whatsapp: wa } = data;
  const isTrialExpired = org.trialStatus === "expired";
  const effectivelyActive = org.isActive && !isTrialExpired;
  const planLabel = org.plan === "pro" ? "growth" : org.plan;

  const activeUsers = users.filter(u => u.isActive).length;

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
              ? <SmartImage src={org.logo} alt={org.name} className="w-12 h-12 rounded-2xl object-cover border flex-shrink-0"
                  style={{ borderColor: "var(--app-border)" }} />
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
          { label: "Team Members", value: limits?.seats?.limit ? `${activeUsers} / ${limits.seats.limit}` : activeUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", isText: !!limits?.seats?.limit },
          { label: "Total Leads",  value: totalLeads.toLocaleString("en-IN"), icon: BarChart3,  color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Projects",     value: limits?.projects?.limit ? `${projectCount} / ${limits.projects.limit}` : projectCount, icon: FolderOpen, color: "text-green-500",  bg: "bg-green-500/10", isText: !!limits?.projects?.limit },
          { label: "Integrations", value: automations.length, icon: Zap,      color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "File Storage", value: storage ? `${fmtSize(storage.usedBytes)} / ${fmtSize(storage.limitBytes)}` : "—", icon: HardDrive,  color: storage?.full ? "text-red-500" : storage?.warn ? "text-amber-500" : "text-teal-500", bg: "bg-teal-500/10", isText: true },
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
          <p className="text-xs text-app-soft mt-0.5">Open the CRM as their admin to debug or assist. Exit Impersonation returns you to the admin panel.</p>
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
          { key: "usage",         label: "Storage & Usage" },
          { key: "billing",       label: "Billing" },
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
        <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Plan & limits: what this org's plan allows and how much of it is used */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
              Plan &amp; Limits
            </div>
            <div className="p-4 space-y-4">
              {[
                { label: "Team members", used: limits?.seats?.used ?? activeUsers, limit: limits?.seats?.limit },
                { label: "Projects",     used: limits?.projects?.used ?? projectCount, limit: limits?.projects?.limit },
                { label: "File storage", used: storage?.usedBytes || 0, limit: storage?.limitBytes, bytes: true },
              ].map(({ label, used, limit, bytes }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-app">{label}</span>
                    <span className="text-app-soft tabular-nums">
                      {bytes ? fmtSize(used) : used} of {limit ? (bytes ? fmtSize(limit) : limit) : "unlimited"}
                    </span>
                  </div>
                  {limit ? <Meter pct={(used / limit) * 100} danger={used >= limit} /> : <Meter pct={0} />}
                </div>
              ))}
              <div className="pt-3 border-t grid grid-cols-2 gap-x-4 gap-y-2 text-xs" style={{ borderColor: "var(--app-border)" }}>
                <span className="text-app-soft">Recordings kept</span><span className="font-semibold text-app">{storage?.recordingDays} days</span>
                <span className="text-app-soft">Leads</span><span className="font-semibold text-app">{totalLeads.toLocaleString("en-IN")}</span>
                <span className="text-app-soft">Database size</span><span className="font-semibold text-app">{fmtBytes(storageBytes)}</span>
              </div>
            </div>
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
                { label: "Billing cycle", value: org.billingCycle ? `${org.billingCycle}${org.seats ? ` · ${org.seats} seats` : ""}` : "N/A" },
                { label: "Paid until",   value: org.paidUntil ? fmtDate(org.paidUntil) : "N/A" },
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
              {/* Onboarding fields */}
              <div className="pt-2 mt-1 border-t space-y-3" style={{ borderColor: "var(--app-border)" }}>
                {[
                  { label: "Industry",   value: org.industry   || "—" },
                  { label: "Team Size",  value: org.companySize || "—" },
                  { label: "City",       value: org.city        || "—" },
                  { label: "Onboarded",  value: org.onboardingCompletedAt ? fmtDate(org.onboardingCompletedAt) : "Pending" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <p className="text-xs text-app-soft w-28 flex-shrink-0">{label}</p>
                    <p className={`text-xs font-semibold ${
                      label === "Onboarded" && !org.onboardingCompletedAt
                        ? "text-amber-500"
                        : "text-app"
                    }`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Usage */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--app-border)" }}>
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="font-bold text-app text-sm">AI Usage (last 6 months)</span>
            <span className="ml-2 text-[10px] text-app-soft border rounded-full px-2 py-0.5" style={{ borderColor: "var(--app-border)" }}>
              Help Bot, WhatsApp agent, drafts, templates
            </span>
          </div>
          {aiUsage.length === 0 ? (
            <p className="text-xs text-app-soft text-center py-10">No AI usage recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="stitch-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: "center" }}>Help Bot</th>
                    <th style={{ textAlign: "center" }}>WA Drafts</th>
                    <th style={{ textAlign: "center" }}>WA Agent Replies</th>
                    <th style={{ textAlign: "center" }}>Template AI</th>
                    <th style={{ textAlign: "center" }}>Total Calls</th>
                    <th style={{ textAlign: "right" }}>Tokens Used</th>
                  </tr>
                </thead>
                <tbody>
                  {aiUsage.map(row => {
                    const helpCalls = (row.calls || 0) - (row.waDraftCalls || 0);
                    return (
                      <tr key={row.month}>
                        <td className="text-sm font-semibold text-app">{fmtMonth(row.month)}</td>
                        <td className="text-sm text-app" style={{ textAlign: "center" }}>{helpCalls}</td>
                        <td className="text-sm text-app" style={{ textAlign: "center" }}>{row.waDraftCalls || 0}</td>
                        <td className="text-sm text-app" style={{ textAlign: "center" }}>{(row.botReplyCalls || 0) + (row.botEnrichCalls || 0)}</td>
                        <td className="text-sm text-app" style={{ textAlign: "center" }}>{row.templateGenCalls || 0}</td>
                        <td className="text-sm font-bold text-indigo-500" style={{ textAlign: "center" }}>{row.calls || 0}</td>
                        <td className="text-sm font-bold text-app" style={{ textAlign: "right" }}>{(row.totalTokens || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Storage & usage tab */}
      {tab === "usage" && storage && (
        <StorageUsageTab orgId={id} storage={storage} wa={wa} org={org} onSaved={load} />
      )}

      {/* Billing tab */}
      {tab === "billing" && (() => {
        const hasBilling = org.address || org.gstNo || org.pan || org.bankAccountNo;
        const row = (label, value) => value ? (
          <div key={label} className="flex items-start gap-2 py-2 border-b last:border-0" style={{ borderColor: "var(--app-border)" }}>
            <p className="text-xs text-app-soft w-36 flex-shrink-0 pt-0.5">{label}</p>
            <p className="text-xs font-semibold text-app break-all">{value}</p>
          </div>
        ) : null;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Legal / Tax */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
                Legal &amp; Tax Details
              </div>
              {!hasBilling ? (
                <p className="text-xs text-app-soft text-center py-10">Organisation has not configured billing details yet.</p>
              ) : (
                <div className="px-4 py-2">
                  {row("Address",  org.address)}
                  {row("Phone",    org.phone)}
                  {row("Email",    org.email)}
                  {row("GST No.",  org.gstNo)}
                  {row("PAN",      org.pan)}
                  {row("CIN",      org.cin)}
                  {row("RERA No.", org.rera)}
                  {!org.address && !org.gstNo && !org.pan && !org.cin && !org.rera && !org.phone && !org.email && (
                    <p className="text-xs text-app-soft text-center py-6">No legal details set.</p>
                  )}
                </div>
              )}
            </div>
            {/* Bank */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
                Bank Details
              </div>
              <div className="px-4 py-2">
                {row("Account Name",   org.bankAccountName)}
                {row("Account No.",    org.bankAccountNo)}
                {row("IFSC Code",      org.bankIfsc)}
                {row("Bank Name",      org.bankName)}
                {row("Branch",         org.bankBranch)}
                {!org.bankAccountName && !org.bankAccountNo && !org.bankIfsc && !org.bankName && !org.bankBranch && (
                  <p className="text-xs text-app-soft text-center py-6">No bank details set.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                            ? <SmartImage src={u.avatar} alt={u.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
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
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>
              Lead source connections ({automations.length})
            </div>
            {automations.length === 0 ? (
              <p className="text-xs text-app-soft text-center py-10">Nothing connected yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="stitch-table min-w-[560px]">
                  <thead><tr><th>Platform</th><th>Name</th><th>Details</th><th>Connected</th><th className="text-center">Status</th></tr></thead>
                  <tbody>
                    {automations.map((a) => {
                      const on = a.isActive !== false && a.status !== "inactive" && a.status !== "disconnected";
                      return (
                        <tr key={a._id}>
                          <td className="text-sm font-semibold text-app">{a.platform}</td>
                          <td className="text-xs text-app">{a.name || "—"}</td>
                          <td className="text-xs text-app-soft">{a.pageName || a.pageId || a.mode || "—"}</td>
                          <td className="text-xs text-app-soft">{fmtDate(a.createdAt)}</td>
                          <td className="text-center">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${on ? "bg-green-500/10 text-green-600 border-green-500/25" : "bg-gray-500/10 text-gray-500 border-gray-500/25"}`}>
                              {on ? "ACTIVE" : "OFF"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#25d366" }}>
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-app">WhatsApp</p>
                <p className="text-xs text-app-soft">{wa?.connected ? `Connected${wa.provider ? ` via ${wa.provider}` : ""}` : "Not connected"}</p>
              </div>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${wa?.connected ? "bg-green-500/10 text-green-600 border-green-500/25" : "bg-gray-500/10 text-gray-500 border-gray-500/25"}`}>
                {wa?.connected ? "CONNECTED" : "NOT CONNECTED"}
              </span>
            </div>
            {wa?.connected && <p className="text-xs text-app-soft">Credits, agents and message counts are under Storage &amp; Usage.</p>}
          </div>
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div>
          {/* Filter + refresh */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <AppSelect
              value={actAction}
              onChange={v => { setActAction(v); setActPage(1); }}
              placeholder="All Actions"
              options={[{ value: "", label: "All Actions" }, ...ALL_ACTIONS.map(a => ({ value: a, label: ACTION_LABELS[a]?.label }))]}
              className="w-52"
              triggerClassName="text-sm"
            />
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

function WhatsAppFacts({ wa }) {
  // 11 facts fill two rows of six
  const facts = [
    ["Credit balance", fmtRupees(wa.creditsPaise)],
    ["On hold", fmtRupees(wa.creditsReservedPaise)],
    ["Free replies used (month)", (wa.freeUsedMonth ?? 0).toLocaleString("en-IN")],
    ["AI agents", `${wa.agentsActive ?? 0} active of ${wa.agentsTotal ?? 0}`],
    ["Button-flow agents", wa.ctwaAgents ?? 0],
    ["Bot replies (30 d)", (wa.botMsgs30 ?? 0).toLocaleString("en-IN")],
    ["Chats started (30 d)", (wa.convos30 ?? 0).toLocaleString("en-IN")],
    ["Messages in (30 d)", (wa.msgsIn30 ?? 0).toLocaleString("en-IN")],
    ["Messages out (30 d)", (wa.msgsOut30 ?? 0).toLocaleString("en-IN")],
    ["Bot on for new chats", wa.botEnabled ? "Yes" : "No"],
    ["Chats, all time", (wa.convosTotal ?? 0).toLocaleString("en-IN")],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4 pt-3 border-t" style={{ borderColor: "var(--app-border)" }}>
      {facts.map(([k, v]) => (
        <div key={k}>
          <p className="text-xs text-app-soft">{k}</p>
          <p className="text-sm font-semibold text-app tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}

function StorageUsageTab({ orgId, storage, wa, org, onSaved }) {
  const GB = 1024 ** 3;
  const [extra, setExtra] = useState(String(Math.round((storage.extraBytes / GB) * 100) / 100));
  const [limit, setLimit] = useState(org.storage?.limitBytes != null ? String(Math.round((org.storage.limitBytes / GB) * 100) / 100) : "");
  const [days, setDays] = useState(org.storage?.recordingDays != null ? String(org.storage.recordingDays) : "");
  const [note, setNote] = useState(storage.note || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/super-admin/orgs/${orgId}/storage`, {
        extraGb: Number(extra || 0),
        limitGb: limit === "" ? null : Number(limit),
        recordingDays: days === "" ? null : Number(days),
        note,
      });
      toast.success("Storage updated");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update storage");
    } finally { setSaving(false); }
  };

  const cats = Object.entries(storage.byCategory || {}).sort((a, b) => b[1].bytes - a[1].bytes);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>File storage</div>
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-xl font-bold text-app">{fmtSize(storage.usedBytes)}</p>
              <p className="text-xs text-app-soft">of {fmtSize(storage.limitBytes)} · {storage.percent}%</p>
            </div>
            <Meter pct={storage.percent} danger={storage.full} />
            <p className="mt-1.5 text-[11px] text-app-soft">
              Plan allowance {fmtSize(storage.planBaseBytes)}{storage.extraBytes ? ` + ${fmtSize(storage.extraBytes)} extra` : ""} · {storage.files} files
              {storage.full ? " · uploads blocked" : storage.warn ? " · customer sees the 80% warning" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {cats.length === 0 && <p className="text-xs text-app-soft">No files stored yet.</p>}
            {cats.map(([cat, v]) => (
              <div key={cat} className="flex items-center gap-3 text-xs">
                <span className="flex-1 text-app">{CATEGORY_LABELS[cat] || cat}</span>
                <span className="text-app-soft tabular-nums">{v.files} files</span>
                <span className="font-semibold text-app tabular-nums w-20 text-right">{fmtSize(v.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-app text-sm" style={{ borderColor: "var(--app-border)" }}>Grant more space</div>
        <div className="p-4 space-y-3">
          {[
            { label: "Extra space (GB)", value: extra, set: setExtra, hint: "Added on top of the plan allowance. Sold in 10 GB blocks at about ₹99 a month." },
            { label: "Replace plan allowance with (GB)", value: limit, set: setLimit, hint: "For a negotiated deal. Leave empty to use the plan's allowance." },
            { label: "Keep call recordings (days)", value: days, set: setDays, hint: "Leave empty to use the plan's period." },
          ].map(({ label, value, set, hint }) => (
            <div key={label}>
              <label className="text-xs font-semibold text-app">{label}</label>
              <input className="input mt-1" type="number" min="0" step="any" value={value} onChange={(e) => set(e.target.value)} />
              <p className="text-[11px] text-app-soft mt-1">{hint}</p>
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-app">Note</label>
            <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this was changed" maxLength={300} />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary gap-2 cursor-pointer">
            {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

      {wa?.connected && (
        <div className="card p-5 lg:col-span-2">
          <p className="text-sm font-bold text-app mb-3">WhatsApp activity</p>
          <WhatsAppFacts wa={wa} />
        </div>
      )}
    </div>
  );
}
