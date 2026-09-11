import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send, Info, CheckCircle2, AlertTriangle, Zap, Plus } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CustomSelect from "../../components/CustomSelect";

const CATEGORIES = [
  { value: "MARKETING",      label: "Marketing" },
  { value: "UTILITY",        label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

const LANGUAGES = [
  { value: "en_US", label: "English (US) — en_US" },
  { value: "en_GB", label: "English (UK) — en_GB" },
  { value: "hi",    label: "Hindi — hi" },
  { value: "mr",    label: "Marathi — mr" },
  { value: "gu",    label: "Gujarati — gu" },
];

// Real-estate starting points. A blank box is where most non-technical users
// stop; every one of these still goes through Meta review unchanged.
const PRESETS = [
  { key: "launch", label: "New project launch", category: "MARKETING",
    body: "Hi {{1}}, we have just launched {{2}} in {{3}}. Limited units available with early-bird pricing. Reply here and our team will share the floor plans and price list." },
  { key: "visit", label: "Site visit reminder", category: "UTILITY",
    body: "Hi {{1}}, this is a reminder about your site visit to {{2}} on {{3}}. Reply here if you need to reschedule." },
  { key: "price", label: "Price update", category: "MARKETING",
    body: "Hi {{1}}, prices for {{2}} are being revised from {{3}}. Book now to lock the current rate. Reply here to know more." },
];

const VAR_RX = /\{\{\s*(\d+)\s*\}\}/g;
const varNumbers = (text) => [...new Set((text.match(VAR_RX) || []).map((m) => Number(m.replace(/\D/g, ""))))].sort((a, b) => a - b);
const NAME_OK = /^[a-z0-9][a-z0-9_]*$/;

const nowClock = () => new Date()
  .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
  .replace(/am|pm/i, (m) => m.toUpperCase());

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const bodyRef = useRef(null);
  const [name, setName]         = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody]         = useState("");
  const [footer, setFooter]     = useState("");
  const [saving, setSaving]     = useState(false);

  const vars = useMemo(() => varNumbers(body), [body]);
  const nextVar = (vars[vars.length - 1] || 0) + 1;
  const activePreset = PRESETS.find((p) => p.body === body)?.key;
  const nameValid = NAME_OK.test(name);

  // Meta rejects anything that is not lowercase/digits/underscore, so normalise
  // as they type rather than failing on submit.
  const onName = (v) => setName(v.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+/, "").slice(0, 60));

  const applyPreset = (p) => {
    setCategory(p.category);
    setBody(p.body);
    if (!name) onName(p.label);
  };

  // Insert a placeholder where the cursor is, not at the end — that is where
  // the person was writing.
  const insertVar = (n) => {
    const token = `{{${n}}}`;
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next.slice(0, 1024));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = async () => {
    if (!nameValid)   return toast.error("Give the template a valid name");
    if (!body.trim()) return toast.error("Add the message body");
    setSaving(true);
    try {
      const components = [{ type: "BODY", text: body.trim() }];
      if (footer.trim()) components.push({ type: "FOOTER", text: footer.trim() });
      await api.post("/whatsapp/templates", { name, category, language, components });
      toast.success("Submitted to Meta for review");
      navigate("/conversations/templates");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not submit", { duration: 8000 });
    } finally { setSaving(false); }
  };

  const previewParts = body ? body.split(/(\{\{\s*\d+\s*\}\})/) : [];

  return (
    <div className="stitch-page">
      <button onClick={() => navigate("/conversations/templates")}
        className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Templates
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app">New template</h1>
        <p className="text-xs text-app-soft mt-0.5">
          Meta reviews every template. Approval usually takes minutes but can take up to 24 hours.
        </p>
      </div>

      {/* Form, preview, submit — on phones the preview sits between the form
          and the submit button so you see what you are sending before you send. */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          <div className="card p-5 space-y-4">
            <div>
              <p className="stitch-kicker mb-2">Start from</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" onClick={() => applyPreset(p)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                    style={activePreset === p.key
                      ? { background: "rgba(var(--app-primary-rgb),0.12)", border: "1px solid rgba(var(--app-primary-rgb),0.4)", color: "var(--app-primary)" }
                      : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="stitch-kicker mb-2">Template name</p>
              <div className="relative">
                <input className="input w-full pr-10 font-mono" placeholder="site_visit_reminder_v2"
                  value={name} onChange={(e) => onName(e.target.value)} />
                {nameValid && (
                  <CheckCircle2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#15803d" }} />
                )}
              </div>
              <p className="text-xs text-app-soft mt-1">Lowercase, numbers and underscores. Cannot be changed later.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="stitch-kicker mb-2">Category</p>
                <CustomSelect value={category} onChange={setCategory} options={CATEGORIES}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
              <div>
                <p className="stitch-kicker mb-2">Language</p>
                <CustomSelect value={language} onChange={setLanguage} options={LANGUAGES}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }} />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="stitch-kicker">Message body</p>
                <span className="text-[10px] font-semibold text-app-soft">Required</span>
              </div>
              <textarea ref={bodyRef} className="input w-full resize-none" rows={6}
                placeholder="Hi {{1}}, this is a quick reminder for your site visit to {{2}}…"
                value={body} onChange={(e) => setBody(e.target.value)} maxLength={1024} />
              <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-app-soft">Add variable:</span>
                  {vars.map((n) => (
                    <button key={n} type="button" onClick={() => insertVar(n)}
                      className="font-mono text-[11px] px-2 py-0.5 rounded-md transition"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                      {`{{${n}}}`}
                    </button>
                  ))}
                  <button type="button" onClick={() => insertVar(nextVar)}
                    className="font-mono text-[11px] px-2 py-0.5 rounded-md flex items-center gap-0.5 transition"
                    style={{ background: "rgba(var(--app-primary-rgb),0.10)", color: "var(--app-primary)" }}>
                    <Plus className="w-3 h-3" />{`{{${nextVar}}}`}
                  </button>
                </div>
                <span className="text-xs text-app-soft tabular-nums">{body.length}/1024</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="stitch-kicker">Footer (optional)</p>
                <span className="text-[10px] font-semibold text-app-soft">Max 60 chars</span>
              </div>
              <input className="input w-full" placeholder="Reply STOP to unsubscribe"
                value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} />
              <p className="text-xs text-app-soft mt-1">Shown in small muted text at the bottom of the WhatsApp message.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 self-start w-full lg:sticky lg:top-4 space-y-3">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="stitch-kicker">Preview</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} /> Live preview
              </span>
            </div>
            <div className="rounded-2xl p-3" style={{ background: "var(--app-bg)" }}>
              <div className="flex justify-center mb-2.5">
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-app-soft"
                  style={{ background: "var(--app-card-solid)", border: "1px solid var(--app-border)" }}>Today</span>
              </div>
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-[4px] px-3.5 py-2.5" style={{ background: "#dcf8c6", color: "#111" }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                  {previewParts.length ? previewParts.map((part, i) => {
                    const m = part.match(/^\{\{\s*(\d+)\s*\}\}$/);
                    return m ? (
                      <span key={i} className="font-mono text-[11px] font-semibold px-1 py-px rounded"
                        style={{ background: "rgba(0,0,0,0.08)" }}>value {m[1]}</span>
                    ) : <span key={i}>{part}</span>;
                  }) : <span className="opacity-50">Your message will appear here</span>}
                </p>
                {footer && <p className="text-[11px] mt-1.5 opacity-60">{footer}</p>}
                <p className="text-[10px] opacity-50 text-right mt-1">{nowClock()}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-app-soft flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {vars.length === 0
                    ? "No variables — every recipient gets identical text."
                    : `${vars.length} variable${vars.length > 1 ? "s" : ""} to fill per recipient when you run a campaign.`}
                </span>
              </p>
              {category === "MARKETING" && (
                <p className="text-[11px] px-2.5 py-2 rounded-xl flex items-start gap-1.5"
                  style={{ background: "rgba(251,191,36,0.10)", color: "#b45309", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>Marketing templates need recorded consent before sending, and cost more per message than utility.</span>
                </p>
              )}
            </div>
          </div>

          <div className="card p-4">
            <p className="text-xs font-bold text-app flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} /> Review time
            </p>
            <p className="text-[11px] text-app-soft mt-1 leading-relaxed">
              Meta reviews every template — usually within minutes, occasionally up to 24 hours. You can
              see the result on the Templates tab.
            </p>
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <button onClick={submit} disabled={saving || !nameValid || !body.trim()}
            className="btn-primary rounded-full px-6 py-3 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {saving ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}
