// pages/ProjectDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner, EmptyState, ConfirmDialog, PhoneActions, WhatsAppLink } from "../components/UI";
import ProjectForm from "../components/ProjectForm";
import api from "../services/api";
import toast from "react-hot-toast";
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from "xlsx";
import {
  ArrowLeft, Building2, Calendar, ChevronLeft, ChevronRight,
  ImageOff, MapPin, Pencil, Search, Trash2, Upload, Users,
} from "lucide-react";

function fmtPrice(n) {
  if (!n) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function cleanPhone(raw) {
  return String(raw || "")
    .replace(/^(?:p|ph|tel|mob|mobile|phone)\s*:\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function parseRow(raw) {
  const r = {};
  Object.keys(raw).forEach((k) => { r[k.trim().toLowerCase()] = String(raw[k] || "").trim(); });
  const name     = r["full name"] || r["name"] || r["customer name"] || r["lead name"] || "";
  const rawPhone = r["phone number"] || r["phone"] || r["mobile"] || r["contact"] || r["mobile number"] || r["ph"] || r["number"] || r["mob"] || r["whatsapp"] || r["contact number"] || r["cell"] || "";
  const phone    = cleanPhone(rawPhone);
  const email    = r["email"] || r["email address"] || r["mail"] || "";
  const source   = r["source"] || r["lead source"] || "Facebook";
  return { name, phone, email, source };
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
function nowIST() { return toISTLocal(new Date().toISOString()); }
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
        <input
          type="datetime-local"
          className="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", minWidth: 145 }}
          value={dateVal}
          onChange={(e) => save(e.target.value)}
        />
        <button type="button" title="Set to current IST time" onClick={() => save(nowIST())}
          className="shrink-0 rounded-md border px-1.5 py-1 text-[10px] font-semibold text-orange-500 hover:bg-orange-500/10 transition"
          style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>Now</button>
      </div>
      {value && <span className="text-[10px] text-app-soft pl-0.5">{fmt12hIST(value)}</span>}
    </div>
  );
}

// ── Inline booking select ─────────────────────────────────────────────────────
const BOOKING_OPTIONS = [
  { value: "",                  label: "— None —",          color: "" },
  { value: "Interested",        label: "Interested",         color: "text-blue-600" },
  { value: "Call Back",         label: "Call Back",          color: "text-amber-600" },
  { value: "Site Visit Booked", label: "Site Visit Booked",  color: "text-violet-600" },
  { value: "Booked",            label: "Booked",             color: "text-green-600" },
  { value: "Not Interested",    label: "Not Interested",     color: "text-red-500" },
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
        <select
          value={remark}
          onChange={handleChange}
          className={`w-full rounded-xl border px-2.5 py-1.5 text-xs font-semibold appearance-none transition ${remarkClass}`}
          style={{ background: "var(--app-surface-low)" }}
        >
          <option value="">— None —</option>
          <option value="Contacted">Contacted</option>
          <option value="Not Contacted">Not Contacted</option>
        </select>
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
  const canManage = ["admin", "manager"].includes(user?.role);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("info");
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
  const [search, setSearch]             = useState("");
  const [importing, setImporting]       = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [deletingLead, setDeletingLead]     = useState(false);

  // Bulk select
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting]       = useState(false);

  const fileRef = useRef(null);

  const [leadsLimit, setLeadsLimit] = useState(10);

  // Prospective leads state (Interested + Site Visit Booked)
  const PROSP_FILTER = "Interested,Site Visit Booked";
  const [prospLeads, setProspLeads]   = useState([]);
  const [prospTotal, setProspTotal]   = useState(0);
  const [prospPage, setProspPage]     = useState(1);
  const [prospPages, setProspPages]   = useState(1);
  const [prospLoading, setProspLoading] = useState(false);
  const [prospSearch, setProspSearch] = useState("");
  const PROSP_LIMIT = 50;

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then((r) => setProject(r.data.data))
      .catch(() => { toast.error("Project not found"); navigate("/projects"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Fetch initial prospective count alongside project (so tab badge is populated)
  useEffect(() => {
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, bookingIn: PROSP_FILTER } })
      .then((r) => setProspTotal(r.data.total))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (tab !== "leads") return;
    setLeadsLoading(true);
    api.get(`/projects/${id}/leads`, { params: { page: leadsPage, limit: leadsLimit, search } })
      .then((r) => { setLeads(r.data.leads); setLeadsTotal(r.data.total); setLeadsPages(r.data.pages); })
      .catch(() => toast.error("Failed to load leads"))
      .finally(() => setLeadsLoading(false));
  }, [id, tab, leadsPage, search, leadsLimit]);

  useEffect(() => {
    if (tab !== "prospective") return;
    setProspLoading(true);
    api.get(`/projects/${id}/leads`, { params: { page: prospPage, limit: PROSP_LIMIT, search: prospSearch, bookingIn: PROSP_FILTER } })
      .then((r) => { setProspLeads(r.data.leads); setProspTotal(r.data.total); setProspPages(r.data.pages); })
      .catch(() => toast.error("Failed to load prospective leads"))
      .finally(() => setProspLoading(false));
  }, [id, tab, prospPage, prospSearch]);

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
      toast.success(`Imported ${res.data.inserted} leads${res.data.skipped ? `, skipped ${res.data.skipped}` : ""}`);
      setLeadsPage(1); setSearch("");
      const fresh = await api.get(`/projects/${id}/leads`, { params: { page: 1, limit: leadsLimit } });
      setLeads(fresh.data.leads); setLeadsTotal(fresh.data.total); setLeadsPages(fresh.data.pages);
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally { setImporting(false); }
  };

  // Clear selection when page/search changes
  useEffect(() => { setSelectedIds(new Set()); }, [leadsPage, search]);

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

  const handleLeadUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
    // Refresh prospective count if booking status may have changed
    api.get(`/projects/${id}/leads`, { params: { page: 1, limit: 1, bookingIn: PROSP_FILTER } })
      .then((r) => setProspTotal(r.data.total)).catch(() => {});
    // If currently on prospective tab, also refresh the list
    if (tab === "prospective") {
      api.get(`/projects/${id}/leads`, { params: { page: prospPage, limit: PROSP_LIMIT, search: prospSearch, bookingIn: PROSP_FILTER } })
        .then((r) => { setProspLeads(r.data.leads); setProspTotal(r.data.total); setProspPages(r.data.pages); })
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
      <div className="flex gap-1 rounded-2xl p-1 w-fit stitch-surface-muted">
        {[
          { key: "info",        label: "Info" },
          { key: "leads",       label: `Leads (${leadsTotal})` },
          { key: "prospective", label: `Prospective${prospTotal > 0 ? ` (${prospTotal})` : ""}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              tab === key
                ? key === "prospective"
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-orange-500 text-white shadow-sm"
                : "text-app-soft hover:text-app"
            }`}
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
            {canManage && selectedIds.size > 0 && (
              <button className="btn-danger" onClick={() => setShowBulkConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Delete {selectedIds.size} selected
              </button>
            )}
            {canManage && (
              <>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importing..." : "Import Excel / CSV"}
                </button>
              </>
            )}
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
                <div className="overflow-x-auto">
                  <table className="stitch-table min-w-[1400px]">
                    <thead>
                      <tr>
                        {canManage && (
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
                        <th>#</th>
                        <th className="sticky left-0 z-20 shadow-[2px_0_6px_rgba(0,0,0,0.07)] w-[100px] min-w-[100px] max-w-[100px]" style={{ background: "var(--app-surface)" }}>Name</th>
                        <th>Phone</th>
                        <th>WhatsApp</th>
                        <th>Email</th>
                        <th>Source</th>
                        <th>Contact Status</th>
                        <th>Remark 1</th>
                        <th>Remark 2</th>
                        <th>Follow Up</th>
                        <th>Follow Up 2</th>
                        <th>Remark</th>
                        <th>Status</th>
                        <th>Updated By</th>
                        {canManage && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead, i) => (
                        <tr key={lead._id} className={`group ${selectedIds.has(lead._id) ? "ring-1 ring-inset ring-orange-400/40 bg-orange-500/5" : ""}`}>
                          {canManage && (
                            <td className="w-10 px-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(lead._id)}
                                onChange={() => toggleOne(lead._id)}
                                className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                              />
                            </td>
                          )}
                          <td className="text-app-soft text-xs">{(leadsPage - 1) * leadsLimit + i + 1}</td>
                          <td className="sticky left-0 z-10 shadow-[2px_0_6px_rgba(0,0,0,0.06)] w-[100px] min-w-[100px] max-w-[100px]" style={{ background: "var(--app-surface)" }}>
                            <span className="block font-medium text-app text-xs truncate" title={lead.name}>{lead.name}</span>
                          </td>
                          <td><PhoneActions phone={lead.phone} /></td>
                          <td><WhatsAppLink phone={lead.phone} /></td>
                          <td className="text-sm text-app-soft">{lead.email || "—"}</td>
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
                            {lead.remarkUpdatedBy?.name || "—"}
                            {lead.remarkUpdatedAt && (
                              <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>
                            )}
                          </td>
                          {canManage && (
                            <td>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-soft opacity-0 group-hover:opacity-100 transition hover:bg-red-500/10 hover:text-red-400"
                                onClick={() => setDeletingLeadId(lead._id)}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-app-soft">{leadsTotal === 0 ? "0" : `${(leadsPage - 1) * leadsLimit + 1} – ${Math.min(leadsPage * leadsLimit, leadsTotal)} of ${leadsTotal}`}</span>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === 1} onClick={() => setLeadsPage(1)}><ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" /></button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === 1} onClick={() => setLeadsPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                      disabled={leadsPage === leadsPages || leadsPages === 0} onClick={() => setLeadsPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></button>
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-soft" />
              <input
                className="input pl-9 py-2 text-sm w-56"
                placeholder="Search name or phone…"
                value={prospSearch}
                onChange={(e) => { setProspSearch(e.target.value); setProspPage(1); }}
              />
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
                  <table className="stitch-table min-w-[900px]">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th className="sticky left-0 z-20 shadow-[2px_0_6px_rgba(0,0,0,0.07)] w-[100px] min-w-[100px] max-w-[100px]" style={{ background: "var(--app-surface)" }}>Name</th>
                        <th>Phone</th>
                        <th>WhatsApp</th>
                        <th>Status</th>
                        <th>Follow Up</th>
                        <th>Remark 1</th>
                        <th>Remark 2</th>
                        <th>Note</th>
                        <th>Updated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prospLeads.map((lead, i) => {
                        const bookingColor = lead.booking === "Interested"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/25"
                          : "bg-violet-500/10 text-violet-600 border-violet-500/25";
                        return (
                          <tr key={lead._id}>
                            <td className="text-app-soft text-xs">{(prospPage - 1) * PROSP_LIMIT + i + 1}</td>
                            <td className="sticky left-0 z-10 shadow-[2px_0_6px_rgba(0,0,0,0.06)] w-[100px] min-w-[100px] max-w-[100px]" style={{ background: "var(--app-surface)" }}>
                              <span className="block font-semibold text-app text-xs truncate" title={lead.name}>{lead.name}</span>
                            </td>
                            <td><PhoneActions phone={lead.phone} /></td>
                            <td><WhatsAppLink phone={lead.phone} /></td>
                            <td>
                              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${bookingColor}`}>
                                {lead.booking}
                              </span>
                            </td>
                            <td>
                              <InlineDate value={lead.followUp} leadId={lead._id} projectId={id} field="followUp"
                                onSaved={(updated) => setProspLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l))} />
                            </td>
                            <td>
                              <InlineText value={lead.remark1} leadId={lead._id} projectId={id} field="remark1" placeholder="Remark 1…"
                                onSaved={(updated) => setProspLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l))} />
                            </td>
                            <td>
                              <InlineText value={lead.remark2} leadId={lead._id} projectId={id} field="remark2" placeholder="Remark 2…"
                                onSaved={(updated) => setProspLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l))} />
                            </td>
                            <td>
                              <InlineText value={lead.remarkNote} leadId={lead._id} projectId={id} field="remarkNote" placeholder="Note…" multiline
                                onSaved={(updated) => setProspLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l))} />
                            </td>
                            <td className="text-xs text-app-soft whitespace-nowrap">
                              {lead.remarkUpdatedBy?.name || "—"}
                              {lead.remarkUpdatedAt && <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>}
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
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={prospPage === 1} onClick={() => setProspPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:opacity-30"
                        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}
                        disabled={prospPage === prospPages} onClick={() => setProspPage((p) => p + 1)}>
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
        message="Are you sure you want to permanently delete this lead? This cannot be undone."
      />

      <ConfirmDialog
        open={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        title={`Delete ${selectedIds.size} Lead${selectedIds.size !== 1 ? "s" : ""}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`}
      />

      <ConfirmDialog
        open={showDeleteProject}
        onClose={() => setShowDeleteProject(false)}
        onConfirm={handleDeleteProject}
        loading={deletingProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? All imported leads will remain but the project will be removed.`}
      />
    </div>
  );
}
