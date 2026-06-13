// pages/ProjectDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner, EmptyState, ConfirmDialog, PhoneActions, WhatsAppLink, AppDatePicker } from "../components/UI";
import ProjectForm from "../components/ProjectForm";
import LeadForm from "../components/LeadForm";
import TransferModal from "../components/TransferModal";
import api from "../services/api";
import toast from "react-hot-toast";
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";
import DateTimePicker from "../components/DateTimePicker";
import CustomSelect from "../components/CustomSelect";
import {
  ArrowLeft, ArrowRightLeft, Building2, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Download, FileSpreadsheet, FileText, ImageOff, MapPin, Pencil, Search, Trash2, Upload, Users,
} from "lucide-react";

// Tap to reveal full name; default shows first name only
function NameCell({ name, bold, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full focus:outline-none group"
    >
      <span className={`block text-xs leading-snug ${bold ? "font-semibold" : "font-medium"} text-app truncate group-hover:text-orange-500 transition-colors`}>
        {name || "-"}
      </span>
      <span className="text-[9px] text-orange-400 leading-none opacity-0 group-hover:opacity-100 transition-opacity">
        tap to open
      </span>
    </button>
  );
}

function fmtPrice(n) {
  if (!n) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function cleanPhone(raw) {
  return String(raw || "")
    .replace(/^(?:p|ph|tel|mob|mobile|phone)\s*:\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

// Standard contact columns (Facebook Graph API style + common spreadsheet headers)
const STANDARD_IMPORT_KEYS = new Set([
  "full name", "full_name", "name", "customer name", "lead name",
  "phone number", "phone_number", "phone", "mobile", "contact",
  "mobile number", "ph", "number", "mob", "whatsapp", "contact number", "cell",
  "email", "email address", "email_address", "mail",
  "source", "lead source",
]);

function parseRow(raw) {
  const r = {};
  Object.keys(raw).forEach((k) => { r[k.trim().toLowerCase()] = String(raw[k] || "").trim(); });

  // Name: support both spreadsheet headers and Facebook's full_name field
  const name = r["full_name"] || r["full name"] || r["name"] || r["customer name"] || r["lead name"] || "";

  // Phone: support Facebook's phone_number and all common variants
  const rawPhone = r["phone_number"] || r["phone number"] || r["phone"] || r["mobile"] ||
    r["contact"] || r["mobile number"] || r["ph"] || r["number"] || r["mob"] ||
    r["whatsapp"] || r["contact number"] || r["cell"] || "";
  const phone = cleanPhone(rawPhone);

  const email  = r["email_address"] || r["email address"] || r["email"] || r["mail"] || "";
  const source = r["source"] || r["lead source"] || "Facebook";

  // Capture dynamic Facebook MCQ / custom form answers as structured notes
  const extraAnswers = Object.entries(r)
    .filter(([k, v]) => !STANDARD_IMPORT_KEYS.has(k) && v)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(" · ");

  return { name, phone, email, source, remarkNote: extraAnswers || "" };
}

// ── Inline editable text cell ─────────────────────────────────────────────────
function InlineText({ value, leadId, projectId, field, placeholder = "Add note…", multiline = false, onSaved }) {
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
      className: "w-full min-w-[130px] rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400",
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

// ── Inline date cell ──────────────────────────────────────────────────────────
function InlineDate({ value, leadId, projectId, field, onSaved }) {
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

// ── Inline booking select ─────────────────────────────────────────────────────
const BOOKING_OPTIONS = [
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

// Filter pills shown above the leads table
const STATUS_FILTERS = [
  { value: "",                  label: "All",               bg: "bg-gray-100 dark:bg-white/10",              text: "text-app-soft" },
  { value: "Interested",        label: "Interested",        bg: "bg-blue-100 dark:bg-blue-500/20",           text: "text-blue-600 dark:text-blue-400" },
  { value: "Not Interested",    label: "Not Interested",    bg: "bg-red-100 dark:bg-red-500/20",             text: "text-red-500 dark:text-red-400" },
  { value: "Not Reachable",     label: "Not Reachable",     bg: "bg-gray-100 dark:bg-white/10",              text: "text-gray-500 dark:text-gray-400" },
  { value: "Low Budget",        label: "Low Budget",        bg: "bg-pink-100 dark:bg-pink-500/20",           text: "text-pink-600 dark:text-pink-400" },
  { value: "Call Back",         label: "Call Back",         bg: "bg-amber-100 dark:bg-amber-500/20",         text: "text-amber-600 dark:text-amber-400" },
  { value: "Site Visit Booked", label: "Site Visit Booked", bg: "bg-violet-100 dark:bg-violet-500/20",       text: "text-violet-600 dark:text-violet-400" },
  { value: "Site Visit Done",   label: "Site Visit Done",   bg: "bg-teal-100 dark:bg-teal-500/20",           text: "text-teal-600 dark:text-teal-400" },
  { value: "Booked",            label: "Booked",            bg: "bg-green-100 dark:bg-green-500/20",         text: "text-green-600 dark:text-green-400" },
  { value: "Other Location",    label: "Other Location",    bg: "bg-orange-100 dark:bg-orange-500/20",       text: "text-orange-600 dark:text-orange-400" },
  { value: "Commercial",        label: "Commercial",        bg: "bg-indigo-100 dark:bg-indigo-500/20",       text: "text-indigo-600 dark:text-indigo-400" },
];

function InlineBooking({ value, leadId, projectId, onSaved }) {
  const [saving, setSaving] = useState(false);

  const save = async (v) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${leadId}`, { booking: v });
      onSaved(res.data.data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const opt = BOOKING_OPTIONS.find((o) => o.value === (value || "")) || BOOKING_OPTIONS[0];
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;

  return (
    <CustomSelect
      value={value || ""}
      onChange={save}
      options={BOOKING_OPTIONS.map((o) => ({ value: o.value, label: o.label, color: o.color }))}
      style={{ minWidth: 120, maxWidth: 160 }}
    />
  );
}

// ── Contact remark cell (None / Contacted / Not Contacted + note) ─────────────
function RemarkCell({ lead, projectId, onUpdated }) {
  const [remark, setRemark] = useState(lead.remark || "");
  const [note, setNote]     = useState(lead.remarkNote || "");
  const [saving, setSaving] = useState(false);
  const noteRef = useRef(null);

  const saveRemark = async (newRemark, newNote) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${lead._id}/remark`, { remark: newRemark, remarkNote: newNote });
      onUpdated(res.data.data);
    } catch { toast.error("Failed to save remark"); }
    finally { setSaving(false); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setRemark(val);
    if (val !== "Contacted") { setNote(""); saveRemark(val, ""); }
    else saveRemark(val, note);
  };

  const remarkClass = remark === "Contacted"
    ? "bg-green-500/10 border-green-500/30 text-green-600"
    : remark === "Not Contacted"
    ? "bg-red-500/10 border-red-500/30 text-red-500"
    : "border-[var(--app-border)] text-app-soft";

  return (
    <div className="flex flex-col gap-2 min-w-[160px]">
      <div className="relative">
        <CustomSelect
          value={remark}
          onChange={(val) => {
            setRemark(val);
            if (val !== "Contacted") { setNote(""); saveRemark(val, ""); }
            else saveRemark(val, note);
          }}
          placeholder="- None -"
          options={[
            { value: "Contacted", label: "Contacted" },
            { value: "Not Contacted", label: "Not Contacted" },
          ]}
          style={{ width: "100%" }}
        />
        {saving && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>}
      </div>
      {remark === "Contacted" && (
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveRemark(remark, note)}
          placeholder="Write a note..."
          rows={2}
          className="w-full rounded-xl border px-2.5 py-1.5 text-xs resize-none transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
        />
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = ["admin", "manager", "super_admin"].includes(user?.role);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState(() => location.state?.searchLead ? "leads" : "info");
  const [showEdit, setShowEdit] = useState(false);

  // Project delete
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [deletingProject, setDeletingProject]     = useState(false);

  // Leads state
  const [leads, setLeads]               = useState([]);
  const [leadsTotal, setLeadsTotal]     = useState(0);
  const [leadsPage, setLeadsPage]       = useState(1);
  const [leadsPages, setLeadsPages]     = useState(1);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [search, setSearch]             = useState(() => location.state?.searchLead || "");
  const [importing, setImporting]       = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [deletingLead, setDeletingLead]     = useState(false);

  // Bulk select – Leads tab
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting]       = useState(false);

  // Bulk select – Prospective tab
  const [prospSelectedIds, setProspSelectedIds]   = useState(new Set());
  const [showProspBulkConfirm, setShowProspBulkConfirm] = useState(false);
  const [prospBulkStatusBook, setProspBulkStatusBook] = useState("");
  const [bulkStatusUpdating, setBulkStatusUpdating]   = useState(false);

  // Bulk select – Site Visit Done tab
  const [svdSelectedIds, setSvdSelectedIds]     = useState(new Set());
  const [showSvdBulkConfirm, setShowSvdBulkConfirm] = useState(false);

  // Edit lead modal
  const [editingLead, setEditingLead] = useState(null);

  // Transfer modal
  const [transferTarget, setTransferTarget] = useState(null); // lead object to transfer
  const [refreshKey, setRefreshKey] = useState(0);

  const fileRef = useRef(null);

  // Top scrollbar refs (leads tab table)
  const topScrollRef   = useRef(null);
  const tableScrollRef = useRef(null);
  const topSpacerRef   = useRef(null);

  const [leadsLimit, setLeadsLimit] = useState(10);
  const [bookingFilter, setBookingFilter] = useState("");

  // Prospective entry statuses - used only for badge pre-fetch fallback
  const PROSP_ENTRY = "Interested,Site Visit Booked,Site Visit Done";
  const [prospLeads, setProspLeads]   = useState([]);
  const [prospTotal, setProspTotal]   = useState(0);
  const [prospPage, setProspPage]     = useState(1);

  // Site Visit Done tab state
  const [svdLeads, setSvdLeads]     = useState([]);
  const [svdTotal, setSvdTotal]     = useState(0);
  const [svdPage, setSvdPage]       = useState(1);
  const [svdPages, setSvdPages]     = useState(1);
  const [svdLoading, setSvdLoading] = useState(false);
  const [svdSearch, setSvdSearch]   = useState("");
  const SVD_LIMIT = 50;
  const [prospPages, setProspPages]   = useState(1);
  const [prospLoading, setProspLoading] = useState(false);
  const [prospSearch, setProspSearch] = useState("");
  const [prospBookingFilter, setProspBookingFilter] = useState(""); // "" = all prospective
  const [prospDateFrom, setProspDateFrom] = useState("");
  const [prospDateTo, setProspDateTo]     = useState("");
  const PROSP_LIMIT = 50;
  const [exportingProsp, setExportingProsp] = useState(false);
  const [exportDropOpen, setExportDropOpen] = useState(false);
  const exportDropRef = useRef(null);

  // Leads tab export
  const [exportingLeads, setExportingLeads] = useState(false);
  const [exportLeadsDropOpen, setExportLeadsDropOpen] = useState(false);
  const exportLeadsDropRef = useRef(null);

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then((r) => setProject(r.data.data))
      .catch(() => { toast.error("Project not found"); navigate("/projects"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Pre-fetch lead counts so tab badges are correct on first render
  useEffect(() => {
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1 } })
      .then((r) => setLeadsTotal(r.data.total)).catch(() => {});
    // Prospective excludes Site Visit Done (they live in their own tab)
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingNotIn: "Site Visit Done" } })
      .then((r) => setProspTotal(r.data.total)).catch(() => {});
    // Site Visit Done count
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingIn: "Site Visit Done" } })
      .then((r) => setSvdTotal(r.data.total)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (tab !== "leads") return;
    setLeadsLoading(true);
    api.get(`/projects/${id}/leads`, { params: { page: leadsPage, limit: leadsLimit, search, ...(bookingFilter && { bookingIn: bookingFilter }) } })
      .then((r) => { setLeads(r.data.leads); setLeadsTotal(r.data.total); setLeadsPages(r.data.pages); })
      .catch(() => toast.error("Failed to load leads"))
      .finally(() => setLeadsLoading(false));
  }, [id, tab, leadsPage, search, leadsLimit, bookingFilter, refreshKey]);

  useEffect(() => {
    if (tab !== "prospective") return;
    setProspLoading(true);
    const params = {
      page: prospPage,
      limit: PROSP_LIMIT,
      search: prospSearch,
      isProspective: true,
    };
    // Filter pills narrow within the prospective scope
    if (prospBookingFilter) params.bookingIn = prospBookingFilter;
    // When showing All Prospective, exclude Site Visit Done (they live in their own tab)
    if (!prospBookingFilter) params.bookingNotIn = "Site Visit Done";
    // Date range
    if (prospDateFrom) params.followUpFrom = prospDateFrom;
    if (prospDateTo)   params.followUpTo   = prospDateTo;
    api.get(`/projects/${id}/leads`, { params })
      .then((r) => { setProspLeads(r.data.leads); setProspTotal(r.data.total); setProspPages(r.data.pages); })
      .catch(() => toast.error("Failed to load prospective leads"))
      .finally(() => setProspLoading(false));
  }, [id, tab, prospPage, prospSearch, prospBookingFilter, prospDateFrom, prospDateTo, refreshKey]);

  // Site Visit Done tab fetch
  useEffect(() => {
    if (tab !== "sitevisitdone") return;
    setSvdLoading(true);
    api.get(`/projects/${id}/leads`, {
      params: { page: svdPage, limit: SVD_LIMIT, search: svdSearch, isProspective: true, bookingIn: "Site Visit Done" },
    })
      .then((r) => { setSvdLeads(r.data.leads); setSvdTotal(r.data.total); setSvdPages(r.data.pages); })
      .catch(() => toast.error("Failed to load site visit done leads"))
      .finally(() => setSvdLoading(false));
  }, [id, tab, svdPage, svdSearch, refreshKey]);

  // Close export dropdowns on outside click
  useEffect(() => {
    if (!exportDropOpen) return;
    const handler = (e) => { if (!exportDropRef.current?.contains(e.target)) setExportDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportDropOpen]);

  useEffect(() => {
    if (!exportLeadsDropOpen) return;
    const handler = (e) => { if (!exportLeadsDropRef.current?.contains(e.target)) setExportLeadsDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportLeadsDropOpen]);

  const exportLeads = async (format) => {
    setExportLeadsDropOpen(false);
    setExportingLeads(true);
    try {
      let sourceLeads;
      if (selectedIds.size > 0) {
        sourceLeads = leads.filter((l) => selectedIds.has(l._id));
      } else {
        const params = { page: 1, limit: 9999, ...(search && { search }), ...(bookingFilter && { bookingIn: bookingFilter }) };
        const { data } = await api.get(`/projects/${id}/leads`, { params });
        sourceLeads = data.leads || [];
      }
      const rows = sourceLeads.map((lead, i) => ({
        "#":           i + 1,
        "Name":        lead.name || "",
        "Phone":       lead.phone || "",
        "WhatsApp":    lead.whatsapp || "",
        "Email":       lead.email || "",
        "Source":      lead.source || "",
        "Status":      lead.booking || "",
        "Follow Up":   lead.followUp ? new Date(lead.followUp).toLocaleDateString("en-IN") : "",
        "Follow Up 2": lead.followUp2 ? new Date(lead.followUp2).toLocaleDateString("en-IN") : "",
        "Remark 1":    lead.remark1 || "",
        "Remark 2":    lead.remark2 || "",
        "Note":        lead.remarkNote || "",
      }));
      if (!rows.length) { toast.error("No leads to export"); return; }
      const projectName = (project?.name || "project").replace(/[^a-zA-Z0-9]/g, "_");
      const filterLabel = bookingFilter ? `_${bookingFilter.replace(/ /g, "_")}` : "";
      const selectionLabel = selectedIds.size > 0 ? `_${selectedIds.size}selected` : "";
      const filename = `Leads_${projectName}${filterLabel}${selectionLabel}`;
      if (format === "csv") {
        const ws = xlsxUtils.json_to_sheet(rows);
        const csv = xlsxUtils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = xlsxUtils.json_to_sheet(rows);
        const wb = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(wb, ws, "Leads");
        xlsxWriteFile(wb, `${filename}.xlsx`);
      }
      toast.success(`Exported ${rows.length} lead${rows.length !== 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Export failed");
    } finally {
      setExportingLeads(false);
    }
  };

  const exportProspective = async (format) => {
    setExportDropOpen(false);
    setExportingProsp(true);
    try {
      const params = {
        page: 1,
        limit: 9999,
        isProspective: true,
        ...(prospSearch        && { search: prospSearch }),
        ...(prospBookingFilter ? { bookingIn: prospBookingFilter } : { bookingNotIn: "Site Visit Done" }),
        ...(prospDateFrom      && { followUpFrom: prospDateFrom }),
        ...(prospDateTo        && { followUpTo: prospDateTo }),
      };
      const { data } = await api.get(`/projects/${id}/leads`, { params });
      const rows = (data.leads || []).map((lead, i) => ({
        "#":             i + 1,
        "Name":          lead.name || "",
        "Phone":         lead.phone || "",
        "WhatsApp":      lead.whatsapp || "",
        "Email":         lead.email || "",
        "Source":        lead.source || "",
        "Status":        lead.booking || "",
        "Follow Up":     lead.followUp ? new Date(lead.followUp).toLocaleDateString("en-IN") : "",
        "Follow Up 2":   lead.followUp2 ? new Date(lead.followUp2).toLocaleDateString("en-IN") : "",
        "Remark 1":      lead.remark1 || "",
        "Remark 2":      lead.remark2 || "",
        "Remark 3":      lead.remark3 || "",
        "Remark 4":      lead.remark4 || "",
        "Note":          lead.remarkNote || "",
        "Updated By":    lead.remarkUpdatedBy?.name || "",
        "Updated At":    lead.remarkUpdatedAt ? new Date(lead.remarkUpdatedAt).toLocaleDateString("en-IN") : "",
      }));
      if (!rows.length) { toast.error("No prospective leads to export"); return; }
      const projectName = (project?.name || "project").replace(/[^a-zA-Z0-9]/g, "_");
      const filterLabel = prospBookingFilter ? `_${prospBookingFilter.replace(/ /g, "_")}` : "";
      const filename = `Prospective_${projectName}${filterLabel}`;
      if (format === "csv") {
        const ws = xlsxUtils.json_to_sheet(rows);
        const csv = xlsxUtils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${filename}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = xlsxUtils.json_to_sheet(rows);
        const wb = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(wb, ws, "Prospective");
        xlsxWriteFile(wb, `${filename}.xlsx`);
      }
      toast.success(`Exported ${rows.length} lead${rows.length !== 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Export failed");
    } finally {
      setExportingProsp(false);
    }
  };

  // Sync top scrollbar ↔ table scrollbar with dynamic width via ResizeObserver
  useEffect(() => {
    const top    = topScrollRef.current;
    const table  = tableScrollRef.current;
    const spacer = topSpacerRef.current;
    if (!top || !table) return;
    const syncWidth = () => { if (spacer) spacer.style.width = table.scrollWidth + "px"; };
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

  const handleSearch = (e) => { setSearch(e.target.value); setLeadsPage(1); };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb  = xlsxRead(buf, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = xlsxUtils.sheet_to_json(ws, { defval: "" });
      const rows = raw.map(parseRow).filter((r) => r.name && r.phone);
      if (!rows.length) return toast.error("No valid rows found. Columns needed: Name, Phone Number");
      const res = await api.post(`/projects/${id}/leads/import`, { rows });
      const inserted  = res.data?.inserted  ?? 0;
      const duplicates = res.data?.duplicates ?? 0;
      const skippedInvalid = res.data?.skipped ?? 0;

      if (inserted > 0) {
        const parts = [`${inserted} lead${inserted !== 1 ? "s" : ""} imported successfully`];
        if (duplicates > 0)    parts.push(`${duplicates} duplicate${duplicates !== 1 ? "s" : ""} skipped`);
        if (skippedInvalid > 0) parts.push(`${skippedInvalid} invalid row${skippedInvalid !== 1 ? "s" : ""} ignored`);
        toast.success(parts.join(" · "), { duration: 5000 });
      } else if (duplicates > 0) {
        toast.error(`All ${duplicates} leads already exist in this project - nothing new added`, { duration: 5000 });
      } else {
        toast.error("No leads were imported");
      }
      setLeadsPage(1); setSearch("");
      const fresh = await api.get(`/projects/${id}/leads`, { params: { page: 1, limit: leadsLimit } });
      setLeads(fresh.data.leads); setLeadsTotal(fresh.data.total); setLeadsPages(fresh.data.pages);
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally { setImporting(false); }
  };

  // Clear selection when page/search changes
  useEffect(() => { setSelectedIds(new Set()); }, [leadsPage, search]);
  useEffect(() => { setProspSelectedIds(new Set()); }, [prospPage, prospSearch, prospBookingFilter]);
  useEffect(() => { setSvdSelectedIds(new Set()); }, [svdPage, svdSearch]);

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l._id));
  const someSelected = leads.some((l) => selectedIds.has(l._id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map((l) => l._id)));
  };

  const toggleOne = (lid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lid)) next.delete(lid); else next.add(lid);
      return next;
    });
  };

  const allProspSelected  = prospLeads.length > 0 && prospLeads.every((l) => prospSelectedIds.has(l._id));
  const someProspSelected = prospLeads.some((l) => prospSelectedIds.has(l._id));
  const toggleAllProsp = () => {
    if (allProspSelected) setProspSelectedIds(new Set());
    else setProspSelectedIds(new Set(prospLeads.map((l) => l._id)));
  };
  const toggleOneProsp = (lid) => {
    setProspSelectedIds((prev) => { const next = new Set(prev); next.has(lid) ? next.delete(lid) : next.add(lid); return next; });
  };

  const allSvdSelected  = svdLeads.length > 0 && svdLeads.every((l) => svdSelectedIds.has(l._id));
  const someSvdSelected = svdLeads.some((l) => svdSelectedIds.has(l._id));
  const toggleAllSvd = () => {
    if (allSvdSelected) setSvdSelectedIds(new Set());
    else setSvdSelectedIds(new Set(svdLeads.map((l) => l._id)));
  };
  const toggleOneSvd = (lid) => {
    setSvdSelectedIds((prev) => { const next = new Set(prev); next.has(lid) ? next.delete(lid) : next.add(lid); return next; });
  };

  // Update lead across all three sections after edit
  const handleEditLeadSaved = (updated) => {
    setLeads((prev)       => prev.map((l) => l._id === updated._id ? { ...l, ...updated } : l));
    setProspLeads((prev)  => prev.map((l) => l._id === updated._id ? { ...l, ...updated } : l));
    setSvdLeads((prev)    => prev.map((l) => l._id === updated._id ? { ...l, ...updated } : l));
    setEditingLead(null);
  };

  const handleLeadUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
    // Refresh prospective badge count (excludes SVD)
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingNotIn: "Site Visit Done" } })
      .then((r) => setProspTotal(r.data.total)).catch(() => {});
    // Refresh SVD badge count
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingIn: "Site Visit Done" } })
      .then((r) => setSvdTotal(r.data.total)).catch(() => {});
    // If currently on prospective tab, also refresh the list
    if (tab === "prospective") {
      const params = { page: prospPage, limit: PROSP_LIMIT, search: prospSearch, isProspective: true };
      if (prospBookingFilter) params.bookingIn = prospBookingFilter;
      if (!prospBookingFilter) params.bookingNotIn = "Site Visit Done";
      api.get(`/projects/${id}/leads`, { params })
        .then((r) => { setProspLeads(r.data.leads); setProspTotal(r.data.total); setProspPages(r.data.pages); })
        .catch(() => {});
    }
    // If currently on SVD tab, also refresh the list
    if (tab === "sitevisitdone") {
      api.get(`/projects/${id}/leads`, { params: { page: svdPage, limit: SVD_LIMIT, search: svdSearch, isProspective: true, bookingIn: "Site Visit Done" } })
        .then((r) => { setSvdLeads(r.data.leads); setSvdTotal(r.data.total); setSvdPages(r.data.pages); })
        .catch(() => {});
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await api.delete(`/projects/${id}/leads/bulk`, { data: { ids } });
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l._id)));
      setLeadsTotal((t) => t - ids.length);
      setSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const handleProspBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...prospSelectedIds];
      await api.delete(`/projects/${id}/leads/bulk`, { data: { ids } });
      setProspLeads((prev) => prev.filter((l) => !prospSelectedIds.has(l._id)));
      setProspTotal((t) => t - ids.length);
      setProspSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
      setShowProspBulkConfirm(false);
    }
  };

  const handleProspBulkStatus = async () => {
    if (!prospBulkStatusBook || prospSelectedIds.size === 0) return;
    setBulkStatusUpdating(true);
    try {
      const ids = [...prospSelectedIds];
      await api.patch(`/projects/${id}/leads/bulk-status`, { ids, booking: prospBulkStatusBook });
      setProspLeads((prev) => prev.map((l) =>
        prospSelectedIds.has(l._id) ? { ...l, booking: prospBulkStatusBook } : l
      ));
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} updated to "${prospBulkStatusBook}"`);
      setProspSelectedIds(new Set());
      setProspBulkStatusBook("");
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk status update failed");
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  const handleSvdBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = [...svdSelectedIds];
      await api.delete(`/projects/${id}/leads/bulk`, { data: { ids } });
      setSvdLeads((prev) => prev.filter((l) => !svdSelectedIds.has(l._id)));
      setSvdTotal((t) => t - ids.length);
      setSvdSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
      setShowSvdBulkConfirm(false);
    }
  };

  const handleDeleteLead = async () => {
    setDeletingLead(true);
    try {
      await api.delete(`/projects/${id}/leads/${deletingLeadId}`);
      setLeads((prev) => prev.filter((l) => l._id !== deletingLeadId));
      setLeadsTotal((t) => t - 1);
      toast.success("Lead deleted");
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed");
    } finally {
      setDeletingLead(false);
      setDeletingLeadId(null);
    }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    try {
      await api.delete(`/projects/${id}`);
      toast.success("Project deleted");
      navigate("/projects");
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed");
    } finally {
      setDeletingProject(false);
      setShowDeleteProject(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!project) return null;

  return (
    <div className="stitch-page space-y-6">
      {/* Top bar */}
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/projects")} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="stitch-kicker mb-0.5">Project</p>
            <h1 className="text-xl font-black tracking-tight text-app">{project.name}</h1>
            {project.location && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-app-soft">
                <MapPin className="h-3 w-3" /> {project.location}
              </div>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowEdit(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button className="btn-danger" onClick={() => setShowDeleteProject(true)}>
              <Trash2 className="h-4 w-4" /> Delete Project
            </button>
          </div>
        )}
      </div>

      {/* Assigned members info bar */}
      {project.assignedTo?.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <Users className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <span className="text-app-soft">
            Assigned to:{" "}
            <span className="font-semibold text-app">
              {project.assignedTo
                .map((m) => (typeof m === "object" ? m.name : ""))
                .filter(Boolean)
                .join(", ")}
            </span>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1 stitch-surface-muted sm:flex sm:w-fit">
        {[
          { key: "info",          label: "Info",                                                                    activeClass: "",                     activeBg: "var(--app-primary)" },
          { key: "leads",         label: `Leads (${leadsTotal})`,                                                  activeClass: "",                     activeBg: "var(--app-primary)" },
          { key: "prospective",   label: `Prospective${prospTotal > 0 ? ` (${prospTotal})` : ""}`,                activeClass: "bg-green-600",         activeBg: "" },
          { key: "sitevisitdone", label: `Site Visit Done${svdTotal > 0 ? ` (${svdTotal})` : ""}`,               activeClass: "bg-teal-600",          activeBg: "" },
        ].map(({ key, label, activeClass, activeBg }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition text-center sm:px-5 sm:py-2 ${
              tab === key
                ? activeClass ? `${activeClass} text-white shadow-sm` : "text-white shadow-sm"
                : "text-app-soft hover:text-app"
            }`}
            style={tab === key && activeBg ? { background: activeBg } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── INFO TAB ── */}
      {tab === "info" && (
        <div className="space-y-6">
          {project.images?.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {project.images.map((url, i) => (
                <div key={i} className="relative flex-shrink-0 h-52 w-80 rounded-2xl overflow-hidden border"
                  style={{ borderColor: "var(--app-border)" }}>
                  <img src={url} alt="" className="h-full w-full object-cover"
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  />
                  <div className="hidden h-full w-full items-center justify-center stitch-surface-muted">
                    <ImageOff className="h-8 w-8 text-app-soft" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-6 space-y-4">
              <p className="stitch-kicker">Project Details</p>
              {project.description && <p className="text-sm text-app-soft leading-relaxed">{project.description}</p>}
              <div className="space-y-3">
                {project.reraNumber && (
                  <div>
                    <p className="text-xs text-app-soft mb-0.5">RERA Number</p>
                    <p className="text-sm font-semibold text-app">{project.reraNumber}</p>
                  </div>
                )}
                {project.possessionDate && (
                  <div>
                    <p className="text-xs text-app-soft mb-0.5">Possession Date</p>
                    <p className="text-sm font-semibold text-app flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-orange-500" />
                      {fmtDate(project.possessionDate)}
                    </p>
                  </div>
                )}
                {project.area && (
                  <div>
                    <p className="text-xs text-app-soft mb-0.5">Area</p>
                    <p className="text-sm font-semibold text-app">{project.area}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <p className="stitch-kicker">Pricing & Configuration</p>
              {(project.priceMin || project.priceMax) && (
                <div>
                  <p className="text-xs text-app-soft mb-0.5">Price Range</p>
                  <p className="text-xl font-black text-orange-500">
                    {fmtPrice(project.priceMin)}{project.priceMin && project.priceMax ? " – " : ""}{fmtPrice(project.priceMax)}
                  </p>
                </div>
              )}
              {project.bhkTypes?.length > 0 && (
                <div>
                  <p className="text-xs text-app-soft mb-2">BHK Options</p>
                  <div className="flex flex-wrap gap-2">
                    {project.bhkTypes.map((b) => (
                      <span key={b} className="rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-xs font-bold text-orange-500">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {project.amenities?.length > 0 && (
              <div className="card p-6 md:col-span-2">
                <p className="stitch-kicker mb-3">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {project.amenities.map((a, i) => (
                    <span key={i} className="stitch-pill">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEADS TAB ── */}
      {tab === "leads" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" />
              <input
                className="input rounded-full pl-11"
                placeholder="Search by name or phone..."
                value={search}
                onChange={handleSearch}
              />
            </div>
            {selectedIds.size > 0 && (
              <button className="btn-danger" onClick={() => setShowBulkConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Delete {selectedIds.size} selected
              </button>
            )}
            {/* Export leads dropdown */}
            <div className="relative" ref={exportLeadsDropRef}>
              <button
                onClick={() => setExportLeadsDropOpen((v) => !v)}
                disabled={exportingLeads}
                className="btn-primary flex items-center gap-2"
                title="Export leads"
              >
                {exportingLeads ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                Export
              </button>
              {exportLeadsDropOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl overflow-hidden shadow-lg py-1"
                  style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
                  {[["xlsx", "Export Excel"], ["csv", "Export CSV"]].map(([fmt, label]) => (
                    <button key={fmt} onClick={() => exportLeads(fmt)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-app hover:bg-orange-500/10 transition">
                      <FileSpreadsheet className="h-4 w-4 text-app-soft" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {canManage && (
              <>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importing..." : "Import"}
                </button>
              </>
            )}
          </div>

          {/* Status filter pills */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = bookingFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => { setBookingFilter(f.value); setLeadsPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-center sm:rounded-full sm:py-1 ${
                    active
                      ? `${f.bg} ${f.text} ring-2 ring-current ring-offset-1`
                      : "bg-gray-100 dark:bg-white/5 text-app-soft border border-orange-400/50 hover:text-app hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="card overflow-hidden">
            {leadsLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : leads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No leads yet"
                desc={canManage ? "Import an Excel or CSV file from Facebook to add leads." : "No leads have been imported yet."}
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
                <div ref={tableScrollRef} className="overflow-x-auto">
                  <table className="stitch-table min-w-[1500px]">
                    <thead>
                      <tr>
                        <th style={{ width: 28, minWidth: 28 }} className="px-1">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500"
                            title="Select all"
                          />
                        </th>
                        <th style={{ width: 28, minWidth: 28 }} className="text-center px-1">#</th>
                        <th className="sticky left-0 z-20 shadow-[2px_0_6px_rgba(0,0,0,0.07)]" style={{ width: 100, minWidth: 100, background: "var(--app-surface)" }}>Name</th>
                        <th style={{ width: 130, minWidth: 130 }}>Phone</th>
                        <th style={{ width: 110, minWidth: 110 }}>WhatsApp</th>
                        <th style={{ width: 130, minWidth: 130 }}>Email</th>
                        <th style={{ width: 80, minWidth: 80 }}>Source</th>
                        <th style={{ width: 130, minWidth: 130 }}>Contact Status</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 1</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 2</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up 2</th>
                        <th style={{ width: 140, minWidth: 140 }}>Remark</th>
                        <th style={{ width: 150, minWidth: 150 }}>Status</th>
                        <th style={{ width: 100, minWidth: 100 }}>Updated By</th>
                        <th style={{ width: 110, minWidth: 110 }}>Assigned To</th>
                        <th style={{ width: 72, minWidth: 72 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead, i) => (
                        <tr key={lead._id} className={`group ${selectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                          <td className="w-6 px-1">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead._id)}
                              onChange={() => toggleOne(lead._id)}
                              className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500"
                            />
                          </td>
                          <td className="w-6 px-1 text-center text-app-soft text-xs">{(leadsPage - 1) * leadsLimit + i + 1}</td>
                          <td className="sticky left-0 z-10 shadow-[2px_0_6px_rgba(0,0,0,0.06)] w-[90px] min-w-[90px] max-w-[90px] px-2" style={{ background: "var(--app-surface)" }}>
                            <NameCell name={lead.name} onOpen={() => setEditingLead(lead)} />
                          </td>
                          <td><PhoneActions phone={lead.phone} /></td>
                          <td><WhatsAppLink phone={lead.phone} name={lead.name} leadId={lead._id} projectId={id} /></td>
                          <td className="text-sm text-app-soft">{lead.email || "-"}</td>
                          <td><span className="stitch-pill text-[11px]">{lead.source}</span></td>
                          <td>
                            <RemarkCell lead={lead} projectId={id} onUpdated={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineText value={lead.remark1} leadId={lead._id} projectId={id} field="remark1" placeholder="Remark 1…" onSaved={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineText value={lead.remark2} leadId={lead._id} projectId={id} field="remark2" placeholder="Remark 2…" onSaved={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineDate value={lead.followUp} leadId={lead._id} projectId={id} field="followUp" onSaved={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineDate value={lead.followUp2} leadId={lead._id} projectId={id} field="followUp2" onSaved={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineText value={lead.remarkNote} leadId={lead._id} projectId={id} field="remarkNote" placeholder="General remark…" multiline onSaved={handleLeadUpdated} />
                          </td>
                          <td>
                            <InlineBooking value={lead.booking} leadId={lead._id} projectId={id} onSaved={handleLeadUpdated} />
                          </td>
                          <td className="text-xs text-app-soft whitespace-nowrap">
                            {lead.remarkUpdatedBy?.name || "-"}
                            {lead.remarkUpdatedAt && (
                              <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>
                            )}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {project.assignedTo?.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {project.assignedTo
                                  .map((m) => (typeof m === "object" ? m.name : null))
                                  .filter(Boolean)
                                  .map((name, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1">
                                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500/20 text-orange-500 text-[9px] font-bold flex-shrink-0">
                                        {name[0]?.toUpperCase()}
                                      </span>
                                      <span className="text-app font-medium">{name}</span>
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-app-soft">-</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-blue-500/10 hover:text-blue-400"
                                onClick={() => setEditingLead(lead)}
                                title="Edit lead"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-orange-500/10 hover:text-orange-500"
                                onClick={() => setTransferTarget(lead)}
                                title="Transfer lead"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </button>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-red-500/10 hover:text-red-400"
                                onClick={() => setDeletingLeadId(lead._id)}
                                title={user?.role === "super_admin" ? "Permanently delete lead" : "Move lead to Dump"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex items-center gap-2 text-xs text-app-soft">
                    <span>Show rows:</span>
                    {[10, 30, 50, 100, 200, 500].map((n) => (
                      <button key={n} onClick={() => { setLeadsLimit(n); setLeadsPage(1); }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${leadsLimit === n ? "bg-orange-500/15 text-orange-500" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"}`}
                      >{n}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-app-soft">{leadsTotal === 0 ? "0" : `${(leadsPage - 1) * leadsLimit + 1} – ${Math.min(leadsPage * leadsLimit, leadsTotal)} of ${leadsTotal}`}</span>
                    {/* Go to page */}
                    {leadsPages > 1 && (
                      <div className="flex items-center gap-1.5 text-xs text-app-soft">
                        <span>Go to</span>
                        <input
                          key={leadsPage}
                          type="number"
                          min={1}
                          max={leadsPages}
                          defaultValue={leadsPage}
                          className="w-14 rounded-lg border text-center text-xs py-1 px-1 outline-none focus:border-orange-400"
                          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = Math.max(1, Math.min(leadsPages, parseInt(e.target.value) || 1));
                              setLeadsPage(v);
                            }
                          }}
                          onBlur={(e) => {
                            const v = Math.max(1, Math.min(leadsPages, parseInt(e.target.value) || 1));
                            if (v !== leadsPage) setLeadsPage(v);
                          }}
                        />
                        <span>of {leadsPages}</span>
                      </div>
                    )}
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === 1} onClick={() => setLeadsPage(1)} title="First page"><ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" /></button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === 1} onClick={() => setLeadsPage((p) => p - 1)} title="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === leadsPages || leadsPages === 0} onClick={() => setLeadsPage((p) => p + 1)} title="Next page"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROSPECTIVE TAB ── */}
      {tab === "prospective" && (
        <div className="space-y-4">
          {/* Header bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/15">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-app">Prospective Leads</p>
                <p className="text-xs text-app-soft">Marked as Interested or Site Visit Booked</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {prospSelectedIds.size > 0 && canManage && (
                <>
                  <button className="btn-danger" onClick={() => setShowProspBulkConfirm(true)}>
                    <Trash2 className="h-4 w-4" /> Delete {prospSelectedIds.size}
                  </button>
                  <CustomSelect
                    value={prospBulkStatusBook}
                    onChange={setProspBulkStatusBook}
                    placeholder="Set status…"
                    options={BOOKING_OPTIONS.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label, color: o.color }))}
                    style={{ minWidth: 140 }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleProspBulkStatus}
                    disabled={!prospBulkStatusBook || bulkStatusUpdating}
                  >
                    {bulkStatusUpdating ? <Spinner size="sm" /> : "Update"}
                  </button>
                </>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-soft" />
                <input
                  className="input pl-9 py-2 text-sm w-56"
                  placeholder="Search name or phone…"
                  value={prospSearch}
                  onChange={(e) => { setProspSearch(e.target.value); setProspPage(1); }}
                />
              </div>
              {/* Export dropdown */}
              <div className="relative" ref={exportDropRef}>
                <button
                  onClick={() => setExportDropOpen((v) => !v)}
                  disabled={exportingProsp}
                  className="btn-primary flex items-center gap-2"
                  title="Export prospective leads"
                >
                  {exportingProsp ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                  Export
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </button>
                {exportDropOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl overflow-hidden shadow-lg py-1"
                    style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
                    <button onClick={() => exportProspective("xlsx")}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-app hover:bg-orange-500/10 transition">
                      <FileSpreadsheet className="h-4 w-4 text-app-soft" /> Export Excel
                    </button>
                    <button onClick={() => exportProspective("csv")}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-app hover:bg-orange-500/10 transition">
                      <FileText className="h-4 w-4 text-app-soft" /> Export CSV
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status filter pills - all scoped to isProspective leads only */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            {[
              { value: "",                  label: "All Prospective",   bg: "bg-gray-100 dark:bg-white/10",           text: "text-app-soft" },
              { value: "Interested",        label: "Interested",        bg: "bg-blue-100 dark:bg-blue-500/20",         text: "text-blue-600 dark:text-blue-400" },
              { value: "Site Visit Booked", label: "Site Visit Booked", bg: "bg-violet-100 dark:bg-violet-500/20",     text: "text-violet-600 dark:text-violet-400" },
              { value: "Call Back",         label: "Call Back",         bg: "bg-amber-100 dark:bg-amber-500/20",       text: "text-amber-600 dark:text-amber-400" },
              { value: "Booked",            label: "Booked",            bg: "bg-green-100 dark:bg-green-500/20",       text: "text-green-600 dark:text-green-400" },
              { value: "Not Interested",    label: "Not Interested",    bg: "bg-red-100 dark:bg-red-500/20",           text: "text-red-500 dark:text-red-400" },
              { value: "Not Reachable",     label: "Not Reachable",     bg: "bg-gray-100 dark:bg-white/10",            text: "text-gray-500 dark:text-gray-400" },
              { value: "Low Budget",        label: "Low Budget",        bg: "bg-pink-100 dark:bg-pink-500/20",         text: "text-pink-600 dark:text-pink-400" },
            ].map((f) => {
              const active = prospBookingFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => { setProspBookingFilter(f.value); setProspPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-center sm:rounded-full sm:py-1 ${
                    active
                      ? `${f.bg} ${f.text} ring-2 ring-current ring-offset-1`
                      : "bg-gray-100 dark:bg-white/5 text-app-soft border border-orange-400/50 hover:text-app hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Date window filter */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-app-soft">Follow-up date:</span>
            <div className="flex items-center gap-2">
              <AppDatePicker value={prospDateFrom} onChange={v => { setProspDateFrom(v); setProspPage(1); }} className="w-28 sm:w-36" />
              <span className="text-xs text-app-soft">to</span>
              <AppDatePicker value={prospDateTo} onChange={v => { setProspDateTo(v); setProspPage(1); }} className="w-28 sm:w-36" />
              {(prospDateFrom || prospDateTo) && (
                <button
                  className="rounded-xl px-2.5 py-1 text-xs font-semibold text-orange-500 hover:bg-orange-500/10 transition border"
                  style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                  onClick={() => { setProspDateFrom(""); setProspDateTo(""); setProspPage(1); }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            {prospLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : prospLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No prospective leads yet"
                desc="Leads marked as Interested or Site Visit Booked will appear here automatically."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="stitch-table min-w-[1400px]">
                    <thead>
                      <tr>
                        {canManage && <th style={{ width: 28, minWidth: 28 }} className="px-1">
                          <input type="checkbox" checked={allProspSelected}
                            ref={(el) => { if (el) el.indeterminate = someProspSelected && !allProspSelected; }}
                            onChange={toggleAllProsp} className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500" title="Select all" />
                        </th>}
                        <th style={{ width: 32, minWidth: 32 }} className="text-center">#</th>
                        <th className="sticky left-0 z-20 shadow-[2px_0_6px_rgba(0,0,0,0.07)]" style={{ width: 100, minWidth: 100, background: "var(--app-surface)" }}>Name</th>
                        <th style={{ width: 130, minWidth: 130 }}>Phone</th>
                        <th style={{ width: 110, minWidth: 110 }}>WhatsApp</th>
                        <th style={{ width: 150, minWidth: 150 }}>Status</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up 2</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 1</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 2</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 3</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 4</th>
                        <th style={{ width: 140, minWidth: 140 }}>Note</th>
                        <th style={{ width: 100, minWidth: 100 }}>Updated By</th>
                        <th style={{ width: 44, minWidth: 44 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospLeads.map((lead, i) => {
                        const handleProspUpdate = (updated) => {
                          // Lead always stays in Prospective once it enters - just update in place
                          setProspLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
                        };
                        return (
                          <tr key={lead._id} className={`group ${prospSelectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                            {canManage && <td className="w-6 px-1">
                              <input type="checkbox" checked={prospSelectedIds.has(lead._id)} onChange={() => toggleOneProsp(lead._id)}
                                className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500" />
                            </td>}
                            <td className="w-6 px-1 text-center text-app-soft text-xs">{(prospPage - 1) * PROSP_LIMIT + i + 1}</td>
                            <td className="sticky left-0 z-10 shadow-[2px_0_6px_rgba(0,0,0,0.06)] w-[90px] min-w-[90px] max-w-[90px] px-2" style={{ background: "var(--app-surface)" }}>
                              <NameCell name={lead.name} bold onOpen={() => setEditingLead(lead)} />
                            </td>
                            <td><PhoneActions phone={lead.phone} /></td>
                            <td><WhatsAppLink phone={lead.phone} name={lead.name} leadId={lead._id} projectId={id} /></td>
                            <td>
                              <InlineBooking value={lead.booking} leadId={lead._id} projectId={id} onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineDate value={lead.followUp} leadId={lead._id} projectId={id} field="followUp" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineDate value={lead.followUp2} leadId={lead._id} projectId={id} field="followUp2" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark1} leadId={lead._id} projectId={id} field="remark1" placeholder="Remark 1…" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark2} leadId={lead._id} projectId={id} field="remark2" placeholder="Remark 2…" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark3} leadId={lead._id} projectId={id} field="remark3" placeholder="Remark 3…" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark4} leadId={lead._id} projectId={id} field="remark4" placeholder="Remark 4…" onSaved={handleProspUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remarkNote} leadId={lead._id} projectId={id} field="remarkNote" placeholder="Note…" multiline onSaved={handleProspUpdate} />
                            </td>
                            <td className="text-xs text-app-soft whitespace-nowrap">
                              {lead.remarkUpdatedBy?.name || "-"}
                              {lead.remarkUpdatedAt && <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>}
                            </td>
                            <td>
                              <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-blue-500/10 hover:text-blue-400"
                                  onClick={() => setEditingLead(lead)}
                                  title="Edit lead"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-orange-500/10 hover:text-orange-500"
                                  onClick={() => setTransferTarget(lead)}
                                  title="Transfer lead"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {prospPages > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
                    <span className="text-xs text-app-soft">
                      {`${(prospPage - 1) * PROSP_LIMIT + 1} – ${Math.min(prospPage * PROSP_LIMIT, prospTotal)} of ${prospTotal}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Go to page */}
                      <div className="flex items-center gap-1.5 text-xs text-app-soft">
                        <span>Go to</span>
                        <input
                          key={prospPage}
                          type="number"
                          min={1}
                          max={prospPages}
                          defaultValue={prospPage}
                          className="w-14 rounded-lg border text-center text-xs py-1 px-1 outline-none focus:border-orange-400"
                          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = Math.max(1, Math.min(prospPages, parseInt(e.target.value) || 1));
                              setProspPage(v);
                            }
                          }}
                          onBlur={(e) => {
                            const v = Math.max(1, Math.min(prospPages, parseInt(e.target.value) || 1));
                            if (v !== prospPage) setProspPage(v);
                          }}
                        />
                        <span>of {prospPages}</span>
                      </div>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={prospPage === 1} onClick={() => setProspPage((p) => p - 1)} title="Previous page">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={prospPage === prospPages} onClick={() => setProspPage((p) => p + 1)} title="Next page">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SITE VISIT DONE TAB ── */}
      {tab === "sitevisitdone" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(20,184,166,0.15)" }}>
                <Users className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-app">Site Visit Done</p>
                <p className="text-xs text-app-soft">Leads who have completed a site visit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {svdSelectedIds.size > 0 && canManage && (
                <button className="btn-danger" onClick={() => setShowSvdBulkConfirm(true)}>
                  <Trash2 className="h-4 w-4" /> Delete {svdSelectedIds.size} selected
                </button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-soft" />
                <input
                  className="input pl-9 py-2 text-sm w-56"
                  placeholder="Search name or phone…"
                  value={svdSearch}
                  onChange={(e) => { setSvdSearch(e.target.value); setSvdPage(1); }}
                />
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            {svdLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : svdLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No site visit done leads yet"
                desc="Leads marked as 'Site Visit Done' will appear here automatically."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="stitch-table min-w-[1400px]">
                    <thead>
                      <tr>
                        {canManage && <th style={{ width: 28, minWidth: 28 }} className="px-1">
                          <input type="checkbox" checked={allSvdSelected}
                            ref={(el) => { if (el) el.indeterminate = someSvdSelected && !allSvdSelected; }}
                            onChange={toggleAllSvd} className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500" title="Select all" />
                        </th>}
                        <th style={{ width: 32, minWidth: 32 }} className="text-center">#</th>
                        <th className="sticky left-0 z-20 shadow-[2px_0_6px_rgba(0,0,0,0.07)]" style={{ width: 100, minWidth: 100, background: "var(--app-surface)" }}>Name</th>
                        <th style={{ width: 130, minWidth: 130 }}>Phone</th>
                        <th style={{ width: 110, minWidth: 110 }}>WhatsApp</th>
                        <th style={{ width: 150, minWidth: 150 }}>Status</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up</th>
                        <th style={{ width: 185, minWidth: 185 }}>Follow Up 2</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 1</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 2</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 3</th>
                        <th style={{ width: 130, minWidth: 130 }}>Remark 4</th>
                        <th style={{ width: 140, minWidth: 140 }}>Note</th>
                        <th style={{ width: 100, minWidth: 100 }}>Updated By</th>
                        <th style={{ width: 44, minWidth: 44 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {svdLeads.map((lead, i) => {
                        const handleSvdUpdate = (updated) => {
                          setSvdLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
                          // Refresh counts when booking changes
                          api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingNotIn: "Site Visit Done" } })
                            .then((r) => setProspTotal(r.data.total)).catch(() => {});
                          api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, isProspective: true, bookingIn: "Site Visit Done" } })
                            .then((r) => setSvdTotal(r.data.total)).catch(() => {});
                        };
                        return (
                          <tr key={lead._id} className={`group ${svdSelectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                            {canManage && <td className="w-6 px-1">
                              <input type="checkbox" checked={svdSelectedIds.has(lead._id)} onChange={() => toggleOneSvd(lead._id)}
                                className="h-3.5 w-3.5 cursor-pointer rounded accent-orange-500" />
                            </td>}
                            <td className="w-6 px-1 text-center text-app-soft text-xs">{(svdPage - 1) * SVD_LIMIT + i + 1}</td>
                            <td className="sticky left-0 z-10 shadow-[2px_0_6px_rgba(0,0,0,0.06)] w-[90px] min-w-[90px] max-w-[90px] px-2" style={{ background: "var(--app-surface)" }}>
                              <NameCell name={lead.name} bold onOpen={() => setEditingLead(lead)} />
                            </td>
                            <td><PhoneActions phone={lead.phone} /></td>
                            <td><WhatsAppLink phone={lead.phone} name={lead.name} leadId={lead._id} projectId={id} /></td>
                            <td>
                              <InlineBooking value={lead.booking} leadId={lead._id} projectId={id} onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineDate value={lead.followUp} leadId={lead._id} projectId={id} field="followUp" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineDate value={lead.followUp2} leadId={lead._id} projectId={id} field="followUp2" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark1} leadId={lead._id} projectId={id} field="remark1" placeholder="Remark 1…" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark2} leadId={lead._id} projectId={id} field="remark2" placeholder="Remark 2…" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark3} leadId={lead._id} projectId={id} field="remark3" placeholder="Remark 3…" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remark4} leadId={lead._id} projectId={id} field="remark4" placeholder="Remark 4…" onSaved={handleSvdUpdate} />
                            </td>
                            <td>
                              <InlineText value={lead.remarkNote} leadId={lead._id} projectId={id} field="remarkNote" placeholder="Note…" multiline onSaved={handleSvdUpdate} />
                            </td>
                            <td className="text-xs text-app-soft whitespace-nowrap">
                              {lead.remarkUpdatedBy?.name || "-"}
                              {lead.remarkUpdatedAt && <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>}
                            </td>
                            <td>
                              <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-blue-500/10 hover:text-blue-400"
                                  onClick={() => setEditingLead(lead)}
                                  title="Edit lead"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft transition hover:bg-orange-500/10 hover:text-orange-500"
                                  onClick={() => setTransferTarget(lead)}
                                  title="Transfer lead"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {svdPages > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
                    <span className="text-xs text-app-soft">{`${(svdPage - 1) * SVD_LIMIT + 1} – ${Math.min(svdPage * SVD_LIMIT, svdTotal)} of ${svdTotal}`}</span>
                    <div className="flex items-center gap-2">
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={svdPage === 1} onClick={() => setSvdPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={svdPage === svdPages} onClick={() => setSvdPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showEdit && (
        <ProjectForm
          open={showEdit}
          onClose={() => setShowEdit(false)}
          project={project}
          onSaved={(updated) => { setProject((p) => ({ ...p, ...updated })); setShowEdit(false); }}
        />
      )}

      <ConfirmDialog
        open={!!deletingLeadId}
        onClose={() => setDeletingLeadId(null)}
        onConfirm={handleDeleteLead}
        loading={deletingLead}
        title="Delete Lead"
        message={
          user?.role === "super_admin"
            ? "Are you sure you want to permanently delete this lead? This cannot be undone."
            : "Are you sure you want to delete this lead? It will be moved to Dump Leads."
        }
      />

      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title={`Delete ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""}`}
        message={
          user?.role === "super_admin"
            ? `Are you sure you want to permanently delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
            : `Are you sure you want to delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? They will be moved to Dump Leads.`
        }
      />

      <ConfirmDialog
        open={showProspBulkConfirm}
        onClose={() => setShowProspBulkConfirm(false)}
        onConfirm={handleProspBulkDelete}
        loading={bulkDeleting}
        title={`Delete ${prospSelectedIds.size} Lead${prospSelectedIds.size !== 1 ? "s" : ""}`}
        message={
          user?.role === "super_admin"
            ? `Are you sure you want to permanently delete ${prospSelectedIds.size} selected lead${prospSelectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
            : `Are you sure you want to delete ${prospSelectedIds.size} selected lead${prospSelectedIds.size !== 1 ? "s" : ""}? They will be moved to Dump Leads.`
        }
      />

      <ConfirmDialog
        open={showSvdBulkConfirm}
        onClose={() => setShowSvdBulkConfirm(false)}
        onConfirm={handleSvdBulkDelete}
        loading={bulkDeleting}
        title={`Delete ${svdSelectedIds.size} Lead${svdSelectedIds.size !== 1 ? "s" : ""}`}
        message={
          user?.role === "super_admin"
            ? `Are you sure you want to permanently delete ${svdSelectedIds.size} selected lead${svdSelectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
            : `Are you sure you want to delete ${svdSelectedIds.size} selected lead${svdSelectedIds.size !== 1 ? "s" : ""}? They will be moved to Dump Leads.`
        }
      />

      <ConfirmDialog
        open={showDeleteProject}
        onClose={() => setShowDeleteProject(false)}
        onConfirm={handleDeleteProject}
        loading={deletingProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? All imported leads will remain but the project will be removed.`}
      />

      {/* Edit Lead modal - works across all three sections */}
      <LeadForm
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={handleEditLeadSaved}
        lead={editingLead}
      />

      <TransferModal
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        lead={transferTarget}
        leadType="project"
        currentProjectId={id}
        onTransferred={() => {
          setTransferTarget(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
