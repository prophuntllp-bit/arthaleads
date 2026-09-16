import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Building2, Megaphone, Plus, X, Check, Loader2,
  ChevronDown, MessageSquare, Send, AlertTriangle, Eye, Trash2, Image as ImageIcon,
  MousePointerClick, Lock, GripVertical,
} from "lucide-react";
import api from "../../services/api";
import CustomSelect from "../../components/CustomSelect";
import toast from "react-hot-toast";

/**
 * Create or edit one WhatsApp assistant, and try it before it ever touches a
 * customer.
 *
 * Its own route rather than a tab, because a form you can wander out of
 * mid-edit is how half-configured assistants end up answering real people.
 */

const SELECT_STYLE = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };

const LANGUAGES = [
  { value: "auto",     label: "Match the customer" },
  { value: "English",  label: "English" },
  { value: "Hindi",    label: "Hindi" },
  { value: "Marathi",  label: "Marathi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Tamil",    label: "Tamil" },
  { value: "Telugu",   label: "Telugu" },
  { value: "Kannada",  label: "Kannada" },
  { value: "Bengali",  label: "Bengali" },
  { value: "Punjabi",  label: "Punjabi" },
];

const STATUSES = [
  { value: "active", label: "Live — answers customers" },
  { value: "paused", label: "Paused — does not answer" },
  { value: "draft",  label: "Draft — still being written" },
];

const slugify = (v, i) => `${String(v || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "option"}_${i}`;

// Sensible starting point for an Indian real-estate CTWA flow — every label
// (and the wording) is editable per agent; only the 5-step shape is fixed.
const DEFAULT_CTWA_FLOW = {
  enabled: false,
  welcomeText: "Hi {{name}} 👋 Thanks for your interest in {{project}}!",
  purposeQuestion: "Are you looking for this primarily for:",
  purposeOptions: [
    { id: "self_use_0", label: "Self Use" },
    { id: "investment_1", label: "Investment" },
  ],
  budgetBrackets: [
    { id: "b0", label: "Under ₹50L", min: 0, max: 5000000 },
    { id: "b1", label: "₹50L – ₹1Cr", min: 5000000, max: 10000000 },
    { id: "b2", label: "₹1Cr+", min: 10000000, max: 0 },
    { id: "b3", label: "Just Exploring", min: 0, max: 0 },
  ],
  timelineOptions: [
    { id: "t0", label: "Within 30 Days" },
    { id: "t1", label: "1–3 Months" },
    { id: "t2", label: "3–6 Months" },
    { id: "t3", label: "Just Exploring" },
  ],
  menuOptions: [
    { id: "m0", label: "📄 Price & Floor Plan", action: "photos" },
    { id: "m1", label: "📞 Talk to Advisor", action: "advisor" },
    { id: "m2", label: "🏡 Book Site Visit", action: "site_visit" },
  ],
  siteVisitSlots: [
    { id: "s0", label: "Morning" },
    { id: "s1", label: "Afternoon" },
    { id: "s2", label: "Evening" },
  ],
};

const MENU_ACTIONS = [
  { value: "photos",     label: "Send photos & brochure" },
  { value: "location",   label: "Send project location" },
  { value: "site_visit", label: "Ask for a site-visit time" },
  { value: "advisor",    label: "Connect to a human advisor" },
];

// Common lead-qualifying buttons most real-estate WhatsApp bots use — a
// quick-add dropdown next to each step's manual input, same pattern as the
// Amenities dropdown on the Project form. Picking one adds it instantly;
// wording can still be edited or removed like any other chip.
const PRESET_PURPOSE = ["Self Use", "Investment", "Buy", "Rent", "Just Exploring"];
const PRESET_TIMELINE = ["Within 30 Days", "1–3 Months", "3–6 Months", "6–12 Months", "Just Exploring"];
const PRESET_SITE_VISIT_SLOTS = ["Morning", "Afternoon", "Evening", "This Weekend", "Weekday"];
const PRESET_BUDGET_BRACKETS = [
  { label: "Under ₹50L", min: 0, max: 5000000 },
  { label: "₹50L – ₹75L", min: 5000000, max: 7500000 },
  { label: "₹75L – ₹1Cr", min: 7500000, max: 10000000 },
  { label: "₹1Cr – ₹1.5Cr", min: 10000000, max: 15000000 },
  { label: "₹1.5Cr+", min: 15000000, max: 0 },
  { label: "Just Exploring", min: 0, max: 0 },
];
const PRESET_MENU_OPTIONS = [
  { label: "📄 Price & Floor Plan", action: "photos" },
  { label: "📍 Location Details", action: "location" },
  { label: "🏡 Book Site Visit", action: "site_visit" },
  { label: "📞 Talk to Advisor", action: "advisor" },
];

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [projects, setProjects] = useState([]);
  const [readiness, setReadiness] = useState(null);

  const [form, setForm] = useState({
    name: "", description: "", status: "draft", greeting: "",
    businessContext: "", groundRules: "", projectIds: [],
    systemPrompt: "", language: "auto", adIds: [],
    shareProjectPhotos: false, shareBrochure: false,
    ctwaFlow: DEFAULT_CTWA_FLOW,
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFlow = (patch) => setForm((f) => ({ ...f, ctwaFlow: { ...f.ctwaFlow, ...patch } }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adDraft, setAdDraft] = useState("");

  // Try-it console
  const [tryInput, setTryInput] = useState("");
  const [tryLog, setTryLog]     = useState([]);
  const [trying, setTrying]     = useState(false);
  const [tryMeta, setTryMeta]   = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const tryEndRef = useRef(null);

  useEffect(() => {
    const reqs = [api.get("/projects")];
    if (!isNew) reqs.push(api.get(`/whatsapp/agents/${id}`));
    Promise.all(reqs).then(([projRes, agentRes]) => {
      setProjects(projRes.data?.data || []);
      if (agentRes) {
        const a = agentRes.data.agent;
        setForm({
          name: a.name || "", description: a.description || "", status: a.status || "draft",
          greeting: a.greeting || "", businessContext: a.businessContext || "",
          groundRules: a.groundRules || "",
          projectIds: (a.projectIds || []).map((p) => String(p?._id || p)),
          systemPrompt: a.systemPrompt || "", language: a.language || "auto",
          adIds: a.adIds || [],
          shareProjectPhotos: a.shareProjectPhotos === true, shareBrochure: a.shareBrochure === true,
          // Merged over the defaults rather than used as-is — an agent saved
          // before purposeQuestion existed would otherwise load that field as
          // undefined and turn its textarea into an uncontrolled input.
          ctwaFlow: a.ctwaFlow?.welcomeText !== undefined ? { ...DEFAULT_CTWA_FLOW, ...a.ctwaFlow } : DEFAULT_CTWA_FLOW,
        });
        setShowAdvanced(!!a.systemPrompt);
        setReadiness(a.readiness);
      }
    }).catch(() => toast.error("Could not load this assistant"))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(() => { tryEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [tryLog, trying]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Give the assistant a name first.");
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/whatsapp/agents", form);
        toast.success(`${data.agent.name} created`);
        // Replace rather than push, so Back does not land on a "new" form that
        // would create a second copy on save.
        navigate(`/conversations/agent/${data.agent._id}`, { replace: true });
      } else {
        const { data } = await api.patch(`/whatsapp/agents/${id}`, form);
        setReadiness(data.agent.readiness);
        toast.success("Saved");
      }
    } catch (e) { toast.error(e.response?.data?.message || "Could not save"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/whatsapp/agents/${id}`);
      toast.success("Assistant deleted");
      navigate("/conversations/agent");
    } catch (e) { toast.error(e.response?.data?.message || "Could not delete"); }
  };

  // Previews whatever is on screen, not what is stored — so this works before
  // the agent has ever been saved, and a ground rule you just typed takes
  // effect on the very next question.
  const runTry = async () => {
    const text = tryInput.trim();
    if (!text || trying) return;
    setTryInput("");
    const history = tryLog.filter((m) => m.role !== "error").map((m) => ({ role: m.role, body: m.body }));
    setTryLog((l) => [...l, { role: "user", body: text }]);
    setTrying(true);
    try {
      const { data } = await api.post("/whatsapp/agents/preview", { message: text, history, agent: form });
      // On a real WhatsApp thread this exact text is sent, verbatim, before the
      // customer's message is even answered — show it the same way here rather
      // than letting the model invent its own opener, which is what silently
      // happened before this existed.
      const greetingMsg = data.greeting
        ? [{ role: "assistant", body: data.greeting, isGreeting: true }] : [];
      setTryLog((l) => [...l, ...greetingMsg, {
        role: "assistant",
        body: data.reply || "(no reply)",
        handoff: data.handoff,
        wantsPhotos: data.wantsPhotos,
        wantsBrochure: data.wantsBrochure,
      }]);
      setTryMeta(data);
    } catch (e) {
      setTryLog((l) => [...l, { role: "error", body: e.response?.data?.message || "The assistant could not answer." }]);
    } finally { setTrying(false); }
  };

  const toggleProject = (pid) => set({
    projectIds: form.projectIds.includes(pid)
      ? form.projectIds.filter((x) => x !== pid)
      : [...form.projectIds, pid],
  });

  const addAd = () => {
    const v = adDraft.trim();
    if (!v) return;
    if (form.adIds.includes(v)) return setAdDraft("");
    set({ adIds: [...form.adIds, v] });
    setAdDraft("");
  };

  if (loading) {
    return (
      <div className="stitch-page">
        <div className="card p-5 h-64 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  const narrowScope = form.projectIds.length > 0 && form.projectIds.length < projects.length / 2;

  return (
    <div className="stitch-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate("/conversations/agent")}
          className="flex items-center gap-1.5 text-sm font-semibold text-app-soft hover:text-app transition">
          <ArrowLeft className="w-4 h-4" /> All agents
        </button>
        {!isNew && (
          <button onClick={remove}
            className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-lg font-bold text-app">{isNew ? "New agent" : form.name || "Agent"}</h1>
        <p className="text-xs text-app-soft">
          What this assistant knows, how it talks, and which messages reach it
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-5 min-w-0">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">Identity</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Name</label>
                <input className="input w-full" placeholder="e.g. Arohi"
                  value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Status</label>
                <CustomSelect value={form.status} onChange={(v) => set({ status: v })}
                  options={STATUSES} style={SELECT_STYLE} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                What it does <span className="font-normal">(for your team, never sent to customers)</span>
              </label>
              <input className="input w-full" placeholder="e.g. Qualifies leads and books site visits for Treetopia"
                value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">Reply language</label>
              <CustomSelect value={form.language} onChange={(v) => set({ language: v })}
                options={LANGUAGES} style={SELECT_STYLE} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-base font-bold text-app">How it talks</h3>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Greeting <span className="font-normal">(optional)</span>
              </label>
              <input className="input w-full" placeholder="Hi! Thanks for reaching out — how can I help you find your next home?"
                value={form.greeting} onChange={(e) => set({ greeting: e.target.value })} />
              <p className="text-xs text-app-soft mt-1">Sent automatically as the first message when someone new writes in.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Business context <span className="font-normal">(optional)</span>
              </label>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Who you are, service area, working hours, anything the assistant should know about your business."
                value={form.businessContext} onChange={(e) => set({ businessContext: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                Ground rules <span className="font-normal">(optional)</span>
              </label>
              <textarea className="input w-full resize-none" rows={3}
                placeholder="Dos and don'ts — e.g. never discuss competitor pricing, always ask for a preferred visit time before booking a site visit."
                value={form.groundRules} onChange={(e) => set({ groundRules: e.target.value })} />
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">What it can discuss</h3>
            </div>
            <p className="text-sm text-app-soft">
              Answers come from your real Projects, not a crawled website. Edit a price on the Projects
              page and the next reply reflects it — nothing to re-sync.
            </p>
            <p className="text-xs text-app-soft">Leave everything unchecked to allow all of your active projects.</p>

            {projects.length === 0 ? (
              <p className="text-xs text-app-soft italic rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                No projects yet — add some on the Projects page first.
              </p>
            ) : (
              <div className="rounded-xl divide-y max-h-64 overflow-y-auto" style={{ border: "1px solid var(--app-border)" }}>
                {projects.map((p) => (
                  <label key={p._id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--app-surface-low)]">
                    <input type="checkbox" className="shrink-0"
                      checked={form.projectIds.includes(p._id)} onChange={() => toggleProject(p._id)} />
                    <span className="flex-1 min-w-0 truncate text-app">{p.name}</span>
                    {p.location && <span className="text-xs text-app-soft truncate shrink-0 max-w-[40%]">{p.location}</span>}
                  </label>
                ))}
              </div>
            )}

            {form.projectIds.length > 0 && (
              <div className="text-xs rounded-xl px-3 py-2 flex items-start gap-2"
                style={narrowScope
                  ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }
                  : { background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)" }}>
                {narrowScope && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                <span>
                  This assistant can only discuss <strong>{form.projectIds.length} of your {projects.length}</strong> active
                  project{projects.length === 1 ? "" : "s"}. Ask it about any of the others and it will say your team
                  will follow up. Uncheck everything to allow all {projects.length}.
                </span>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">What it can send</h3>
            </div>
            <p className="text-sm text-app-soft">
              Off by default. Some teams want a human to qualify a lead before anything visual goes out —
              this is that gate, separate from what the assistant is allowed to talk about.
            </p>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" className="mt-0.5 shrink-0"
                checked={form.shareProjectPhotos} onChange={(e) => set({ shareProjectPhotos: e.target.checked })} />
              <span>
                <span className="text-app font-semibold block">Can send project photos</span>
                <span className="text-xs text-app-soft">
                  Only for projects that actually have photos uploaded — add them on the Projects page.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" className="mt-0.5 shrink-0"
                checked={form.shareBrochure} onChange={(e) => set({ shareBrochure: e.target.checked })} />
              <span>
                <span className="text-app font-semibold block">Can send the brochure (PDF)</span>
                <span className="text-xs text-app-soft">
                  Only for projects that have a brochure uploaded — add one on the Projects page.
                </span>
              </span>
            </label>
            <p className="text-xs text-app-soft rounded-xl px-3 py-2" style={{ background: "var(--app-surface-low)" }}>
              Works on the direct Arthaleads connection only — not on AiSensy, Wati or Interakt. The
              assistant only ever sends what's relevant to what was just discussed, never on the first reply.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">Route ads to this agent</h3>
            </div>
            <p className="text-sm text-app-soft">
              Running a Click-to-WhatsApp ad? Paste its Ad ID (from Meta Ads Manager — the ad, not the
              campaign). Anyone who messages in from that ad reaches this assistant, whichever one is
              your default.
            </p>
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" placeholder="Ad ID e.g. 1202101234567890"
                value={adDraft} onChange={(e) => setAdDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAd(); } }} />
              <button type="button" onClick={addAd} disabled={!adDraft.trim()}
                className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {form.adIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.adIds.map((ad) => (
                  <span key={ad} className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                    style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                    {ad}
                    <button type="button" onClick={() => set({ adIds: form.adIds.filter((a) => a !== ad) })}
                      className="text-app-soft hover:text-red-500 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
                <h3 className="text-base font-bold text-app">CTWA button flow</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                  <Lock className="w-2.5 h-2.5" /> Growth+
                </span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                <input type="checkbox" checked={form.ctwaFlow.enabled}
                  onChange={(e) => setFlow({ enabled: e.target.checked })} />
                <span className="text-xs font-semibold text-app">{form.ctwaFlow.enabled ? "On" : "Off"}</span>
              </label>
            </div>
            <p className="text-sm text-app-soft">
              For a customer arriving from a Click-to-WhatsApp ad (route it above first), replace the first
              few free-text qualifying questions with real WhatsApp buttons/lists: purpose → budget →
              timeline → what they want next → site-visit time. Answers write straight onto the lead. Anyone
              who free-types instead of tapping drops back into this assistant's usual conversation.
            </p>

            <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft">Message 1 of 2 — sent first, plain text</p>
              <div>
                <label className="text-xs font-semibold text-app-soft block mb-1">Welcome message</label>
                <textarea className="input w-full resize-none" rows={2}
                  placeholder="Hi {{name}} 👋 Thanks for your interest in {{project}}!"
                  value={form.ctwaFlow.welcomeText} onChange={(e) => setFlow({ welcomeText: e.target.value })} />
                <p className="text-[11px] text-app-soft mt-1">
                  Use <code>{"{{name}}"}</code> and <code>{"{{project}}"}</code>. Sent on its own — a greeting bundled
                  into the same message as the first question reads as the bot talking over itself.
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft">Message 2 of 2 — sent right after, with the purpose buttons</p>
              <div>
                <label className="text-xs font-semibold text-app-soft block mb-1">Purpose question</label>
                <input className="input w-full" placeholder="Are you looking for this primarily for:"
                  value={form.ctwaFlow.purposeQuestion} onChange={(e) => setFlow({ purposeQuestion: e.target.value })} />
              </div>
              <ChipRowEditor label="Purpose — up to 3 buttons" max={3} presets={PRESET_PURPOSE}
                rows={form.ctwaFlow.purposeOptions} onChange={(rows) => setFlow({ purposeOptions: rows })} />
            </div>

            <BudgetBracketEditor rows={form.ctwaFlow.budgetBrackets}
              onChange={(rows) => setFlow({ budgetBrackets: rows })} />

            <ChipRowEditor label="Timeline — up to 10, shown as a list" max={10} presets={PRESET_TIMELINE}
              rows={form.ctwaFlow.timelineOptions} onChange={(rows) => setFlow({ timelineOptions: rows })} />

            <MenuOptionEditor rows={form.ctwaFlow.menuOptions}
              onChange={(rows) => setFlow({ menuOptions: rows })} />

            <ChipRowEditor label="Site-visit time slots — up to 3 buttons" max={3} presets={PRESET_SITE_VISIT_SLOTS}
              rows={form.ctwaFlow.siteVisitSlots} onChange={(rows) => setFlow({ siteVisitSlots: rows })} />
            <p className="text-[11px] text-app-soft text-center">
              Preview of this flow is alongside "Try it" →
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <button type="button" onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced: replace everything above with one custom prompt
            </button>
            {showAdvanced && (
              <div>
                <textarea className="input w-full resize-none" rows={5}
                  placeholder="Leave blank to use the settings above. Writing anything here overrides them entirely."
                  value={form.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
                <p className="text-xs text-app-soft mt-1">
                  When this is filled in, the greeting, business context, ground rules and project list are
                  all ignored — you are fully in control of the prompt.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Try it + the CTWA flow preview, alongside the form rather than
            under it, so you can change a ground rule or a button label and
            immediately re-check it without losing your place. */}
        <div className="space-y-4 lg:sticky lg:top-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
            <h3 className="text-base font-bold text-app">Try it</h3>
          </div>

          {readiness && readiness.score < readiness.total && (
            <div className="text-xs rounded-xl px-3 py-2"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }}>
              <strong>Setup {readiness.score}/{readiness.total}.</strong>{" "}
              {readiness.checks.filter((c) => !c.ok).map((c) => c.label).join(" · ")}
            </div>
          )}

          <p className="text-sm text-app-soft">
            Tries exactly what is on screen now, saved or not. Nothing is sent over WhatsApp and no
            WhatsApp credit is used.
          </p>

          <div className="rounded-2xl p-3 space-y-2 overflow-y-auto"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", minHeight: 180, maxHeight: 340 }}>
            {tryLog.length === 0 && (
              <p className="text-xs text-app-soft italic text-center py-8">
                Try “what projects do you have in Pune?” or “price of a 2BHK?”
              </p>
            )}
            {tryLog.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === "user" ? "rounded-tr-[4px] wa-bubble-out" : "rounded-tl-[4px]"}`}
                  style={m.role === "error"
                    ? { background: "rgba(239,68,68,0.10)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.28)" }
                    : m.role === "assistant"
                      ? { background: "var(--app-card-solid)", color: "var(--app-text)", border: "1px solid var(--app-border)" }
                      : undefined}>
                  {m.isGreeting && (
                    <span className="block text-[10px] font-bold mb-1" style={{ color: "var(--app-primary)" }}>
                      Sent automatically — real Greeting text, not generated
                    </span>
                  )}
                  {m.body}
                  {(m.wantsPhotos || m.wantsBrochure) && (
                    <span className="block text-[10px] font-bold mt-1.5" style={{ color: "var(--app-primary)" }}>
                      📎 would send {[m.wantsPhotos && "project photos", m.wantsBrochure && "the brochure"].filter(Boolean).join(" and ")} here — not sent in Try It
                    </span>
                  )}
                  {m.handoff && (
                    <span className="block text-[10px] font-bold mt-1.5" style={{ color: "#b45309" }}>
                      → would hand this thread to a human
                    </span>
                  )}
                </div>
              </div>
            ))}
            {trying && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-[4px] px-3.5 py-2"
                  style={{ background: "var(--app-card-solid)", border: "1px solid var(--app-border)" }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-app-soft" />
                </div>
              </div>
            )}
            <div ref={tryEndRef} />
          </div>

          <div className="flex items-end gap-2">
            <input className="input flex-1" placeholder="Ask what a customer would ask…"
              value={tryInput} onChange={(e) => setTryInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runTry(); } }} />
            <button type="button" onClick={runTry} disabled={!tryInput.trim() || trying}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40"
              style={{ background: tryInput.trim() ? "var(--app-primary)" : "var(--app-surface-low)" }}>
              <Send className={`w-4 h-4 ${tryInput.trim() ? "text-white" : "text-app-soft"}`} />
            </button>
          </div>

          {tryMeta && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full font-semibold"
                  style={tryMeta.projectsInScope === 0 && !tryMeta.usingCustomPrompt
                    ? { background: "rgba(239,68,68,0.10)", color: "#b91c1c" }
                    : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
                  {tryMeta.usingCustomPrompt
                    ? "Using your custom prompt"
                    : `Knows ${tryMeta.projectsInScope} of ${tryMeta.activeProjects} projects`}
                </span>
                {tryLog.length > 0 && (
                  <button type="button" onClick={() => setTryLog([])}
                    className="text-xs font-semibold text-app-soft hover:text-app transition">Clear</button>
                )}
                <button type="button" onClick={() => setShowPrompt((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-app transition ml-auto">
                  <Eye className="w-3.5 h-3.5" />
                  {showPrompt ? "Hide" : "Show"} what it was told
                </button>
              </div>
              {showPrompt && (
                <pre className="text-[11px] leading-relaxed rounded-xl p-3 overflow-auto whitespace-pre-wrap break-words"
                  style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)", maxHeight: 280 }}>
                  {tryMeta.systemPrompt}
                </pre>
              )}
            </div>
          )}
        </div>

        <CtwaFlowPreviewPanel flow={form.ctwaFlow}
          projectName={projects.find((p) => form.projectIds.includes(String(p._id)))?.name} />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4" style={{ borderTop: "1px solid var(--app-border)" }}>
        <button onClick={save} disabled={saving}
          className="btn-primary rounded-full px-6 py-2.5 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : isNew ? "Create agent" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── CTWA flow preview ────────────────────────────────────────────────────────
// A client-side simulation of exactly what services/ctwaFlowService.js does
// on the backend — same branching, same step order — so a tenant can see the
// whole thing tap-through before ever pointing a real ad at it. Nothing here
// touches the API: no credit spent, no lead written, no message sent.
function fillVars(text, vars) {
  return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

// Mirrors ctwaFlowService.js's CLOSING_OPTIONS exactly — fixed, not
// agent-configurable, so "Price & Floor Plan" / "Location Details" always
// land on one of these two real endings instead of going quiet.
const CLOSING_BUTTONS = [{ id: "advisor", label: "Talk to Advisor" }, { id: "site_visit", label: "Book Site Visit" }];

function CtwaFlowPreviewPanel({ flow, projectName }) {
  const [log, setLog] = useState([]);
  const [step, setStep] = useState(null); // mirrors WaConversation.flowState.step
  const [freeText, setFreeText] = useState("");
  const vars = { name: "Ananya", project: projectName || "this project" };

  const push = (entry) => setLog((l) => [...l, entry]);

  const restart = () => {
    setLog([]); setFreeText("");
    if (!flow.enabled) {
      setStep(null);
      return;
    }
    // Two separate messages, exactly like ctwaFlowService.startFlow — a
    // greeting bundled into the same message as the first question reads as
    // the bot talking over itself.
    push({ from: "bot", text: fillVars(flow.welcomeText, vars) || "(welcome message is empty)" });
    if (!flow.purposeOptions.length) {
      push({ from: "bot", warn: true, text: "No purpose options configured yet — add at least one above to preview past this step." });
      setStep(null);
      return;
    }
    push({ from: "bot", text: fillVars(flow.purposeQuestion, vars) || "(purpose question is empty)", buttons: flow.purposeOptions });
    setStep("purpose");
  };

  useEffect(() => { restart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const needOptions = (rows, label) => {
    if (rows.length) return false;
    push({ from: "bot", warn: true, text: `No ${label} configured yet — add at least one above to preview past this step.` });
    setStep(null);
    return true;
  };

  // Matched by button id across every step, not by whatever step is
  // currently recorded — mirrors ctwaFlowService.advanceFlow exactly. A real
  // WhatsApp message's buttons never stop being tappable once a newer one
  // is sent, and a lead often wants to revisit an earlier question (check
  // the floor plan after already seeing the location; pick a different
  // budget) rather than being stuck wherever they last left off — so every
  // button in this preview stays live too, for as long as the flow hasn't
  // reached a true ending (advisor connected, or a site visit booked).
  const tap = (opt) => {
    push({ from: "user", text: opt.label });

    const inPurpose  = flow.purposeOptions.some((o) => o.id === opt.id);
    const inBudget   = flow.budgetBrackets.some((o) => o.id === opt.id);
    const inTimeline = flow.timelineOptions.some((o) => o.id === opt.id);
    const inMenu     = flow.menuOptions.some((o) => o.id === opt.id);
    const inClosing  = CLOSING_BUTTONS.some((o) => o.id === opt.id);
    const inSlots    = flow.siteVisitSlots.some((o) => o.id === opt.id);

    if (inPurpose) {
      if (needOptions(flow.budgetBrackets, "budget brackets")) return;
      push({ from: "bot", text: "Perfect. What's your approximate budget range?", list: flow.budgetBrackets });
      setStep("budget"); return;
    }
    if (inBudget) {
      if (needOptions(flow.timelineOptions, "timeline options")) return;
      push({ from: "bot", text: "Got it. When are you looking to finalize?", list: flow.timelineOptions });
      setStep("timeline"); return;
    }
    if (inTimeline) {
      if (needOptions(flow.menuOptions, "\"what next\" options")) return;
      push({ from: "bot", text: "Great — what would you like to see next?", buttons: flow.menuOptions });
      setStep("menu"); return;
    }
    if (inSlots) {
      push({ from: "bot", text: "Wonderful — our team will confirm your visit shortly and take it from here." });
      push({ from: "bot", note: true, text: "✅ Lead updated: status → Site Visit, booking → Site Visit Booked, activity logged. Bot pauses and a human on your team is assigned and notified." });
      setStep(null); return;
    }
    if (inMenu || inClosing) {
      const action = inMenu ? opt.action : opt.id; // closing ids ARE their action
      if (action === "site_visit") {
        if (needOptions(flow.siteVisitSlots, "site-visit time slots")) return;
        push({ from: "bot", text: "Which time works best for your visit?", buttons: flow.siteVisitSlots });
        setStep("site_visit"); return;
      }
      if (action === "advisor") { pushAdvisorTerminal(); setStep(null); return; }
      // Informational — never a dead end, and never retires the menu: the
      // same message's other buttons (and this one) stay tappable after.
      if (action === "photos") {
        push({ from: "bot", note: true, text: "📷 Sends project photos + brochure, if that agent's \"What it can send\" toggles above are on for this project." });
      } else if (action === "location") {
        push({ from: "bot", text: `This project is located at: ${projectName ? "(the project's saved location)" : "(no single project — assign one above to resolve this)"}` });
      }
      push({ from: "bot", text: "Would you like to talk to our advisor, or book a site visit?", buttons: CLOSING_BUTTONS });
      setStep("menu"); return;
    }
  };

  const pushAdvisorTerminal = () => {
    push({ from: "bot", text: "Connecting you with our advisor — they'll reach out to you shortly. You can also reach them directly on <their phone number>." });
    push({ from: "bot", note: true, text: "✅ Uses this project's \"Talk to Advisor\" contact if one is set (Projects page) — real name and phone number included so the lead can call directly; otherwise falls back to normal round-robin assignment with no number shown. Bot pauses and that person is notified." });
  };

  const sendFreeText = () => {
    const text = freeText.trim();
    if (!text) return;
    push({ from: "user", text });
    push({ from: "bot", note: true, text: "→ No button was tapped, so the flow exits here — this assistant's normal AI conversation answers this message instead." });
    setFreeText(""); setStep(null);
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MousePointerClick className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
        <h3 className="text-base font-bold text-app">Preview: CTWA button flow</h3>
      </div>
      <p className="text-xs text-app-soft">
        Simulated in your browser — nothing is sent, no credit is spent, no lead is touched. Uses whatever
        is on screen now, saved or not, the same way "Try it" above does.
      </p>

      {!flow.enabled ? (
        <p className="text-xs text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
          Turn on the CTWA button flow above to preview it here.
        </p>
      ) : (
      <>
        <div className="rounded-2xl p-3 space-y-2.5 overflow-y-auto" style={{ background: "var(--app-surface-low)", maxHeight: 420 }}>
          {log.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.from === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                  style={m.warn
                    ? { background: "rgba(239,68,68,0.12)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.3)" }
                    : m.note
                    ? { background: "transparent", color: "var(--app-text-soft)", fontStyle: "italic", padding: "2px 4px" }
                    : m.from === "user"
                    ? { background: "var(--app-primary)", color: "#fff" }
                    : { background: "var(--app-card-solid)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                  {m.text}
                </div>
                {(m.buttons?.length > 0 || m.list?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(m.buttons || m.list).map((o) => (
                      <button key={o.id} type="button" onClick={() => tap(o)}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition hover:opacity-80"
                        style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "var(--app-card-solid)" }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {step && (
          <div className="flex items-center gap-2">
            <input className="input flex-1 text-xs" placeholder="Or type something instead of tapping a button…"
              value={freeText} onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendFreeText(); } }} />
            <button type="button" onClick={sendFreeText} disabled={!freeText.trim()}
              className="btn-secondary rounded-full px-3 py-2 disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex justify-between items-center pt-1">
          <p className="text-[11px] text-app-soft">{step ? `Currently at: ${step}` : "Flow finished — restart to try a different path."}</p>
          <button type="button" onClick={restart} className="text-xs font-semibold text-app-soft hover:text-app transition">Restart</button>
        </div>
      </>
      )}
    </div>
  );
}

// ── CTWA flow step editors ──────────────────────────────────────────────────
// Three small, focused editors rather than one generic table: each step's
// options need a slightly different shape (plain label, label+budget range,
// label+action), and forcing them through one config-driven table would be
// harder to read than three short components.

const ROW_CLS = "flex items-center gap-2";
const SMALL_INPUT = "input text-xs py-1.5";

const PRESET_SELECT_STYLE = { width: "100%", padding: "8px 12px", borderRadius: "0.75rem", fontSize: 12 };

// Shared drag-to-reorder chip list for all three editors below — order here
// is the order WhatsApp shows the buttons/list rows in, so a tenant sets
// their preferred sequence by dragging instead of deleting and re-adding.
function DraggableChips({ rows, onChange, renderLabel }) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const reorder = (from, to) => {
    if (from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {rows.map((r, i) => (
        <span key={r.id} draggable
          onDragStart={(e) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
          onDrop={(e) => { e.preventDefault(); if (dragIndex.current !== null) reorder(dragIndex.current, i); dragIndex.current = null; setOverIndex(null); }}
          onDragEnd={() => { dragIndex.current = null; setOverIndex(null); }}
          className="inline-flex items-center gap-1 text-xs font-semibold pl-1.5 pr-2.5 py-1 rounded-full cursor-grab active:cursor-grabbing"
          style={{
            background: "var(--app-surface-low)",
            border: overIndex === i ? "1px dashed var(--app-primary)" : "1px solid var(--app-border)",
            color: "var(--app-text)",
          }}>
          <GripVertical className="w-3 h-3 text-app-soft shrink-0" />
          {renderLabel ? renderLabel(r) : r.label}
          <button type="button" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
            className="text-app-soft hover:text-red-500 transition"><X className="w-3 h-3" /></button>
        </span>
      ))}
    </div>
  );
}

function ChipRowEditor({ label, rows, max, onChange, presets }) {
  const [draft, setDraft] = useState("");
  const add = (text) => {
    text = text.trim();
    if (!text || rows.length >= max || rows.some((r) => r.label.toLowerCase() === text.toLowerCase())) return;
    onChange([...rows, { id: slugify(text, rows.length), label: text }]);
    setDraft("");
  };
  const remaining = presets?.filter((p) => !rows.some((r) => r.label.toLowerCase() === p.toLowerCase()));
  return (
    <div>
      <label className="text-xs font-semibold text-app-soft block mb-1">{label}</label>
      {presets && remaining.length > 0 && (
        <CustomSelect value="" onChange={add} options={remaining}
          placeholder="Quick add a common option…" style={PRESET_SELECT_STYLE} />
      )}
      <div className={`${ROW_CLS} ${presets ? "mt-2" : ""}`}>
        <input className={`${SMALL_INPUT} flex-1`} value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Or type your own…" disabled={rows.length >= max}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} />
        <button type="button" onClick={() => add(draft)} disabled={!draft.trim() || rows.length >= max}
          className="btn-secondary rounded-full px-2.5 py-1.5 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {rows.length > 0 && <DraggableChips rows={rows} onChange={onChange} />}
    </div>
  );
}

function BudgetBracketEditor({ rows, onChange }) {
  const [label, setLabel] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState("");
  const addRow = (row) => {
    if (rows.length >= 10 || rows.some((r) => r.label.toLowerCase() === row.label.toLowerCase())) return;
    onChange([...rows, { id: slugify(row.label, rows.length), ...row }]);
  };
  const add = () => {
    if (!label.trim()) return;
    addRow({ label: label.trim(), min: Number(min) || 0, max: Number(max) || 0 });
    setLabel(""); setMin(""); setMax("");
  };
  const remaining = PRESET_BUDGET_BRACKETS.filter((p) => !rows.some((r) => r.label.toLowerCase() === p.label.toLowerCase()));
  return (
    <div>
      <label className="text-xs font-semibold text-app-soft block mb-1">Budget brackets — up to 10, shown as a list</label>
      {remaining.length > 0 && (
        <CustomSelect value="" onChange={(v) => addRow(remaining.find((p) => p.label === v))}
          options={remaining.map((p) => p.label)} placeholder="Quick add a common bracket…" style={PRESET_SELECT_STYLE} />
      )}
      <div className={`${ROW_CLS} mt-2`}>
        <input className={`${SMALL_INPUT} flex-1`} value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Label, e.g. ₹50L – ₹1Cr" disabled={rows.length >= 10} />
        <input className={`${SMALL_INPUT} w-24`} type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)}
          placeholder="Min ₹" disabled={rows.length >= 10} />
        <input className={`${SMALL_INPUT} w-24`} type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)}
          placeholder="Max ₹ (0 = no cap)" disabled={rows.length >= 10} />
        <button type="button" onClick={add} disabled={!label.trim() || rows.length >= 10}
          className="btn-secondary rounded-full px-2.5 py-1.5 disabled:opacity-40 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {rows.length > 0 && <DraggableChips rows={rows} onChange={onChange} />}
    </div>
  );
}

// No manual action picker here — every real action (photos, location,
// advisor, site visit) is already covered by the 4 presets below, and a
// second control that duplicated what the preset already set was more
// confusing than useful. A custom-worded button defaults to "advisor" (the
// one action that's always safe — it just hands the customer to a person).
function MenuOptionEditor({ rows, onChange }) {
  const [label, setLabel] = useState("");
  const addRow = (row) => {
    if (rows.length >= 3 || rows.some((r) => r.label.toLowerCase() === row.label.toLowerCase())) return;
    onChange([...rows, { id: slugify(row.label, rows.length), ...row }]);
  };
  const add = () => {
    if (!label.trim()) return;
    addRow({ label: label.trim(), action: "advisor" });
    setLabel("");
  };
  const remaining = PRESET_MENU_OPTIONS.filter((p) => !rows.some((r) => r.label.toLowerCase() === p.label.toLowerCase()));
  return (
    <div>
      <label className="text-xs font-semibold text-app-soft block mb-1">"What next?" menu — up to 3 buttons</label>
      <p className="text-[11px] text-app-soft mb-1">
        Price &amp; Floor Plan and Location Details always follow up with "Talk to Advisor" / "Book Site
        Visit" — this flow never dead-ends on just a photo or an address.
      </p>
      {remaining.length > 0 && (
        <CustomSelect value="" onChange={(v) => addRow(remaining.find((p) => p.label === v))}
          options={remaining.map((p) => p.label)} placeholder="Quick add a common option…" style={PRESET_SELECT_STYLE} />
      )}
      <div className={`${ROW_CLS} mt-2`}>
        <input className={`${SMALL_INPUT} flex-1`} value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Or type your own — becomes a 'Talk to Advisor' style button" disabled={rows.length >= 3}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!label.trim() || rows.length >= 3}
          className="btn-secondary rounded-full px-2.5 py-1.5 disabled:opacity-40 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {rows.length > 0 && (
        <DraggableChips rows={rows} onChange={onChange}
          renderLabel={(r) => <>{r.label} <span className="text-app-soft font-normal">→ {MENU_ACTIONS.find((a) => a.value === r.action)?.label}</span></>} />
      )}
    </div>
  );
}
