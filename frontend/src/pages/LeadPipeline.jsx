import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { ArrowLeftRight, ChevronDown, Clock3, MapPinned, PhoneCall, RefreshCw, Trophy, XCircle } from "lucide-react";
import api from "../services/api";
import { STATUS_OPTIONS } from "../utils/constants";
import { PhoneActions, WhatsAppLink, Spinner } from "../components/UI";
import CustomSelect from "../components/CustomSelect";
import { useAuth } from "../context/AuthContext";

const REFRESH_INTERVAL = 30_000; // 30 seconds

const STAGE_META = {
  "New":        { title: "New",         icon: Clock3,       badge: "bg-sky-500/15 text-sky-400",      bar: "bg-sky-400",     accent: "#38bdf8" },
  "Contacted":  { title: "Contacted",   icon: PhoneCall,    badge: "bg-amber-500/15 text-amber-400",  bar: "bg-amber-400",   accent: "#fbbf24" },
  "Site Visit": { title: "Site Visit",  icon: MapPinned,    badge: "bg-violet-500/15 text-violet-400",bar: "bg-violet-400",  accent: "#a78bfa" },
  "Negotiation":{ title: "Negotiation", icon: ArrowLeftRight,badge:"bg-orange-500/15 text-orange-400",bar: "bg-orange-400",  accent: "#fb923c" },
  "Closed Won": { title: "Closed Won",  icon: Trophy,       badge: "bg-emerald-500/15 text-emerald-400",bar:"bg-emerald-400",accent: "#34d399" },
  "Closed Lost":{ title: "Closed Lost", icon: XCircle,      badge: "bg-rose-500/15 text-rose-400",    bar: "bg-rose-400",    accent: "#fb7185" },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function LeadPipeline() {
  useEffect(() => { document.title = "Sales Pipeline - Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [members, setMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(""); // "" = all members
  const timerRef = useRef(null);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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

  const fetchLeads = useCallback(async (silent = false, userId = selectedUserId) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const params = { limit: 5000, page: 1 };
      if (userId) params.userId = userId;
      const { data } = await api.get("/leads/unified", { params });
      setLeads(data.leads || []);
      setLastUpdated(new Date());
    } catch {
      if (!silent) toast.error("Failed to load pipeline leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUserId]);

  // Fetch team members for the member picker (admin/manager only)
  useEffect(() => {
    if (!isAdminOrManager) return;
    api.get("/auth/users").then(({ data }) => setMembers(data.users || data || [])).catch(() => {});
  }, [isAdminOrManager]);

  // Initial load + live auto-refresh every 30s
  useEffect(() => {
    clearInterval(timerRef.current);
    fetchLeads(false, selectedUserId);
    timerRef.current = setInterval(() => fetchLeads(true, selectedUserId), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchLeads, selectedUserId]);

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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-app">Lead Pipeline</h1>
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-[11px] text-app-soft mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live · {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Member picker — admin / manager only */}
          {isAdminOrManager && members.length > 0 && (
            <CustomSelect
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="All Members"
              options={[
                { value: "", label: "All Members" },
                ...members.map((m) => ({ value: m._id, label: m.name })),
              ]}
              style={{ minWidth: 160 }}
            />
          )}
          <button
            onClick={() => fetchLeads(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div data-tour="pipeline-board" className="overflow-x-auto pb-3 -mx-4 px-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {STATUS_OPTIONS.map((status) => {
            const meta = STAGE_META[status];
            const Icon = meta.icon;
            const stageLeads = grouped[status] || [];

            return (
              <div
                key={status}
                className="flex flex-col rounded-2xl overflow-hidden"
                style={{
                  width: 256,
                  minWidth: 256,
                  border: "1px solid var(--app-border)",
                  background: "var(--app-surface-low)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                }}
              >
                {/* Column header */}
                <div className="shrink-0 px-3 pt-3 pb-2.5" style={{ background: "var(--app-surface)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${meta.badge}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="flex-1 text-[13px] font-bold text-app">{meta.title}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className={`h-0.5 rounded-full ${meta.bar}`} style={{ opacity: 0.6 }} />
                </div>

                {/* Scrollable cards */}
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-1.5"
                  style={{ maxHeight: "calc(100vh - 210px)" }}
                >
                  {stageLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed px-3 py-5 text-xs text-center text-app-soft" style={{ borderColor: "var(--app-border)" }}>
                      No leads here
                    </div>
                  )}

                  {stageLeads.map((lead) => {
                    const isOpen = expanded.has(lead._id);
                    return (
                      <article
                        key={lead._id}
                        className="rounded-xl overflow-hidden"
                        style={{
                          border: "1px solid var(--app-border)",
                          background: "var(--app-surface)",
                          boxShadow: isOpen ? "0 2px 12px rgba(0,0,0,0.08)" : "none",
                        }}
                      >
                        {/* Collapsed row — always visible */}
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                          onClick={() => toggleExpand(lead._id)}
                        >
                          {/* Accent bar */}
                          <div
                            className="shrink-0 w-1 rounded-full self-stretch"
                            style={{ background: meta.accent, opacity: 0.7, minHeight: 20 }}
                          />
                          {/* Name + project */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-app truncate leading-tight">{lead.name}</p>
                            {lead.projectName && (
                              <p className="text-[10px] text-app-soft truncate leading-none mt-0.5">{lead.projectName}</p>
                            )}
                          </div>
                          {/* Phone (stop propagation so click doesn't toggle) */}
                          <span onClick={e => e.stopPropagation()}>
                            <PhoneActions phone={lead.phone} onContact={() => handleContact(lead)} />
                          </span>
                          {/* Expand chevron */}
                          <ChevronDown
                            className="shrink-0 w-3.5 h-3.5 text-app-soft transition-transform duration-200"
                            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                          />
                        </div>

                        {/* Expanded details */}
                        {isOpen && (
                          <div
                            className="px-3 pb-3 space-y-2.5 border-t"
                            style={{ borderColor: "var(--app-border)" }}
                          >
                            {/* WhatsApp + source */}
                            <div className="flex items-center gap-2 pt-2">
                              <WhatsAppLink phone={lead.phone} name={lead.name} onContact={() => handleContact(lead)} />
                              <span className="text-[11px] text-app-soft">· {lead.source}</span>
                            </div>

                            {/* Follow-up date */}
                            {(lead.followUpDate || lead.followUp) && (
                              <p className="text-[11px] font-semibold text-orange-400">
                                Follow Up: {fmtDate(lead.followUpDate || lead.followUp)}
                              </p>
                            )}

                            {/* Notes (up to 2 lines) */}
                            {(lead.remark1 || lead.remark2 || lead.remarkNote) && (
                              <p className="text-[11px] text-app-soft leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {[lead.remark1, lead.remark2, lead.remarkNote].filter(Boolean).join(" · ")}
                              </p>
                            )}

                            {/* Move to stage */}
                            <CustomSelect
                              value={lead.status}
                              onChange={(v) => handleMove(lead, v)}
                              options={STATUS_OPTIONS}
                              style={{ width: "100%", fontSize: 12, padding: "6px 10px", borderRadius: 10 }}
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
