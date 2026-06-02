import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Sparkles } from "lucide-react";
import api from "../services/api";
import { Modal, PriorityBadge, SourceBadge, Spinner, StatusBadge, PhoneActions, WhatsAppLink, toWaNumber } from "./UI";
import CustomSelect from "./CustomSelect";
import { fmtCurrency, fmtDate, fmtDateTime, STATUS_OPTIONS } from "../utils/constants";

const FB_ERROR_PATTERN = "Facebook lead received but field data could not be fetched";

// Strip raw Elementor field-ID lines e.g. "Field 9b10818: 8007678625"
const cleanRequirements = (text) => {
  if (!text) return "";
  return text.split("\n").filter(l => !/^Field\s+[a-f0-9]{5,}\s*:/i.test(l.trim())).join("\n").trim();
};

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
  const [retrying, setRetrying] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [drafting, setDrafting] = useState(false);

  const handleRetryFacebook = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post(`/leads/${lead._id}/retry-facebook`);
      toast.success("Lead data fetched! Name, phone and email updated.");
      onUpdated?.(data.lead);
    } catch (err) {
      toast.error(err.response?.data?.message || "Retry failed. Token may still be expired.");
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    setTab("info");
    setNote("");
    setStatus(lead?.status || "New");
    setAiDraft(null);
  }, [lead, open]);

  const handleAiDraft = async () => {
    if (!lead?._id || drafting) return;
    setDrafting(true);
    try {
      const { data } = await api.post(`/leads/${lead._id}/draft-message`);
      setAiDraft(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "AI drafting failed. Please try again.");
    } finally {
      setDrafting(false);
    }
  };

  if (!lead) return null;

  const isProjectLead = lead._type === "project";

  const refreshLead = async () => {
    if (isProjectLead) return;
    const { data } = await api.get(`/leads/${lead._id}`);
    onUpdated(data.data);
  };

  const handleNote = async () => {
    if (isProjectLead) { toast.error("Notes are not available for project leads"); return; }
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
      let updated;
      if (isProjectLead && lead.projectId) {
        const { data } = await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, { status: nextStatus });
        updated = data.data;
      } else {
        const { data } = await api.put(`/leads/${lead._id}`, { status: nextStatus });
        updated = data.data;
      }
      onUpdated(updated);
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
                <WhatsAppLink phone={lead.phone} name={lead.name} />
                {lead.phone && !isProjectLead && (
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={drafting}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                    style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
                    title="Draft a personalized WhatsApp message with AI"
                  >
                    {drafting ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    )}
                    AI Draft
                  </button>
                )}
                {lead.email && <span className="text-sm text-app-soft">{lead.email}</span>}
              </div>
              {aiDraft !== null && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">AI Drafted Message</span>
                    <span className="text-[10px] text-app-soft ml-1">— edit before sending</span>
                    <button type="button" onClick={() => setAiDraft(null)} className="ml-auto text-xs text-app-soft hover:text-app transition cursor-pointer">✕</button>
                  </div>
                  <textarea
                    value={aiDraft}
                    onChange={(e) => setAiDraft(e.target.value)}
                    rows={3}
                    className="input w-full resize-none rounded-xl text-sm"
                    style={{ minHeight: 72 }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(aiDraft); toast.success("Copied to clipboard!"); }}
                      className="btn-secondary flex-1 rounded-lg text-xs cursor-pointer"
                    >
                      Copy
                    </button>
                    <a
                      href={`https://wa.me/${toWaNumber(lead.phone)}?text=${encodeURIComponent(aiDraft)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary flex-1 rounded-lg text-center text-xs"
                    >
                      Send on WhatsApp
                    </a>
                  </div>
                </div>
              )}
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
          <CustomSelect
            value={status}
            onChange={handleStatus}
            options={STATUS_OPTIONS}
            style={{ marginLeft: "auto", minWidth: 160 }}
          />
        </div>

        {tab === "info" && (
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <Info label="Property Type" value={lead.propertyType} />
            <Info label="BHK" value={lead.bhk} />
            <Info label="Purpose" value={lead.purpose} />
            <Info label="Preferred Location" value={lead.preferredLocation || "-"} />
            <Info label="Street Address" value={lead.streetAddress || "-"} />
            <Info label="City" value={lead.city || "-"} />
            <Info label="Budget" value={`${fmtCurrency(lead.budget?.min)} - ${fmtCurrency(lead.budget?.max)}`} />
            <Info label="Assigned To" value={lead.assignedToName || lead.assignedTo?.name || "-"} />
            <Info label="Follow-up Date" value={fmtDate(lead.followUpDate)} />
            <Info label="Created On" value={fmtDateTime(lead.createdAt)} />
            <div className="md:col-span-2">
              <Info label="Follow-up Note" value={lead.followUpNote || "-"} />
            </div>
            {!!lead.formResponses?.length && (
              <div className="md:col-span-2 rounded-[1.35rem] p-4 stitch-surface-muted">
                <p className="stitch-kicker mb-3">Form Questions</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {lead.formResponses.map((item, index) => (
                    <Info key={`${item.fieldKey}-${index}`} label={item.label} value={item.value || "-"} />
                  ))}
                </div>
              </div>
            )}
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
              {(lead.notes || []).slice().reverse().map((item) => {
                const isFbError = item.text?.includes(FB_ERROR_PATTERN);
                return (
                  <div
                    key={item._id || `${item.text}-${item.createdAt}`}
                    className={`rounded-[1.25rem] p-4 overflow-hidden ${isFbError ? "border border-amber-400/30 bg-amber-50 dark:bg-amber-500/10" : "stitch-surface-muted"}`}
                  >
                    <p className="text-sm text-app whitespace-pre-wrap break-words">{item.text}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-app-soft">
                        {item.addedByName || item.addedBy?.name || "Unknown"} | {fmtDate(item.createdAt)}
                      </p>
                      {isFbError && (
                        <button
                          onClick={handleRetryFacebook}
                          disabled={retrying}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition"
                          style={{ background: "var(--app-primary)" }}
                        >
                          {retrying
                            ? <><Spinner size="sm" /> Fetching…</>
                            : <><RefreshCw className="w-3 h-3" /> Retry Fetch</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {(lead.activities || []).length === 0 && <p className="text-sm text-app-soft">No activity yet.</p>}
            {(lead.activities || []).slice().reverse().map((item) => (
              <div key={item._id || `${item.type}-${item.createdAt}`} className="rounded-[1.25rem] p-4 stitch-surface-muted overflow-hidden">
                <p className="text-sm font-semibold text-app break-words">{item.description}</p>
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
