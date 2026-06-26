import { useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Megaphone, Send, Users, CheckCircle2 } from "lucide-react";
import { Spinner } from "../components/UI";
import { useEffect } from "react";

const TARGETS = [
  { value: "all",        label: "All Org Admins",          desc: "Send to every organisation's admin" },
  { value: "trial",      label: "Trial Orgs Only",         desc: "Orgs still on the free trial" },
  { value: "starter",    label: "Starter Plan",            desc: "Orgs on the Starter plan" },
  { value: "growth",     label: "Growth Plan",             desc: "Orgs on the Growth plan" },
  { value: "enterprise", label: "Enterprise Plan",         desc: "Orgs on the Enterprise plan" },
];

export default function SuperAdminBroadcast() {
  const [subject,   setSubject]   = useState("");
  const [message,   setMessage]   = useState("");
  const [target,    setTarget]    = useState("all");
  const [sending,   setSending]   = useState(false);
  const [result,    setResult]    = useState(null);

  useEffect(() => { document.title = "Broadcast · Arthaleads Admin"; }, []);

  const handleSend = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (!message.trim()) { toast.error("Message is required"); return; }
    if (!window.confirm(`Send this email to ${TARGETS.find(t => t.value === target)?.label}?`)) return;

    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post("/super-admin/broadcast", {
        subject: subject.trim(),
        message: message.trim(),
        targetPlan: target,
      });
      setResult(data);
      toast.success(`Sent to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stitch-page max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
          <Megaphone className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-app">Broadcast Email</h1>
          <p className="text-xs text-app-soft mt-0.5">Send an announcement to all organisation admins</p>
        </div>
      </div>

      {/* Success result */}
      {result && (
        <div className="card p-5 mb-5 flex items-center gap-4"
          style={{ border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}>
          <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-app text-sm">Broadcast sent successfully</p>
            <p className="text-xs text-app-soft mt-0.5">
              {result.sent} delivered · {result.failed} failed · {result.total} total recipients
            </p>
          </div>
        </div>
      )}

      <div className="card p-6 space-y-5">
        {/* Audience */}
        <div>
          <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-2">
            Target Audience
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TARGETS.map(t => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className="flex items-start gap-3 p-3 rounded-2xl border text-left transition cursor-pointer"
                style={{
                  background: target === t.value ? "rgba(var(--app-primary-rgb),0.08)" : "var(--app-surface-low)",
                  borderColor: target === t.value ? "var(--app-primary)" : "var(--app-border)",
                }}
              >
                <div className="w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: target === t.value ? "var(--app-primary)" : "var(--app-border)" }}>
                  {target === t.value && (
                    <div className="w-2 h-2 rounded-full" style={{ background: "var(--app-primary)" }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-app">{t.label}</p>
                  <p className="text-[11px] text-app-soft mt-0.5">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-1.5">
            Email Subject
          </label>
          <input
            className="input w-full"
            placeholder="e.g. New feature: Attendance tracking is live!"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={200}
          />
          <p className="text-[10px] text-app-soft text-right mt-0.5">{subject.length}/200</p>
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-bold text-app-soft uppercase tracking-wide mb-1.5">
            Message Body
          </label>
          <textarea
            className="input w-full resize-none font-mono text-sm"
            rows={10}
            placeholder={"Hi {name},\n\nWe're excited to announce…\n\nBest regards,\nTeam Arthaleads"}
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={5000}
          />
          <p className="text-[10px] text-app-soft text-right mt-0.5">{message.length}/5000</p>
        </div>

        {/* Preview box */}
        {(subject || message) && (
          <div>
            <p className="text-xs font-bold text-app-soft uppercase tracking-wide mb-2">Preview</p>
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <p className="text-xs text-app-soft">Subject: <strong className="text-app">{subject || "—"}</strong></p>
              <hr style={{ borderColor: "var(--app-border)" }} />
              <pre className="text-xs text-app whitespace-pre-wrap font-sans leading-relaxed">
                {message || "—"}
              </pre>
            </div>
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={{ background: "var(--app-primary)" }}
          >
            {sending ? <><Spinner size="sm" /> Sending…</> : <><Send className="w-4 h-4" /> Send Broadcast</>}
          </button>
          <p className="text-xs text-app-soft">
            Sends to <strong className="text-app">{TARGETS.find(t => t.value === target)?.label}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
