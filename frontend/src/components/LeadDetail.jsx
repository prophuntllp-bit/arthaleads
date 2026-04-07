import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { Modal, PriorityBadge, SourceBadge, Spinner, StatusBadge, PhoneActions, WhatsAppLink } from "./UI";
import { fmtCurrency, fmtDate, STATUS_OPTIONS } from "../utils/constants";

function Info({ label, value }) {
  return (
    <div className="rounded-[1.35rem] p-4 stitch-surface-muted">
      <p className="stitch-kicker mb-2">{label}</p>
      <p className="text-sm font-medium text-app">{value}</p>
    </div>
  );
}

export default function LeadDetail({ open, onClose, lead, onUpdated }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(lead?.status || "New");

  useEffect(() => {
    setTab("info");
    setNote("");
    setStatus(lead?.status || "New");
  }, [lead, open]);

  if (!lead) return null;

  const refreshLead = async () => {
    const { data } = await api.get(`/leads/${lead._id}`);
    onUpdated(data.data);
  };

  const handleNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post(`/leads/${lead._id}/notes`, { text: note });
      setNote("");
      await refreshLead();
      toast.success("Note added");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (nextStatus) => {
    setStatus(nextStatus);
    try {
      const { data } = await api.put(`/leads/${lead._id}`, { status: nextStatus });
      onUpdated(data.data);
      toast.success("Status updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
      setStatus(lead.status);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Lead Details" size="xl">
      <div className="space-y-5">
        <div className="rounded-[1.75rem] p-5 stitch-surface-muted">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="stitch-kicker mb-2">Lead Profile</p>
              <h3 className="text-2xl font-black tracking-tight text-app">{lead.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <PhoneActions phone={lead.phone} />
                <WhatsAppLink phone={lead.phone} />
                {lead.email && <span className="text-sm text-app-soft">{lead.email}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source={lead.source} />
              <PriorityBadge priority={lead.priority} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: "var(--app-border)" }}>
          {["info", "notes", "activity"].map((item) => (
            <button
              key={item}
              className={item === tab ? "btn-primary rounded-xl" : "btn-secondary rounded-xl"}
              onClick={() => setTab(item)}
              type="button"
            >
              {item === "notes" ? `Notes (${lead.notes?.length || 0})` : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
          <select className="select ml-auto max-w-52 rounded-xl" value={status} onChange={(e) => handleStatus(e.target.value)}>
            {STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {tab === "info" && (
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <Info label="Property Type" value={lead.propertyType} />
            <Info label="BHK" value={lead.bhk} />
            <Info label="Purpose" value={lead.purpose} />
            <Info label="Preferred Location" value={lead.preferredLocation || "-"} />
            <Info label="Budget" value={`${fmtCurrency(lead.budget?.min)} - ${fmtCurrency(lead.budget?.max)}`} />
            <Info label="Assigned To" value={lead.assignedToName || lead.assignedTo?.name || "-"} />
            <Info label="Follow-up Date" value={fmtDate(lead.followUpDate)} />
            <Info label="Created On" value={fmtDate(lead.createdAt)} />
            <div className="md:col-span-2">
              <Info label="Follow-up Note" value={lead.followUpNote || "-"} />
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4">
            <textarea
              className="textarea"
              placeholder="Add a note for the sales team..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex justify-end">
              <button className="btn-primary rounded-xl" onClick={handleNote} disabled={saving}>
                {saving ? <Spinner size="sm" /> : "Add Note"}
              </button>
            </div>
            <div className="space-y-3">
              {(lead.notes || []).length === 0 && <p className="text-sm text-app-soft">No notes yet.</p>}
              {(lead.notes || []).slice().reverse().map((item) => (
                <div key={item._id || `${item.text}-${item.createdAt}`} className="rounded-[1.25rem] p-4 stitch-surface-muted">
                  <p className="text-sm text-app">{item.text}</p>
                  <p className="mt-2 text-xs text-app-soft">
                    {item.addedByName || item.addedBy?.name || "Unknown"} | {fmtDate(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {(lead.activities || []).length === 0 && <p className="text-sm text-app-soft">No activity yet.</p>}
            {(lead.activities || []).slice().reverse().map((item) => (
              <div key={item._id || `${item.type}-${item.createdAt}`} className="rounded-[1.25rem] p-4 stitch-surface-muted">
                <p className="text-sm font-semibold text-app">{item.description}</p>
                <p className="mt-1 text-xs text-app-soft">
                  {item.performedByName || item.performedBy?.name || "System"} | {fmtDate(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
