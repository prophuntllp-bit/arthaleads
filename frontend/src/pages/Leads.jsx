import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  StatusBadge, PriorityBadge, SourceBadge,
  PageLoader, EmptyState, ConfirmDialog, Spinner, PhoneActions, WhatsAppLink, toWaNumber,
} from "../components/UI";
import LeadForm from "../components/LeadForm";
import LeadDetail from "../components/LeadDetail";
import CustomSelect from "../components/CustomSelect";
import TransferModal from "../components/TransferModal";
import QrModal from "../components/QrModal";
import { useLeads } from "../hooks/useLeads";
import { useColumnResize, RTh } from "../hooks/useColumnResize";
import api from "../services/api";
import toast from "react-hot-toast";
import { DATE_RANGE_OPTIONS, fmtDate, fmtCurrency, PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from "../utils/constants";

// Strip raw Elementor/form field-ID lines like "Field 9b10818: 8007678625"
// These appear when a form plugin sends fields with hex IDs instead of labels.
const cleanRequirements = (text) => {
  if (!text) return "";
  return text
    .split("\n")
    .filter(line => !/^Field\s+[a-f0-9]{5,}\s*:/i.test(line.trim()))
    .join("\n")
    .trim();
};

// Compact budget formatter: 8000000 → "80L", 10000000 → "1Cr"
const fmtBudget = (val) => {
  if (!val || val === 0) return "";
  if (val >= 10_000_000) return `${parseFloat((val / 10_000_000).toFixed(2)).toString()}Cr`;
  if (val >= 100_000) return `${parseFloat((val / 100_000).toFixed(1)).toString()}L`;
  return `₹${val}`;
};
import { ArrowRightLeft, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, FolderKanban, Globe, MessageSquare, Pencil, Plus, QrCode, Search, Send, Trash2, Upload, User, Users, X } from "lucide-react";
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";
import DateTimePicker from "../components/DateTimePicker";

// ── Inline editable text cell ─────────────────────────────────────────────────
function InlineText({ value, leadId, projectId, field, onSaved, placeholder = "Add note…", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || "");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setEditing(false);
    if (val === (value || "")) return;
    setSaving(true);
    try {
      const res = projectId
        ? await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: val })
        : await api.put(`/leads/${leadId}`, { [field]: val });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); setVal(value || ""); }
    finally { setSaving(false); }
  };

  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;

  if (editing) {
    const shared = {
      autoFocus: true,
      className: "w-full min-w-[140px] rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400",
      style: { borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" },
      value: val,
      onChange: (e) => setVal(e.target.value),
      onBlur: save,
      onKeyDown: (e) => e.key === "Escape" && setEditing(false),
    };
    return multiline
      ? <textarea {...shared} rows={2} className={shared.className + " resize-none"} />
      : <input {...shared} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />;
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="block cursor-pointer rounded px-1 py-0.5 text-xs transition hover:bg-orange-500/10 min-w-[80px]"
      title="Click to edit"
    >
      {val || <span className="text-app-soft italic">{placeholder}</span>}
    </span>
  );
}


// ── Inline date cell (compact single-line) ────────────────────────────────────
function InlineDate({ value, leadId, projectId, field, onSaved }) {
  const [saving, setSaving] = useState(false);
  const save = async (isoStr) => {
    setSaving(true);
    try {
      const res = projectId
        ? await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: isoStr })
        : await api.put(`/leads/${leadId}`, { [field]: isoStr });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return <DateTimePicker value={value} onChange={save} />;
}

// ── Inline booking select ─────────────────────────────────────────────────────
const BOOKING_OPTIONS = [
  { value: "",                   label: "- None -",           color: null },
  { value: "Interested",         label: "Interested",          color: "#2563eb" }, // blue
  { value: "Not Interested",     label: "Not Interested",      color: "#ef4444" }, // red
  { value: "Not Reachable",      label: "Not Reachable",       color: "#6b7280" }, // gray
  { value: "Low Budget",         label: "Low Budget",          color: "#db2777" }, // pink
  { value: "Call Back",          label: "Call Back",           color: "#d97706" }, // amber
  { value: "Site Visit Booked",  label: "Site Visit Booked",   color: "#7c3aed" }, // violet
  { value: "Site Visit Done",    label: "Site Visit Done",     color: "#0d9488" }, // teal
  { value: "Booked",             label: "Booked",              color: "#16a34a" }, // green
  { value: "Other Location",     label: "Other Location",      color: "#ea580c" }, // orange
  { value: "Commercial",         label: "Commercial",          color: "#4f46e5" }, // indigo
];

function InlineBooking({ value, leadId, projectId, onSaved }) {
  const [saving, setSaving] = useState(false);

  const save = async (v) => {
    setSaving(true);
    try {
      const res = projectId
        ? await api.patch(`/projects/${projectId}/leads/${leadId}`, { booking: v })
        : await api.put(`/leads/${leadId}`, { booking: v });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <CustomSelect
      value={value || ""}
      onChange={save}
      placeholder="- None -"
      options={BOOKING_OPTIONS.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.label, color: o.color }))}
      style={{ minWidth: 130, fontWeight: 600 }}
    />
  );
}

// ── Project lead inline helpers ───────────────────────────────────────────────
function ProjInlineText({ value, leadId, projectId, field, placeholder = "Add note…", multiline = false, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || "");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setEditing(false);
    if (val === (value || "")) return;
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: val });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); setVal(value || ""); }
    finally { setSaving(false); }
  };

  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  if (editing) {
    const shared = {
      autoFocus: true,
      className: "w-full min-w-[120px] rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400",
      style: { borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" },
      value: val, onChange: (e) => setVal(e.target.value), onBlur: save,
      onKeyDown: (e) => e.key === "Escape" && setEditing(false),
    };
    return multiline
      ? <textarea {...shared} rows={2} className={shared.className + " resize-none"} />
      : <input {...shared} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />;
  }
  return (
    <span onClick={() => setEditing(true)}
      className="block cursor-pointer rounded px-1 py-0.5 text-xs transition hover:bg-orange-500/10 min-w-[70px]" title="Click to edit">
      {val || <span className="text-app-soft italic">{placeholder}</span>}
    </span>
  );
}

// ── Remark cell - click to edit inline, blur/Enter to save ──────────────────
const REMARK_PREVIEW_LEN = 40;
function RemarkPopupCell({ value, leadId, projectId, field, placeholder = "Add remark…", onSaved }) {
  const [editing, setEditing]   = useState(false);
  const [val, setVal]           = useState(value || "");
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState(false);

  // keep local val in sync when parent refreshes data
  useEffect(() => { if (!editing) setVal(value || ""); }, [value, editing]);

  const save = async () => {
    setEditing(false);
    if (val === (value || "")) return;
    setSaving(true);
    try {
      const res = projectId
        ? await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: val })
        : await api.put(`/leads/${leadId}`, { [field]: val });
      onSaved?.(res.data.data);
    } catch { toast.error("Save failed"); setVal(value || ""); }
    finally { setSaving(false); }
  };

  if (saving) return <span className="flex items-center px-1"><Spinner size="sm" /></span>;

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={2}
        className="w-full min-w-[130px] rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400 resize-none"
        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setVal(value || ""); } }}
      />
    );
  }

  const needsToggle = val.length > REMARK_PREVIEW_LEN;
  const displayed = expanded || !needsToggle ? val : val.slice(0, REMARK_PREVIEW_LEN) + "…";

  return (
    <div className="min-w-[100px] max-w-[180px]">
      <span
        onClick={() => setEditing(true)}
        className="block cursor-pointer rounded px-1 py-0.5 text-xs leading-relaxed text-app transition hover:bg-orange-500/10"
        title="Click to edit"
      >
        {val ? displayed : <span className="text-app-soft italic">{placeholder}</span>}
      </span>
      {needsToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
          className="block mt-0.5 ml-1 text-orange-400 hover:text-orange-500 text-[10px] font-medium transition"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function ProjInlineDate({ value, leadId, projectId, field, onSaved }) {
  const [saving, setSaving] = useState(false);
  const save = async (isoStr) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: isoStr });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return <DateTimePicker value={value} onChange={save} />;
}

const PROJ_BOOKING_OPTIONS = [
  { value: "",                   label: "- None -",           color: null },
  { value: "Interested",         label: "Interested",          color: "#2563eb" },
  { value: "Not Interested",     label: "Not Interested",      color: "#ef4444" },
  { value: "Not Reachable",      label: "Not Reachable",       color: "#6b7280" },
  { value: "Low Budget",         label: "Low Budget",          color: "#db2777" },
  { value: "Call Back",          label: "Call Back",           color: "#d97706" },
  { value: "Site Visit Booked",  label: "Site Visit Booked",   color: "#7c3aed" },
  { value: "Site Visit Done",    label: "Site Visit Done",     color: "#0d9488" },
  { value: "Booked",             label: "Booked",              color: "#16a34a" },
  { value: "Other Location",     label: "Other Location",      color: "#ea580c" },
  { value: "Commercial",         label: "Commercial",          color: "#4f46e5" },
];

function ProjInlineBooking({ value, leadId, projectId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const save = async (v) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${leadId}`, { booking: v });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <CustomSelect
      value={value || ""}
      onChange={save}
      placeholder="- None -"
      options={PROJ_BOOKING_OPTIONS.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.label, color: o.color }))}
      style={{ minWidth: 125, fontWeight: 600 }}
    />
  );
}

// ── Column resize hook ────────────────────────────────────────────────────────
// Drag the right edge of any <th> to resize that column. Works by tracking


// ── Unified contact status cell (works for both regular & project leads) ─────
function ContactStatusCell({ lead, projectId, onUpdated }) {
  const [remark, setRemark] = useState(lead.remark || "");
  const [saving, setSaving] = useState(false);

  const save = async (v) => {
    setSaving(true);
    try {
      let res;
      if (projectId) {
        res = await api.patch(`/projects/${projectId}/leads/${lead._id}/remark`, { remark: v, remarkNote: "" });
      } else {
        res = await api.put(`/leads/${lead._id}`, { remark: v });
      }
      onUpdated(res.data.data);
    } catch { toast.error("Failed to save remark"); }
    finally { setSaving(false); }
  };

  const triggerStyle = remark === "Contacted"
    ? { color: "#16a34a", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", fontWeight: 600 }
    : remark === "Not Contacted"
    ? { color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontWeight: 600 }
    : { fontWeight: 600 };

  if (saving) return <span className="flex items-center px-2"><Spinner size="sm" /></span>;
  return (
    <CustomSelect
      value={remark}
      onChange={(v) => { setRemark(v); save(v); }}
      placeholder="- None -"
      options={[
        { value: "Contacted",     label: "Contacted"     },
        { value: "Not Contacted", label: "Not Contacted" },
      ]}
      style={{ minWidth: 140, width: "100%", ...triggerStyle }}
    />
  );
}

export default function Leads() {
  useEffect(() => { document.title = "Lead Management - Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const isAdmin = user?.role && user.role !== "agent";
  const location = useLocation();
  const navigate = useNavigate();
  const {
    leads, total, loading, page, setPage,
    filters, setFilter,
    upsertLead, removeLead, refetch, pages, limit, changeLimit,
  } = useLeads("unified", {
    search: location.state?.presetSearch || "",
    status: location.state?.presetStatus || "",
    source: location.state?.presetSource || "",
    followUpToday: location.state?.presetFollowUpToday ? "true" : "",
    myOnly: (() => { try { return localStorage.getItem("leads_myOnly") === "true" ? "true" : ""; } catch { return ""; } })(),
  });

  const toggleMyOnly = () => {
    const next = filters.myOnly !== "true";
    setFilter("myOnly", next ? "true" : "");
    try { localStorage.setItem("leads_myOnly", String(next)); } catch {}
  };

  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // transferMeta: { lead, leadType: "lead"|"project", projectId: string|null }
  const [transferMeta, setTransferMeta] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOrgQr, setShowOrgQr] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const exportMenuRef = useRef(null);
  const exportBtnRef = useRef(null);
  const topScrollRef   = useRef(null);
  const tableScrollRef = useRef(null);
  const topSpacerRef   = useRef(null);
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, right: 0 });

  // ── Bulk select state ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");
  const [bulkAssigning, setBulkAssigning]     = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState("");
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);
  const [waBroadcast, setWaBroadcast]         = useState(null); // null | { list, msg, idx, skipped, step }

  // ── Project-wise leads ────────────────────────────────────────────────────
  const [projRefreshKey, setProjRefreshKey] = useState(0);
  const [projects, setProjects]               = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projLeads, setProjLeads]             = useState([]);
  const [projTotal, setProjTotal]             = useState(0);
  const [projPage, setProjPage]               = useState(1);
  const [projPages, setProjPages]             = useState(1);
  const [projLoading, setProjLoading]         = useState(false);
  const [projSearch, setProjSearch]           = useState("");
  const [projDeletingId, setProjDeletingId]         = useState(null);
  const [projDeleting, setProjDeleting]             = useState(false);
  const [projSelectedIds, setProjSelectedIds]       = useState(new Set());
  const [showProjBulkConfirm, setShowProjBulkConfirm] = useState(false);
  const [projBulkDeleting, setProjBulkDeleting]     = useState(false);
  const [projLimit, setProjLimit] = useState(10);

  // ── Column widths for main leads table (resizable via drag, persisted) ──────
  const [colW, startResize] = useColumnResize("leads", {
    lead: 180, phone: 172, source: 118, project: 118,
    status: 88, priority: 82, requirements: 175, budget: 88, purpose: 72,
    remark: 128, remark1: 118, remark2: 118,
    followup: 185, followup2: 185, booking: 138,
    property: 148, assigned: 98, actions: 108,
  });

  // Clear preset state from location so back-navigation doesn't re-apply filters
  useEffect(() => {
    if (location.state?.openAddLead) {
      setShowForm(true);
    }
    if (location.state?.presetStatus || location.state?.presetSource || location.state?.presetFollowUpToday || location.state?.presetSearch || location.state?.openAddLead) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  useEffect(() => {
    api.get("/projects").then((r) => setProjects(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setProjLoading(true);
    api.get(`/projects/${selectedProject._id}/leads`, { params: { page: projPage, limit: projLimit, search: projSearch } })
      .then((r) => { setProjLeads(r.data.leads); setProjTotal(r.data.total); setProjPages(r.data.pages); })
      .catch(() => toast.error("Failed to load project leads"))
      .finally(() => setProjLoading(false));
  }, [selectedProject, projPage, projSearch, projLimit, projRefreshKey]);

  useEffect(() => {
    if (user?.role !== "agent") {
      api.get("/auth/agents").then((r) => setAgents(r.data.agents)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const openLeadId = location.state?.openLeadId;
    if (!openLeadId || loading) return;

    const localLead = leads.find((lead) => lead._id === openLeadId);
    if (localLead) {
      setDetailLead(localLead);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    api.get(`/leads/${openLeadId}`)
      .then(({ data }) => {
        setDetailLead(data.data);
        navigate(location.pathname, { replace: true, state: {} });
      })
      .catch(() => toast.error("Unable to open that lead"));
  }, [leads, loading, location.pathname, location.state, navigate]);

  // Export menu is closed via the backdrop div in the portal (onClick={() => setShowExportMenu(false)})

  // Clear selection when page changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, filters]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l._id));
  const someSelected = leads.some((l) => selectedIds.has(l._id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map((l) => l._id)));
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSaved = (saved) => {
    upsertLead(saved, !editLead);
    setShowForm(false);
    setEditLead(null);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/leads/${deletingId}`);
      removeLead(deletingId);
      toast.success("Lead moved to Dump");
    } catch (e) {
      toast.error(e.response?.data?.message || "Move to Dump failed");
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  // Auto-mark lead as Contacted when agent clicks call or WhatsApp
  const handleContact = async (lead) => {
    const updates = { remark: "Contacted" };
    if (lead.status === "New") updates.status = "Contacted";
    // Skip if already contacted and remark already set
    if (lead.remark === "Contacted" && lead.status !== "New") return;
    try {
      const res = lead._type === "project" && lead.projectId
        ? await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, updates)
        : await api.put(`/leads/${lead._id}`, updates);
      upsertLead({ ...lead, ...updates, ...(res.data.data || {}) });
    } catch { /* silent - the call/chat still happened */ }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await api.delete("/leads/bulk", { data: { ids } });
      ids.forEach((id) => removeLead(id));
      setSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} moved to Dump`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Move to Dump failed");
    } finally {
      setBulkDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignAgentId) { toast.error("Please select an agent"); return; }
    setBulkAssigning(true);
    try {
      const ids = [...selectedIds];
      const r = await api.post("/leads/bulk-assign", { ids, agentId: bulkAssignAgentId });
      toast.success(r.data.message || `${ids.length} lead(s) assigned`);
      // Update leads in table: set assignedTo + assignedToName
      const agent = agents.find((a) => a._id === bulkAssignAgentId);
      if (agent) {
        ids.forEach((id) => {
          const lead = leads.find((l) => l._id === id);
          if (lead) upsertLead({ ...lead, assignedTo: agent._id, assignedToName: agent.name }, false);
        });
      }
      setSelectedIds(new Set());
      setBulkAssignAgentId("");
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk assign failed");
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatusValue) { toast.error("Please select a status"); return; }
    setBulkUpdatingStatus(true);
    try {
      const ids = [...selectedIds];
      const r = await api.patch("/leads/bulk-status", { ids, status: bulkStatusValue });
      toast.success(r.data.message || `${ids.length} lead(s) updated`);
      ids.forEach((id) => {
        const lead = leads.find((l) => l._id === id);
        if (lead) upsertLead({ ...lead, status: bulkStatusValue }, false);
      });
      setSelectedIds(new Set());
      setBulkStatusValue("");
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk status update failed");
    } finally {
      setBulkUpdatingStatus(false);
    }
  };

  const handleDetailUpdated = (updated) => {
    upsertLead(updated, false);
    setDetailLead(updated);
  };

  const handleInlineUpdate = (updated) => {
    if (updated?.booking === "Not Interested") {
      removeLead(updated._id);
      toast.success("Lead moved to Dump");
    } else {
      upsertLead(updated, false);
    }
  };

  const projAllSelected = projLeads.length > 0 && projLeads.every((l) => projSelectedIds.has(l._id));
  const projSomeSelected = projLeads.some((l) => projSelectedIds.has(l._id));

  const projToggleAll = () => {
    if (projAllSelected) setProjSelectedIds(new Set());
    else setProjSelectedIds(new Set(projLeads.map((l) => l._id)));
  };

  const projToggleOne = (lid) => {
    setProjSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lid)) next.delete(lid); else next.add(lid);
      return next;
    });
  };

  const handleProjLeadUpdated = (updated) => {
    if (updated?.booking === "Not Interested") {
      setProjLeads((prev) => prev.filter((l) => l._id !== updated._id));
      toast.success("Lead moved to Dump");
    } else {
      setProjLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
    }
  };

  const handleProjBulkDelete = async () => {
    setProjBulkDeleting(true);
    try {
      const ids = [...projSelectedIds];
      await api.delete(`/projects/${selectedProject._id}/leads/bulk`, { data: { ids } });
      setProjLeads((prev) => prev.filter((l) => !projSelectedIds.has(l._id)));
      setProjTotal((t) => t - ids.length);
      setProjSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk delete failed");
    } finally {
      setProjBulkDeleting(false);
      setShowProjBulkConfirm(false);
    }
  };

  const handleProjDeleteLead = async () => {
    setProjDeleting(true);
    try {
      await api.delete(`/projects/${selectedProject._id}/leads/${projDeletingId}`);
      setProjLeads((prev) => prev.filter((l) => l._id !== projDeletingId));
      setProjTotal((t) => t - 1);
      toast.success("Lead deleted");
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed");
    } finally {
      setProjDeleting(false);
      setProjDeletingId(null);
    }
  };


  const exportRows = async (type, selectedIdsOverride = null) => {
    const tid = toast.loading("Preparing export…");
    try {
      const date = new Date().toISOString().slice(0, 10);

      // Respect current filters AND the current page + row-count setting.
      // If specific IDs are selected, fetch just enough to cover them.
      const params = new URLSearchParams();
      if (filters.status)    params.set("status",    filters.status);
      if (filters.source)    params.set("source",    filters.source);
      if (filters.priority)  params.set("priority",  filters.priority);
      if (filters.search)    params.set("search",    filters.search);
      if (filters.dateRange) params.set("dateRange", filters.dateRange);
      // Use the current page + limit so export matches exactly what the user sees
      params.set("limit", String(limit));
      params.set("page",  String(page));

      const { data: res } = await api.get(`/leads/unified?${params.toString()}`);
      let source = res.leads || [];

      // If specific IDs selected, narrow to those
      if (selectedIdsOverride && selectedIdsOverride.size > 0) {
        source = source.filter((l) => selectedIdsOverride.has(String(l._id)));
      }

      // Helper: force a value to a plain string so xlsx/Excel never coerces
      // phone numbers into scientific notation or strips leading zeros
      const str = (v) => (v == null || v === "" ? "" : String(v));

      const rows = source.map((lead) => ({
        Name:          str(lead.name),
        Phone:         str(lead.phone),           // kept as string - no numeric coercion
        Email:         str(lead.email),
        Source:        str(lead.source),
        LeadSource:    str(lead.leadSourceLabel),  // sub-source / campaign label
        Status:        str(lead.status),
        Priority:      str(lead.priority),
        PropertyType:  str(lead.propertyType),
        BHK:           str(lead.bhk),
        Purpose:       str(lead.purpose),
        BudgetMin:     lead.budget?.min ?? "",
        BudgetMax:     lead.budget?.max ?? "",
        FollowUpDate:  lead.followUpDate  ? new Date(lead.followUpDate).toISOString().slice(0, 10)  : "",
        FollowUpDate2: lead.followUp2     ? new Date(lead.followUp2).toISOString().slice(0, 10)     : "",
        FollowUpNote:  str(lead.followUpNote),
        Remark:        str(lead.remark),
        Remark1:       str(lead.remark1),
        Remark2:       str(lead.remark2),
        Booking:       str(lead.booking),
        AssignedTo:    str(lead.assignedToName),
        Project:       str(lead.projectName),
        CreatedAt:     lead.createdAt ? new Date(lead.createdAt).toISOString().slice(0, 10) : "",
      }));

      toast.dismiss(tid);
      if (rows.length === 0) { toast.error("No leads to export"); return; }

      const label = selectedIdsOverride?.size > 0
        ? `${selectedIdsOverride.size}-selected`
        : `page${page}-of${limit}`;

      if (type === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `leads-${label}-${date}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        // Build the sheet manually so we can force the Phone column to type "s" (string).
        // json_to_sheet would detect numeric-looking strings and coerce them to numbers,
        // which causes Excel to show scientific notation for long phone numbers.
        const ws = xlsxUtils.json_to_sheet(rows);

        // Walk every cell in the Phone column (column B, index 1) and stamp type="s"
        const colKeys = Object.keys(rows[0] || {});
        const phoneColIdx = colKeys.indexOf("Phone");
        if (phoneColIdx >= 0) {
          const phoneColLetter = xlsxUtils.encode_col(phoneColIdx);
          for (let r = 1; r <= rows.length; r++) {
            const cellAddr = `${phoneColLetter}${r + 1}`; // +1 for header row
            if (ws[cellAddr]) {
              ws[cellAddr].t = "s"; // force string
              ws[cellAddr].z = "@"; // Excel "Text" number format
            }
          }
        }

        const wb = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(wb, ws, "Leads");
        const ext = type === "excel" ? "xlsx" : "csv";
        xlsxWriteFile(wb, `leads-${label}-${date}.${ext}`, { bookType: ext });
      }

      toast.success(`Exported ${rows.length} lead${rows.length !== 1 ? "s" : ""}`);
    } catch (e) {
      toast.dismiss(tid);
      toast.error("Export failed: " + (e.response?.data?.message || e.message));
    }
  };

  // ── Standard CRM import (Name/Phone/Email columns) ───────────────────────────
  // Normalise header: lowercase, strip all punctuation/spaces → "leadname", "phonenumber" etc.
  const normKey = (s) => String(s).toLowerCase().replace(/[\s_\-().#\/\\]/g, "");

  // Build a header-lookup closure for one row. Tries aliases in priority order,
  // returns the first non-empty value found (or "").
  const makeColPicker = (row) => {
    const map = {};
    for (const h of Object.keys(row)) map[normKey(h)] = h;
    return (...candidates) => {
      for (const c of candidates) {
        const orig = map[normKey(c)];
        if (orig !== undefined && String(row[orig] ?? "").trim() !== "") return String(row[orig]).trim();
      }
      return "";
    };
  };

  // Content-based column inference: scan up to 10 rows to find which header
  // matches name / phone / email by the shape of values when alias lookup fails.
  const inferColByContent = (rows, type) => {
    const headers = Object.keys(rows[0]);
    const sample = rows.slice(0, Math.min(10, rows.length));
    const score = (header) => {
      let hits = 0;
      for (const r of sample) {
        const v = String(r[header] ?? "").trim();
        if (!v) continue;
        if (type === "name"  && /^[A-Za-z\s'.\-]{2,60}$/.test(v) && !/\d/.test(v)) hits++;
        if (type === "phone" && /^\+?[\d\s\-()]{8,16}$/.test(v.replace(/\s/g, ""))) hits++;
        if (type === "email" && v.includes("@") && v.includes(".")) hits++;
      }
      return hits;
    };
    // Pick the header with the highest hit count (min 2 hits to avoid false positives)
    let best = null, bestScore = 1;
    for (const h of headers) {
      const s = score(h);
      if (s > bestScore) { bestScore = s; best = h; }
    }
    return best; // null if nothing found
  };

  const parseImportRow = (row, inferredCols = {}) => {
    const col = makeColPicker(row);

    const name = col(
      "Lead Name","LeadName","Full Name","FullName","Name","Customer Name","CustomerName",
      "Contact Name","ContactName","Client Name","ClientName","User Name","UserName",
      "Prospect","Party","Buyer","Person","Contact","Customer"
    ) || (inferredCols.name ? String(row[inferredCols.name] ?? "").trim() : "");

    const phone = col(
      "Phone","Phone Number","PhoneNumber","Mobile","Mobile Number","MobileNumber",
      "Contact Number","ContactNumber","Cell","WhatsApp","Whatsapp Number","WhatsappNumber",
      "Mob","Tel","Telephone"
    ) || (inferredCols.phone ? String(row[inferredCols.phone] ?? "").trim() : "");

    const email = col(
      "Email","Email Address","EmailAddress","Email ID","EmailID","Mail","E-mail","E Mail"
    ) || (inferredCols.email ? String(row[inferredCols.email] ?? "").trim() : "");

    const agentName = col("Agent","Assigned To","AssignedTo","Assigned Agent","AssignedAgent","Salesperson","Sales Person");
    const assignedAgent = agentName
      ? agents.find((a) => a.name?.toLowerCase() === agentName.toLowerCase())
      : undefined;

    // Budget: try split min/max first, then single Budget field
    const budgetSingle = col("Budget","Budget Range","BudgetRange");
    const budgetMin = Number(col("Budget Min","BudgetMin","Min Budget","MinBudget")) || 0;
    const budgetMax = Number(col("Budget Max","BudgetMax","Max Budget","MaxBudget") || budgetSingle) || 0;

    // Follow-up date: handle Excel serial numbers and string dates
    const fuRaw = col("Follow Up Date","FollowUpDate","Follow-Up Date","Followup Date","FollowupDate","Next Followup","NextFollowup");
    let followUpDate = null;
    if (fuRaw) {
      const n = Number(fuRaw);
      if (!isNaN(n) && n > 40000) {
        // Excel serial date → JS date
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        followUpDate = d.toISOString();
      } else {
        const parsed = new Date(fuRaw);
        if (!isNaN(parsed)) followUpDate = parsed.toISOString();
      }
    }

    return {
      name,
      phone,
      email,
      source:            col("Source","Lead Source","LeadSource") || "Manual",
      status:            col("Status","Lead Status","LeadStatus") || "New",
      priority:          col("Priority","Lead Priority","LeadPriority") || "Medium",
      propertyType:      col("Property Type","PropertyType","Requirements","Requirement","Property","Type") || "Apartment",
      bhk:               col("BHK","Bhk","Configuration","Config") || "N/A",
      purpose:           col("Purpose","Requirement Type","RequirementType","Intent") || "Buy",
      preferredLocation: col("Area","Location","Preferred Location","PreferredLocation","City","Locality"),
      followUpDate,
      followUpNote:      col("Follow Up Note","FollowUpNote","Remark","Remarks","Note","Notes","Comment"),
      assignedTo:        assignedAgent?._id || null,
      budget: { min: budgetMin, max: budgetMax, currency: "INR" },
    };
  };

  // ── Native CSV/TSV parser (no xlsx dependency) ───────────────────────────────
  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const parseRow = (line) => {
      const vals = [];
      let cur = "", inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === delim && !inQuote) { vals.push(cur); cur = ""; continue; }
        cur += ch;
      }
      vals.push(cur);
      return vals;
    };
    const headers = parseRow(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
      return obj;
    });
  };

  // ── Facebook Lead Form CSV parser ─────────────────────────────────────────────
  // Columns to strip (Facebook metadata)
  const FB_META = new Set([
    "id", "created_time", "ad_id", "ad_name", "adset_id", "adset_name",
    "campaign_id", "campaign_name", "form_id", "form_name", "is_organic", "platform",
  ]);
  // Mandatory contact columns (always present)
  const FB_CONTACT = new Set(["full_name", "phone_number", "email", "street_address", "city"]);

  const isFbCsv = (headers) =>
    headers.includes("full_name") && headers.includes("phone_number");

  // Underscores → spaces, collapse whitespace
  const fbClean = (v = "") => String(v).replace(/_/g, " ").replace(/\s+/g, " ").trim();

  // "₹80_lakh_–_₹1_cr" → { min: 8000000, max: 10000000 }
  const parseFbBudget = (v = "") => {
    const s = String(v).replace(/[₹,\s]/g, "").toLowerCase();
    const parts = s.split(/[–\-]+/);
    const toINR = (p = "") => {
      // strip leading/trailing underscores left from splitting (e.g. "_1_cr" → "1_cr")
      const cleaned = p.replace(/^_+|_+$/g, "");
      const n = parseFloat(cleaned);
      if (isNaN(n) || n === 0) return 0;
      if (cleaned.includes("cr")) return Math.round(n * 10_000_000);
      if (cleaned.includes("lakh") || cleaned.includes("lac")) return Math.round(n * 100_000);
      return Math.round(n);
    };
    return { min: toINR(parts[0]), max: toINR(parts[1] || parts[0]), currency: "INR" };
  };

  // "end_use_(self-use)" → "Buy", "investment" → "Invest", "rent" → "Rent"
  const parseFbPurpose = (v = "") => {
    const s = String(v).toLowerCase();
    if (s.includes("invest")) return "Invest";
    if (s.includes("rent")) return "Rent";
    return "Buy";
  };

  const parseFbRow = (row, questionCols) => {
    const location = [row.street_address, row.city]
      .map((s) => fbClean(String(s || "")))
      .filter(Boolean)
      .join(", ");

    let purpose = "Buy";
    let budget = { min: 0, max: 0, currency: "INR" };
    let followUpNote = "";
    const extras = [];

    for (const col of questionCols) {
      const raw = String(row[col] || "").trim();
      if (!raw) continue;
      const colLower = col.toLowerCase();

      if (colLower.includes("budget")) {
        budget = parseFbBudget(raw);
      } else if (colLower.includes("purpose")) {
        purpose = parseFbPurpose(raw);
      } else if (colLower.includes("when") || colLower.includes("plan") || colLower.includes("timeline") || colLower.includes("time")) {
        // Purchase timeline → followUpNote (visible in Lead Detail Info tab)
        followUpNote = fbClean(raw);
      } else {
        // Any other question → general remark (NOT remark1/remark2 which are for agent notes)
        const label = col.replace(/_/g, " ").replace(/\?$/, "").trim();
        extras.push(`${label}: ${fbClean(raw)}`);
      }
    }

    return {
      name: String(row.full_name || "").replace(/^"|"$/g, "").trim(),
      phone: String(row.phone_number || "").replace(/^p:/i, "").trim(),
      email: String(row.email || "").trim(),
      source: "Facebook",
      preferredLocation: location,
      purpose,
      budget,
      followUpNote,
      remark: extras.join(" | "),
      // remark1 and remark2 intentionally left empty - reserved for agent notes after calling
      status: "New",
      priority: "Medium",
    };
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      let rows;
      if (isCsv) {
        // Parse CSV/TSV without xlsx - handles UTF-16 LE (Facebook export) and UTF-8
        let text;
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          text = new TextDecoder("utf-16le").decode(buffer.slice(2));
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          text = new TextDecoder("utf-16be").decode(buffer.slice(2));
        } else {
          text = new TextDecoder("utf-8").decode(buffer);
        }
        rows = parseCsvText(text);
      } else {
        const workbook = xlsxRead(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        rows = xlsxUtils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
      }
      if (!rows.length) { toast.error("File is empty"); return; }

      const headers = Object.keys(rows[0]);
      let leadsToImport;

      if (isFbCsv(headers)) {
        // Auto-detected Facebook Lead Form export
        const questionCols = headers.filter((h) => !FB_META.has(h) && !FB_CONTACT.has(h));
        leadsToImport = rows.map((row) => parseFbRow(row, questionCols)).filter((e) => e.name && e.phone);
        if (!leadsToImport.length) { toast.error("No valid leads in the Facebook export"); return; }
        toast(`Facebook format detected - ${questionCols.length} custom question(s) mapped`, { icon: "📋" });
      } else {
        // Standard CRM import format
        // First pass: try alias-based matching
        let parsed = rows.map((r) => parseImportRow(r, {}));
        const firstPassValid = parsed.filter((e) => e.name && e.phone);

        if (!firstPassValid.length) {
          // Second pass: infer columns by cell-value content (handles any header name)
          const inferredCols = {
            name:  inferColByContent(rows, "name"),
            phone: inferColByContent(rows, "phone"),
            email: inferColByContent(rows, "email"),
          };
          if (inferredCols.name || inferredCols.phone) {
            parsed = rows.map((r) => parseImportRow(r, inferredCols));
            const inferred = parsed.filter((e) => e.name && e.phone);
            if (inferred.length) {
              const detectedNames = Object.entries(inferredCols)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}="${v}"`)
                .join(", ");
              toast(`Auto-detected columns: ${detectedNames}`, { icon: "🔍" });
              leadsToImport = inferred;
            }
          }
        } else {
          leadsToImport = firstPassValid;
        }

        if (!leadsToImport?.length) { toast.error("No valid leads found — check that your file has name and phone columns"); return; }
      }

      const { data } = await api.post("/leads/import", { leads: leadsToImport });
      toast.success(data.message || `${leadsToImport.length} lead(s) imported`);
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Import failed");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const canDelete = true; // all roles can delete; super_admin = permanent, others = soft → dump

  // Sync top scrollbar ↔ table scrollbar, and keep spacer width = table scrollWidth
  useEffect(() => {
    const top    = topScrollRef.current;
    const table  = tableScrollRef.current;
    const spacer = topSpacerRef.current;
    if (!top || !table) return;

    // Keep spacer width in sync with actual table scroll width
    const syncWidth = () => {
      if (spacer) spacer.style.width = table.scrollWidth + "px";
    };
    syncWidth();

    const ro = new ResizeObserver(syncWidth);
    ro.observe(table);

    const onTopScroll   = () => { table.scrollLeft = top.scrollLeft; };
    const onTableScroll = () => { top.scrollLeft   = table.scrollLeft; };
    top.addEventListener("scroll",   onTopScroll);
    table.addEventListener("scroll", onTableScroll);
    return () => {
      ro.disconnect();
      top.removeEventListener("scroll",   onTopScroll);
      table.removeEventListener("scroll", onTableScroll);
    };
  }, []);

  return (
    <div className="stitch-page space-y-6">
      {/* ── Header + filters (single card) ────────────────────────────────────── */}
      <div className="card px-5 py-4 space-y-3">
        {/* Row 1: title + action buttons */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 overflow-hidden">
            <h1 className="text-[15px] sm:text-xl font-black tracking-tight text-app leading-none truncate">Leads Management</h1>
            <p className="text-xs text-app-soft mt-1 hidden sm:block">{total} active leads across your property funnel.</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Import — compact icon button */}
            <label
              className="inline-flex items-center justify-center h-8 w-8 rounded-full cursor-pointer transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
              title={importing ? "Importing…" : "Import CSV/Excel"}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
            {/* Export — compact icon button */}
            <div ref={exportMenuRef} data-tour="export-btn">
              <button
                ref={exportBtnRef}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
                title="Export leads"
                onClick={() => {
                  const rect = exportBtnRef.current?.getBoundingClientRect();
                  if (rect) setExportMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  setShowExportMenu((c) => !c);
                }}
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            {/* QR Code */}
            <button
              className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
              title="Lead capture QR code"
              onClick={() => setShowOrgQr(true)}
            >
              <QrCode className="h-3.5 w-3.5 shrink-0" />
            </button>
            {/* Add Lead */}
            <button
              data-tour="add-lead-btn"
              className="btn-primary flex items-center gap-1.5 rounded-full whitespace-nowrap"
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600 }}
              onClick={() => { setEditLead(null); setShowForm(true); }}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* Row 2: filters — 3-col × 3-row grid on sm+ */}
        {(() => {
          const activeFilterCount = [
            filters.status, filters.source, filters.priority, filters.siteFilter,
            filters.assignedTo,
            filters.myOnly === "true" ? "t" : null, selectedProject ? "t" : null,
          ].filter(Boolean).length;
          return (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--app-border)" }}>
              {/* Mobile: search + filters toggle always visible */}
              <div className="flex items-center gap-2 sm:hidden">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-soft" />
                  <input
                    style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 10, fontSize: 13, border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", outline: "none" }}
                    placeholder="Search name, phone…"
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                  />
                </div>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold relative transition-all flex-shrink-0"
                  style={{ padding: "5px 12px", border: "1px solid var(--app-border)", background: showFilters ? "var(--app-primary)" : "var(--app-surface-low)", color: showFilters ? "#fff" : "var(--app-text-soft)" }}
                  onClick={() => setShowFilters(f => !f)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Filter grid: 3-col on sm+; 2-col expandable on mobile */}
              <div className={`${showFilters ? "grid" : "hidden"} grid-cols-2 gap-2 sm:grid sm:grid-cols-3`} data-tour="leads-search">
                {/* R1C1: Search — sm+ only */}
                <div className="relative hidden sm:block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-soft" />
                  <input
                    style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 10, fontSize: 13, border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", outline: "none" }}
                    placeholder="Search name, phone…"
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                  />
                </div>
                {/* R1C2: Domain */}
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-soft" />
                  <input
                    style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 10, fontSize: 13, border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", outline: "none" }}
                    placeholder="Domain…"
                    value={filters.siteFilter || ""}
                    onChange={(e) => setFilter("siteFilter", e.target.value)}
                  />
                </div>
                {/* R1C3: Agent filter — admin/manager only */}
                {isAdmin && agents.length > 0 && (
                  <CustomSelect
                    value={filters.assignedTo || ""}
                    onChange={(v) => setFilter("assignedTo", v)}
                    placeholder="All Agents"
                    options={agents.map((a) => ({ value: a._id, label: a.name }))}
                    style={{ width: "100%" }}
                  />
                )}
                {/* R2C1: Projects */}
                {projects.length > 0 && (
                  <CustomSelect
                    value={selectedProject?._id || ""}
                    onChange={(v) => {
                      const p = projects.find((x) => x._id === v) || null;
                      setSelectedProject(p); setProjPage(1); setProjSearch("");
                    }}
                    placeholder="All Projects"
                    options={projects.map((p) => ({ value: p._id, label: `${p.name} (${p.leadCount || 0})` }))}
                    style={{ width: "100%" }}
                  />
                )}
                {/* Status, Source, Priority */}
                {[
                  { key: "status",   placeholder: "All Statuses",   opts: STATUS_OPTIONS   },
                  { key: "source",   placeholder: "All Sources",    opts: SOURCE_OPTIONS   },
                  { key: "priority", placeholder: "All Priorities", opts: PRIORITY_OPTIONS },
                ].map(({ key, placeholder, opts }) => (
                  <CustomSelect
                    key={key}
                    value={filters[key]}
                    onChange={(v) => setFilter(key, v)}
                    placeholder={placeholder}
                    options={opts}
                    style={{ width: "100%" }}
                  />
                ))}
                {/* Date range */}
                <CustomSelect
                  value={filters.dateRange}
                  onChange={(v) => setFilter("dateRange", v)}
                  placeholder="Date range"
                  options={DATE_RANGE_OPTIONS}
                  style={{ width: "100%" }}
                />
                {/* My Leads — admin/manager only */}
                {isAdmin && (
                  <div className="col-span-2 sm:col-auto">
                    <button
                      onClick={toggleMyOnly}
                      className="w-full inline-flex items-center justify-between gap-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ padding: "7px 12px", border: "1px solid var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>My Leads</span>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", width: 32, height: 18, borderRadius: 9, padding: "0 2px", background: filters.myOnly === "true" ? "var(--app-primary, #f97316)" : "rgba(128,128,128,0.25)", transition: "background 0.2s", flexShrink: 0 }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transform: filters.myOnly === "true" ? "translateX(14px)" : "translateX(0)", transition: "transform 0.2s", display: "block" }} />
                      </span>
                    </button>
                  </div>
                )}
                {/* Clear */}
                {(Object.values(filters).some(Boolean) || selectedProject) && (
                  <div className="col-span-2 sm:col-auto">
                    <button
                      className="w-full flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition border border-red-500/20"
                      onClick={() => {
                        ["search", "siteFilter", "status", "source", "priority", "dateRange", "myOnly", "assignedTo"].forEach((k) => setFilter(k, ""));
                        setSelectedProject(null);
                        try { localStorage.removeItem("leads_myOnly"); } catch {}
                      }}
                    >
                      <X className="h-3 w-3" /> Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Project leads table (shown when a project is selected) ─────────────── */}
      {selectedProject && (
            <section className="card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative flex-1 max-w-sm min-w-[180px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" />
                  <input className="input rounded-full pl-11 text-sm" placeholder="Search by name or phone..."
                    value={projSearch}
                    onChange={(e) => { setProjSearch(e.target.value); setProjPage(1); setProjSelectedIds(new Set()); }} />
                </div>
                {projSelectedIds.size > 0 && canDelete && (
                  <button className="btn-danger rounded-xl text-xs" onClick={() => setShowProjBulkConfirm(true)}>
                    <Trash2 className="h-4 w-4" /> Delete {projSelectedIds.size} selected
                  </button>
                )}
                <span className="text-xs text-app-soft">{projTotal} leads</span>
              </div>

              {projLoading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> : (
                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--app-border)" }}>
                  <table className="stitch-table min-w-[1400px]">
                    <thead>
                      <tr>
                        {canDelete && (
                          <th className="w-10 px-3">
                            <input
                              type="checkbox"
                              checked={projAllSelected}
                              ref={(el) => { if (el) el.indeterminate = projSomeSelected && !projAllSelected; }}
                              onChange={projToggleAll}
                              className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                              title="Select all"
                            />
                          </th>
                        )}
                        <th>#</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Email</th><th>Source</th>
                        <th>Contact Status</th><th style={{ minWidth: 185 }}>Follow Up</th><th style={{ minWidth: 185 }}>Follow Up 2</th>
                        <th>Remark 1</th><th>Remark 2</th><th>Remark</th><th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projLeads.length === 0 ? (
                        <tr><td colSpan={canDelete ? 14 : 12} className="py-10 text-center text-sm text-app-soft">No leads in this project yet</td></tr>
                      ) : projLeads.map((lead, i) => (
                        <tr key={lead._id} className={`group ${projSelectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                          {canDelete && (
                            <td className="w-10 px-3">
                              <input
                                type="checkbox"
                                checked={projSelectedIds.has(lead._id)}
                                onChange={() => projToggleOne(lead._id)}
                                className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                              />
                            </td>
                          )}
                          <td className="text-xs text-app-soft">{(projPage - 1) * projLimit + i + 1}</td>
                          <td className="font-medium text-app text-sm whitespace-nowrap">{lead.name}</td>
                          <td><PhoneActions phone={lead.phone} lead={lead} onContact={() => handleContact({ ...lead, _type: "project", projectId: selectedProject._id })} /></td>
                          <td><WhatsAppLink phone={lead.phone} name={lead.name} onContact={() => handleContact({ ...lead, _type: "project", projectId: selectedProject._id })} /></td>
                          <td className="text-sm text-app-soft">{lead.email || "-"}</td>
                          <td><span className="stitch-pill text-[11px]">{lead.source}</span></td>
                          <td><ContactStatusCell lead={lead} projectId={selectedProject._id} onUpdated={handleProjLeadUpdated} /></td>
                          <td className="min-w-[185px]"><ProjInlineDate value={lead.followUp} leadId={lead._id} projectId={selectedProject._id} field="followUp" onSaved={handleProjLeadUpdated} /></td>
                          <td className="min-w-[185px]"><ProjInlineDate value={lead.followUp2} leadId={lead._id} projectId={selectedProject._id} field="followUp2" onSaved={handleProjLeadUpdated} /></td>
                          <td><RemarkPopupCell value={lead.remark1} leadId={lead._id} projectId={selectedProject._id} field="remark1" placeholder="Remark 1…" onSaved={handleProjLeadUpdated} /></td>
                          <td><RemarkPopupCell value={lead.remark2} leadId={lead._id} projectId={selectedProject._id} field="remark2" placeholder="Remark 2…" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineText value={lead.remarkNote} leadId={lead._id} projectId={selectedProject._id} field="remarkNote" placeholder="Remark…" multiline onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineBooking value={lead.booking} leadId={lead._id} projectId={selectedProject._id} onSaved={handleProjLeadUpdated} /></td>
                          <td>
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-orange-500/10 hover:text-orange-500"
                                onClick={() => setTransferMeta({ lead, leadType: "project", projectId: selectedProject._id })}
                                title="Transfer lead"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </button>
                              {canDelete && (
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-red-500/10 hover:text-red-400"
                                  onClick={() => setProjDeletingId(lead._id)}
                                  title="Delete lead"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
                    <div className="flex items-center gap-2 text-xs text-app-soft">
                      <span>Show rows:</span>
                      {[10, 30, 50, 100, 200, 500].map((n) => (
                        <button key={n} onClick={() => { setProjLimit(n); setProjPage(1); }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${projLimit === n ? "text-white" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
                          style={projLimit === n ? { background: "var(--app-primary)" } : {}}
                        >{n}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-app-soft">{projTotal === 0 ? "0 results" : `${(projPage - 1) * projLimit + 1} – ${Math.min(projPage * projLimit, projTotal)} of ${projTotal}`}</span>
                      {projPages > 1 && (
                        <div className="flex items-center gap-1.5 text-xs text-app-soft">
                          <span>Go to</span>
                          <input
                            key={projPage}
                            type="number"
                            min={1}
                            max={projPages}
                            defaultValue={projPage}
                            className="w-14 rounded-lg border text-center text-xs py-1 px-1 outline-none focus:border-orange-400"
                            style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = Math.max(1, Math.min(projPages, parseInt(e.target.value) || 1));
                                setProjPage(v);
                              }
                            }}
                            onBlur={(e) => {
                              const v = Math.max(1, Math.min(projPages, parseInt(e.target.value) || 1));
                              if (v !== projPage) setProjPage(v);
                            }}
                          />
                          <span>of {projPages}</span>
                        </div>
                      )}
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={projPage === 1} onClick={() => setProjPage(1)}><ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" /></button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={projPage === 1} onClick={() => setProjPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={projPage === projPages || projPages === 0} onClick={() => setProjPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

      <section className="card overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads found"
            desc={Object.values(filters).some(Boolean) ? "Try adjusting your filters" : "Add your first lead to get started"}
            action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Lead</button>}
          />
        ) : (
          <>
            {/* Top scroll mirror - always-visible horizontal scrollbar above the table */}
            <div
              ref={topScrollRef}
              style={{
                overflowX: "scroll",
                overflowY: "hidden",
                height: 14,
                borderBottom: "1px solid var(--app-border)",
              }}
            >
              <div ref={topSpacerRef} style={{ height: 1 }} />
            </div>
          <div ref={tableScrollRef} data-tour="leads-table" className="overflow-x-auto">
            <table className="stitch-table text-sm" style={{ tableLayout: "fixed", width: (canDelete ? 40 : 0) + Object.entries(colW).filter(([k]) => k !== "whatsapp").reduce((a, [, b]) => a + b, 0) }}>
              <colgroup>
                {canDelete && <col style={{ width: 40, minWidth: 40 }} />}
                {Object.entries(colW).filter(([k]) => k !== "whatsapp").map(([k, w]) => <col key={k} style={{ width: w, minWidth: 60 }} />)}
              </colgroup>
              <thead>
                <tr>
                  {canDelete && (
                    <th className="px-2.5" style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500"
                        title="Select all"
                      />
                    </th>
                  )}
                  <RTh k="lead"         colW={colW} startResize={startResize}>Lead</RTh>
                  <RTh k="phone"        colW={colW} startResize={startResize}>Phone / WhatsApp</RTh>
                  <RTh k="source"       colW={colW} startResize={startResize}>Source</RTh>
                  <RTh k="project"      colW={colW} startResize={startResize}>Project</RTh>
                  <RTh k="status"       colW={colW} startResize={startResize}>Status</RTh>
                  <RTh k="priority"     colW={colW} startResize={startResize}>Priority</RTh>
                  <RTh k="requirements" colW={colW} startResize={startResize}>Requirements</RTh>
                  <RTh k="budget"       colW={colW} startResize={startResize}>Budget</RTh>
                  <RTh k="purpose"      colW={colW} startResize={startResize}>Purpose</RTh>
                  <RTh k="remark"       colW={colW} startResize={startResize}>Remark</RTh>
                  <RTh k="remark1"      colW={colW} startResize={startResize}>Remark 1</RTh>
                  <RTh k="remark2"      colW={colW} startResize={startResize}>Remark 2</RTh>
                  <RTh k="followup"     colW={colW} startResize={startResize}>Follow Up</RTh>
                  <RTh k="followup2"    colW={colW} startResize={startResize}>Follow Up 2</RTh>
                  <RTh k="booking"      colW={colW} startResize={startResize}>Booking</RTh>
                  <RTh k="property"     colW={colW} startResize={startResize}>Property</RTh>
                  <RTh k="assigned"     colW={colW} startResize={startResize}>Assigned</RTh>
                  <RTh k="actions"      colW={colW} startResize={startResize}>Actions</RTh>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr key={lead._id} className={`${index % 2 === 1 ? "bg-black/5 dark:bg-white/[0.02]" : ""} group ${selectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                    {canDelete && (
                      <td className="px-2.5" style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead._id)}
                          onChange={() => toggleOne(lead._id)}
                          className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500"
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="stitch-surface-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold text-orange-500">
                          {lead.name?.slice(0, 1)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 cursor-pointer group" onClick={() => setDetailLead(lead)}>
                          <p className="truncate text-sm font-semibold text-app max-w-[140px] group-hover:text-orange-500 transition-colors">{lead.name}</p>
                          <p className="truncate text-xs text-app-soft max-w-[140px]">{lead.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <PhoneActions phone={lead.phone} lead={lead} onContact={() => handleContact(lead)} />
                        <WhatsAppLink phone={lead.phone} name={lead.name} leadId={lead._id} onContact={() => handleContact(lead)} />
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <SourceBadge source={lead.source} />
                        {lead.leadSourceLabel && (
                          <span className="text-[10px] text-app-soft truncate max-w-[130px]" title={lead.leadSourceLabel}>
                            {lead.leadSourceLabel}
                          </span>
                        )}
                        {lead.sourceDomain && lead.sourceDomain !== lead.leadSourceLabel && (
                          <span className="text-[10px] text-blue-500 truncate max-w-[130px]" title={lead.sourceDomain}>
                            {lead.sourceDomain}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {lead.projectName
                        ? <span className="text-[11px] font-semibold text-violet-600 truncate max-w-[130px] block" title={lead.projectName}>{lead.projectName}</span>
                        : <span className="text-xs text-app-soft">-</span>}
                    </td>
                    <td className="whitespace-nowrap"><StatusBadge status={lead.status} /></td>
                    <td className="whitespace-nowrap"><PriorityBadge priority={lead.priority} /></td>
                    <td>
                      {cleanRequirements(lead.requirements)
                        ? <p className="text-xs text-app leading-relaxed line-clamp-2" title={cleanRequirements(lead.requirements)}>{cleanRequirements(lead.requirements)}</p>
                        : <span className="text-xs text-app-soft">-</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="text-xs text-app">
                        {lead.budget?.min || lead.budget?.max
                          ? `${fmtBudget(lead.budget.min)}${lead.budget.max && lead.budget.max !== lead.budget.min ? ` - ${fmtBudget(lead.budget.max)}` : ""}`
                          : <span className="text-app-soft">-</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="text-xs text-app">{lead.purpose && lead.purpose !== "N/A" ? lead.purpose : <span className="text-app-soft">-</span>}</span>
                    </td>
                    {/* Remark (contact status) - same dropdown for all lead types */}
                    <td>
                      <ContactStatusCell
                        lead={lead}
                        projectId={lead._type === "project" ? lead.projectId : undefined}
                        onUpdated={handleInlineUpdate}
                      />
                    </td>
                    <td>
                      <RemarkPopupCell value={lead.remark1} leadId={lead._id} projectId={lead._type === "project" ? lead.projectId : undefined} field="remark1" onSaved={handleInlineUpdate} placeholder="Remark 1…" />
                    </td>
                    <td>
                      <RemarkPopupCell value={lead.remark2} leadId={lead._id} projectId={lead._type === "project" ? lead.projectId : undefined} field="remark2" onSaved={handleInlineUpdate} placeholder="Remark 2…" />
                    </td>
                    <td>
                      <InlineDate
                        value={lead.followUpDate}
                        leadId={lead._id}
                        projectId={lead._type === "project" ? lead.projectId : undefined}
                        field={lead._type === "project" ? "followUp" : "followUpDate"}
                        onSaved={handleInlineUpdate}
                      />
                    </td>
                    <td>
                      <InlineDate
                        value={lead.followUp2}
                        leadId={lead._id}
                        projectId={lead._type === "project" ? lead.projectId : undefined}
                        field="followUp2"
                        onSaved={handleInlineUpdate}
                      />
                    </td>
                    <td>
                      <InlineBooking value={lead.booking} leadId={lead._id} projectId={lead._type === "project" ? lead.projectId : undefined} onSaved={handleInlineUpdate} />
                    </td>
                    <td>
                      {(lead.propertyType || lead.bhk) ? (
                        <p className="text-sm font-medium text-app">
                          {lead.propertyType || ""}{lead.bhk && lead.bhk !== "N/A" ? ` · ${lead.bhk}` : ""}
                        </p>
                      ) : <span className="text-xs text-app-soft">-</span>}
                      {(lead.budget?.min || lead.budget?.max) && (
                        <p className="mt-0.5 text-xs text-orange-500">{fmtCurrency(lead.budget?.min)} – {fmtCurrency(lead.budget?.max)}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-sm text-app-soft">{lead.assignedToName || lead.assignedTo?.name || "-"}</td>
                    <td>
                      <div className="flex justify-end gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                        <button className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-amber-500/10 hover:text-amber-400" onClick={() => { setEditLead(lead); setShowForm(true); }} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-orange-500/10 hover:text-orange-500" onClick={() => setTransferMeta({ lead, leadType: lead._type || "lead", projectId: lead._type === "project" ? lead.projectId : null })} title="Transfer to project">
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-red-500/10 hover:text-red-400" onClick={() => setDeletingId(lead._id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
          {/* Show rows selector */}
          <div className="flex items-center gap-2 text-xs text-app-soft">
            <span>Show rows:</span>
            {[10, 30, 50, 100, 200, 500].map((n) => (
              <button
                key={n}
                onClick={() => changeLimit(n)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${limit === n ? "text-white" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
                style={limit === n ? { background: "var(--app-primary)" } : {}}
              >{n}</button>
            ))}
          </div>
          {/* Page info + navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-app-soft">
              {total === 0 ? "0 results" : `${(page - 1) * limit + 1} – ${Math.min(page * limit, total)} of ${total}`}
            </span>
            {/* Go to page */}
            {pages > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-app-soft">
                <span>Go to</span>
                <input
                  key={page}
                  type="number"
                  min={1}
                  max={pages}
                  defaultValue={page}
                  className="w-14 rounded-lg border text-center text-xs py-1 px-1 outline-none focus:border-orange-400"
                  style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = Math.max(1, Math.min(pages, parseInt(e.target.value) || 1));
                      setPage(v);
                    }
                  }}
                  onBlur={(e) => {
                    const v = Math.max(1, Math.min(pages, parseInt(e.target.value) || 1));
                    if (v !== page) setPage(v);
                  }}
                />
                <span>of {pages}</span>
              </div>
            )}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
              style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
              disabled={page === 1} onClick={() => setPage(1)} title="First page"
            ><ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" /></button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
              style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
              disabled={page === 1} onClick={() => setPage((p) => p - 1)} title="Previous page"
            ><ChevronLeft className="h-4 w-4" /></button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
              style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
              disabled={page === pages || pages === 0} onClick={() => setPage((p) => p + 1)} title="Next page"
            ><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <LeadForm open={showForm} onClose={() => { setShowForm(false); setEditLead(null); }} onSaved={handleSaved} lead={editLead} agents={agents} />
      <LeadDetail
        open={!!detailLead}
        onClose={() => setDetailLead(null)}
        lead={detailLead}
        onUpdated={handleDetailUpdated}
        onEdit={(lead) => { setDetailLead(null); setEditLead(lead); setShowForm(true); }}
      />
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title={user?.role === "super_admin" ? "Delete Lead" : "Move to Dump"}
        message={
          user?.role === "super_admin"
            ? "Are you sure you want to permanently delete this lead? This cannot be undone."
            : "This lead will be moved to the Dump section. You can restore or permanently delete it from there."
        }
      />
      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title={user?.role === "super_admin" ? `Delete ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""}` : `Move ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""} to Dump`}
        message={
          user?.role === "super_admin"
            ? `Are you sure you want to permanently delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
            : `${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""} will be moved to the Dump section. You can restore or permanently delete them from there.`
        }
      />
      <ConfirmDialog
        open={!!projDeletingId}
        onClose={() => setProjDeletingId(null)}
        onConfirm={handleProjDeleteLead}
        loading={projDeleting}
        title="Delete Project Lead"
        message={
          user?.role === "super_admin"
            ? "Are you sure you want to permanently delete this lead? This cannot be undone."
            : "This lead will be moved to Dump Leads. You can restore or permanently delete it from there."
        }
      />
      <ConfirmDialog
        open={showProjBulkConfirm}
        onClose={() => setShowProjBulkConfirm(false)}
        onConfirm={handleProjBulkDelete}
        loading={projBulkDeleting}
        title={`Delete ${projSelectedIds.size} Lead${projSelectedIds.size !== 1 ? "s" : ""}`}
        message={
          user?.role === "super_admin"
            ? `Are you sure you want to permanently delete ${projSelectedIds.size} selected lead${projSelectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
            : `${projSelectedIds.size} selected lead${projSelectedIds.size !== 1 ? "s" : ""} will be moved to Dump Leads. You can restore or permanently delete them from there.`
        }
      />

      <TransferModal
        open={!!transferMeta}
        onClose={() => setTransferMeta(null)}
        lead={transferMeta?.lead}
        leadType={transferMeta?.leadType || "lead"}
        currentProjectId={transferMeta?.projectId}
        onTransferred={() => {
          const meta = transferMeta;
          setTransferMeta(null);
          if (meta?.leadType === "project") {
            // Remove from project leads list optimistically
            setProjLeads((prev) => prev.filter((l) => l._id !== meta.lead._id));
            setProjRefreshKey((k) => k + 1);
          } else {
            // Remove transferred lead from main pipeline list
            removeLead(meta?.lead._id);
          }
        }}
      />

      {showOrgQr && (
        <QrModal type="org" name="Leads Capture Form" onClose={() => setShowOrgQr(false)} />
      )}

      {/* ── Floating Bulk Action Bar ─────────────────────────────────────────── */}
      {selectedIds.size > 0 && createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-[9999] sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-2xl sm:min-w-[480px] rounded-t-2xl backdrop-blur-sm"
          style={{
            background: "var(--app-card-solid, #1e1e1e)",
            border: "1.5px solid var(--app-border)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.35)",
            padding: "12px 16px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* ── Mobile layout ── */}
          <div className="flex flex-col gap-2 sm:hidden">
            {/* Row 1: count + close */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <button onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-app-soft hover:bg-white/10 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: Assign (admin only) */}
            {user?.role !== "agent" && agents.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <CustomSelect
                    value={bulkAssignAgentId}
                    onChange={(v) => setBulkAssignAgentId(v)}
                    placeholder="Assign to agent…"
                    options={agents.map((a) => ({ value: a._id, label: a.name }))}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  onClick={handleBulkAssign}
                  disabled={bulkAssigning || !bulkAssignAgentId}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-40 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  {bulkAssigning ? "…" : "Assign"}
                </button>
              </div>
            )}

            {/* Row 3: Status update */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CustomSelect
                  value={bulkStatusValue}
                  onChange={(v) => setBulkStatusValue(v)}
                  placeholder="Set status…"
                  options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                  style={{ width: "100%" }}
                />
              </div>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={bulkUpdatingStatus || !bulkStatusValue}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--app-primary)" }}
              >
                {bulkUpdatingStatus ? "…" : "Update"}
              </button>
            </div>

            {/* Row 4: WhatsApp + Delete */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const list = leads.filter((l) => selectedIds.has(l._id) && l.phone);
                  if (!list.length) { toast.error("No selected leads have a phone number"); return; }
                  setWaBroadcast({ list, msg: "Hi {name}, ", idx: 0, skipped: 0, step: "compose" });
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition cursor-pointer"
                style={{ background: "#25d366" }}
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </button>
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-red-600 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          {/* ── Desktop layout (single row) ── */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="shrink-0 flex items-center justify-center rounded-xl bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-400 border border-orange-500/30">
              {selectedIds.size} selected
            </span>

            {user?.role !== "agent" && agents.length > 0 && (
              <>
                <div className="flex-1 min-w-0">
                  <CustomSelect
                    value={bulkAssignAgentId}
                    onChange={(v) => setBulkAssignAgentId(v)}
                    placeholder="Assign to agent…"
                    options={agents.map((a) => ({ value: a._id, label: a.name }))}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  onClick={handleBulkAssign}
                  disabled={bulkAssigning || !bulkAssignAgentId}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-40 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  {bulkAssigning ? "Assigning…" : "Assign"}
                </button>
              </>
            )}

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <CustomSelect
                  value={bulkStatusValue}
                  onChange={(v) => setBulkStatusValue(v)}
                  placeholder="Set status…"
                  options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                  style={{ width: "100%" }}
                />
              </div>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={bulkUpdatingStatus || !bulkStatusValue}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--app-primary)" }}
              >
                {bulkUpdatingStatus ? "Updating…" : "Update"}
              </button>
            </div>

            <button
              onClick={() => {
                const list = leads.filter((l) => selectedIds.has(l._id) && l.phone);
                if (!list.length) { toast.error("No selected leads have a phone number"); return; }
                setWaBroadcast({ list, msg: "Hi {name}, ", idx: 0, skipped: 0, step: "compose" });
              }}
              className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
              style={{ background: "#25d366" }}
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </button>

            <button
              onClick={() => setShowBulkConfirm(true)}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/10 cursor-pointer"
              style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
            >
              ✕
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Export dropdown - portal-rendered to escape overflow:hidden parents */}
      {showExportMenu && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowExportMenu(false)} />
          <div
            className="fixed w-56 overflow-hidden rounded-2xl py-1"
            style={{
              top: exportMenuPos.top,
              right: exportMenuPos.right,
              zIndex: 9999,
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              boxShadow: "var(--app-shadow)",
            }}
          >
            {selectedIds.size > 0 && (
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                Exporting {selectedIds.size} selected
              </p>
            )}
            {[
              { key: "csv",   label: "Export CSV" },
              { key: "excel", label: "Export Excel" },
              { key: "json",  label: "Export JSON" },
            ].map((item) => (
              <button
                key={item.key}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-app hover:bg-orange-500/10 transition"
                onClick={() => {
                  setShowExportMenu(false);
                  exportRows(item.key, selectedIds.size > 0 ? selectedIds : null);
                }}
              >
                <Download className="h-4 w-4" /> {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* ── WhatsApp Broadcast Modal ─────────────────────────────────────── */}
      {waBroadcast && <WaBroadcastModal state={waBroadcast} setState={setWaBroadcast} />}
    </div>
  );
}

// ── WaBroadcastModal ──────────────────────────────────────────────────────────
function interpolate(template, lead) {
  return template
    .replace(/\{name\}/gi,    lead.name    || "")
    .replace(/\{phone\}/gi,   lead.phone   || "")
    .replace(/\{project\}/gi, lead.projectName || lead.project || "");
}

function WaBroadcastModal({ state, setState }) {
  const { list, msg, idx, skipped, step } = state;
  const total   = list.length;
  const current = list[idx];
  const sent    = idx - skipped;

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  // ── Compose step ────────────────────────────────────────────────────────
  if (step === "compose") {
    const preview = interpolate(msg, list[0] || {});
    return (
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
          style={{ background: "var(--app-card-solid, #1e1e1e)", border: "1px solid var(--app-border)" }}>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#25d366" }}>WhatsApp Broadcast</p>
              <h3 className="text-lg font-black text-app mt-0.5">{total} lead{total !== 1 ? "s" : ""} selected</h3>
            </div>
            <button onClick={() => setState(null)} className="p-2 rounded-xl hover:bg-white/10 text-app-soft"><X className="h-4 w-4" /></button>
          </div>

          <div>
            <label className="text-xs font-semibold text-app-soft uppercase tracking-wide block mb-1.5">
              Message Template
            </label>
            <textarea
              className="textarea text-sm"
              rows={5}
              value={msg}
              onChange={(e) => set({ msg: e.target.value })}
              placeholder="Hi {name}, we have an exciting property update for you…"
              autoFocus
            />
            <p className="mt-1.5 text-[11px] text-app-soft">
              Variables: <span className="font-mono bg-black/20 px-1 rounded">{"{name}"}</span>  <span className="font-mono bg-black/20 px-1 rounded">{"{project}"}</span>
            </p>
          </div>

          <div className="rounded-2xl p-3.5 text-sm" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#25d366" }}>Preview — {list[0]?.name}</p>
            <p className="text-app whitespace-pre-wrap leading-relaxed">{preview || <span className="text-app-soft italic">Type a message above…</span>}</p>
          </div>

          <button
            disabled={!msg.trim()}
            onClick={() => set({ step: "running" })}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-40 transition"
            style={{ background: "#25d366" }}
          >
            <Send className="h-4 w-4" /> Start Broadcast
          </button>
        </div>
      </div>
    );
  }

  // ── Running step ────────────────────────────────────────────────────────
  if (step === "running") {
    const waUrl = `https://wa.me/${toWaNumber(current.phone)}?text=${encodeURIComponent(interpolate(msg, current))}`;
    const progress = Math.round((idx / total) * 100);

    const advance = (wasSkipped) => {
      const nextIdx     = idx + 1;
      const nextSkipped = skipped + (wasSkipped ? 1 : 0);
      if (nextIdx >= total) {
        set({ idx: nextIdx, skipped: nextSkipped, step: "done" });
      } else {
        set({ idx: nextIdx, skipped: nextSkipped });
      }
    };

    return (
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
          style={{ background: "var(--app-card-solid, #1e1e1e)", border: "1px solid var(--app-border)" }}>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#25d366" }}>Broadcasting…</p>
              <h3 className="text-lg font-black text-app mt-0.5">{idx + 1} of {total}</h3>
            </div>
            <button onClick={() => setState(null)} className="p-2 rounded-xl hover:bg-white/10 text-app-soft"><X className="h-4 w-4" /></button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#25d366" }} />
          </div>

          {/* Lead card */}
          <div className="rounded-2xl p-4 space-y-1" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <p className="text-base font-black text-app">{current.name}</p>
            <p className="text-sm text-app-soft">{current.phone}</p>
            {current.status && <p className="text-xs text-app-soft">Status: {current.status}</p>}
          </div>

          {/* Message preview */}
          <div className="rounded-2xl p-3.5 text-sm" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
            <p className="text-app whitespace-pre-wrap leading-relaxed">{interpolate(msg, current)}</p>
          </div>

          {/* Actions */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition"
            style={{ background: "#25d366" }}
          >
            <MessageSquare className="h-4 w-4" /> Open WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => advance(true)}
              className="rounded-2xl py-2.5 text-xs font-semibold text-app-soft transition hover:bg-white/10"
              style={{ border: "1px solid var(--app-border)" }}
            >
              Skip
            </button>
            <button
              onClick={() => advance(false)}
              className="rounded-2xl py-2.5 text-xs font-bold text-white transition"
              style={{ background: "var(--app-primary, #ff6b00)" }}
            >
              Sent ✓ &nbsp;Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done step ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 text-center"
        style={{ background: "var(--app-card-solid, #1e1e1e)", border: "1px solid var(--app-border)" }}>

        <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)" }}>
          ✓
        </div>
        <div>
          <h3 className="text-xl font-black text-app">Broadcast Complete</h3>
          <p className="mt-1 text-sm text-app-soft">
            <span className="font-bold text-app">{total - skipped}</span> sent &nbsp;·&nbsp; <span className="font-bold text-app">{skipped}</span> skipped
          </p>
        </div>
        <button
          onClick={() => setState(null)}
          className="w-full rounded-2xl py-3 text-sm font-bold text-white"
          style={{ background: "var(--app-primary, #ff6b00)" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
