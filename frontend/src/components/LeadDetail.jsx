import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useCopilot } from "../context/CopilotContext";
import { Pencil, RefreshCw, Sparkles, Phone, Mic, AlignLeft, Loader2, PhoneMissed, FileText } from "lucide-react";
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

export default function LeadDetail({ open, onClose, lead, onUpdated, onEdit }) {
  const { setFocusedLead } = useCopilot();

  useEffect(() => {
    if (open && lead) setFocusedLead(lead);
    else setFocusedLead(null);
    return () => setFocusedLead(null);
  }, [open, lead?._id]);

  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(lead?.status || "New");
  const [retrying, setRetrying] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callHistory, setCallHistory]     = useState([]);
  const [callsLoading, setCallsLoading]   = useState(false);
  const [expandedCall, setExpandedCall]   = useState(null);

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
    const latest = lead?.notes?.[lead.notes.length - 1];
    setNote(latest?.text || "");
    setStatus(lead?.status || "New");
    setAiDraft(null);
    setCallHistory([]);
    setExpandedCall(null);
  }, [lead?._id, open]);

  useEffect(() => {
    if (tab !== "calls" || !lead?._id) return;
    setCallsLoading(true);
    api.get(`/calls/lead/${lead._id}`)
      .then(({ data }) => setCallHistory(data.calls || []))
      .catch(() => toast.error("Failed to load call history"))
      .finally(() => setCallsLoading(false));
  }, [tab, lead?._id]);

  const callLead = async () => {
    if (!lead?._id || calling) return;
    setCalling(true);
    try {
      const { data } = await api.post("/calls/initiate", { leadId: lead._id });
      toast.success(data.message || "Call initiated — check your phone.");
      await refreshLead();
    } catch (err) {
      toast.error(err.response?.data?.message || "Call failed. Check EnableX settings.");
    } finally {
      setCalling(false);
    }
  };

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
    if (isProjectLead) return null;
    const { data } = await api.get(`/leads/${lead._id}`);
    onUpdated(data.data);
    return data.data;
  };

  const handleNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      if (isProjectLead && lead.projectId) {
        const { data } = await api.post(`/projects/${lead.projectId}/leads/${lead._id}/notes`, { text: note });
        const savedLead = data.data;
        const latest = savedLead.notes?.[savedLead.notes.length - 1];
        setNote(latest?.text || note);
        onUpdated(savedLead);
      } else {
        await api.post(`/leads/${lead._id}/notes`, { text: note });
        const updatedLead = await refreshLead();
        if (updatedLead) {
          const latest = updatedLead.notes?.[updatedLead.notes.length - 1];
          setNote(latest?.text || note);
        }
      }
      toast.success("Note saved");
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
                {lead.phone && (
                  <button
                    type="button"
                    onClick={callLead}
                    disabled={calling}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                    style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
                    title="Call this lead via EnableX"
                  >
                    {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5 text-orange-500" />}
                    {calling ? "Calling…" : "Call"}
                  </button>
                )}
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
                    <span className="text-[10px] text-app-soft ml-1">(edit before sending)</span>
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
            <div className="flex flex-wrap items-start gap-2">
              <SourceBadge source={lead.source} />
              <PriorityBadge priority={lead.priority} />
              <StatusBadge status={lead.status} />
              {onEdit && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(lead); }}
                  title="Edit lead"
                  className="p-1.5 rounded-xl transition-colors"
                  style={{ color: "var(--app-text-soft)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.10)"; e.currentTarget.style.color = "var(--app-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--app-text-soft)"; }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: "var(--app-border)" }}>
          {["info", "notes", "activity", "calls"].map((item) => (
            <button
              key={item}
              className={item === tab ? "btn-primary rounded-xl" : "btn-secondary rounded-xl"}
              onClick={() => setTab(item)}
              type="button"
            >
              {item === "notes"
                ? `Notes (${lead.notes?.length || 0})`
                : item === "calls"
                ? `Calls${callHistory.length ? ` (${callHistory.length})` : ""}`
                : item[0].toUpperCase() + item.slice(1)}
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
              rows={6}
            />
            <div className="flex justify-end">
              <button className="btn-primary rounded-xl" onClick={handleNote} disabled={saving}>
                {saving ? <Spinner size="sm" /> : "Save Note"}
              </button>
            </div>
            {/* FB error notes still need to be surfaced for retry */}
            {(lead.notes || []).some(n => n.text?.includes(FB_ERROR_PATTERN)) && (
              <div className="space-y-3">
                {(lead.notes || []).filter(n => n.text?.includes(FB_ERROR_PATTERN)).map((item) => (
                  <div key={item._id || item.text} className="rounded-[1.25rem] p-4 border border-amber-400/30 bg-amber-50 dark:bg-amber-500/10">
                    <p className="text-sm text-app whitespace-pre-wrap break-words">{item.text}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-app-soft">{item.addedByName || "Unknown"} | {fmtDate(item.createdAt)}</p>
                      <button
                        onClick={handleRetryFacebook}
                        disabled={retrying}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition"
                        style={{ background: "var(--app-primary)" }}
                      >
                        {retrying ? <><Spinner size="sm" /> Fetching…</> : <><RefreshCw className="w-3 h-3" /> Retry Fetch</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "calls" && (
          <div className="space-y-3">
            {callsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-app-soft" />
              </div>
            ) : callHistory.length === 0 ? (
              <div className="rounded-[1.25rem] p-6 text-center stitch-surface-muted">
                <Phone className="w-8 h-8 mx-auto mb-2 text-app-soft opacity-40" />
                <p className="text-sm font-semibold text-app">No calls yet</p>
                <p className="text-xs text-app-soft mt-1">Use the Call button above to start a call with this lead.</p>
              </div>
            ) : callHistory.map((call) => {
              const meta   = call.meta || {};
              const st     = meta.status || "initiated";
              const stColor = st === "answered" ? "#22c55e" : st === "missed" ? "#ef4444" : "#f97316";
              const stBg    = st === "answered" ? "rgba(34,197,94,0.10)" : st === "missed" ? "rgba(239,68,68,0.10)" : "rgba(249,115,22,0.10)";
              const isOpen  = expandedCall === call.activityId;
              const dur     = meta.duration > 0
                ? `${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s`.replace("0m ", "")
                : null;

              return (
                <div key={call.activityId} className="rounded-[1.25rem] overflow-hidden stitch-surface-muted">
                  {/* Row — always visible */}
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setExpandedCall(isOpen ? null : call.activityId)}
                    type="button"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: stBg }}>
                      {st === "missed"
                        ? <PhoneMissed className="w-3.5 h-3.5" style={{ color: stColor }} />
                        : <Phone       className="w-3.5 h-3.5" style={{ color: stColor }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{ background: stBg, color: stColor }}>{st}</span>
                        {dur && <span className="text-xs font-semibold text-app">{dur}</span>}
                        {meta.recordingUrl && <Mic      className="w-3 h-3 text-orange-400" />}
                        {meta.summary      && <Sparkles className="w-3 h-3 text-indigo-400" />}
                        {meta.notes        && <FileText className="w-3 h-3 text-app-soft"   />}
                      </div>
                      <p className="text-xs text-app-soft mt-0.5">
                        {fmtDateTime(call.createdAt)}{call.performedBy ? ` · ${call.performedBy}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-app-soft font-medium">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--app-border)" }}>
                      {/* Call back */}
                      {st === "missed" && (
                        <button
                          onClick={async () => {
                            setCalling(true);
                            try {
                              await api.post("/calls/initiate", { leadId: lead._id });
                              toast.success("Calling back — check your phone.");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Call failed");
                            } finally { setCalling(false); }
                          }}
                          disabled={calling}
                          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                          type="button"
                        >
                          {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneMissed className="w-4 h-4" />}
                          Call Back Now
                        </button>
                      )}

                      {/* Recording */}
                      {meta.recordingUrl ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1.5 flex items-center gap-1">
                            <Mic className="w-3 h-3" /> Recording
                          </p>
                          <audio controls src={meta.recordingUrl} className="w-full h-8" />
                        </div>
                      ) : st === "answered" && (
                        <p className="text-xs text-app-soft mt-3 flex items-center gap-1.5">
                          <Mic className="w-3 h-3 opacity-40" />
                          Recording will appear once uploaded by the recording server.
                        </p>
                      )}

                      {/* AI Summary */}
                      {meta.summary && (
                        <div className="rounded-xl p-3" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Summary</span>
                          </div>
                          <p className="text-xs text-app leading-relaxed">{meta.summary}</p>
                        </div>
                      )}

                      {/* Transcript */}
                      {meta.transcript && (
                        <details>
                          <summary className="text-xs font-semibold text-app-soft hover:text-app transition cursor-pointer flex items-center gap-1.5 select-none">
                            <AlignLeft className="w-3 h-3" /> View Transcript
                          </summary>
                          <p className="mt-1.5 text-xs text-app-soft leading-relaxed whitespace-pre-wrap">{meta.transcript}</p>
                        </details>
                      )}

                      {/* Call Notes */}
                      {meta.notes && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-app-soft mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Notes
                          </p>
                          <p className="text-xs text-app whitespace-pre-wrap">{meta.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {(lead.activities || []).length === 0 && <p className="text-sm text-app-soft">No activity yet.</p>}
            {(lead.activities || []).slice().reverse().map((item) => {
              const isCall = item.type === "called";
              const meta   = item.meta || {};
              const sentiment = meta.sentiment;
              const sentimentColor = sentiment === "positive" ? "#22c55e" : sentiment === "negative" ? "#ef4444" : "#a1a1aa";
              const sentimentLabel = sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Negative" : "Neutral";

              return (
                <div key={item._id || `${item.type}-${item.createdAt}`} className="rounded-[1.25rem] p-4 stitch-surface-muted overflow-hidden">
                  <div className="flex items-start gap-2">
                    {isCall && <Phone className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app break-words">{item.description}</p>
                      <p className="mt-1 text-xs text-app-soft">
                        {item.performedByName || item.performedBy?.name || "System"} | {fmtDate(item.createdAt)}
                        {isCall && meta.status && (
                          <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: meta.status === "answered" ? "rgba(34,197,94,0.12)" : meta.status === "missed" ? "rgba(239,68,68,0.1)" : "rgba(161,161,170,0.12)",
                              color: meta.status === "answered" ? "#22c55e" : meta.status === "missed" ? "#ef4444" : "#a1a1aa",
                            }}>
                            {meta.status}
                          </span>
                        )}
                        {isCall && meta.sentiment && (
                          <span className="ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: `${sentimentColor}18`, color: sentimentColor }}>
                            {sentimentLabel}
                          </span>
                        )}
                      </p>

                      {/* Recording player */}
                      {isCall && meta.recordingUrl && (
                        <div className="mt-2">
                          <audio controls src={meta.recordingUrl} className="w-full h-8" style={{ maxWidth: "100%" }} />
                        </div>
                      )}

                      {/* AI Summary */}
                      {isCall && meta.summary && (
                        <div className="mt-2 rounded-xl p-3" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Summary</span>
                          </div>
                          <p className="text-xs text-app leading-relaxed">{meta.summary}</p>
                        </div>
                      )}

                      {/* Transcript (collapsible) */}
                      {isCall && meta.transcript && (
                        <details className="mt-2">
                          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition select-none">
                            <AlignLeft className="w-3 h-3" /> View Transcript
                          </summary>
                          <p className="mt-1.5 text-xs text-app-soft leading-relaxed whitespace-pre-wrap">{meta.transcript}</p>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
