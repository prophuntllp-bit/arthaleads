import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, Image as ImageIcon, Film, FileText, LayoutTemplate } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Modal } from "./UI";
import CustomSelect from "./CustomSelect";

/**
 * Send a project's photos, video, floor plan or brochure into a conversation by
 * hand. Same rules as a typed reply: only inside WhatsApp's 24-hour window, and
 * each file is one message (photos are capped at 3, the first video is sent).
 * Upload the files on the Projects page first.
 */
export default function ProjectMediaSendModal({ open, onClose, conversation, onSent }) {
  const [projects, setProjects] = useState(null);
  const [error, setError]       = useState("");
  const [projectId, setProjectId] = useState("");
  const [picked, setPicked]     = useState({});
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProjects(null); setError(""); setPicked({});
    api.get("/projects")
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.data || [];
        setProjects(list);
        const withFiles = list.find((p) => p.videos?.length || p.floorPlanUrl || p.brochureUrl || p.images?.length);
        setProjectId((withFiles || list[0])?._id || "");
      })
      .catch(() => { if (!cancelled) setError("Couldn't load your projects."); });
    return () => { cancelled = true; };
  }, [open]);

  const project = useMemo(() => (projects || []).find((p) => p._id === projectId), [projects, projectId]);
  const items = useMemo(() => {
    if (!project) return [];
    const photos = (project.images || []).filter((u) => /^https?:/.test(u)).length;
    const videos = (project.videos || []).length;
    return [
      { key: "videos",    icon: Film,           label: "Video",      have: videos > 0,           note: videos ? (videos > 1 ? `first of ${videos} is sent` : "1 video") : "not uploaded" },
      { key: "floorplan", icon: LayoutTemplate, label: "Floor plan (PDF)", have: !!project.floorPlanUrl, note: project.floorPlanUrl ? "PDF" : "not uploaded" },
      { key: "brochure",  icon: FileText,       label: "Brochure (PDF)",   have: !!project.brochureUrl,  note: project.brochureUrl ? "PDF" : "not uploaded" },
      { key: "photos",    icon: ImageIcon,      label: "Photos",     have: photos > 0,           note: photos ? `${Math.min(photos, 3)} of ${photos} sent` : "not uploaded" },
    ];
  }, [project]);

  // A different project means different files — clear the ticks.
  useEffect(() => { setPicked({}); }, [projectId]);

  const kinds = items.filter((i) => picked[i.key] && i.have).map((i) => i.key);

  const send = async () => {
    if (!kinds.length || sending) return;
    setSending(true);
    try {
      const { data } = await api.post("/whatsapp/send-media", { conversationId: conversation._id, projectId, kinds });
      toast.success(`Sent ${data.sent.length} ${data.sent.length === 1 ? "type of file" : "types of files"}`);
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Couldn't send the files.", { duration: 7000 });
    } finally { setSending(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send project files" size="md">
      {error ? (
        <p className="py-8 text-center text-sm text-app-soft">{error}</p>
      ) : !projects ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-orange-500" /></div>
      ) : projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-app-soft">Add a project and upload its files on the Projects page first.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-app-soft block mb-1">Project</label>
            <CustomSelect
              value={projectId}
              onChange={setProjectId}
              options={projects.map((p) => ({ value: p._id, label: p.name }))}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
            />
          </div>

          <div className="space-y-2">
            {items.map((it) => (
              <label key={it.key}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition ${it.have ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                style={{ borderColor: picked[it.key] && it.have ? "var(--app-primary)" : "var(--app-border)", background: "var(--app-surface-low)" }}>
                <input type="checkbox" disabled={!it.have} checked={!!picked[it.key] && it.have}
                  onChange={(e) => setPicked((p) => ({ ...p, [it.key]: e.target.checked }))} />
                <it.icon className="h-4 w-4 shrink-0 text-app-soft" />
                <span className="flex-1 text-sm font-semibold text-app">{it.label}</span>
                <span className="text-xs text-app-soft">{it.note}</span>
              </label>
            ))}
          </div>

          <p className="text-[11px] text-app-soft">
            Each file goes as its own WhatsApp message and uses one reply from your monthly allowance.
            Files can only be sent while the customer's 24-hour reply window is open.
          </p>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary flex items-center gap-2" disabled={!kinds.length || sending} onClick={send}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : `Send ${kinds.length || ""} ${kinds.length === 1 ? "file type" : "file types"}`.replace("  ", " ")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
