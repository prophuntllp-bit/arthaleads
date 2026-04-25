import { useEffect, useState } from "react";
import { Modal, Spinner } from "./UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { ArrowRightLeft } from "lucide-react";

const SOURCES = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "99acres", "MagicBricks", "Other"];

export default function TransferModal({ open, onClose, lead, leadType, currentProjectId, onTransferred }) {
  const [mode, setMode] = useState("project");   // "project" | "pipeline"
  const [projects, setProjects] = useState([]);
  const [toProjectId, setToProjectId] = useState("");
  const [source, setSource] = useState("Facebook");
  const [loading, setLoading] = useState(false);
  const [projLoading, setProjLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("project");
    setToProjectId("");
    setSource("Facebook");
    setProjLoading(true);
    api.get("/projects")
      .then(r => setProjects((r.data.data || []).filter(p => String(p._id) !== String(currentProjectId))))
      .catch(() => {})
      .finally(() => setProjLoading(false));
  }, [open, currentProjectId]);

  const handleTransfer = async () => {
    setLoading(true);
    try {
      if (leadType === "project") {
        if (mode === "project") {
          if (!toProjectId) { toast.error("Select a project"); setLoading(false); return; }
          await api.post(`/projects/${currentProjectId}/leads/${lead._id}/transfer`, { toProjectId });
        } else {
          await api.post(`/projects/${currentProjectId}/leads/${lead._id}/transfer`, { toLeads: true, source });
        }
      } else {
        // main lead → project
        if (!toProjectId) { toast.error("Select a project"); setLoading(false); return; }
        await api.post(`/leads/${lead._id}/transfer`, { toProjectId });
      }
      toast.success("Lead transferred successfully");
      onTransferred?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer Lead" size="sm">
      <div className="space-y-4">
        <div className="rounded-2xl p-3 border text-sm" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
          <p className="font-semibold text-app">{lead?.name}</p>
          <p className="text-app-soft text-xs">{lead?.phone}</p>
        </div>

        {leadType === "project" && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode("project")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${mode === "project" ? "bg-orange-500 text-white" : "btn-secondary"}`}
            >
              → Project
            </button>
            <button
              onClick={() => setMode("pipeline")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${mode === "pipeline" ? "bg-orange-500 text-white" : "btn-secondary"}`}
            >
              → Main Pipeline
            </button>
          </div>
        )}

        {(mode === "project" || leadType === "lead") && (
          <div>
            <label className="label">Select Project</label>
            {projLoading ? <Spinner size="sm" /> : (
              <select className="select w-full" value={toProjectId} onChange={e => setToProjectId(e.target.value)}>
                <option value="">Choose project…</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {mode === "pipeline" && leadType === "project" && (
          <div>
            <label className="label">Campaign / Source</label>
            <select className="select w-full" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleTransfer} disabled={loading}>
            {loading ? <Spinner size="sm" /> : <ArrowRightLeft className="w-4 h-4" />}
            Transfer
          </button>
        </div>
      </div>
    </Modal>
  );
}
