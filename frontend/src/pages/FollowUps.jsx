import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { PageLoader, EmptyState, Spinner, PhoneActions, WhatsAppLink, SourceBadge, AppDatePicker } from "../components/UI";
import CustomSelect from "../components/CustomSelect";
import LeadDetail from "../components/LeadDetail";
import api from "../services/api";
import toast from "react-hot-toast";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, CalendarCheck, CalendarDays, ArrowUp, ArrowDown, CheckCircle2, User, Search, X as XIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useColumnResize, RTh } from "../hooks/useColumnResize";

const FU_COL_DEFAULTS = {
  name: 120, phone: 130, whatsapp: 110, source: 80, status: 110,
  booking: 150, remark1: 130, remark2: 130, remark3: 130, remark4: 130,
  note: 140, followUp: 168, followUp2: 168, project: 120, assignedTo: 110, type: 80,
};
const FU_TH = "px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap";

// ── Route patch to correct API based on lead type ─────────────────────────────
async function patchLead(lead, data) {
  if (lead._type === "project") {
    // Project leads support all 4 remarks + note directly
    const r = await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, data);
    return r.data.data;
  } else {
    // Map project-lead field names → main-lead field names
    // remark3 / remark4 are only on project leads - ignored for pipeline leads
    const mapped = {};
    if ("followUp"   in data) mapped.followUpDate = data.followUp;
    if ("followUp2"  in data) mapped.followUp2    = data.followUp2;
    if ("remark1"    in data) mapped.remark1       = data.remark1;
    if ("remark2"    in data) mapped.remark2       = data.remark2;
    if ("remarkNote" in data) mapped.remarkNote    = data.remarkNote;
    if ("booking"    in data) mapped.booking       = data.booking;
    const r = await api.patch(`/leads/${lead._id}`, mapped);
    return r.data.data;
  }
}

// ── Time helpers ──────────────────────────────────────────────────────────────
const _pad = (n) => String(n).padStart(2, "0");
function toLocalInput(utcStr) {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}T${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
}
function fromLocalInput(s) { return s ? new Date(s).toISOString() : null; }
function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}T${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
}
function fmtLocalTime(utcStr) {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Inline text ───────────────────────────────────────────────────────────────
function FUText({ lead, field, placeholder = "Add…", onUpdate }) {
  const value = lead[field] || "";
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value);
  const [saving, setSaving]   = useState(false);
  const save = async () => {
    setEditing(false);
    if (val === value) return;
    setSaving(true);
    try { const updated = await patchLead(lead, { [field]: val }); onUpdate(updated); }
    catch { toast.error("Save failed"); setVal(value); }
    finally { setSaving(false); }
  };
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  if (editing) return (
    <input autoFocus
      className="w-full min-w-[120px] rounded-lg border px-2 py-1 text-xs focus:outline-none focus:border-orange-400"
      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)" }}
      value={val} onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
    />
  );
  return (
    <span onClick={() => { setVal(value); setEditing(true); }}
      className="block cursor-pointer rounded px-1 py-0.5 text-xs transition hover:bg-orange-500/10 min-w-[80px] truncate max-w-[140px]"
      title={value || placeholder}>
      {value || <span className="text-app-soft italic">{placeholder}</span>}
    </span>
  );
}

// ── Inline date (compact single-line) ────────────────────────────────────────
function FUDate({ lead, field, onUpdate }) {
  // For main leads followUp maps to followUpDate; project leads use field as-is
  const rawValue = lead._type === "lead" && field === "followUp"
    ? (lead.followUpDate || lead.followUp || null)
    : (lead[field] || null);
  const [saving, setSaving] = useState(false);
  const save = async (localStr) => {
    setSaving(true);
    try { const updated = await patchLead(lead, { [field]: fromLocalInput(localStr) }); onUpdate(updated); }
    catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  const displayTime = rawValue ? fmtLocalTime(rawValue) : "";
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <div className="flex items-center gap-1">
      <input type="datetime-local"
        className="rounded-lg border px-1.5 py-1 text-xs focus:outline-none focus:border-orange-400"
        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", color: "var(--app-text)", width: 138 }}
        value={toLocalInput(rawValue)}
        title={displayTime || "Set date & time"}
        onChange={(e) => save(e.target.value)}
      />
      <button type="button" title={`Set to now${displayTime ? " (currently: " + displayTime + ")" : ""}`} onClick={() => save(nowLocal())}
        className="shrink-0 flex items-center justify-center h-6 w-6 rounded-md border text-orange-500 hover:bg-orange-500/10 transition"
        style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
        <Clock className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Inline booking ────────────────────────────────────────────────────────────
const FU_BOOKING_OPTIONS = [
  { value: "",                   label: "- None -",          color: "" },
  { value: "Interested",         label: "Interested",         color: "text-blue-600" },
  { value: "Call Back",          label: "Call Back",          color: "text-amber-600" },
  { value: "Site Visit Booked",  label: "Site Visit Booked",  color: "text-violet-600" },
  { value: "Site Visit Done",    label: "Site Visit Done",    color: "text-teal-600" },
  { value: "Booked",             label: "Booked",             color: "text-green-600" },
  { value: "Not Interested",     label: "Not Interested",     color: "text-red-500" },
  { value: "Not Reachable",      label: "Not Reachable",      color: "text-gray-500" },
  { value: "Low Budget",         label: "Low Budget",         color: "text-orange-500" },
  { value: "Other Location",     label: "Other Location",     color: "text-orange-600" },
  { value: "Commercial",         label: "Commercial",         color: "text-indigo-600" },
];
function FUBooking({ lead, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const save = async (v) => {
    setSaving(true);
    try { const updated = await patchLead(lead, { booking: v }); onUpdate(updated); }
    catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <CustomSelect
      value={lead.booking || ""}
      onChange={save}
      placeholder="- None -"
      options={FU_BOOKING_OPTIONS.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.label }))}
      style={{ minWidth: 130, fontWeight: 600 }}
    />
  );
}

const SECTIONS = [
  { key: "past",    label: "Past Events",    icon: Clock,         color: "text-red-500",   bg: "bg-red-500/10",   activeBg: "bg-red-500",    badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  { key: "present", label: "Today's Leads",  icon: CalendarCheck, color: "text-blue-500",  bg: "bg-blue-500/10",  activeBg: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  { key: "future",  label: "Future Events",  icon: CalendarDays,  color: "text-green-500", bg: "bg-green-500/10", activeBg: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
];

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SectionBadge({ section }) {
  const s = SECTIONS.find(x => x.key === section);
  if (!s) return null;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.badge}`}>{s.label}</span>;
}

const BOOKING_COLORS = {
  "Interested":        "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  "Site Visit Booked": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  "Site Visit Done":   "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
  "Booked":            "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  "Not Interested":    "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  "Call Back":         "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
  "Not Reachable":     "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
};

function BookingBadge({ value }) {
  if (!value) return <span className="text-app-soft">-</span>;
  const cls = BOOKING_COLORS[value] || "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cls}`}>{value}</span>;
}

export default function FollowUps() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role && user.role !== "agent";

  // Lead detail panel — opened from global search suggestion
  const [detailLead, setDetailLead] = useState(null);

  useEffect(() => {
    const openId = location.state?.openLeadId;
    if (!openId) return;
    // Clear the state so back-navigation doesn't re-open
    navigate(location.pathname, { replace: true, state: {} });
    api.get(`/leads/${openId}`)
      .then(({ data }) => setDetailLead(data.lead || data))
      .catch(() => toast.error("Could not load lead details"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [colW, startResize] = useColumnResize("followups", FU_COL_DEFAULTS);

  const [section, setSection] = useState("present");
  const [searchQ, setSearchQ] = useState(() => searchParams.get("q") || "");
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Smart defaults: past = latest missed first (desc), future/present = soonest first (asc)
  const [sort, setSort] = useState("desc"); // "asc" | "desc"
  // myOnly: admin/manager toggle to see only their own leads (persisted per session)
  const [myOnly, setMyOnly] = useState(() => {
    try { return localStorage.getItem("followups_myOnly") === "true"; } catch { return false; }
  });

  const limit = 50;

  const toggleMyOnly = () => {
    setMyOnly(v => {
      const next = !v;
      try { localStorage.setItem("followups_myOnly", String(next)); } catch {}
      return next;
    });
    setPage(1);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section, page, limit, sort });
      if (section === "future") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      if (isAdmin && myOnly) params.set("myOnly", "true");
      if (searchQ.trim()) params.set("search", searchQ.trim());
      const r = await api.get(`/followups?${params.toString()}`);
      setLeads(r.data.leads || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      toast.error("Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [section, page, from, to, sort, myOnly, isAdmin, searchQ]);

  // Sync ?q= URL param → searchQ (handles navigation from sidebar)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQ(q);
    if (q) setPage(1);
  }, [searchParams]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [searchQ]);

  // Reset page + set smart sort default when switching sections
  useEffect(() => {
    setPage(1);
    setSort(section === "past" ? "desc" : "asc");
  }, [section]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const activeSection = SECTIONS.find(s => s.key === section);

  return (
    <div className="stitch-page">
      {/* Top bar */}
      <div className="stitch-topbar">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10">
            <CalendarClock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-app leading-none">Follow Ups</h1>
            <p className="text-xs text-app-soft mt-0.5">{total} record{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="pt-4">
        <div data-tour="followup-tabs" className="flex gap-2 p-1 rounded-2xl w-full max-w-lg" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? `${s.activeBg} text-white shadow-sm` : "text-app-soft hover:text-app"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls row - search + sort toggle + future date filters + my-only toggle */}
      <div className="pt-3 flex items-center gap-3 flex-wrap">
        {/* Search within follow-ups */}
        <div className="relative flex-shrink-0" style={{ width: 220 }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-soft" />
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setPage(1); setSearchParams(e.target.value ? { q: e.target.value } : {}); }}
            placeholder="Search by name or phone…"
            className="w-full rounded-xl pl-8 pr-7 py-1.5 text-sm text-app"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", outline: "none" }}
            onFocus={e => { e.target.style.borderColor = "var(--app-primary)"; }}
            onBlur={e  => { e.target.style.borderColor = "var(--app-border)"; }}
          />
          {searchQ && (
            <button onClick={() => { setSearchQ(""); setSearchParams({}); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-soft hover:text-app transition">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* My leads only toggle — admin/manager only */}
        {isAdmin && (
          <button
            onClick={toggleMyOnly}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}
            title={myOnly ? "Showing only your leads — click to show all" : "Showing all team leads — click to show only yours"}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>My Leads</span>
            {/* iOS-style toggle track */}
            <span
              style={{
                display: "inline-flex", alignItems: "center",
                width: 32, height: 18, borderRadius: 9, padding: "0 2px",
                background: myOnly ? "var(--app-primary, #f97316)" : "rgba(128,128,128,0.25)",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              {/* thumb */}
              <span style={{
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transform: myOnly ? "translateX(14px)" : "translateX(0)",
                transition: "transform 0.2s",
                display: "block",
              }} />
            </span>
          </button>
        )}

        {/* Sort toggle - always visible */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <button
            onClick={() => { setSort("desc"); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              sort === "desc" ? "text-white shadow-sm" : "text-app-soft hover:text-app"
            }`}
            style={sort === "desc" ? { background: "var(--app-primary)" } : {}}
          >
            <ArrowDown className="w-3 h-3" />
            Latest First
          </button>
          <button
            onClick={() => { setSort("asc"); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              sort === "asc" ? "text-white shadow-sm" : "text-app-soft hover:text-app"
            }`}
            style={sort === "asc" ? { background: "var(--app-primary)" } : {}}
          >
            <ArrowUp className="w-3 h-3" />
            Earliest First
          </button>
        </div>

        {/* Future date range filters */}
        {section === "future" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">From</label>
              <AppDatePicker value={from} onChange={v => { setFrom(v); setPage(1); }} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">To</label>
              <AppDatePicker value={to} onChange={v => { setTo(v); setPage(1); }} className="w-36" />
            </div>
            {(from || to) && (
              <button
                className="text-xs text-orange-500 hover:underline"
                onClick={() => { setFrom(""); setTo(""); setPage(1); }}
              >
                Clear
              </button>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="pt-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={activeSection?.icon}
            title={`No ${activeSection?.label?.toLowerCase()} found`}
            desc="Nothing to show for this section right now."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table data-tour="followup-table" className="text-xs" style={{ borderCollapse: "collapse", tableLayout: "fixed", width: Object.values(colW).reduce((a, b) => a + b, 0) + 50 }}>
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                    <RTh k="name"       colW={colW} startResize={startResize} className={FU_TH}>Name</RTh>
                    <RTh k="phone"      colW={colW} startResize={startResize} className={FU_TH}>Phone</RTh>
                    <RTh k="whatsapp"   colW={colW} startResize={startResize} className={FU_TH}>WhatsApp</RTh>
                    <RTh k="source"     colW={colW} startResize={startResize} className={FU_TH}>Source</RTh>
                    <RTh k="status"     colW={colW} startResize={startResize} className={FU_TH}>Status</RTh>
                    <RTh k="booking"    colW={colW} startResize={startResize} className={FU_TH}>Booking</RTh>
                    <RTh k="remark1"    colW={colW} startResize={startResize} className={FU_TH}>Remark 1</RTh>
                    <RTh k="remark2"    colW={colW} startResize={startResize} className={FU_TH}>Remark 2</RTh>
                    <RTh k="remark3"    colW={colW} startResize={startResize} className={FU_TH}>Remark 3</RTh>
                    <RTh k="remark4"    colW={colW} startResize={startResize} className={FU_TH}>Remark 4</RTh>
                    <RTh k="note"       colW={colW} startResize={startResize} className={FU_TH}>Note</RTh>
                    <RTh k="followUp"   colW={colW} startResize={startResize} className={FU_TH}>
                      <button onClick={() => { setSort(s => s === "desc" ? "asc" : "desc"); setPage(1); }}
                        className="inline-flex items-center gap-1 hover:text-orange-500 transition-colors" title="Toggle sort order">
                        Follow-up Date
                        {sort === "desc" ? <ArrowDown className="w-3 h-3 text-orange-500" /> : <ArrowUp className="w-3 h-3 text-orange-500" />}
                      </button>
                    </RTh>
                    <RTh k="followUp2"  colW={colW} startResize={startResize} className={FU_TH}>Follow Up 2</RTh>
                    <RTh k="project"    colW={colW} startResize={startResize} className={FU_TH}>Project</RTh>
                    <RTh k="assignedTo" colW={colW} startResize={startResize} className={FU_TH}>Assigned To</RTh>
                    <RTh k="type"       colW={colW} startResize={startResize} className={FU_TH}>Type</RTh>
                    <th className={`${FU_TH} text-center`} style={{ width: 50, minWidth: 50 }}>Done</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const handleUpdate = (updated) => {
                      setLeads((prev) => prev.map((l) => l._id === updated._id ? { ...l, ...updated } : l));
                    };
                    const handleMarkDone = async (e) => {
                      e.stopPropagation();
                      try {
                        await patchLead(lead, { followUp: null, followUp2: null });
                        setLeads((prev) => prev.filter((l) => l._id !== lead._id));
                        setTotal((t) => t - 1);
                        toast.success("Follow-up marked as done ✓");
                      } catch { toast.error("Failed to mark done"); }
                    };
                    return (
                      <tr key={lead._id} className="group border-b transition-colors hover:bg-orange-500/5"
                        style={{ borderColor: "var(--app-border)" }}>
                        <td className="px-2.5 py-2">
                          <button
                            type="button"
                            onClick={() => setDetailLead(lead)}
                            className="font-semibold text-app truncate max-w-[120px] text-left hover:text-orange-500 transition-colors cursor-pointer block"
                          >
                            {lead.name || "-"}
                          </button>
                          {lead._type === "project" && (
                            <span className="text-[10px] text-orange-400 leading-none">Project lead</span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <PhoneActions phone={lead.phone} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <WhatsAppLink
                            phone={lead.phone}
                            name={lead.name}
                            leadId={lead._id}
                            projectId={lead._type === "project" ? lead.projectId : undefined}
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          {lead._type === "project"
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">Project</span>
                            : lead.source ? <SourceBadge source={lead.source} /> : <span className="text-app-soft">-</span>
                          }
                        </td>
                        <td className="px-2.5 py-2">
                          <span className="text-app-soft truncate max-w-[120px] block">{lead.status || lead.remark || "-"}</span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUBooking lead={lead} onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUText lead={lead} field="remark1" placeholder="Remark 1…" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUText lead={lead} field="remark2" placeholder="Remark 2…" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUText lead={lead} field="remark3" placeholder="Remark 3…" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUText lead={lead} field="remark4" placeholder="Remark 4…" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUText lead={lead} field="remarkNote" placeholder="Note…" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUDate lead={lead} field="followUp" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FUDate lead={lead} field="followUp2" onUpdate={handleUpdate} />
                        </td>
                        <td className="px-2.5 py-2">
                          {lead._type === "project"
                            ? <span className="text-orange-500 font-medium truncate max-w-[120px] block">{lead.projectName || "-"}</span>
                            : <span className="text-app-soft">Main Pipeline</span>
                          }
                        </td>
                        <td className="px-2.5 py-2">
                          <span className="text-app truncate max-w-[110px] block text-xs font-medium">
                            {lead.assignedToName || lead.assignedTo?.name || <span className="text-app-soft italic">Unassigned</span>}
                          </span>
                        </td>
                        <td className="px-2.5 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            lead._type === "project"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                          }`}>
                            {lead._type === "project" ? "Project" : "Pipeline"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={handleMarkDone}
                            title="Mark follow-up as done - removes from list"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-green-500 hover:bg-green-500/10 transition opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">
                  Page {page} of {pages} &middot; {total} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 text-app" />
                  </button>
                  <span className="text-xs font-semibold text-app px-2">{page}</span>
                  <button
                    className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                    disabled={page >= pages}
                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4 text-app" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead detail panel — opened from global search suggestions */}
      {detailLead && (
        <LeadDetail
          open={!!detailLead}
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onUpdated={(updated) => { setDetailLead(updated); fetchLeads(); }}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}
