import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  StatusBadge, PriorityBadge, SourceBadge,
  PageLoader, EmptyState, ConfirmDialog, Spinner
} from "../components/UI";
import LeadForm from "../components/LeadForm";
import LeadDetail from "../components/LeadDetail";
import { useLeads } from "../hooks/useLeads";
import api from "../services/api";
import toast from "react-hot-toast";
import { DATE_RANGE_OPTIONS, fmtDate, fmtCurrency, PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Filter, FolderKanban, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";

// ── Inline editable text cell ─────────────────────────────────────────────────
function InlineText({ value, leadId, field, onSaved, placeholder = "Add note…", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || "");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setEditing(false);
    if (val === (value || "")) return;
    setSaving(true);
    try {
      const res = await api.put(`/leads/${leadId}`, { [field]: val });
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
function InlineDate({ value, leadId, field, onSaved }) {
  const [saving, setSaving] = useState(false);

  const save = async (dateStr) => {
    setSaving(true);
    try {
      const res = await api.put(`/leads/${leadId}`, { [field]: fromISTLocal(dateStr) });
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

function InlineBooking({ value, leadId, onSaved }) {
  const [saving, setSaving] = useState(false);

  const save = async (v) => {
    setSaving(true);
    try {
      const res = await api.put(`/leads/${leadId}`, { booking: v });
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

// ── Project-wise leads remark cell ────────────────────────────────────────────
function ProjRemarkCell({ lead, projectId, onUpdated }) {
  const [remark, setRemark] = useState(lead.remark || "");
  const [note, setNote]     = useState(lead.remarkNote || "");
  const [saving, setSaving] = useState(false);

  const save = async (r, n) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${lead._id}/remark`, { remark: r, remarkNote: n });
      onUpdated(res.data.data);
    } catch { toast.error("Failed to save remark"); }
    finally { setSaving(false); }
  };

  const remarkClass = remark === "Contacted"
    ? "bg-green-500/10 border-green-500/30 text-green-600"
    : remark === "Not Contacted"
    ? "bg-red-500/10 border-red-500/30 text-red-500"
    : "border-[var(--app-border)] text-app-soft";

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      <div className="relative">
        <select
          value={remark}
          onChange={(e) => {
            const v = e.target.value;
            setRemark(v);
            if (v !== "Contacted") { setNote(""); save(v, ""); }
            else save(v, note);
          }}
          className={`w-full rounded-xl border px-2.5 py-1.5 text-xs font-semibold appearance-none transition ${remarkClass}`}
          style={{ background: "var(--app-surface-low)" }}
        >
          <option value="">— None —</option>
          <option value="Contacted">Contacted</option>
          <option value="Not Contacted">Not Contacted</option>
        </select>
        {saving && <span className="absolute right-2 top-1/2 -translate-y-1/2"><Spinner size="sm" /></span>}
      </div>
      {remark === "Contacted" && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => save(remark, note)}
          placeholder="Write a note..."
          rows={2}
          className="w-full rounded-xl border px-2.5 py-1.5 text-xs resize-none"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
        />
      )}
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    leads, total, loading, page, setPage,
    filters, setFilter,
    upsertLead, removeLead, pages, limit, changeLimit,
  } = useLeads("unified");

  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

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
  const [projLimit, setProjLimit] = useState(50);

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
    if (!location.state?.presetSource && !location.state?.presetStatus) return;
    if (location.state?.presetSource) setFilter("source", location.state.presetSource);
    if (location.state?.presetStatus) setFilter("status", location.state.presetStatus);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      toast.success("Lead deleted");
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await api.delete("/leads/bulk", { data: { ids } });
      ids.forEach((id) => removeLead(id));
      setSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk delete failed");
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
    upsertLead(updated, false);
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
    setProjLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
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

  const getXlsx = async () => import("xlsx");

  const exportRows = async (type) => {
    try {
      const { data } = await api.get("/leads", {
        params: { ...filters, page: 1, limit: 1000, sortBy: "createdAt", order: "desc" },
      });

      const rows = (data.leads || []).map((lead) => ({
        Name: lead.name,
        Phone: lead.phone,
        Email: lead.email || "",
        Source: lead.source,
        Status: lead.status,
        Priority: lead.priority,
        PropertyType: lead.propertyType,
        BHK: lead.bhk,
        Purpose: lead.purpose,
        PreferredLocation: lead.preferredLocation || "",
        BudgetMin: lead.budget?.min || 0,
        BudgetMax: lead.budget?.max || 0,
        FollowUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : "",
        FollowUpNote: lead.followUpNote || "",
        FollowUp2: lead.followUp2 ? new Date(lead.followUp2).toISOString().slice(0, 10) : "",
        Remark1: lead.remark1 || "",
        Remark2: lead.remark2 || "",
        Remark: lead.remark || "",
        Booking: lead.booking || "",
        AssignedTo: lead.assignedToName || lead.assignedTo?.name || "",
        CreatedAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : "",
      }));

      if (type === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `propcrm-leads-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Leads exported as JSON");
        return;
      }

      const XLSX = await getXlsx();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
      const fileName = `propcrm-leads-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "csv"}`;
      XLSX.writeFile(workbook, fileName, { bookType: type === "excel" ? "xlsx" : "csv" });
      toast.success(`Leads exported as ${type === "excel" ? "Excel" : "CSV"}`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Export failed");
    }
  };

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

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await getXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
      const leadsToImport = rows.map(parseImportRow).filter((entry) => entry.name && entry.phone);
      if (!leadsToImport.length) { toast.error("No valid leads found in the uploaded file"); return; }
      const { data } = await api.post("/leads/import", { leads: leadsToImport });
      toast.success(data.message || "Leads imported");
      window.location.reload();
    } catch (e) {
      toast.error(e.response?.data?.message || "Import failed");
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

            <div className="relative" ref={exportMenuRef}>
              <button className="btn-secondary rounded-xl" onClick={() => setShowExportMenu((c) => !c)}>
                <Download className="h-4 w-4" /> Export <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl"
                  style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "var(--app-shadow)" }}
                >
                  {[
                    { key: "csv",   label: "Export CSV" },
                    { key: "excel", label: "Export Excel" },
                    { key: "json",  label: "Export JSON" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-app transition"
                      onClick={() => { setShowExportMenu(false); exportRows(item.key); }}
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--app-surface-low)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Download className="h-4 w-4" /> {item.label}
                    </button>
                  ))}
                </div>
              )}
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
                        <th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Source</th>
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
                          <td><a href={`tel:${lead.phone}`} className="text-sm text-orange-500 hover:underline whitespace-nowrap">{lead.phone}</a></td>
                          <td className="text-sm text-app-soft">{lead.email || "—"}</td>
                          <td><span className="stitch-pill text-[11px]">{lead.source}</span></td>
                          <td><ProjRemarkCell lead={lead} projectId={selectedProject._id} onUpdated={handleProjLeadUpdated} /></td>
                          <td><ProjInlineDate value={lead.followUp} leadId={lead._id} projectId={selectedProject._id} field="followUp" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineDate value={lead.followUp2} leadId={lead._id} projectId={selectedProject._id} field="followUp2" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineText value={lead.remark1} leadId={lead._id} projectId={selectedProject._id} field="remark1" placeholder="Remark 1…" onSaved={handleProjLeadUpdated} /></td>
                          <td><ProjInlineText value={lead.remark2} leadId={lead._id} projectId={selectedProject._id} field="remark2" placeholder="Remark 2…" onSaved={handleProjLeadUpdated} /></td>
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
                  {["Lead", "Phone", "Source", "Project", "Status", "Priority", "Follow Up", "Follow Up 2", "Remark 1", "Remark 2", "Remark", "Status", "Property", "Assigned", "Actions"].map((h) => (
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
                    <td className="whitespace-nowrap text-sm text-app-soft">{lead.phone}</td>
                    <td><SourceBadge source={lead.source} /></td>
                    <td>
                      {lead.projectName
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600">{lead.projectName}</span>
                        : <span className="text-xs text-app-soft">—</span>}
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td><PriorityBadge priority={lead.priority} /></td>
                    <td>
                      <InlineDate value={lead.followUpDate} leadId={lead._id} field="followUpDate" onSaved={handleInlineUpdate} />
                    </td>
                    <td>
                      <InlineDate value={lead.followUp2} leadId={lead._id} field="followUp2" onSaved={handleInlineUpdate} />
                    </td>
                    <td>
                      <InlineText value={lead.remark1} leadId={lead._id} field="remark1" onSaved={handleInlineUpdate} placeholder="Remark 1…" />
                    </td>
                    <td>
                      <InlineText value={lead.remark2} leadId={lead._id} field="remark2" onSaved={handleInlineUpdate} placeholder="Remark 2…" />
                    </td>
                    <td>
                      <InlineText value={lead.remark} leadId={lead._id} field="remark" onSaved={handleInlineUpdate} placeholder="General remark…" multiline />
                    </td>
                    <td>
                      <InlineBooking value={lead.booking} leadId={lead._id} onSaved={handleInlineUpdate} />
                    </td>
                    <td className="min-w-[160px]">
                      <p className="text-sm font-medium text-app">{lead.propertyType}{lead.bhk !== "N/A" ? ` · ${lead.bhk}` : ""}</p>
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
      <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDelete} loading={deleteLoading} title="Delete Lead" message="Are you sure you want to permanently delete this lead? This cannot be undone." />
      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title={`Delete ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`}
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
    </div>
  );
}
