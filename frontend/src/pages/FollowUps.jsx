import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageLoader, EmptyState, Spinner, PhoneActions, WhatsAppLink, SourceBadge } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, CalendarCheck, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

const SECTIONS = [
  { key: "past",    label: "Past Events",    icon: Clock,         color: "text-red-500",   bg: "bg-red-500/10",   activeBg: "bg-red-500",    badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  { key: "present", label: "Today's Leads",  icon: CalendarCheck, color: "text-blue-500",  bg: "bg-blue-500/10",  activeBg: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  { key: "future",  label: "Future Events",  icon: CalendarDays,  color: "text-green-500", bg: "bg-green-500/10", activeBg: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SectionBadge({ section }) {
  const s = SECTIONS.find(x => x.key === section);
  if (!s) return null;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.badge}`}>{s.label}</span>;
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

      {/* Controls row — sort toggle + future date filters */}
      <div className="px-4 lg:px-6 pt-3 flex items-center gap-3 flex-wrap">
        {/* Sort toggle — always visible */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <button
            onClick={() => { setSort("desc"); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              sort === "desc"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-app-soft hover:text-app"
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            Latest First
          </button>
          <button
            onClick={() => { setSort("asc"); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              sort === "asc"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-app-soft hover:text-app"
            }`}
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
              <table className="w-full text-xs min-w-[780px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Phone</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">WhatsApp</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Source</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Status / Remark</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">
                      <button
                        onClick={() => { setSort(s => s === "desc" ? "asc" : "desc"); setPage(1); }}
                        className="inline-flex items-center gap-1 hover:text-orange-500 transition-colors"
                        title="Toggle sort order"
                      >
                        Follow-up Date
                        {sort === "desc" ? <ArrowDown className="w-3 h-3 text-orange-500" /> : <ArrowUp className="w-3 h-3 text-orange-500" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Project</th>
                    <th className="px-4 py-3 text-left font-semibold text-app-soft uppercase tracking-wide text-[10px]">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr
                      key={lead._id}
                      className="border-b transition-colors hover:bg-orange-500/5 cursor-pointer"
                      style={{ borderColor: "var(--app-border)" }}
                      onClick={() => {
                        if (lead._type === "project" && lead.projectId) {
                          navigate(`/projects/${lead.projectId}`);
                        } else {
                          navigate("/leads", { state: { openLeadId: lead._id } });
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-app truncate max-w-[120px]">{lead.name || "—"}</p>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <PhoneActions phone={lead.phone} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <WhatsAppLink phone={lead.phone} />
                      </td>
                      <td className="px-4 py-3">
                        {lead.source ? <SourceBadge source={lead.source} /> : <span className="text-app-soft">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-app-soft truncate max-w-[120px] block">
                          {lead.status || lead.remark || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-app-soft whitespace-nowrap">{fmtDate(lead.followUpDate || lead.followUp)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {lead._type === "project" ? (
                          <span className="text-orange-500 font-medium truncate max-w-[120px] block">{lead.projectName || "—"}</span>
                        ) : (
                          <span className="text-app-soft">Main Pipeline</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          lead._type === "project"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        }`}>
                          {lead._type === "project" ? "Project" : "Pipeline"}
                        </span>
                      </td>
                    </tr>
                  ))}
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
