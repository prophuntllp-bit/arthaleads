import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Loader2, Send, Info, CheckCircle2, AlertTriangle, Zap, Plus, X, Compass, XCircle,
  Sparkles, Building2,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CustomSelect from "../../components/CustomSelect";
import { lintTemplate, hasBlockers, varNumbers } from "../../utils/templateLint";
import { VAR_LABELS } from "../../data/templateGallery";

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

const FORM_SELECT = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };
const SMALL_SELECT = { width: "100%", padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 };

const TONES = [
  { value: "normal",   label: "Normal" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent",   label: "Direct" },
  { value: "formal",   label: "Formal" },
];

const OPTIMISE = [
  { value: "replies", label: "Getting a reply" },
  { value: "clicks",  label: "Getting a tap" },
];

const BUTTON_KINDS = [
  { type: "QUICK_REPLY",  label: "Quick reply", max: 10, blank: { type: "QUICK_REPLY", text: "" } },
  { type: "URL",          label: "Link",        max: 2,  blank: { type: "URL", text: "", url: "" } },
  { type: "PHONE_NUMBER", label: "Call",        max: 1,  blank: { type: "PHONE_NUMBER", text: "", phone_number: "" } },
];

const nowClock = () => new Date()
  .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
  .replace(/am|pm/i, (m) => m.toUpperCase());

const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+/, "").slice(0, 60);

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const bodyRef = useRef(null);
  const preset = location.state?.preset || null;

  const [name, setName]         = useState(preset ? slugify(preset.key) : "");
  const [category, setCategory] = useState(preset?.category || "MARKETING");
  const [language, setLanguage] = useState(preset?.language || "en_US");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody]         = useState(preset?.body || "");
  const [footer, setFooter]     = useState(preset?.footer || "");
  const [examples, setExamples] = useState(preset?.example || []);
  const [buttons, setButtons]   = useState(preset?.buttons ? preset.buttons.map((b) => ({ ...b })) : []);
  const [saving, setSaving]     = useState(false);
  const [existingNames, setExistingNames] = useState([]);

  // Which CRM field each {{n}} is meant to hold. Comes from a gallery preset or
  // an AI variant; drives the labels beside the sample values.
  const [varMap, setVarMap] = useState(preset?.varMap || []);

  const [aiPrompt, setAiPrompt]     = useState("");
  const [aiTone, setAiTone]         = useState("normal");
  const [aiOptimise, setAiOptimise] = useState("replies");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants]     = useState(null);
  const [projectsUsed, setProjectsUsed] = useState(0);
  const [aiError, setAiError]       = useState("");

  // Only used to catch a duplicate name before Meta does. A failure here is not
  // worth surfacing — the submit itself will still report it.
  useEffect(() => {
    api.get("/whatsapp/templates")
      .then((r) => setExistingNames((r.data.templates || []).map((t) => t.name)))
      .catch(() => {});
  }, []);

  const vars = useMemo(() => varNumbers(body), [body]);
  const nextVar = (vars[vars.length - 1] || 0) + 1;

  const issues = useMemo(
    () => lintTemplate({ name, category, body, footer, headerText, examples, buttons }, { existingNames }),
    [name, category, body, footer, headerText, examples, buttons, existingNames]
  );
  const blocked = hasBlockers(issues);
  const blockers = issues.filter((i) => i.level === "block");
  const warnings = issues.filter((i) => i.level === "warn");

  const onName = (v) => setName(slugify(v));

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

  const generate = async () => {
    if (!aiPrompt.trim()) return toast.error("Describe what the message should say");
    setGenerating(true); setAiError("");
    try {
      const { data } = await api.post("/whatsapp/templates/generate", {
        prompt: aiPrompt, category, tone: aiTone, optimizeFor: aiOptimise,
      });
      setVariants(data.variants || []);
      setProjectsUsed(data.projectsUsed || 0);
    } catch (e) {
      // 429 already raises its own toast from the api interceptor.
      if (e.response?.status !== 429) {
        setAiError(e.response?.data?.message || "Could not generate templates.");
      }
    } finally { setGenerating(false); }
  };

  // Fills the form from a variant. Nothing is submitted — it lands as an
  // ordinary draft the person can edit, and the linter re-runs over it.
  const useVariant = (v) => {
    const taken = new Set(existingNames);
    let candidate = v.name;
    for (let i = 2; taken.has(candidate); i++) candidate = `${v.name}_${i}`.slice(0, 60);
    setName(candidate);
    setBody(v.body);
    setFooter(v.footer || "");
    setExamples(v.example || []);
    setVarMap(v.varMap || []);
    setButtons((v.buttons || []).map((b) => ({ ...b })));
    setVariants(null);
    toast.success("Loaded into the form — edit anything before submitting");
  };

  const setExample = (i, v) => setExamples((e) => { const n = [...e]; n[i] = v; return n; });
  const addButton = (kind) => setButtons((b) => [...b, { ...kind.blank }]);
  const setButton = (i, patch) => setButtons((b) => { const n = [...b]; n[i] = { ...n[i], ...patch }; return n; });
  const dropButton = (i) => setButtons((b) => b.filter((_, x) => x !== i));

  const submit = async () => {
    if (blocked) return toast.error(blockers[0].message, { duration: 6000 });
    setSaving(true);
    try {
      const components = [];
      if (headerText.trim()) {
        components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
      }
      const bodyComp = { type: "BODY", text: body.trim() };
      // Meta rejects any template with variables that does not carry sample
      // values, which is why this page used to get templates rejected.
      if (vars.length) {
        bodyComp.example = { body_text: [vars.map((_, i) => String(examples[i] ?? "").trim())] };
      }
      components.push(bodyComp);
      if (footer.trim()) components.push({ type: "FOOTER", text: footer.trim() });
      if (buttons.length) {
        components.push({
          type: "BUTTONS",
          buttons: buttons.map((b) =>
            b.type === "URL" ? { type: "URL", text: b.text.trim(), url: b.url.trim() }
            : b.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: b.text.trim(), phone_number: b.phone_number.trim() }
            : { type: "QUICK_REPLY", text: b.text.trim() }
          ),
        });
      }
      await api.post("/whatsapp/templates", { name, category, language, components });
      toast.success("Submitted to Meta for review");
      navigate("/conversations/templates");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not submit", { duration: 8000 });
    } finally { setSaving(false); }
  };

  // The preview substitutes the real sample values, so what you read is what a
  // recipient reads — not "value 1".
  const previewParts = body ? body.split(/(\{\{\s*\d+\s*\}\})/) : [];
  const usedKinds = (type) => buttons.filter((b) => b.type === type).length;

  return (
    <div className="stitch-page">
      <button onClick={() => navigate("/conversations/templates")}
        className="flex items-center gap-1.5 text-sm text-app-soft hover:text-app transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Templates
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app">{preset ? preset.title : "New template"}</h1>
        <p className="text-xs text-app-soft mt-0.5">
          Meta reviews every template. Approval usually takes minutes but can take up to 24 hours.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          {!preset && (
            <div className="card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
                <Compass className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-app">Starting from scratch?</p>
                <p className="text-xs text-app-soft mt-0.5">
                  There are ready-made templates for every lead stage, with the blanks already wired to your CRM fields.
                </p>
              </div>
              <button onClick={() => navigate("/conversations/templates")}
                className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold shrink-0">Browse</button>
            </div>
          )}

          <div className="card p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-app">Write it with AI</p>
                <p className="text-xs text-app-soft mt-0.5">
                  Describe the message in plain English. You get three versions to choose from, written
                  around your real projects.
                </p>
              </div>
            </div>

            <textarea className="input w-full resize-none" rows={3}
              placeholder="e.g. invite leads who visited last month to the new tower launch, mention the early-bird price"
              value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} maxLength={1000} />

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <p className="stitch-kicker mb-1.5">Tone</p>
                <CustomSelect value={aiTone} onChange={setAiTone} options={TONES} style={SMALL_SELECT} />
              </div>
              <div>
                <p className="stitch-kicker mb-1.5">Optimise for</p>
                <CustomSelect value={aiOptimise} onChange={setAiOptimise} options={OPTIMISE} style={SMALL_SELECT} />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={generate} disabled={generating || !aiPrompt.trim()}
                className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Writing three versions…" : "Generate"}
              </button>
              <p className="text-[11px] text-app-soft">Generates as {category.toLowerCase()}. Nothing is submitted automatically.</p>
            </div>

            {aiError && (
              <p className="text-[11px] px-2.5 py-2 rounded-xl flex items-start gap-1.5"
                style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" }}>
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{aiError}</span>
              </p>
            )}

            {variants && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="stitch-kicker">
                    {variants.length} version{variants.length === 1 ? "" : "s"} — pick one to edit
                  </p>
                  {projectsUsed > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>
                      <Building2 className="w-3 h-3" /> using {projectsUsed} of your projects
                    </span>
                  )}
                </div>

                {variants.length === 0 ? (
                  <p className="text-xs text-app-soft">
                    Nothing came back that Meta would accept. Try describing the message differently.
                  </p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {variants.map((v, vi) => (
                      <div key={vi} className="rounded-2xl p-3 flex flex-col gap-2"
                        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
                        <p className="text-[11px] font-mono font-bold text-app-soft truncate">{v.name}</p>
                        <div className="rounded-xl px-3 py-2.5 flex-1" style={{ background: "#dcf8c6", color: "#111" }}>
                          <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words">
                            {v.body.split(/(\{\{\s*\d+\s*\}\})/).map((part, i) => {
                              const m = part.match(/^\{\{\s*(\d+)\s*\}\}$/);
                              if (!m) return <span key={i}>{part}</span>;
                              return <span key={i} className="font-bold">{v.example?.[Number(m[1]) - 1] || `value ${m[1]}`}</span>;
                            })}
                          </p>
                          {v.footer && <p className="text-[10px] mt-1.5 opacity-60">{v.footer}</p>}
                        </div>
                        {!!v.buttons?.length && (
                          <div className="space-y-1">
                            {v.buttons.map((b, bi) => (
                              <div key={bi} className="rounded-lg py-1.5 text-center text-[11px] font-medium"
                                style={{ background: "#fff", color: "#00a5f4", border: "1px solid rgba(0,0,0,0.06)" }}>
                                {b.text}
                              </div>
                            ))}
                          </div>
                        )}
                        {!!v.varMap?.length && (
                          <p className="text-[10px] text-app-soft leading-relaxed">
                            Fills from: {v.varMap.map((f) => VAR_LABELS[f] || f).join(", ")}
                          </p>
                        )}
                        <button onClick={() => useVariant(v)}
                          className="btn-secondary rounded-full w-full py-2 text-xs font-bold">Use this</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <p className="stitch-kicker mb-2">Template name</p>
              <div className="relative">
                <input className="input w-full pr-10 font-mono" placeholder="site_visit_reminder_v2"
                  value={name} onChange={(e) => onName(e.target.value)} />
                {name && !blockers.some((b) => b.message.toLowerCase().includes("name")) && (
                  <CheckCircle2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#15803d" }} />
                )}
              </div>
              <p className="text-xs text-app-soft mt-1">Lowercase, numbers and underscores. Cannot be changed later.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="stitch-kicker mb-2">Category</p>
                <CustomSelect value={category} onChange={setCategory} options={CATEGORIES} style={FORM_SELECT} />
              </div>
              <div>
                <p className="stitch-kicker mb-2">Language</p>
                <CustomSelect value={language} onChange={setLanguage} options={LANGUAGES} style={FORM_SELECT} />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="stitch-kicker">Header (optional)</p>
                <span className="text-[10px] font-semibold text-app-soft">Max 60 chars</span>
              </div>
              <input className="input w-full" placeholder="Your site visit is confirmed"
                value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
              <p className="text-xs text-app-soft mt-1">Bold line above the message. Leave blank for none.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="stitch-kicker">Message body</p>
                <span className="text-[10px] font-semibold text-app-soft">Required</span>
              </div>
              <textarea ref={bodyRef} className="input w-full resize-none" rows={7}
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

            {vars.length > 0 && (
              <div>
                <p className="stitch-kicker mb-2">Sample values</p>
                <p className="text-xs text-app-soft mb-2.5">
                  Meta requires an example for every variable — it is how a reviewer reads the message.
                  {varMap.length > 0 && " These came with the template; edit them to match your business."}
                </p>
                <div className="space-y-2">
                  {vars.map((n, i) => {
                    const field = varMap?.[i];
                    return (
                      <div key={n} className="flex items-center gap-2.5 rounded-2xl p-2.5 stitch-surface-muted">
                        <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg shrink-0"
                          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>{`{{${n}}}`}</span>
                        {field && (
                          <span className="text-[11px] text-app-soft shrink-0 hidden sm:block">{VAR_LABELS[field] || field}</span>
                        )}
                        <input className="input flex-1 min-w-0" style={{ padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 }}
                          placeholder="e.g. Priya" value={examples[i] ?? ""} onChange={(e) => setExample(i, e.target.value)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="stitch-kicker">Footer (optional)</p>
                <span className="text-[10px] font-semibold text-app-soft">Max 60 chars</span>
              </div>
              <input className="input w-full" placeholder="Reply STOP to unsubscribe"
                value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} />
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div>
              <p className="stitch-kicker mb-1">Buttons (optional)</p>
              <p className="text-xs text-app-soft">
                Quick replies come back into your inbox as a message. Link and call buttons open on the recipient's phone.
              </p>
            </div>

            {buttons.map((b, i) => (
              <div key={i} className="rounded-2xl p-3 space-y-2 stitch-surface-muted">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
                    style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
                    {BUTTON_KINDS.find((k) => k.type === b.type)?.label || b.type}
                  </span>
                  <input className="input flex-1 min-w-0" style={{ padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 }}
                    placeholder="Button label" maxLength={25} value={b.text}
                    onChange={(e) => setButton(i, { text: e.target.value })} />
                  <button type="button" onClick={() => dropButton(i)}
                    className="p-1.5 rounded-lg text-app-soft hover:text-red-500 transition shrink-0" title="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {b.type === "URL" && (
                  <input className="input w-full" style={{ padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 }}
                    placeholder="https://yoursite.com/project" value={b.url}
                    onChange={(e) => setButton(i, { url: e.target.value })} />
                )}
                {b.type === "PHONE_NUMBER" && (
                  <input className="input w-full" style={{ padding: "8px 12px", borderRadius: "0.75rem", fontSize: 13 }}
                    placeholder="+919876543210" value={b.phone_number}
                    onChange={(e) => setButton(i, { phone_number: e.target.value })} />
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              {BUTTON_KINDS.map((kind) => {
                const full = usedKinds(kind.type) >= kind.max;
                return (
                  <button key={kind.type} type="button" disabled={full} onClick={() => addButton(kind)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 disabled:opacity-40"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                    <Plus className="w-3 h-3" /> {kind.label}
                    <span className="opacity-50 tabular-nums">{usedKinds(kind.type)}/{kind.max}</span>
                  </button>
                );
              })}
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
                {headerText && <p className="text-[13px] font-bold mb-1 break-words">{headerText}</p>}
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                  {previewParts.length ? previewParts.map((part, i) => {
                    const m = part.match(/^\{\{\s*(\d+)\s*\}\}$/);
                    if (!m) return <span key={i}>{part}</span>;
                    const sample = String(examples[Number(m[1]) - 1] ?? "").trim();
                    return sample
                      ? <span key={i} className="font-semibold">{sample}</span>
                      : <span key={i} className="font-mono text-[11px] font-semibold px-1 py-px rounded"
                          style={{ background: "rgba(0,0,0,0.08)" }}>value {m[1]}</span>;
                  }) : <span className="opacity-50">Your message will appear here</span>}
                </p>
                {footer && <p className="text-[11px] mt-1.5 opacity-60">{footer}</p>}
                <p className="text-[10px] opacity-50 text-right mt-1">{nowClock()}</p>
              </div>
              {buttons.length > 0 && (
                <div className="ml-auto max-w-[92%] mt-1 space-y-1">
                  {buttons.map((b, i) => (
                    <div key={i} className="rounded-xl py-2 text-center text-[13px] font-medium"
                      style={{ background: "#fff", color: "#00a5f4", border: "1px solid rgba(0,0,0,0.06)" }}>
                      {b.text || "Button"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(blockers.length > 0 || warnings.length > 0) && (
            <div className="card p-4 space-y-2">
              <p className="stitch-kicker mb-1">Before you submit</p>
              {blockers.map((b, i) => (
                <p key={`b${i}`} className="text-[11px] px-2.5 py-2 rounded-xl flex items-start gap-1.5"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{b.message}</span>
                </p>
              ))}
              {warnings.map((w, i) => (
                <p key={`w${i}`} className="text-[11px] px-2.5 py-2 rounded-xl flex items-start gap-1.5"
                  style={{ background: "rgba(251,191,36,0.10)", color: "#b45309", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{w.message}</span>
                </p>
              ))}
            </div>
          )}

          <div className="card p-4">
            <p className="text-xs font-bold text-app flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} /> Review time
            </p>
            <p className="text-[11px] text-app-soft mt-1 leading-relaxed">
              Meta reviews every template — usually within minutes, occasionally up to 24 hours. You can
              see the result on the Templates tab.
            </p>
            <p className="text-[11px] text-app-soft mt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {vars.length === 0
                  ? "No variables — every recipient gets identical text."
                  : `${vars.length} variable${vars.length > 1 ? "s" : ""} filled per recipient when you run a campaign.`}
              </span>
            </p>
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <button onClick={submit} disabled={saving || blocked}
            className="btn-primary rounded-full px-6 py-3 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {saving ? "Submitting…" : "Submit for review"}
          </button>
          {blocked && (
            <p className="text-xs text-app-soft mt-2">{blockers.length} thing{blockers.length > 1 ? "s" : ""} to fix first.</p>
          )}
        </div>
      </div>
    </div>
  );
}
