import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send, Info } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CustomSelect from "../../components/CustomSelect";

const CATEGORIES = [
  { value: "MARKETING",      label: "Marketing — offers, launches, re-engagement" },
  { value: "UTILITY",        label: "Utility — updates about something they did" },
  { value: "AUTHENTICATION", label: "Authentication — one-time codes" },
];

const LANGUAGES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "hi",    label: "Hindi" },
  { value: "mr",    label: "Marathi" },
  { value: "gu",    label: "Gujarati" },
];

// Real-estate starting points. A blank box is where most non-technical users
// stop, and every one of these still goes through Meta review unchanged.
const PRESETS = [
  {
    label: "New project launch",
    category: "MARKETING",
    body: "Hi {{1}}, we have just launched {{2}} in {{3}}. Limited units available with early-bird pricing. Reply here and our team will share the floor plans and price list.",
  },
  {
    label: "Site visit reminder",
    category: "UTILITY",
    body: "Hi {{1}}, this is a reminder about your site visit to {{2}} on {{3}}. Reply here if you need to reschedule.",
  },
  {
    label: "Price update",
    category: "MARKETING",
    body: "Hi {{1}}, prices for {{2}} are being revised from {{3}}. Book now to lock the current rate. Reply here to know more.",
  },
];

const varCount = (text) =>
  new Set((text.match(/\{\{\s*\d+\s*\}\}/g) || []).map(m => m.replace(/\D/g, ""))).size;

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const [name, setName]         = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody]         = useState("");
  const [footer, setFooter]     = useState("");
  const [saving, setSaving]     = useState(false);

  const vars = useMemo(() => varCount(body), [body]);

  // Meta rejects anything that is not lowercase/digits/underscore, so normalise
  // as they type rather than failing on submit.
  const onName = (v) => setName(v.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+/, "").slice(0, 60));

  const applyPreset = (p) => {
    setCategory(p.category);
    setBody(p.body);
    if (!name) onName(p.label);
  };

  const submit = async () => {
    if (!name)        return toast.error("Give the template a name");
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

  // Rendered preview with placeholders filled by example values, so the shape
  // of the real message is visible before it is submitted.
  const preview = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => `[value ${n}]`);

  return (
    <div className="stitch-page">
      <button onClick={() => navigate("/conversations/templates")}
        className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Templates
      </button>

      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">New template</h1>
        <p className="text-xs text-app-soft">
          Meta reviews every template. Approval usually takes minutes but can take up to 24 hours.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Start from</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" onClick={() => applyPreset(p)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Template name</label>
              <input className="input w-full" placeholder="new_project_launch"
                value={name} onChange={e => onName(e.target.value)} />
              <p className="text-xs text-app-soft mt-1">Lowercase, numbers and underscores. Cannot be changed later.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Category</label>
                <CustomSelect
                  value={category} onChange={setCategory} options={CATEGORIES}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Language</label>
                <CustomSelect
                  value={language} onChange={setLanguage} options={LANGUAGES}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
                />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Message body</label>
              <textarea className="input w-full resize-none" rows={6}
                placeholder="Hi {{1}}, we have just launched {{2}}..."
                value={body} onChange={e => setBody(e.target.value)} maxLength={1024} />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-app-soft">
                  Use <code className="text-app">{"{{1}}"}</code>, <code className="text-app">{"{{2}}"}</code> for
                  values filled per recipient.
                </p>
                <span className="text-xs text-app-soft">{body.length}/1024</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Footer <span className="font-normal">(optional)</span>
              </label>
              <input className="input w-full" placeholder="Reply STOP to opt out"
                value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} />
            </div>
          </div>

          <button onClick={submit} disabled={saving || !name || !body.trim()}
            className="btn-primary rounded-full px-6 py-3 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {saving ? "Submitting…" : "Submit for review"}
          </button>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 self-start w-full">
          <div className="card p-4">
            <p className="text-xs font-semibold text-app-soft mb-3">Preview</p>
            <div className="rounded-2xl p-3" style={{ background: "var(--app-surface-low)" }}>
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-full"
                style={{ background: "#dcf8c6", color: "#111" }}>
                <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">
                  {preview || "Your message will appear here"}
                </p>
                {footer && <p className="text-[11px] mt-1.5 opacity-60">{footer}</p>}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-app-soft flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {vars === 0
                    ? "No variables — every recipient gets identical text."
                    : `${vars} variable${vars > 1 ? "s" : ""} to fill per recipient when you run a campaign.`}
                </span>
              </p>
              {category === "MARKETING" && (
                <p className="text-[11px] text-app-soft">
                  Marketing templates need recorded consent before sending, and cost more per message than utility.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
