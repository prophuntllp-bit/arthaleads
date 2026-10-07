// ProjectDumpLeads.jsx — the leads dumped from one project, with every remark
// and note written on them, so whoever dumped a lead can see why. Paged and
// searchable because a busy project dumps hundreds. Restore puts a lead back
// into the project with its remarks and notes.
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Spinner, EmptyState } from "./UI";
import { Archive, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");

function Line({ label, value }) {
  if (!value) return null;
  return (
    <p className="text-xs leading-relaxed">
      <span className="text-app-soft">{label}: </span>
      <span className="text-app whitespace-pre-wrap break-words">{value}</span>
    </p>
  );
}

export default function ProjectDumpLeads({ open, onClose, projectId, projectName, onChanged }) {
  const [leads, setLeads] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const listRef = useRef(null);

  // Debounce typing into the search box
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (!open) { setSearch(""); setQuery(""); setPage(1); setConfirmId(null); } }, [open]);

  const load = useCallback(() => {
    setLeads(null);
    api.get(`/projects/${projectId}/dumped-leads`, { params: { page, limit: PAGE_SIZE, search: query || undefined } })
      .then((r) => { setLeads(r.data.leads || []); setTotal(r.data.total || 0); setPages(r.data.pages || 1); listRef.current?.scrollTo?.(0, 0); })
      .catch(() => { toast.error("Could not load dumped leads"); setLeads([]); });
  }, [projectId, page, query]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const restore = async (lead) => {
    setBusyId(lead._id);
    try {
      const { data } = await api.post(`/projects/${projectId}/dumped-leads/${lead._id}/restore`);
      toast.success(data.restoredTo === "project" ? `${lead.name} is back in ${data.projectName}` : `${lead.name} restored to Leads`);
      setConfirmId(null);
      // Reload; if that emptied this page, step back one.
      if (leads.length === 1 && page > 1) setPage((p) => p - 1); else load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not restore this lead");
      load();
    } finally { setBusyId(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Dump leads · ${projectName || "Project"}`} size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-app-soft" />
            <input className="input w-full" style={{ paddingLeft: 34, paddingTop: 9, paddingBottom: 9, borderRadius: "0.75rem", fontSize: 13 }}
              placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-app-soft whitespace-nowrap tabular-nums">{total} {total === 1 ? "lead" : "leads"}</span>
        </div>

        <div ref={listRef} className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "58vh", minHeight: 120 }}>
          {leads === null ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : leads.length === 0 ? (
            <EmptyState icon={Archive}
              title={query ? "No dumped leads match" : "Nothing dumped from this project"}
              desc={query ? "Try a different name or number." : "Leads deleted from this project will appear here with their remarks."} />
          ) : leads.map((l) => (
            <div key={l._id} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-app truncate">{l.name}</p>
                  <p className="text-xs text-app-soft">{l.phone}{l.status ? ` · ${l.status}` : ""}{l.booking && l.booking !== l.status ? ` · ${l.booking}` : ""}</p>
                </div>
                {confirmId === l._id ? (
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button type="button" disabled={busyId === l._id} onClick={() => restore(l)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white cursor-pointer transition hover:opacity-90"
                      style={{ background: "var(--app-primary)" }}>
                      {busyId === l._id ? <Spinner size="sm" /> : null} Put back in project
                    </button>
                    <button type="button" disabled={busyId === l._id} onClick={() => setConfirmId(null)}
                      className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-app-soft hover:text-app cursor-pointer">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmId(l._id)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition hover:opacity-90"
                    style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </button>
                )}
              </div>
              <p className="text-[11px] text-app-soft">Dumped {fmt(l.deletedAt)}{l.deletedByName ? ` by ${l.deletedByName}` : ""}</p>
              <div className="space-y-1 pt-1 border-t" style={{ borderColor: "var(--app-border)" }}>
                <Line label="Remark 1" value={l.remark1} />
                <Line label="Remark 2" value={l.remark2} />
                <Line label="Remark 3" value={l.remark3} />
                <Line label="Remark 4" value={l.remark4} />
                <Line label="Remark note" value={l.remark} />
                <Line label="Follow-up note" value={l.followUpNote} />
                {(l.notes || []).map((n, i) => (
                  <Line key={i} label={`Note${n.addedByName ? ` (${n.addedByName})` : ""}`} value={n.text} />
                ))}
                {!l.remark1 && !l.remark2 && !l.remark3 && !l.remark4 && !l.remark && !l.followUpNote && !(l.notes || []).length && (
                  <p className="text-xs text-app-soft italic">No remarks were written on this lead.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-app-soft tabular-nums">Page {page} of {pages}</p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer" aria-label="Previous page">
                <ChevronLeft className="w-4 h-4 text-app" />
              </button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer" aria-label="Next page">
                <ChevronRight className="w-4 h-4 text-app" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
