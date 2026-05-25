import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageLoader, EmptyState, Spinner, PhoneActions, WhatsAppLink, SourceBadge } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, CalendarCheck, CalendarDays, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";

// ── Route patch to correct API based on lead type ─────────────────────────────
async function patchLead(lead, data) {
  if (lead._type === "project") {
    const r = await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, data);
    return r.data.data;
  } else {
    // Map project-lead field names → main-lead field names
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
];
function FUBooking({ lead, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const save = async (v) => {
    setSaving(true);
    try { const updated = await patchLead(lead, { booking: v }); onUpdate(updated); }
    catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };
  const opt = FU_BOOKING_OPTIONS.find((o) => o.value === (lead.booking || "")) || FU_BOOKING_OPTIONS[0];
  if (saving) return <span className="flex items-center"><Spinner size="sm" /></span>;
  return (
    <select
      className={`rounded-lg border px-2 py-1 text-xs appearance-none focus:outline-none focus:border-orange-400 font-semibold ${opt.color}`}
      style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)", minWidth: 120, maxWidth: 145 }}
      value={lead.booking || ""} onChange={(e) => save(e.target.value)}>
      {FU_BOOKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
  const navigate = useNavigate();
  const [section, setSection] = useState("present");
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Smart defaults: past = latest missed first (desc), future/present = soonest first (asc)
  const [sort, setSort] = useState("desc"); // "asc" | "desc"

  const limit = 50;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section, page, limit, sort });
      if (section === "future") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const r = await api.get(`/followups?${params.toString()}`);
      setLeads(r.data.leads || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      toast.error("Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [section, page, from, to, sort]);

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
      <div className="px-4 lg:px-6 pt-4">
        <div className="flex gap-2 p-1 rounded-2xl w-full max-w-lg" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
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

      {/* Controls row - sort toggle + future date filters */}
      <div className="px-4 lg:px-6 pt-3 flex items-center gap-3 flex-wrap">
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
              <input
                type="date"
                className="input text-xs py-1.5 px-3"
                value={from}
                onChange={e => { setFrom(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-soft font-medium">To</label>
              <input
                type="date"
                className="input text-xs py-1.5 px-3"
                value={to}
                onChange={e => { setTo(e.target.value); setPage(1); }}
              />
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
      <div className="px-4 lg:px-6 pt-4 pb-6">
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
              <table className="w-full text-xs min-w-[1440px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 120, minWidth: 120 }}>Name</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 130, minWidth: 130 }}>Phone</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 110, minWidth: 110 }}>WhatsApp</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 80, minWidth: 80 }}>Source</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 110, minWidth: 110 }}>Status</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 150, minWidth: 150 }}>Booking</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 130, minWidth: 130 }}>Remark 1</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 130, minWidth: 130 }}>Remark 2</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 168, minWidth: 168 }}>
                      <button onClick={() => { setSort(s => s === "desc" ? "asc" : "desc"); setPage(1); }}
                        className="inline-flex items-center gap-1 hover:text-orange-500 transition-colors" title="Toggle sort order">
                        Follow-up Date
                        {sort === "desc" ? <ArrowDown className="w-3 h-3 text-orange-500" /> : <ArrowUp className="w-3 h-3 text-orange-500" />}
                      </button>
                    </th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 168, minWidth: 168 }}>Follow Up 2</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 120, minWidth: 120 }}>Project</th>
                    <th className="px-2.5 py-2 text-left font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 80, minWidth: 80 }}>Type</th>
                    <th className="px-2.5 py-2 text-center font-bold text-app-soft uppercase tracking-[0.14em] text-[10px] whitespace-nowrap" style={{ width: 50, minWidth: 50 }}>Done</th>
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
                      <tr key={lead._id} className="group border-b transition-colors hover:bg-orange-500/5 cursor-pointer"
                        style={{ borderColor: "var(--app-border)" }}
                        onClick={() => {
                          if (lead._type === "project" && lead.projectId) navigate(`/projects/${lead.projectId}`);
                          else navigate("/leads", { state: { openLeadId: lead._id } });
                        }}>
                        <td className="px-2.5 py-2">
                          <p className="font-semibold text-app truncate max-w-[120px]">{lead.name || "-"}</p>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <PhoneActions phone={lead.phone} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <WhatsAppLink phone={lead.phone} />
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
                            title="Mark follow-up as done — removes from list"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-green-500 hover:bg-green-500/10 transition opacity-0 group-hover:opacity-100">
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
    </div>
  );
}
