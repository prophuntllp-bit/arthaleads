// pages/ProjectDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner, EmptyState } from "../components/UI";
import ProjectForm from "../components/ProjectForm";
import api from "../services/api";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  ArrowLeft, Building2, Calendar, ChevronLeft, ChevronRight,
  ImageOff, MapPin, Pencil, Search, Upload, Users,
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

// Strip common phone prefixes Facebook adds: "p:", "P:", "ph:", "tel:", "mob:" etc.
function cleanPhone(raw) {
  return String(raw || "")
    .replace(/^(?:p|ph|tel|mob|mobile|phone)\s*:\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

// Parse a row from the imported Excel — tries multiple Facebook column name variants
function parseRow(raw) {
  const r = {};
  Object.keys(raw).forEach((k) => { r[k.trim().toLowerCase()] = String(raw[k] || "").trim(); });

  const name   = r["full name"] || r["name"] || r["customer name"] || r["lead name"] || "";
  const rawPhone = r["phone number"] || r["phone"] || r["mobile"] || r["contact"] || r["mobile number"] || r["ph"] || "";
  const phone  = cleanPhone(rawPhone);
  const email  = r["email"] || r["email address"] || r["mail"] || "";
  const source = r["source"] || r["lead source"] || "Facebook";

  return { name, phone, email, source };
}

// Remark row — select + conditional note
function RemarkCell({ lead, projectId, onUpdated }) {
  const [remark, setRemark]     = useState(lead.remark || "Not Contacted");
  const [note, setNote]         = useState(lead.remarkNote || "");
  const [saving, setSaving]     = useState(false);
  const noteRef = useRef(null);

  const saveRemark = async (newRemark, newNote) => {
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}/leads/${lead._id}/remark`, {
        remark: newRemark,
        remarkNote: newNote,
      });
      onUpdated(res.data.data);
    } catch {
      toast.error("Failed to save remark");
    } finally {
      setSaving(false);
    }
  };

  const handleRemarkChange = (e) => {
    const val = e.target.value;
    setRemark(val);
    if (val === "Not Contacted") {
      setNote("");
      saveRemark(val, "");
    } else {
      saveRemark(val, note);
    }
  };

  const handleNoteBlur = () => {
    if (remark === "Contacted") saveRemark(remark, note);
  };

  return (
    <div className="flex flex-col gap-2 min-w-[180px]">
      <div className="relative">
        <select
          value={remark}
          onChange={handleRemarkChange}
          className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold appearance-none pr-8 transition ${
            remark === "Contacted"
              ? "bg-green-500/10 border-green-500/30 text-green-500"
              : "bg-orange-500/10 border-orange-500/30 text-orange-500"
          }`}
        >
          <option value="Not Contacted">Not Contacted</option>
          <option value="Contacted">Contacted</option>
        </select>
        {saving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {remark === "Contacted" && (
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Write a note..."
          rows={2}
          className="w-full rounded-xl border px-3 py-2 text-xs resize-none transition"
          style={{
            borderColor: "var(--app-border)",
            background: "var(--app-surface-low)",
            color: "var(--app-text)",
          }}
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

  // Leads state
  const [leads, setLeads]         = useState([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage]   = useState(1);
  const [leadsPages, setLeadsPages] = useState(1);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const LIMIT = 50;

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then((r) => setProject(r.data.data))
      .catch(() => { toast.error("Project not found"); navigate("/projects"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (tab !== "leads") return;
    setLeadsLoading(true);
    api.get(`/projects/${id}/leads`, { params: { page: leadsPage, limit: LIMIT, search } })
      .then((r) => {
        setLeads(r.data.leads);
        setLeadsTotal(r.data.total);
        setLeadsPages(r.data.pages);
      })
      .catch(() => toast.error("Failed to load leads"))
      .finally(() => setLeadsLoading(false));
  }, [id, tab, leadsPage, search]);

  const handleSearch = (e) => { setSearch(e.target.value); setLeadsPage(1); };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const rows = raw.map(parseRow).filter((r) => r.name && r.phone);
      if (!rows.length) return toast.error("No valid rows found. Columns needed: Name, Phone Number");

      const res = await api.post(`/projects/${id}/leads/import`, { rows });
      toast.success(`Imported ${res.data.inserted} leads${res.data.skipped ? `, skipped ${res.data.skipped}` : ""}`);

      // Refresh leads
      setLeadsPage(1);
      setSearch("");
      const fresh = await api.get(`/projects/${id}/leads`, { params: { page: 1, limit: LIMIT } });
      setLeads(fresh.data.leads);
      setLeadsTotal(fresh.data.total);
      setLeadsPages(fresh.data.pages);
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleRemarkUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
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
          <button className="btn-secondary" onClick={() => setShowEdit(true)}>
            <Pencil className="h-4 w-4" /> Edit Project
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl p-1 w-fit stitch-surface-muted">
        {["info", "leads"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? "bg-orange-500 text-white shadow-sm"
                : "text-app-soft hover:text-app"
            }`}
          >
            {t === "leads" ? `Leads (${leadsTotal})` : "Info"}
          </button>
        ))}
      </div>

      {/* ── INFO TAB ── */}
      {tab === "info" && (
        <div className="space-y-6">
          {/* Images */}
          {project.images?.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {project.images.map((url, i) => (
                <div key={i} className="relative flex-shrink-0 h-52 w-80 rounded-2xl overflow-hidden border"
                  style={{ borderColor: "var(--app-border)" }}>
                  <img src={url} alt="" className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div className="hidden h-full w-full items-center justify-center stitch-surface-muted">
                    <ImageOff className="h-8 w-8 text-app-soft" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info grid */}
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
          {/* Toolbar */}
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

          {/* Table */}
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
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Source</th>
                        <th>Remark</th>
                        <th>Updated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead, i) => (
                        <tr key={lead._id}>
                          <td className="text-app-soft text-xs">{(leadsPage - 1) * LIMIT + i + 1}</td>
                          <td className="font-medium text-app">{lead.name}</td>
                          <td>
                            <a href={`tel:${lead.phone}`} className="text-sm text-orange-500 hover:underline">{lead.phone}</a>
                          </td>
                          <td className="text-sm text-app-soft">{lead.email || "—"}</td>
                          <td>
                            <span className="stitch-pill text-[11px]">{lead.source}</span>
                          </td>
                          <td>
                            <RemarkCell
                              lead={lead}
                              projectId={id}
                              onUpdated={handleRemarkUpdated}
                            />
                          </td>
                          <td className="text-xs text-app-soft">
                            {lead.remarkUpdatedBy?.name || "—"}
                            {lead.remarkUpdatedAt && (
                              <div className="text-[10px] mt-0.5 opacity-60">{fmtDate(lead.remarkUpdatedAt)}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {leadsPages > 1 && (
                  <div className="flex items-center justify-between border-t px-5 py-4" style={{ borderColor: "var(--app-border)" }}>
                    <p className="text-xs text-app-soft">
                      {(leadsPage - 1) * LIMIT + 1}–{Math.min(leadsPage * LIMIT, leadsTotal)} of {leadsTotal}
                    </p>
                    <div className="flex gap-2">
                      <button className="btn-secondary px-3 py-2" disabled={leadsPage === 1}
                        onClick={() => setLeadsPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button className="btn-secondary px-3 py-2" disabled={leadsPage === leadsPages}
                        onClick={() => setLeadsPage((p) => p + 1)}>
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
    </div>
  );
}
