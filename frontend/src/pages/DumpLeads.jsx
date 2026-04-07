import { useEffect, useState } from "react";
import { Archive, Phone, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EmptyState, PageLoader, SourceBadge, StatusBadge } from "../components/UI";
import { fmtDate } from "../utils/constants";
import api from "../services/api";
import toast from "react-hot-toast";

const BOOKING_COLOR = {
  "Not Interested": "bg-red-500/10 text-red-500 border-red-500/20",
  "Interested":     "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Booked":         "bg-green-500/10 text-green-600 border-green-500/20",
  "Call Back":      "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Site Visit Booked": "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

export default function DumpLeads() {
  const { user } = useAuth();
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const canDelete = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    api.get("/leads/dump")
      .then((r) => setLeads(r.data.data))
      .catch(() => toast.error("Failed to load dump leads"))
      .finally(() => setLoading(false));
  }, []);

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

  const filtered = leads.filter((l) =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="stitch-page space-y-6">
      <header className="stitch-topbar">
        <div className="flex flex-1 flex-col gap-2">
          <p className="stitch-kicker mb-1">Archive</p>
          <h1 className="text-3xl font-black tracking-tight text-app">Dump Leads</h1>
          <p className="text-sm text-app-soft">Leads marked as Not Interested or Closed Lost — {leads.length} total</p>
        </div>
      </header>

      <div className="card p-4 flex gap-3">
        <input
          className="input flex-1"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="card overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Archive} title="No dump leads" desc="Leads marked Not Interested or Closed Lost will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table min-w-[900px] text-sm">
              <thead>
                <tr>
                  {["Lead", "Phone", "Source", "Pipeline Status", "Booking Status", "Reason", "Assigned To", "Remark", "Added", canDelete && "Actions"].filter(Boolean).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead._id} className={`${i % 2 === 1 ? "bg-black/5 dark:bg-white/[0.02]" : ""} ${lead.isDeleted ? "opacity-75" : ""}`}>
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
                    <td>
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-app-soft hover:text-orange-500 transition whitespace-nowrap">
                        <Phone className="h-3 w-3" />{lead.phone}
                      </a>
                    </td>
                    <td><SourceBadge source={lead.source} /></td>
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
                          {lead.isDeleted && (
                            <button onClick={() => handleRestore(lead._id)}
                              className="rounded-lg p-1.5 text-green-500 hover:bg-green-500/10 transition" title="Restore lead">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleHardDelete(lead._id)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition" title="Delete permanently">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
