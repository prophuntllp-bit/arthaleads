import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  StatusBadge, PriorityBadge, SourceBadge,
  PageLoader, EmptyState, ConfirmDialog, Spinner, PhoneActions, WhatsAppLink
} from "../components/UI";
import LeadForm from "../components/LeadForm";
import LeadDetail from "../components/LeadDetail";
import { useLeads } from "../hooks/useLeads";
import api from "../services/api";
import toast from "react-hot-toast";
import { DATE_RANGE_OPTIONS, fmtDate, fmtCurrency, PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from "../utils/constants";

// Compact budget formatter: 8000000 → "80L", 10000000 → "1Cr"
const fmtBudget = (val) => {
  if (!val || val === 0) return "";
  if (val >= 10_000_000) return `${parseFloat((val / 10_000_000).toFixed(2)).toString()}Cr`;
  if (val >= 100_000) return `${parseFloat((val / 100_000).toFixed(1)).toString()}L`;
  return `₹${val}`;
};
import { ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Filter, FolderKanban, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";

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

// ── IST helpers (UTC+5:30) ────────────────────────────────────────────────────
function toISTLocal(utcStr) {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}
function fromISTLocal(localStr) {
  if (!localStr) return null;
  const d = new Date(localStr);
  return new Date(d.getTime() - 330 * 60 * 1000).toISOString();
}
function nowIST() {
  return toISTLocal(new Date().toISOString());
}
function fmt12hIST(utcStr) {
  if (!utcStr) return "";
  const ist = new Date(new Date(utcStr).getTime() + 330 * 60 * 1000);
  const h = ist.getUTCHours(), m = ist.getUTCMinutes().toString().padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"} IST`;
}

// ── Inline date cell ──────────────────────────────────────────────────────────
function InlineDate({ value, leadId, projectId, field, onSaved }) {
  const [saving, setSaving] = useState(false);

  const save = async (dateStr) => {
    setSaving(true);
    try {
      const res = projectId
        ? await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: fromISTLocal(dateStr) })
        : await api.put(`/leads/${leadId}`, { [field]: fromISTLocal(dateStr) });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const dateVal = toISTLocal(value);
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="datetime-local"
          className="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", minWidth: 145 }}
          value={dateVal}
          onChange={(e) => save(e.target.value)}
        />
        <button
          type="button"
          title="Set to current IST time"
          onClick={() => save(nowIST())}
          className="shrink-0 rounded-md border px-1.5 py-1 text-[10px] font-semibold text-orange-500 hover:bg-orange-500/10 transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
        >Now</button>
      </div>
      {value && <span className="text-[10px] text-app-soft pl-0.5">{fmt12hIST(value)}</span>}
    </div>
  );
}

// ── Inline booking select ─────────────────────────────────────────────────────
const BOOKING_OPTIONS = [
  { value: "",                   label: "— None —",           color: "" },
  { value: "Interested",         label: "Interested",          color: "text-blue-600" },
  { value: "Call Back",          label: "Call Back",           color: "text-amber-600" },
  { value: "Site Visit Booked",  label: "Site Visit Booked",   color: "text-violet-600" },
  { value: "Booked",             label: "Booked",              color: "text-green-600" },
  { value: "Not Interested",     label: "Not Interested",      color: "text-red-500" },
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

  const opt = BOOKING_OPTIONS.find((o) => o.value === (value || "")) || BOOKING_OPTIONS[0];
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;

  return (
    <select
      className={`rounded-lg border px-2 py-1 text-xs appearance-none focus:outline-none focus:border-orange-400 font-semibold ${opt.color}`}
      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", minWidth: 130 }}
      value={value || ""}
      onChange={(e) => save(e.target.value)}
    >
      {BOOKING_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
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

// ── Remark cell — collapsed, expands inline with show more / show less ───────
const REMARK_PREVIEW_LEN = 40;
function RemarkPopupCell({ value, placeholder = "—" }) {
  const [expanded, setExpanded] = useState(false);
  const text = value || "";
  const needsToggle = text.length > REMARK_PREVIEW_LEN;
  const displayed = expanded || !needsToggle ? text : text.slice(0, REMARK_PREVIEW_LEN) + "…";

  if (!text) return <span className="text-xs text-app-soft">{placeholder}</span>;

  return (
    <div className="min-w-[100px] max-w-[180px] text-xs text-app leading-relaxed">
      <span>{displayed}</span>
      {needsToggle && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="block mt-0.5 text-orange-400 hover:text-orange-500 font-medium transition"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ProjInlineDate({ value, leadId, projectId, field, onSaved }) {
  const [saving, setSaving] = useState(false);
  const save = async (dateStr) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${leadId}`, { [field]: fromISTLocal(dateStr) });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  const dateVal = toISTLocal(value);
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input type="datetime-local"
          className="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", minWidth: 145 }}
          value={dateVal} onChange={(e) => save(e.target.value)} />
        <button type="button" title="Set to current IST time" onClick={() => save(nowIST())}
          className="shrink-0 rounded-md border px-1.5 py-1 text-[10px] font-semibold text-orange-500 hover:bg-orange-500/10 transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>Now</button>
      </div>
      {value && <span className="text-[10px] text-app-soft pl-0.5">{fmt12hIST(value)}</span>}
    </div>
  );
}

const PROJ_BOOKING_OPTIONS = [
  { value: "", label: "— None —", color: "" },
  { value: "Interested", label: "Interested", color: "text-blue-600" },
  { value: "Call Back", label: "Call Back", color: "text-amber-600" },
  { value: "Site Visit Booked", label: "Site Visit Booked", color: "text-violet-600" },
  { value: "Booked", label: "Booked", color: "text-green-600" },
  { value: "Not Interested", label: "Not Interested", color: "text-red-500" },
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
  const opt = PROJ_BOOKING_OPTIONS.find((o) => o.value === (value || "")) || PROJ_BOOKING_OPTIONS[0];
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <select
      className={`rounded-lg border px-2 py-1 text-xs appearance-none focus:outline-none focus:border-orange-400 font-semibold ${opt.color}`}
      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", minWidth: 125 }}
      value={value || ""} onChange={(e) => save(e.target.value)}>
      {PROJ_BOOKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

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

  const cls = remark === "Contacted"
    ? "bg-green-500/10 border-green-500/30 text-green-600"
    : remark === "Not Contacted"
    ? "bg-red-500/10 border-red-500/30 text-red-500"
    : "border-[var(--app-border)] text-app-soft";

  return (
    <div className="relative min-w-[150px]">
      <select
        value={remark}
        onChange={(e) => { const v = e.target.value; setRemark(v); save(v); }}
        className={`w-full rounded-xl border px-2.5 py-1.5 text-xs font-semibold appearance-none transition ${cls}`}
        style={{ background: "var(--app-surface-low)" }}
      >
        <option value="">— None —</option>
        <option value="Contacted">Contacted</option>
        <option value="Not Contacted">Not Contacted</option>
      </select>
      {saving && <span className="absolute right-2 top-1/2 -translate-y-1/2"><Spinner size="sm" /></span>}
    </div>
  );
}

export default function Leads() {
  useEffect(() => { document.title = "Lead Management — Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    leads, total, loading, page, setPage,
    filters, setFilter,
    upsertLead, removeLead, pages, limit, changeLimit,
  } = useLeads("unified", {
    status: location.state?.presetStatus || "",
    source: location.state?.presetSource || "",
    followUpToday: location.state?.presetFollowUpToday ? "true" : "",
  });

  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const exportBtnRef = useRef(null);
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, right: 0 });

  // ── Bulk select state ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Project-wise leads ────────────────────────────────────────────────────
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

  // Clear preset state from location so back-navigation doesn't re-apply filters
  useEffect(() => {
    if (location.state?.presetStatus || location.state?.presetSource || location.state?.presetFollowUpToday) {
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
  }, [selectedProject, projPage, projSearch, projLimit]);

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
    } catch { /* silent — the call/chat still happened */ }
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

      // Fetch all leads from backend (up to 5000), then filter by selected IDs if needed
      const params = new URLSearchParams();
      if (filters.status)    params.set("status",    filters.status);
      if (filters.source)    params.set("source",    filters.source);
      if (filters.priority)  params.set("priority",  filters.priority);
      if (filters.search)    params.set("search",    filters.search);
      if (filters.dateRange) params.set("dateRange", filters.dateRange);
      params.set("limit", "5000");
      params.set("page", "1");

      const { data: res } = await api.get(`/leads/unified?${params.toString()}`);
      let source = res.leads || [];

      // If specific IDs selected, filter to only those
      if (selectedIdsOverride && selectedIdsOverride.size > 0) {
        source = source.filter((l) => selectedIdsOverride.has(String(l._id)));
      }

      const rows = source.map((lead) => ({
        Name:          lead.name || "",
        Phone:         lead.phone || "",
        Email:         lead.email || "",
        Source:        lead.source || "",
        LeadSource:    lead.leadSourceLabel || "",
        Status:        lead.status || "",
        Priority:      lead.priority || "",
        PropertyType:  lead.propertyType || "",
        BHK:           lead.bhk || "",
        Purpose:       lead.purpose || "",
        BudgetMin:     lead.budget?.min || "",
        BudgetMax:     lead.budget?.max || "",
        FollowUpDate:  lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : "",
        FollowUpNote:  lead.followUpNote || "",
        Remark1:       lead.remark1 || "",
        Remark2:       lead.remark2 || "",
        ContactStatus: lead.remark || "",
        Booking:       lead.booking || "",
        AssignedTo:    lead.assignedToName || "",
        Project:       lead.projectName || "",
        CreatedAt:     lead.createdAt ? new Date(lead.createdAt).toISOString().slice(0, 10) : "",
      }));

      toast.dismiss(tid);

      if (rows.length === 0) { toast.error("No leads to export"); return; }

      const label = selectedIdsOverride?.size > 0 ? `${selectedIdsOverride.size}-selected` : "all";

      if (type === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `leads-${label}-${date}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        const ws = xlsxUtils.json_to_sheet(rows);
        const wb = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(wb, ws, "Leads");
        const ext = type === "excel" ? "xlsx" : "csv";
        xlsxWriteFile(wb, `leads-${label}-${date}.${ext}`, { bookType: ext });
      }

      toast.success(`Exported ${rows.length} leads`);
    } catch (e) {
      toast.dismiss(tid);
      toast.error("Export failed: " + (e.response?.data?.message || e.message));
    }
  };

  // ── Standard CRM import (Name/Phone/Email columns) ───────────────────────────
  const parseImportRow = (row) => {
    const assignedAgent = agents.find((agent) => agent.name?.toLowerCase() === String(row.AssignedTo || "").trim().toLowerCase());
    return {
      name: String(row.Name || row.name || "").trim(),
      phone: String(row.Phone || row.phone || "").trim(),
      email: String(row.Email || row.email || "").trim(),
      source: String(row.Source || row.source || "Manual").trim() || "Manual",
      status: String(row.Status || row.status || "New").trim() || "New",
      priority: String(row.Priority || row.priority || "Medium").trim() || "Medium",
      propertyType: String(row.PropertyType || row.propertyType || "Apartment").trim() || "Apartment",
      bhk: String(row.BHK || row.bhk || "N/A").trim() || "N/A",
      purpose: String(row.Purpose || row.purpose || "Buy").trim() || "Buy",
      preferredLocation: String(row.PreferredLocation || row.preferredLocation || "").trim(),
      followUpDate: row.FollowUpDate ? new Date(row.FollowUpDate).toISOString() : null,
      followUpNote: String(row.FollowUpNote || row.followUpNote || "").trim(),
      assignedTo: assignedAgent?._id || null,
      budget: {
        min: Number(row.BudgetMin || row.budgetMin || 0),
        max: Number(row.BudgetMax || row.budgetMax || 0),
        currency: "INR",
      },
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
      // remark1 and remark2 intentionally left empty — reserved for agent notes after calling
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
        // Parse CSV/TSV without xlsx — handles UTF-16 LE (Facebook export) and UTF-8
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
        toast(`Facebook format detected — ${questionCols.length} custom question(s) mapped`, { icon: "📋" });
      } else {
        // Standard CRM import format
        leadsToImport = rows.map(parseImportRow).filter((entry) => entry.name && entry.phone);
        if (!leadsToImport.length) { toast.error("No valid leads found in the uploaded file"); return; }
      }

      const { data } = await api.post("/leads/import", { leads: leadsToImport });
      toast.success(data.message || `${leadsToImport.length} lead(s) imported`);
      window.location.reload();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Import failed");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const canDelete = user?.role !== "agent";

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="stitch-kicker mb-2">Curated Pipeline</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Leads Management</h1>
            <p className="mt-2 text-sm text-app-soft">{total} active leads across your property funnel.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {selectedIds.size > 0 && canDelete && (
              <button
                className="btn-danger rounded-xl"
                onClick={() => setShowBulkConfirm(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete {selectedIds.size} selected
              </button>
            )}

            <label className="btn-secondary cursor-pointer rounded-xl">
              <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
            </label>

            <div ref={exportMenuRef}>
              <button
                ref={exportBtnRef}
                className="btn-secondary rounded-xl"
                onClick={() => {
                  const rect = exportBtnRef.current?.getBoundingClientRect();
                  if (rect) setExportMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  setShowExportMenu((c) => !c);
                }}
              >
                <Download className="h-4 w-4" /> Export <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <button className="btn-primary rounded-xl" onClick={() => { setEditLead(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Add Lead
            </button>
          </div>
        </div>
      </section>

      {/* ── Project-wise leads section ── */}
      {projects.length > 0 && (
        <section className="card p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FolderKanban className="h-4 w-4 text-orange-500" />
            <p className="stitch-kicker">View by Project</p>
            <select
              className="select rounded-2xl max-w-xs"
              value={selectedProject?._id || ""}
              onChange={(e) => {
                const p = projects.find((x) => x._id === e.target.value) || null;
                setSelectedProject(p);
                setProjPage(1);
                setProjSearch("");
              }}
            >
              <option value="">— Select a project —</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name} ({p.leadCount || 0} leads)</option>
              ))}
            </select>
            {selectedProject && (
              <button className="btn-ghost text-xs" onClick={() => setSelectedProject(null)}>Clear</button>
            )}
          </div>

          {selectedProject && (
            <div>
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
                        <th>Contact Status</th><th>Follow Up</th><th>Follow Up 2</th>
                        <th>Remark 1</th><th>Remark 2</th><th>Remark</th><th>Status</th>
                        {canDelete && <th></th>}
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
                          <td><PhoneActions phone={lead.phone} onContact={() => handleContact({ ...lead, _type: "project", projectId: selectedProject._id })} /></td>
                          <td><WhatsAppLink phone={lead.phone} onContact={() => handleContact({ ...lead, _type: "project", projectId: selectedProject._id })} /></td>
                          <td className="text-sm text-app-soft">{lead.email || "—"}</td>
                          <td><span className="stitch-pill text-[11px]">{lead.source}</span></td>
                          <td><ContactStatusCell lead={lead} projectId={selectedProject._id} onUpdated={handleProjLeadUpdated} /></td>
                          <td><ProjInlineDate value={lead.followUp} leadId={lead._id} projectId={selectedProject._id} field="followUp" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineDate value={lead.followUp2} leadId={lead._id} projectId={selectedProject._id} field="followUp2" onSaved={handleProjLeadUpdated} /></td>
                          <td><RemarkPopupCell value={lead.remark1} leadId={lead._id} projectId={selectedProject._id} field="remark1" placeholder="Remark 1…" onSaved={handleProjLeadUpdated} /></td>
                          <td><RemarkPopupCell value={lead.remark2} leadId={lead._id} projectId={selectedProject._id} field="remark2" placeholder="Remark 2…" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineText value={lead.remarkNote} leadId={lead._id} projectId={selectedProject._id} field="remarkNote" placeholder="Remark…" multiline onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineBooking value={lead.booking} leadId={lead._id} projectId={selectedProject._id} onSaved={handleProjLeadUpdated} /></td>
                          {canDelete && (
                            <td>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft opacity-0 group-hover:opacity-100 transition hover:bg-red-500/10 hover:text-red-400"
                                onClick={() => setProjDeletingId(lead._id)}
                                title="Delete lead"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
                    <div className="flex items-center gap-2 text-xs text-app-soft">
                      <span>Show rows:</span>
                      {[10, 30, 50, 100, 200, 500].map((n) => (
                        <button key={n} onClick={() => { setProjLimit(n); setProjPage(1); }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${projLimit === n ? "bg-orange-500/15 text-orange-500" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
                        >{n}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-app-soft">{projTotal === 0 ? "0 results" : `${(projPage - 1) * projLimit + 1} – ${Math.min(projPage * projLimit, projTotal)} of ${projTotal}`}</span>
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
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <Filter className="h-4 w-4 text-app-soft" />
            <p className="stitch-kicker">Filters</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" />
              <input className="input rounded-2xl pl-11" placeholder="Search name, phone, email..." value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
            </div>
            <select className="select rounded-2xl" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select className="select rounded-2xl" value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
              <option value="">All Sources</option>
              {SOURCE_OPTIONS.map((source) => <option key={source}>{source}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-4">
          <p className="stitch-kicker mb-3">Date Window</p>
          <select className="select rounded-2xl" value={filters.dateRange} onChange={(e) => setFilter("dateRange", e.target.value)}>
            {DATE_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="card p-4">
          <p className="stitch-kicker mb-3">Priority Focus</p>
          <select className="select rounded-2xl" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
          {Object.values(filters).some(Boolean) && (
            <button className="btn-ghost mt-3 px-0 text-xs" onClick={() => ["search", "status", "source", "priority", "dateRange"].forEach((key) => setFilter(key, ""))}>
              Clear filters
            </button>
          )}
        </div>
      </section>

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
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[1800px] text-sm">
              <thead>
                <tr>
                  {canDelete && (
                    <th className="w-10 px-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                        title="Select all"
                      />
                    </th>
                  )}
                  {["Lead", "Phone", "WhatsApp", "Source", "Project", "Status", "Priority", "Budget", "Purpose", "Remark", "Remark 1", "Remark 2", "Follow Up", "Follow Up 2", "Booking", "Property", "Assigned", "Actions"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr key={lead._id} className={`${index % 2 === 1 ? "bg-black/5 dark:bg-white/[0.02]" : ""} group ${selectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                    {canDelete && (
                      <td className="w-10 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead._id)}
                          onChange={() => toggleOne(lead._id)}
                          className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="stitch-surface-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold text-orange-500">
                          {lead.name?.slice(0, 1)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-app max-w-[140px]">{lead.name}</p>
                          <p className="truncate text-xs text-app-soft max-w-[140px]">{lead.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td><PhoneActions phone={lead.phone} onContact={() => handleContact(lead)} /></td>
                    <td><WhatsAppLink phone={lead.phone} onContact={() => handleContact(lead)} /></td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <SourceBadge source={lead.source} />
                        {lead.leadSourceLabel && (
                          <span className="text-[10px] text-app-soft truncate max-w-[130px]" title={lead.leadSourceLabel}>
                            {lead.leadSourceLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {lead.projectName
                        ? <span className="text-[11px] font-semibold text-violet-600 truncate max-w-[130px] block" title={lead.projectName}>{lead.projectName}</span>
                        : <span className="text-xs text-app-soft">—</span>}
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td><PriorityBadge priority={lead.priority} /></td>
                    <td>
                      <span className="text-xs text-app whitespace-nowrap">
                        {lead.budget?.min || lead.budget?.max
                          ? `${fmtBudget(lead.budget.min)}${lead.budget.max && lead.budget.max !== lead.budget.min ? ` - ${fmtBudget(lead.budget.max)}` : ""}`
                          : <span className="text-app-soft">—</span>}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-app">{lead.purpose && lead.purpose !== "N/A" ? lead.purpose : <span className="text-app-soft">—</span>}</span>
                    </td>
                    {/* Remark (contact status) — same dropdown for all lead types */}
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
                    <td className="min-w-[160px]">
                      {(lead.propertyType || lead.bhk) ? (
                        <p className="text-sm font-medium text-app">
                          {lead.propertyType || ""}{lead.bhk && lead.bhk !== "N/A" ? ` · ${lead.bhk}` : ""}
                        </p>
                      ) : <span className="text-xs text-app-soft">—</span>}
                      {(lead.budget?.min || lead.budget?.max) && (
                        <p className="mt-0.5 text-xs text-orange-500">{fmtCurrency(lead.budget?.min)} – {fmtCurrency(lead.budget?.max)}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-sm text-app-soft">{lead.assignedToName || lead.assignedTo?.name || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                        <button className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-white/5 hover:text-app" onClick={() => setDetailLead(lead)} title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-amber-500/10 hover:text-amber-400" onClick={() => { setEditLead(lead); setShowForm(true); }} title="Edit">
                          <Pencil className="h-4 w-4" />
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
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
          {/* Show rows selector */}
          <div className="flex items-center gap-2 text-xs text-app-soft">
            <span>Show rows:</span>
            {[10, 30, 50, 100, 200, 500].map((n) => (
              <button
                key={n}
                onClick={() => changeLimit(n)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${limit === n ? "bg-orange-500/15 text-orange-500" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
              >{n}</button>
            ))}
          </div>
          {/* Page info + navigation */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-soft">
              {total === 0 ? "0 results" : `${(page - 1) * limit + 1} – ${Math.min(page * limit, total)} of ${total}`}
            </span>
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
      <LeadDetail open={!!detailLead} onClose={() => setDetailLead(null)} lead={detailLead} onUpdated={handleDetailUpdated} />
      <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDelete} loading={deleteLoading} title="Move to Dump" message="This lead will be moved to the Dump section. You can restore or permanently delete it from there." />
      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title={`Move ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""} to Dump`}
        message={`${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""} will be moved to the Dump section. You can restore or permanently delete them from there.`}
      />
      <ConfirmDialog
        open={!!projDeletingId}
        onClose={() => setProjDeletingId(null)}
        onConfirm={handleProjDeleteLead}
        loading={projDeleting}
        title="Delete Project Lead"
        message="Are you sure you want to permanently delete this lead? This cannot be undone."
      />
      <ConfirmDialog
        open={showProjBulkConfirm}
        onClose={() => setShowProjBulkConfirm(false)}
        onConfirm={handleProjBulkDelete}
        loading={projBulkDeleting}
        title={`Delete ${projSelectedIds.size} Lead${projSelectedIds.size !== 1 ? "s" : ""}`}
        message={`Are you sure you want to permanently delete ${projSelectedIds.size} selected lead${projSelectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`}
      />

      {/* Export dropdown — portal-rendered to escape overflow:hidden parents */}
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
    </div>
  );
}
