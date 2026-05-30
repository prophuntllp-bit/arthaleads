import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { ArrowLeftRight, CheckCircle2, Clock3, MapPinned, PhoneCall, RefreshCw, Trophy, XCircle } from "lucide-react";
import api from "../services/api";
import { STATUS_OPTIONS } from "../utils/constants";
import { PhoneActions, WhatsAppLink, Spinner } from "../components/UI";
import CustomSelect from "../components/CustomSelect";

const REFRESH_INTERVAL = 30_000; // 30 seconds

const STAGE_META = {
  "New": {
    title: "New",
    subtitle: "All uncontacted enquiries",
    icon: Clock3,
    stripe: "from-sky-500/25 via-sky-500/10 to-transparent",
    badge: "bg-sky-500/15 text-sky-300",
    border: "border-sky-500/20",
  },
  "Contacted": {
    title: "Contacted",
    subtitle: "Initial call or message completed",
    icon: PhoneCall,
    stripe: "from-amber-500/25 via-amber-500/10 to-transparent",
    badge: "bg-amber-500/15 text-amber-300",
    border: "border-amber-500/20",
  },
  "Site Visit": {
    title: "Site Visit",
    subtitle: "Visits scheduled or done",
    icon: MapPinned,
    stripe: "from-violet-500/25 via-violet-500/10 to-transparent",
    badge: "bg-violet-500/15 text-violet-300",
    border: "border-violet-500/20",
  },
  "Negotiation": {
    title: "Negotiation",
    subtitle: "Commercial discussion in progress",
    icon: ArrowLeftRight,
    stripe: "from-orange-500/25 via-orange-500/10 to-transparent",
    badge: "bg-orange-500/15 text-orange-300",
    border: "border-orange-500/20",
  },
  "Closed Won": {
    title: "Closed Won",
    subtitle: "Successful conversions",
    icon: Trophy,
    stripe: "from-emerald-500/25 via-emerald-500/10 to-transparent",
    badge: "bg-emerald-500/15 text-emerald-300",
    border: "border-emerald-500/20",
  },
  "Closed Lost": {
    title: "Closed Lost",
    subtitle: "Dropped or unqualified leads",
    icon: XCircle,
    stripe: "from-rose-500/25 via-rose-500/10 to-transparent",
    badge: "bg-rose-500/15 text-rose-300",
    border: "border-rose-500/20",
  },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function LeadPipeline() {
  useEffect(() => { document.title = "Sales Pipeline - Arthaleads CRM"; }, []);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const handleContact = async (lead) => {
    const updates = { remark: "Contacted" };
    if (lead.status === "New") updates.status = "Contacted";
    if (lead.remark === "Contacted" && lead.status !== "New") return;
    try {
      let updated;
      if (lead._type === "project" && lead.projectId) {
        const { data } = await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, updates);
        updated = data.data;
      } else {
        const { data } = await api.put(`/leads/${lead._id}`, updates);
        updated = data.data;
      }
      setLeads((curr) => curr.map((l) => l._id === lead._id ? { ...l, ...updates, ...(updated || {}), _type: lead._type, projectId: lead.projectId } : l));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update contact status");
    }
  };

  const fetchLeads = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get("/leads/unified", { params: { limit: 5000, page: 1 } });
      setLeads(data.leads || []);
      setLastUpdated(new Date());
    } catch {
      if (!silent) toast.error("Failed to load pipeline leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + live auto-refresh every 30s
  useEffect(() => {
    fetchLeads(false);
    timerRef.current = setInterval(() => fetchLeads(true), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchLeads]);

  const grouped = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = leads.filter((lead) => lead.status === status);
      return acc;
    }, {});
  }, [leads]);

  const handleMove = async (lead, nextStatus) => {
    if (lead.status === nextStatus) return;
    try {
      let updated;
      if (lead._type === "project" && lead.projectId) {
        const { data } = await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, { status: nextStatus });
        updated = data.data;
      } else {
        const { data } = await api.put(`/leads/${lead._id}`, { status: nextStatus });
        updated = data.data;
      }
      setLeads((curr) => curr.map((l) => l._id === lead._id ? { ...l, ...updated, _type: lead._type, projectId: lead.projectId } : l));
      toast.success(`Moved to ${nextStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to move lead");
    }
  };

  if (loading) return <div className="stitch-page flex items-center justify-center py-24"><Spinner /></div>;

  return (
    <div className="stitch-page space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-app">Lead Pipeline</h1>
          {lastUpdated && (
            <span className="flex items-center gap-1 text-[11px] text-app-soft mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live · updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchLeads(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50 shrink-0"
          style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Horizontal kanban — each column scrolls independently */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {STATUS_OPTIONS.map((status) => {
            const meta = STAGE_META[status];
            const Icon = meta.icon;
            const stageLeads = grouped[status] || [];
            return (
              <div
                key={status}
                className={`flex flex-col rounded-2xl border overflow-hidden ${meta.border}`}
                style={{ width: 252, minWidth: 252 }}
              >
                {/* Column header */}
                <div className={`bg-gradient-to-br ${meta.stripe} px-3 py-3 shrink-0`}>
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${meta.badge}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-app leading-none">{meta.title}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Scrollable lead cards */}
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-2"
                  style={{ maxHeight: "calc(100vh - 220px)", background: "var(--app-surface-low)" }}
                >
                  {stageLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed px-3 py-4 text-xs text-center text-app-soft" style={{ borderColor: "var(--app-border)" }}>
                      No leads here
                    </div>
                  )}

                  {stageLeads.map((lead) => (
                    <article
                      key={lead._id}
                      className="rounded-xl border p-3 space-y-2"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
                    >
                      {/* Name */}
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-[13px] font-semibold text-app leading-tight truncate">{lead.name}</p>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-orange-500 mt-0.5" />
                      </div>

                      {/* Phone + WhatsApp on one row */}
                      <div className="flex items-center gap-2">
                        <PhoneActions phone={lead.phone} onContact={() => handleContact(lead)} />
                        <WhatsAppLink phone={lead.phone} name={lead.name} onContact={() => handleContact(lead)} />
                      </div>

                      {/* Project tag */}
                      {lead.projectName && (
                        <p className="text-[11px] text-app-soft truncate leading-none">{lead.projectName}</p>
                      )}

                      {/* Follow-up date */}
                      {(lead.followUpDate || lead.followUp) && (
                        <p className="text-[11px] font-medium text-orange-400 leading-none">
                          {fmtDate(lead.followUpDate || lead.followUp)}
                        </p>
                      )}

                      {/* First note — single truncated line */}
                      {(lead.remark1 || lead.remark2 || lead.remarkNote) && (
                        <p className="text-[11px] text-app-soft truncate leading-none">
                          {lead.remark1 || lead.remark2 || lead.remarkNote}
                        </p>
                      )}

                      {/* Move to stage */}
                      <CustomSelect
                        value={lead.status}
                        onChange={(v) => handleMove(lead, v)}
                        options={STATUS_OPTIONS}
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px" }}
                      />
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
