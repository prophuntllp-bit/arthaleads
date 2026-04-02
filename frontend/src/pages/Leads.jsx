import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  StatusBadge, PriorityBadge, SourceBadge,
  PageLoader, EmptyState, ConfirmDialog
} from "../components/UI";
import LeadForm from "../components/LeadForm";
import LeadDetail from "../components/LeadDetail";
import { useLeads } from "../hooks/useLeads";
import api from "../services/api";
import toast from "react-hot-toast";
import { DATE_RANGE_OPTIONS, fmtDate, fmtCurrency, PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { ChevronDown, Download, Eye, Filter, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";

export default function Leads() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    leads, total, loading, page, setPage,
    filters, setFilter,
    upsertLead, removeLead, pages, LIMIT,
  } = useLeads();

  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (user?.role !== "agent") {
      api.get("/auth/agents").then((r) => setAgents(r.data.agents)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!location.state?.presetSource) return;
    setFilter("source", location.state.presetSource);
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

  const handleDetailUpdated = (updated) => {
    upsertLead(updated, false);
    setDetailLead(updated);
  };

  const getXlsx = async () => import("xlsx");

  const exportRows = async (type) => {
    try {
      const { data } = await api.get("/leads", {
        params: {
          ...filters,
          page: 1,
          limit: 1000,
          sortBy: "createdAt",
          order: "desc",
        },
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

      if (!leadsToImport.length) {
        toast.error("No valid leads found in the uploaded file");
        return;
      }

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
            <label className="btn-secondary cursor-pointer rounded-xl">
              <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
            </label>

            <div className="relative" ref={exportMenuRef}>
              <button className="btn-secondary rounded-xl" onClick={() => setShowExportMenu((current) => !current)}>
                <Download className="h-4 w-4" /> Export <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl"
                  style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "var(--app-shadow)" }}
                >
                  {[
                    { key: "csv", label: "Export CSV" },
                    { key: "excel", label: "Export Excel" },
                    { key: "json", label: "Export JSON" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-app transition"
                      onClick={() => {
                        setShowExportMenu(false);
                        exportRows(item.key);
                      }}
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

      <section className="card p-4 text-xs text-app-soft">
        Import columns supported: <span className="text-app">Name, Phone, Email, Source, Status, Priority, PropertyType, BHK, Purpose, PreferredLocation, BudgetMin, BudgetMax, FollowUpDate, FollowUpNote, AssignedTo</span>
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
            <table className="stitch-table min-w-[980px] text-sm">
              <thead>
                <tr>
                  {["Lead", "Phone", "Source", "Status", "Priority", "Property Interest", "Follow-up", "Assigned To", "Actions"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr key={lead._id} className={index % 2 === 1 ? "bg-black/5 dark:bg-white/[0.02] group" : "group"}>
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="stitch-surface-muted flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold text-orange-500">
                          {lead.name?.slice(0, 1)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-app">{lead.name}</p>
                          <p className="truncate text-xs text-app-soft">{lead.email || "No email added"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm text-app-soft">{lead.phone}</td>
                    <td><SourceBadge source={lead.source} /></td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td><PriorityBadge priority={lead.priority} /></td>
                    <td className="min-w-[220px]">
                      <div>
                        <p className="text-sm font-medium text-app">{lead.propertyType}{lead.bhk !== "N/A" ? ` • ${lead.bhk}` : ""}</p>
                        {(lead.budget?.min || lead.budget?.max) && (
                          <p className="mt-1 text-xs text-orange-500">{fmtCurrency(lead.budget?.min)} - {fmtCurrency(lead.budget?.max)}</p>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-xs text-app-soft">{fmtDate(lead.followUpDate)}</td>
                    <td className="whitespace-nowrap text-sm text-app-soft">{lead.assignedToName || lead.assignedTo?.name || "-"}</td>
                    <td>
                      <div className="flex justify-end gap-2 opacity-50 transition-opacity group-hover:opacity-100">
                        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-app-soft transition hover:bg-white/5 hover:text-app" onClick={() => setDetailLead(lead)} title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-app-soft transition hover:bg-amber-500/10 hover:text-amber-400" onClick={() => { setEditLead(lead); setShowForm(true); }} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        {user?.role !== "agent" && (
                          <button className="flex h-9 w-9 items-center justify-center rounded-xl text-app-soft transition hover:bg-red-500/10 hover:text-red-400" onClick={() => setDeletingId(lead._id)} title="Delete">
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

        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-4" style={{ borderColor: "var(--app-border)" }}>
            <p className="text-xs text-app-soft">Showing {(page - 1) * LIMIT + 1} - {Math.min(page * LIMIT, total)} of {total}</p>
            <div className="flex gap-2">
              <button className="btn-secondary rounded-xl px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p > pages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-9 w-9 rounded-xl text-xs font-semibold transition ${p === page ? "text-white" : "text-app-soft"}`}
                    style={p === page ? { background: "linear-gradient(135deg, var(--app-primary-deep), var(--app-primary))" } : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}
                  >
                    {p}
                  </button>
                );
              })}
              <button className="btn-secondary rounded-xl px-3 py-1.5 text-xs" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      <LeadForm open={showForm} onClose={() => { setShowForm(false); setEditLead(null); }} onSaved={handleSaved} lead={editLead} agents={agents} />
      <LeadDetail open={!!detailLead} onClose={() => setDetailLead(null)} lead={detailLead} onUpdated={handleDetailUpdated} />
      <ConfirmDialog open={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={handleDelete} loading={deleteLoading} title="Delete Lead" message="Are you sure you want to permanently delete this lead? This cannot be undone." />
    </div>
  );
}
