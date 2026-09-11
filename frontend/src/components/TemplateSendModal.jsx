import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Send, Plus, Info } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Modal } from "./UI";
import CustomSelect from "./CustomSelect";

const CATEGORY_CREDIT = { MARKETING: "marketing", UTILITY: "utility", AUTHENTICATION: "authentication" };
const rupees = (p) => `₹${((p || 0) / 100).toFixed(2)}`;
const bodyOf = (t) => ((t?.components || []).find((c) => c.type === "BODY") || {}).text || "";
const varCount = (text) => new Set((text.match(/\{\{\s*\d+\s*\}\}/g) || []).map((m) => m.replace(/\D/g, ""))).size;

/**
 * Send one approved template into a conversation.
 *
 * This is what the composer's lightning button opens, and the only way to
 * reach someone once WhatsApp's 24-hour reply window has closed — a normal
 * reply at that point is simply rejected by Meta.
 */
export default function TemplateSendModal({ open, onClose, conversation, credits, onSent, onNeedCredits }) {
  const navigate = useNavigate();
  const [list, setList]       = useState(null);
  const [error, setError]     = useState("");
  const [name, setName]       = useState("");
  const [values, setValues]   = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    api.get("/whatsapp/templates")
      .then((r) => setList((r.data.templates || []).filter((t) => t.status === "APPROVED")))
      .catch((e) => { setList([]); setError(e.response?.data?.message || "Could not load templates."); });
  }, [open]);

  const tpl = useMemo(() => (list || []).find((t) => t.name === name), [list, name]);
  const body = bodyOf(tpl);
  const n = varCount(body);

  // {{1}} is almost always a greeting name, so start it on the contact's first
  // name rather than an empty box.
  useEffect(() => {
    if (!tpl) return;
    const first = String(conversation?.contactName || "").trim().split(/\s+/)[0] || "";
    setValues(Array.from({ length: n }, (_, i) => (i === 0 ? first : "")));
  }, [tpl, n, conversation?.contactName]);

  const rendered = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, k) => values[Number(k) - 1] || `[value ${k}]`);
  const credit = CATEGORY_CREDIT[String(tpl?.category || "").toUpperCase()] || "marketing";
  const rate = credits?.ratesPaise?.[credit];
  const ready = tpl && values.every((v) => String(v).trim());

  const send = async () => {
    if (!ready || sending) return;
    setSending(true);
    try {
      const { data } = await api.post("/whatsapp/send-template", {
        conversationId: conversation._id, templateName: tpl.name, values,
      });
      toast.success("Template sent");
      onSent?.(data.message);
      onClose?.();
    } catch (e) {
      if (e.response?.status === 402) { onClose?.(); onNeedCredits?.(); return; }
      toast.error(e.response?.data?.message || "Could not send the template", { duration: 8000 });
    } finally { setSending(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send a template" size="md">
      {list === null ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-app-soft" /></div>
      ) : error ? (
        <p className="text-sm text-app-soft py-6 text-center">{error}</p>
      ) : list.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-bold text-app">No approved templates yet</p>
          <p className="text-xs text-app-soft mt-1 max-w-xs mx-auto">
            A template has to be approved by Meta before it can be sent. Approval usually takes minutes.
          </p>
          <button onClick={() => { onClose?.(); navigate("/conversations/templates/new"); }}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 mt-4">
            <Plus className="w-4 h-4" /> Create a template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Template</label>
            <CustomSelect value={name} onChange={setName} placeholder="Choose an approved template"
              options={list.map((t) => ({ value: t.name, label: `${t.name} · ${(t.category || "").toLowerCase()}` }))}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
          </div>

          {tpl && n > 0 && (
            <div className="space-y-2.5">
              {values.map((v, i) => (
                <div key={i}>
                  <label className="text-xs font-semibold text-app-soft mb-1 block font-mono">{`{{${i + 1}}}`}</label>
                  <input className="input w-full" value={v}
                    onChange={(e) => setValues((vs) => { const c = [...vs]; c[i] = e.target.value; return c; })} />
                </div>
              ))}
            </div>
          )}

          {tpl && (
            <div className="rounded-2xl p-3" style={{ background: "var(--app-bg)" }}>
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-[4px] px-3.5 py-2.5" style={{ background: "#dcf8c6", color: "#111" }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{rendered}</p>
              </div>
            </div>
          )}

          {tpl && (
            <p className="text-xs text-app-soft flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {credits?.billedDirectlyByMeta
                  ? "Billed directly to your Meta account, not through credits."
                  : <>{rate != null ? `Costs ${rupees(rate)} as a ${credit} message. ` : ""}Free monthly replies do not apply to templates.</>}
              </span>
            </p>
          )}

          <button onClick={send} disabled={!ready || sending}
            className="btn-primary w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Send template"}
          </button>
        </div>
      )}
    </Modal>
  );
}
