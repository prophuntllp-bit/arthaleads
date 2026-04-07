import { useEffect, useRef, useState } from "react";
import { Archive, ChevronDown, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EmptyState, PageLoader, PhoneActions, WhatsAppLink, SourceBadge, StatusBadge } from "../components/UI";
import { fmtDate } from "../utils/constants";
import api from "../services/api";
import toast from "react-hot-toast";

const BOOKING_COLOR = {
  "Not Interested":    "bg-red-500/10 text-red-500 border-red-500/20",
  "Interested":        "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Booked":            "bg-green-500/10 text-green-600 border-green-500/20",
  "Call Back":         "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Site Visit Booked": "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

const getXlsx = async () => import("xlsx");

export default function DumpLeads() {
  const { user } = useAuth();
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [limit, setLimit]           = useState(10);
  const [page, setPage]             = useState(1);
  const [importing, setImporting]   = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  const canDelete = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    api.get("/leads/dump")
      .then((r) => setLeads(r.data.data))
      .catch(() => toast.error("Failed to load dump leads"))
      .finally(() => setLoading(false));
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    const h = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Regular lead actions ────────────────────────────────────────────────────
  const handleHardDelete = async (id) => {
    if (!window.confirm("Permanently delete this lead? This cannot be undone.")) return;
    try {
      await api.delete(`/leads/${id}/permanent`);
      setLeads((prev) => prev.filter((l) => l._id !== id));
      toast.success("Lead permanently deleted");
    } catch { toast.error("Delete failed"); }
  };

  const handleRestore = async (id) => {
    try {
      await api.patch(`/leads/${id}/restore`);
      setLeads((prev) => prev.filter((l) => l._id !== id));
      toast.success("Lead restored to main leads");
    } catch { toast.error("Restore failed"); }
  };

  // ── Project lead actions ────────────────────────────────────────────────────
  const handleProjRestore = async (lead) => {
    try {
      await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, { booking: "" });
      setLeads((prev) => prev.filter((l) => l._id !== lead._id));
      toast.success("Lead restored to project leads");
    } catch { toast.error("Restore failed"); }
  };

  const handleProjHardDelete = async (lead) => {
    if (!window.confirm("Permanently delete this project lead? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${lead.projectId}/leads/${lead._id}`);
      setLeads((prev) => prev.filter((l) => l._id !== lead._id));
      toast.success("Lead permanently deleted");
    } catch { toast.error("Delete failed"); }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportRows = async (type) => {
    try {
      const rows = leads.map((lead) => ({
        Name: lead.name,
        Phone: lead.phone,
        Email: lead.email || "",
        Source: lead.source || "",
        Project: lead.projectName || "",
        PipelineStatus: lead.status || "",
        BookingStatus: lead.booking || "",
        Reason: lead.isDeleted ? "Deleted" : "Not Interested",
        AssignedTo: lead.assignedToName || "",
        Remark: lead.remark || "",
        Remark1: lead.remark1 || "",
        Remark2: lead.remark2 || "",
        AddedOn: lead.createdAt ? new Date(lead.createdAt).toISOString().slice(0, 10) : "",
      }));

      if (type === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `propcrm-dump-leads-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Dump leads exported as JSON");
        return;
      }

      const XLSX = await getXlsx();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dump Leads");
      const fileName = `propcrm-dump-leads-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "csv"}`;
      XLSX.writeFile(workbook, fileName, { bookType: type === "excel" ? "xlsx" : "csv" });
      toast.success(`Dump leads exported as ${type === "excel" ? "Excel" : "CSV"}`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Export failed");
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────
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

      const leadsToImport = rows
        .map((row) => ({
          name:   String(row.Name   || row.name   || "").trim(),
          phone:  String(row.Phone  || row.phone  || "").trim(),
          email:  String(row.Email  || row.email  || "").trim(),
          source: String(row.Source || row.source || "Manual").trim() || "Manual",
          status: String(row.PipelineStatus || row.Status || row.status || "New").trim() || "New",
          remark: String(row.Remark  || row.remark  || "").trim(),
          remark1: String(row.Remark1 || row.remark1 || "").trim(),
          remark2: String(row.Remark2 || row.remark2 || "").trim(),
          booking: "Not Interested",  // imported into dump = Not Interested
          isDeleted: false,
        }))
        .filter((e) => e.name && e.phone);

      if (!leadsToImport.length) {
        toast.error("No valid leads found. File must have Name and Phone columns.");
        return;
      }

      const { data } = await api.post("/leads/import", { leads: leadsToImport });
      toast.success(data.message || `${leadsToImport.length} leads imported to dump`);
      // Reload dump leads
      const r = await api.get("/leads/dump");
      setLeads(r.data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const filtered = leads.filter((l) =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * limit, safePage * limit);

  return (
    <div className="stitch-page space-y-6">
      <header className="stitch-topbar">
        <div className="flex flex-1 flex-col gap-2">
          <p className="stitch-kicker mb-1">Archive</p>
          <h1 className="text-3xl font-black tracking-tight text-app">Dump Leads</h1>
          <p className="text-sm text-app-soft">Leads marked as Not Interested or deleted — {leads.length} total</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Import */}
          <label className="btn-secondary cursor-pointer rounded-xl flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4" />
            {importing ? "Importing…" : "Import"}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>

          {/* Export */}
          <div className="relative" ref={exportMenuRef}>
            <button
              className="btn-secondary rounded-xl flex items-center gap-2 text-sm font-medium"
              onClick={() => setShowExportMenu((c) => !c)}
            >
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
        </div>
      </header>

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-app-soft whitespace-nowrap">Show rows</span>
          <select
            className="input w-20 py-2 text-sm"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <section className="card overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Archive} title="No dump leads" desc="Leads marked Not Interested or deleted will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[900px] text-sm">
              <thead>
                <tr>
                  {["Lead", "Phone", "WhatsApp", "Source", "Project", "Pipeline Status", "Booking Status", "Reason", "Assigned To", "Remark", "Added", canDelete && "Actions"].filter(Boolean).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((lead, i) => (
                  <tr key={lead._id + (lead._type || "")} className={`${i % 2 === 1 ? "bg-black/5 dark:bg-white/[0.02]" : ""} ${lead.isDeleted ? "opacity-75" : ""}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="stitch-surface-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold text-orange-500">
                          {lead.name?.slice(0, 1)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-app max-w-[140px]">{lead.name}</p>
                          <p className="truncate text-xs text-app-soft max-w-[140px]">{lead.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td><PhoneActions phone={lead.phone} /></td>
                    <td><WhatsAppLink phone={lead.phone} /></td>
                    <td><SourceBadge source={lead.source} /></td>
                    <td>
                      {lead.projectName
                        ? <span className="text-[11px] font-semibold text-violet-600">{lead.projectName}</span>
                        : <span className="text-xs text-app-soft">—</span>}
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td>
                      {lead.booking ? (
                        <span className={`badge border ${BOOKING_COLOR[lead.booking] || "bg-gray-100 text-gray-600"}`}>
                          {lead.booking}
                        </span>
                      ) : <span className="text-xs text-app-soft">—</span>}
                    </td>
                    <td>
                      {lead.isDeleted
                        ? <span className="badge bg-red-500/10 text-red-500 border border-red-500/20">Deleted</span>
                        : <span className="badge bg-gray-100/50 text-gray-500">Not Interested</span>}
                    </td>
                    <td className="text-xs text-app-soft whitespace-nowrap">{lead.assignedToName || "—"}</td>
                    <td className="text-xs text-app-soft max-w-[180px]">
                      <p className="truncate">{lead.remark || lead.remark1 || "—"}</p>
                    </td>
                    <td className="text-xs text-app-soft whitespace-nowrap">{fmtDate(lead.createdAt)}</td>
                    {canDelete && (
                      <td>
                        <div className="flex items-center gap-1">
                          {lead._type === "project" ? (
                            <button onClick={() => handleProjRestore(lead)}
                              className="rounded-lg p-1.5 text-green-500 hover:bg-green-500/10 transition" title="Restore lead">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : lead.isDeleted ? (
                            <button onClick={() => handleRestore(lead._id)}
                              className="rounded-lg p-1.5 text-green-500 hover:bg-green-500/10 transition" title="Restore lead">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {lead._type === "project" ? (
                            <button onClick={() => handleProjHardDelete(lead)}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition" title="Delete permanently">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => handleHardDelete(lead._id)}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition" title="Delete permanently">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs text-app-soft">
                  {filtered.length} total · showing {(safePage - 1) * limit + 1}–{Math.min(safePage * limit, filtered.length)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >← Prev</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "…" ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs text-app-soft">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            p === safePage ? "bg-orange-500 text-white" : "text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >{p}</button>
                      )
                    )}
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
