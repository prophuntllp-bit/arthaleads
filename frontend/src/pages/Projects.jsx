// pages/Projects.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, EmptyState } from "../components/UI";
import ProjectForm from "../components/ProjectForm";
import api from "../services/api";
import toast from "react-hot-toast";
import { Building2, FolderKanban, MapPin, Pencil, Plus, Users } from "lucide-react";

function fmtPrice(n) {
  if (!n) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function Projects() {
  useEffect(() => { document.title = "Property Inventory — Arthaleads CRM"; }, []);
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ["admin", "manager"].includes(user?.role);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProj, setEditProj] = useState(null);

  useEffect(() => {
    api.get("/projects")
      .then((r) => setProjects(r.data.data))
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p._id === project._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...project };
        return next;
      }
      return [project, ...prev];
    });
    setEditProj(null);
  };

  const openEdit = (e, proj) => {
    e.stopPropagation();
    setEditProj(proj);
    setShowForm(true);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page space-y-6">
      <header className="stitch-topbar">
        <div>
          <p className="stitch-kicker mb-1">Real Estate</p>
          <h1 className="text-2xl font-black tracking-tight text-app">Projects</h1>
          <p className="mt-1 text-sm text-app-soft">Manage project info and import telecaller leads</p>
        </div>
        {canManage && (
          <button
            className="btn-primary"
            onClick={() => { setEditProj(null); setShowForm(true); }}
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          desc={canManage ? "Create your first project to start importing leads." : "No projects have been created yet."}
          action={canManage && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> New Project
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((proj) => (
            <div
              key={proj._id}
              className="card cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5"
              onClick={() => navigate(`/projects/${proj._id}`)}
            >
              {/* Image */}
              <div className="relative h-44 w-full overflow-hidden">
                {proj.images?.[0] ? (
                  <img
                    src={proj.images[0]}
                    alt={proj.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className={`${proj.images?.[0] ? "hidden" : "flex"} h-full w-full items-center justify-center`}
                  style={{ background: "linear-gradient(135deg, rgba(160,65,0,0.15), rgba(255,107,0,0.10))" }}
                >
                  <Building2 className="h-12 w-12 text-orange-500/40" />
                </div>
                {/* Lead count badge */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
                  <Users className="h-3 w-3" />
                  {proj.leadCount || 0} leads
                </div>
                {canManage && (
                  <button
                    onClick={(e) => openEdit(e, proj)}
                    className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl text-white opacity-0 group-hover:opacity-100 transition"
                    style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-bold text-app leading-tight">{proj.name}</h3>
                  {canManage && (
                    <button
                      onClick={(e) => openEdit(e, proj)}
                      className="flex-shrink-0 rounded-xl p-1.5 transition hover:bg-orange-500/10"
                    >
                      <Pencil className="h-3.5 w-3.5 text-app-soft" />
                    </button>
                  )}
                </div>

                {proj.location && (
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-app-soft">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    {proj.location}
                  </div>
                )}

                {/* Price */}
                {(proj.priceMin || proj.priceMax) ? (
                  <p className="mb-3 text-sm font-semibold text-orange-500">
                    {fmtPrice(proj.priceMin)}{proj.priceMin && proj.priceMax ? " – " : ""}{fmtPrice(proj.priceMax)}
                  </p>
                ) : null}

                {/* BHK chips */}
                {proj.bhkTypes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {proj.bhkTypes.map((b) => (
                      <span key={b} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-app-soft"
                        style={{ borderColor: "var(--app-border)" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {/* Assigned members badge */}
                {proj.assignedTo?.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {proj.assignedTo.slice(0, 3).map((m) => {
                        const member = typeof m === "object" ? m : { _id: m, name: "?" };
                        const initials = member.name
                          ? member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                          : "?";
                        return (
                          <span
                            key={member._id}
                            title={member.name}
                            className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold text-white"
                            style={{ background: "var(--color-orange-500, #f97316)", borderColor: "var(--app-surface)" }}
                          >
                            {initials}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-app-soft">
                      {proj.assignedTo.length > 3
                        ? `${proj.assignedTo.slice(0, 3).map((m) => (typeof m === "object" ? m.name : "")).filter(Boolean).join(", ")} +${proj.assignedTo.length - 3} more`
                        : proj.assignedTo.map((m) => (typeof m === "object" ? m.name : "")).filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProjectForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditProj(null); }}
          project={editProj}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
