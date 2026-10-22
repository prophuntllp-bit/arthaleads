import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Building2, Megaphone, Plus, X, Check, Loader2,
  ChevronDown, ChevronUp, MessageSquare, Send, AlertTriangle, Eye, Trash2, Image as ImageIcon,
  MousePointerClick, Lock, GripVertical,
} from "lucide-react";
import api from "../../services/api";
import CustomSelect from "../../components/CustomSelect";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../utils/plan";
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

// The one non-question value an option's `next` may point to — matches
// backend whatsappRoutes.js's sanitizeCtwaFlow / ctwaFlowService.js exactly.
const NEXT_CLOSING = "__closing__";
// The one non-question value closingSiteVisitNext may point to — matches
// backend whatsappRoutes.js's sanitizeCtwaFlow / ctwaFlowService.js exactly.
const CLOSING_BOOK_IMMEDIATELY = "__book__";

// The two ways the flow can end, in the order they're offered. Mirrors
// ctwaFlowService.js's CLOSING_OPTIONS. A tenant can rename either or leave
// one out (a campaign aimed at out-of-town investors has no use for a site
// visit), but never both.
const CLOSING_DEFAULTS = [
  { id: "advisor", label: "Talk to Advisor", hint: "Connects the lead with your advisor" },
  { id: "site_visit", label: "Book Site Visit", hint: "Books a site visit" },
];
const CLOSING_TITLE_MAX = 20;
const DEFAULT_CLOSING_PROMPT = "Would you like to talk to our advisor, or book a site visit?";
const ADVISOR_ONLY_CLOSING_PROMPT = "Would you like to talk to our advisor?";
function resolveClosingButtons(flow) {
  const saved = (Array.isArray(flow?.closingButtons) ? flow.closingButtons : [])
    .filter((b) => CLOSING_DEFAULTS.some((d) => d.id === b?.id) && String(b.label || "").trim());
  const seen = new Set();
  const uniq = saved.filter((b) => !seen.has(b.id) && seen.add(b.id)).map((b) => ({ id: b.id, label: String(b.label).slice(0, CLOSING_TITLE_MAX) }));
  return uniq.length ? uniq : CLOSING_DEFAULTS.map(({ id, label }) => ({ id, label }));
}

// Sensible starting point for an Indian real-estate CTWA flow — every label
// (and the wording) is editable per agent, and so is the order and count of
// questions; only the closing step (talk to an advisor, or book a site
// visit) is fixed. What used to be separate hardcoded "what next?" and
// "site visit" steps are now just two more entries in the same list — this
// is a platform feature every tenant uses, not just real-estate ones.
const DEFAULT_CTWA_FLOW = {
  enabled: false,
  welcomeText: "Hi {{name}} 👋 Thanks for your interest in {{project}}!",
  qualifyingQuestions: [
    {
      id: "purpose", questionText: "Are you looking for this primarily for:", mapsTo: "purpose",
      options: [
        { id: "self_use_0", label: "Self Use", action: "none" },
        { id: "investment_1", label: "Investment", action: "none" },
      ],
    },
    {
      id: "budget", questionText: "Perfect. What's your approximate budget range?", mapsTo: "budget",
      options: [
        { id: "b0", label: "Under ₹50L", min: 0, max: 5000000, action: "none" },
        { id: "b1", label: "₹50L - ₹1Cr", min: 5000000, max: 10000000, action: "none" },
        { id: "b2", label: "₹1Cr+", min: 10000000, max: 0, action: "none" },
        { id: "b3", label: "Just Exploring", min: 0, max: 0, action: "none" },
      ],
    },
    {
      id: "timeline", questionText: "Got it. When are you looking to finalize?", mapsTo: "timeline",
      options: [
        { id: "t0", label: "Within 30 Days", action: "none" },
        { id: "t1", label: "1-3 Months", action: "none" },
        { id: "t2", label: "3-6 Months", action: "none" },
        { id: "t3", label: "Just Exploring", action: "none" },
      ],
    },
    {
      id: "menu", questionText: "Great, what would you like to see next?", mapsTo: "none",
      options: [
        { id: "m0", label: "🖼️ Photos & Videos", action: "photos" },
        { id: "m1", label: "📄 Floor Plan & Brochure", action: "docs" },
        // "none" — not "site_visit" — because tapping this should lead into
        // the slot-picker question right below, not book immediately.
        { id: "m2", label: "🏡 Book Site Visit", action: "none" },
      ],
    },
    {
      id: "site_visit_slots", questionText: "Which time works best for your visit?", mapsTo: "none",
      options: [
        { id: "s0", label: "Morning", action: "site_visit" },
        { id: "s1", label: "Afternoon", action: "site_visit" },
        { id: "s2", label: "Evening", action: "site_visit" },
      ],
    },
  ],
  closingPrompt: "Would you like to talk to our advisor, or book a site visit?",
  closingSiteVisitNext: "",
  closingButtons: CLOSING_DEFAULTS.map(({ id, label }) => ({ id, label })),
  nudgesEnabled: false,
  nudgeText: "",
  testPhones: [],
};

// Pre-existing agents saved before this change carry the old
// purposeQuestion/purposeOptions/budgetBrackets/timelineOptions fields —
// synthesized into the same question shape they always behaved as.
function legacyPurposeBudgetTimeline(ctwaFlow) {
  const qs = [];
  if (ctwaFlow?.purposeOptions?.length) {
    qs.push({ id: "purpose", questionText: ctwaFlow.purposeQuestion || "Are you exploring this primarily for:", options: ctwaFlow.purposeOptions.map((o) => ({ ...o, action: "none" })), mapsTo: "purpose" });
  }
  if (ctwaFlow?.budgetBrackets?.length) {
    qs.push({ id: "budget", questionText: "Perfect. What's your approximate budget range?", options: ctwaFlow.budgetBrackets.map((o) => ({ ...o, action: "none" })), mapsTo: "budget" });
  }
  if (ctwaFlow?.timelineOptions?.length) {
    qs.push({ id: "timeline", questionText: "Got it. When are you looking to finalize?", options: ctwaFlow.timelineOptions.map((o) => ({ ...o, action: "none" })), mapsTo: "timeline" });
  }
  return qs;
}

// A legacy menu option with action "site_visit" meant "open the slot
// picker" back when that was a separate hardcoded step — remapped to
// "none" here, since the equivalent now is simply that the site-visit
// question comes right after this one in the array, and "none" already
// means "move to the next question."
function legacyMenuAndSiteVisit(ctwaFlow) {
  const qs = [];
  if (ctwaFlow?.menuOptions?.length) {
    qs.push({
      id: "menu",
      questionText: ctwaFlow.menuPrompt || "Great, what would you like to see next?",
      options: ctwaFlow.menuOptions.map((m) => ({ id: m.id, label: m.label, action: m.action === "site_visit" ? "none" : (m.action || "none") })),
      mapsTo: "none",
    });
  }
  if (ctwaFlow?.siteVisitSlots?.length) {
    qs.push({
      id: "site_visit_slots",
      questionText: ctwaFlow.siteVisitPrompt || "Which time works best for your visit?",
      options: ctwaFlow.siteVisitSlots.map((s) => ({ id: s.id, label: s.label, action: "site_visit" })),
      mapsTo: "none",
    });
  }
  return qs;
}

// Handles three states, not just "fully legacy" vs. "fully migrated":
//   1. No qualifyingQuestions at all — everything (purpose/budget/timeline
//      AND menu/site-visit) is synthesized from the old separate fields.
//   2. qualifyingQuestions already has entries (e.g. purpose/budget/
//      timeline were migrated at some point) but menuOptions/siteVisitSlots
//      are STILL separate, un-folded fields — those two questions are
//      appended on top, since otherwise this in-between state silently
//      drops the menu/site-visit steps entirely (a real bug: an agent
//      migrated before menu/site-visit were folded in lost both steps from
//      its live flow, not just this editor — see ctwaFlowService.js's
//      identical getQualifyingQuestions, which this mirrors exactly).
//   3. qualifyingQuestions already includes a folded-in "menu" /
//      "site_visit_slots" question (tenant re-saved through the current
//      builder) — nothing appended, no duplicates.
function resolveQualifyingQuestions(ctwaFlow) {
  const saved = ctwaFlow?.qualifyingQuestions;
  const qs = saved?.length ? [...saved] : legacyPurposeBudgetTimeline(ctwaFlow);
  const hasMenu  = qs.some((q) => q.id === "menu");
  const hasSlots = qs.some((q) => q.id === "site_visit_slots");
  if (!hasMenu || !hasSlots) {
    for (const q of legacyMenuAndSiteVisit(ctwaFlow)) {
      if ((q.id === "menu" && !hasMenu) || (q.id === "site_visit_slots" && !hasSlots)) qs.push(q);
    }
  }
  return qs;
}

const MAPS_TO_OPTIONS = [
  { value: "none",              label: "Don't map — just record the answer" },
  { value: "purpose",           label: "Purpose (Buy / Rent / Invest)" },
  { value: "budget",            label: "Budget range" },
  { value: "timeline",          label: "Timeline" },
  { value: "bhk",                label: "Configuration (BHK)" },
  { value: "propertyType",      label: "Property type" },
  { value: "city",               label: "City" },
  { value: "preferredLocation", label: "Preferred location" },
  { value: "streetAddress",     label: "Street address" },
];

// Per-option action — independent of the question's own "Maps to". Only
// offered on questions that don't map to a real lead field ("none"), since a
// Purpose/Budget/Timeline answer is about capturing structured data, not
// triggering a send or an ending.
const OPTION_ACTIONS = [
  { value: "none",       label: "Just record the answer, then continue" },
  { value: "photos",     label: "Send photos & videos, then continue" },
  { value: "docs",       label: "Send floor plan & brochure, then continue" },
  { value: "location",   label: "Send the project location, then continue" },
  { value: "advisor",    label: "End here — connect to a human advisor" },
  { value: "site_visit", label: "End here — book a site visit (uses this button's own label as the time)" },
];

// Common lead-qualifying buttons most real-estate WhatsApp bots use — a
// quick-add dropdown next to each step's manual input, same pattern as the
// Amenities dropdown on the Project form. Picking one adds it instantly;
// wording can still be edited or removed like any other chip.
const PRESET_PURPOSE = ["Self Use", "Investment", "Buy", "Rent", "Just Exploring"];
const PRESET_TIMELINE = ["Within 30 Days", "1-3 Months", "3-6 Months", "6-12 Months", "Just Exploring"];
const PRESET_BHK = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK+", "Studio"];
const PRESET_PROPERTY_TYPE = ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse"];
// Which quick-add presets make sense once a question is mapped to a
// specific field — "none" (and anything not listed) gets no presets, since
// there's nothing to suggest for an arbitrary custom question.
const MAPS_TO_PRESETS = {
  purpose: PRESET_PURPOSE,
  timeline: PRESET_TIMELINE,
  bhk: PRESET_BHK,
  propertyType: PRESET_PROPERTY_TYPE,
};
const PRESET_BUDGET_BRACKETS = [
  { label: "Under ₹50L", min: 0, max: 5000000 },
  { label: "₹50L - ₹75L", min: 5000000, max: 7500000 },
  { label: "₹75L - ₹1Cr", min: 7500000, max: 10000000 },
  { label: "₹1Cr - ₹1.5Cr", min: 10000000, max: 15000000 },
  { label: "₹1.5Cr+", min: 15000000, max: 0 },
  { label: "Just Exploring", min: 0, max: 0 },
];
const PRESET_MENU_OPTIONS = [
  { label: "🖼️ Photos & Videos", action: "photos" },
  { label: "📄 Floor Plan & Brochure", action: "docs" },
  { label: "📍 Location Details", action: "location" },
  { label: "🏡 Book Site Visit", action: "site_visit" },
  { label: "📞 Talk to Advisor", action: "advisor" },
];

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { org, user } = useAuth();
  // The button flow is an Enterprise feature; the server refuses it below that.
  const flowAllowed = user?.role === "super_admin" || canAccess(org, "enterprise");
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [projects, setProjects] = useState([]);
  const [readiness, setReadiness] = useState(null);

  const [form, setForm] = useState({
    name: "", personaName: "", description: "", status: "draft", greeting: "", greetingEnabled: true,
    businessContext: "", groundRules: "", projectIds: [],
    systemPrompt: "", language: "auto", adIds: [],
    shareProjectPhotos: false, shareBrochure: false, shareVideos: false, shareFloorPlan: false,
    ctwaFlow: DEFAULT_CTWA_FLOW,
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFlow = (patch) => setForm((f) => ({ ...f, ctwaFlow: { ...f.ctwaFlow, ...patch } }));
  // patch === null turns a closing button off; an object turns it on and/or
  // renames it. Offered in the fixed order above, and never left empty.
  const setClosingButton = (id, patch) => setForm((f) => {
    const current = f.ctwaFlow.closingButtons;
    let next;
    if (patch === null) next = current.filter((b) => b.id !== id);
    else if (current.some((b) => b.id === id)) next = current.map((b) => (b.id === id ? { ...b, ...patch } : b));
    else next = CLOSING_DEFAULTS.map((d) => (d.id === id ? { id, label: d.label, ...patch } : current.find((b) => b.id === d.id))).filter(Boolean);
    if (!next.length) return f;
    return { ...f, ctwaFlow: { ...f.ctwaFlow, closingButtons: next } };
  });
  const [section, setSection] = useState("basics");
  const [openQuestion, setOpenQuestion] = useState(null);
  const [previewTab, setPreviewTab] = useState("chat");
  // What was last loaded or saved, to show "Unsaved changes" and warn on leave.
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const dirty = savedSnapshot !== null ? JSON.stringify(form) !== savedSnapshot : !!form.name.trim();
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [adDraft, setAdDraft] = useState("");
  const [testPhoneDraft, setTestPhoneDraft] = useState("");

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
        const loaded = {
          name: a.name || "", personaName: a.personaName || "", description: a.description || "", status: a.status || "draft",
          greeting: a.greeting || "", greetingEnabled: a.greetingEnabled !== false, businessContext: a.businessContext || "",
          groundRules: a.groundRules || "",
          projectIds: (a.projectIds || []).map((p) => String(p?._id || p)),
          systemPrompt: a.systemPrompt || "", language: a.language || "auto",
          adIds: a.adIds || [],
          shareProjectPhotos: a.shareProjectPhotos === true, shareBrochure: a.shareBrochure === true,
          shareVideos: a.shareVideos === true, shareFloorPlan: a.shareFloorPlan === true,
          // Merged over the defaults rather than used as-is — an agent saved
          // before welcomeText existed would otherwise load that field as
          // undefined and turn its textarea into an uncontrolled input.
          // qualifyingQuestions specifically: an agent saved before it existed
          // (old purposeQuestion/purposeOptions/budgetBrackets/timelineOptions
          // shape) gets it synthesized on load — the next Save persists the
          // new shape for good, no separate migration needed.
          ctwaFlow: a.ctwaFlow?.welcomeText !== undefined
            ? {
                ...DEFAULT_CTWA_FLOW,
                ...a.ctwaFlow,
                qualifyingQuestions: resolveQualifyingQuestions(a.ctwaFlow),
                closingButtons: resolveClosingButtons(a.ctwaFlow),
              }
            : DEFAULT_CTWA_FLOW,
        };
        setForm(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
        if (a.systemPrompt) setSection("advanced");
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
        setSavedSnapshot(JSON.stringify(form));
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

  const addTestPhone = () => {
    const v = testPhoneDraft.replace(/\D/g, "");
    if (!v) return;
    if (form.ctwaFlow.testPhones.includes(v)) return setTestPhoneDraft("");
    setFlow({ testPhones: [...form.ctwaFlow.testPhones, v] });
    setTestPhoneDraft("");
  };

  const addAd = () => {
    const v = adDraft.trim();
    if (!v) return;
    if (form.adIds.includes(v)) return setAdDraft("");
    set({ adIds: [...form.adIds, v] });
    setAdDraft("");
  };

  // Generous headroom above the old fixed 3 (purpose/budget/timeline) now
  // that what used to be the separate "what next?" and "site visit" steps
  // are just more entries in this same list — a tenant can still add more
  // questions after them. Mirrors backend CTWA_MAX_QUESTIONS.
  const MAX_QUALIFYING_QUESTIONS = 8;
  const updateQuestion = (index, next) => setFlow({
    qualifyingQuestions: form.ctwaFlow.qualifyingQuestions.map((q, i) => (i === index ? next : q)),
  });
  const removeQuestion = (index) => {
    if (form.ctwaFlow.qualifyingQuestions.length <= 1) return;
    setFlow({ qualifyingQuestions: form.ctwaFlow.qualifyingQuestions.filter((_, i) => i !== index) });
  };
  const moveQuestion = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= form.ctwaFlow.qualifyingQuestions.length) return;
    const next = [...form.ctwaFlow.qualifyingQuestions];
    [next[index], next[target]] = [next[target], next[index]];
    setFlow({ qualifyingQuestions: next });
  };
  const addQuestion = () => {
    if (form.ctwaFlow.qualifyingQuestions.length >= MAX_QUALIFYING_QUESTIONS) return;
    setFlow({
      qualifyingQuestions: [
        ...form.ctwaFlow.qualifyingQuestions,
        { id: `q_${Date.now().toString(36)}`, questionText: "", options: [], mapsTo: "none" },
      ],
    });
  };

  if (loading) {
    return (
      <div className="stitch-page">
        <div className="card p-5 h-64 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  // ── The page in sections (22 Oct 2026 redesign) ─────────────────────────
  // One section on screen at a time instead of seven cards down one long
  // page; a left list says what each holds and whether it is done; Save
  // stays in a sticky bar; the preview sits beside whatever is being edited.
  const narrowScope = form.projectIds.length > 0 && form.projectIds.length < projects.length / 2;
  const flow = form.ctwaFlow;
  const qCount = flow.qualifyingQuestions.length;
  const sendCount = [form.shareProjectPhotos, form.shareBrochure, form.shareVideos, form.shareFloorPlan].filter(Boolean).length;
  const testingLock = flow.testPhones.length > 0 && form.status === "active";
  const hasContext = !!(form.businessContext.trim() || form.systemPrompt.trim());
  const hasRules = !!(form.groundRules.trim() || form.systemPrompt.trim());
  const SECTIONS = [
    { key: "basics",    label: "Basics",            summary: form.name.trim() ? (form.description.trim() ? "Done" : "Say what it does") : "Needs a name", state: form.name.trim() && form.description.trim() ? "ok" : "todo" },
    { key: "talk",      label: "How it talks",      summary: form.greetingEnabled === false ? "No greeting (ad greets)" : form.greeting.trim() ? "Greets with your text" : "Greets in its own words", state: hasContext && hasRules ? "ok" : "todo" },
    { key: "knowledge", label: "What it knows",     summary: projects.length === 0 ? "No projects yet" : form.projectIds.length ? `${form.projectIds.length} of ${projects.length} projects` : `All ${projects.length} projects`, state: projects.length === 0 || narrowScope ? "warn" : "ok" },
    { key: "questions", label: "Button questions",  summary: !flowAllowed ? "Enterprise plan" : flow.enabled ? `${qCount} question${qCount === 1 ? "" : "s"}` : "Off", state: flow.enabled ? "ok" : "off" },
    { key: "send",      label: "What it can send",  summary: sendCount ? `${sendCount} of 4 on` : "Nothing yet", state: sendCount ? "ok" : "off" },
    { key: "live",      label: "Ads and go live",   summary: testingLock ? "Locked to test numbers" : form.status !== "active" ? STATUSES.find((s) => s.value === form.status)?.label.split(" ")[0] : form.adIds.length ? `${form.adIds.length} ad${form.adIds.length === 1 ? "" : "s"} routed` : "Every conversation", state: testingLock ? "danger" : form.status === "active" ? "ok" : "off" },
  ];
  const DOT = { ok: "#16a34a", todo: "#f59e0b", warn: "#f59e0b", off: "#d1d5db", danger: "#dc2626" };
  const current = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const currentIdx = SECTIONS.indexOf(current);
  const goTo = (key) => { setSection(key); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const sectionTitle = (title, sub) => (
    <div>
      <h2 className="text-lg font-bold text-app">{title}</h2>
      {sub && <p className="text-sm text-app-soft mt-0.5">{sub}</p>}
    </div>
  );
  const Toggle = ({ on, onChange, label }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative shrink-0 rounded-full transition"
      style={{ width: 46, height: 26, background: on ? "var(--app-primary)" : "#d1d5db" }}>
      <span className="absolute top-[3px] rounded-full bg-white shadow transition-all" style={{ width: 20, height: 20, left: on ? 23 : 3 }} />
    </button>
  );
  const Row = ({ title, hint, children }) => (
    <div className="flex items-start justify-between gap-4 rounded-2xl p-4" style={{ border: "1px solid var(--app-border)" }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-app">{title}</p>
        {hint && <p className="text-xs text-app-soft mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="stitch-page">
      {/* Sticky bar: name, status, setup score, Save. Nothing to scroll for. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5"
        style={{ background: "var(--app-surface-solid)", borderBottom: "1px solid var(--app-border)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { if (!dirty || window.confirm("Leave without saving your changes?")) navigate("/conversations/agent"); }}
            className="flex items-center gap-1.5 text-sm font-semibold text-app-soft hover:text-app transition">
            <ArrowLeft className="w-4 h-4" /> All agents
          </button>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <h1 className="text-base font-bold text-app truncate">{isNew ? "New agent" : form.name || "Agent"}</h1>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={form.status === "active"
                ? { background: "rgba(22,163,74,0.12)", color: "#15803d" }
                : form.status === "paused" ? { background: "rgba(245,158,11,0.14)", color: "#b45309" }
                : { background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: form.status === "active" ? "#16a34a" : form.status === "paused" ? "#f59e0b" : "#9ca3af" }} />
              {form.status === "active" ? "Live" : form.status === "paused" ? "Paused" : "Draft"}
            </span>
          </div>
          {readiness && (
            <button type="button" onClick={() => goTo(readiness.checks.find((c) => !c.ok)?.key === "knowledge" ? "knowledge" : readiness.checks.find((c) => !c.ok) ? (["context", "rules", "greeting"].includes(readiness.checks.find((c) => !c.ok).key) ? "talk" : "basics") : "basics")}
              className="hidden sm:flex items-center gap-2 text-left" title={readiness.checks.filter((c) => !c.ok).map((c) => c.label).join(", ") || "All set"}>
              <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--app-border)" strokeWidth="4" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={readiness.score === readiness.total ? "#16a34a" : "var(--app-primary)"} strokeWidth="4"
                  strokeDasharray={`${(readiness.score / readiness.total) * 94.2} 94.2`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                <text x="18" y="22" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--app-text)">{readiness.score}/{readiness.total}</text>
              </svg>
              <span className="text-[11px] leading-tight text-app-soft">
                Setup<br />
                <strong className="text-app">{readiness.score === readiness.total ? "All set" : readiness.checks.find((c) => !c.ok)?.label}</strong>
              </span>
            </button>
          )}
          {dirty && <span className="text-xs font-semibold" style={{ color: "#b45309" }}>Unsaved changes</span>}
          {!isNew && (
            <button onClick={remove} title="Delete this agent" aria-label="Delete this agent"
              className="btn-secondary rounded-full w-9 h-9 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="btn-primary rounded-full px-5 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : isNew ? "Create agent" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[224px_minmax(0,1fr)_380px] items-start">
        {/* Section list: a row of pills on a phone, a column on a desktop. */}
        <nav aria-label="Agent sections" className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0 lg:sticky lg:top-[76px]">
          {SECTIONS.map((s, i) => {
            const active = s.key === section;
            return (
              <button key={s.key} type="button" onClick={() => goTo(s.key)}
                className="shrink-0 lg:shrink flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition"
                style={active
                  ? { background: "var(--app-card-solid, var(--app-surface-solid))", border: "1px solid rgba(var(--app-primary-rgb),0.45)" }
                  : { border: "1px solid transparent" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOT[s.state] }} />
                <span className="min-w-0">
                  <span className={`block text-[13px] font-semibold leading-tight whitespace-nowrap ${active ? "" : "text-app"}`} style={active ? { color: "var(--app-primary)" } : undefined}>
                    {i + 1}. {s.label}
                  </span>
                  <span className="hidden lg:block text-[11px] text-app-soft truncate">{s.summary}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => goTo("advanced")}
            className="shrink-0 lg:shrink lg:mt-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-app-soft hover:text-app transition whitespace-nowrap"
            style={section === "advanced" ? { color: "var(--app-primary)" } : undefined}>
            Advanced
          </button>
        </nav>

        <div className="min-w-0 space-y-4">
          {section === "basics" && (
            <div className="card p-5 space-y-4">
              {sectionTitle("Basics", "Who this assistant is. Two minutes.")}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Name (for your team)</label>
                  <input className="input w-full" placeholder="e.g. Khopoli Project Advisor"
                    value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Name customers hear</label>
                  <input className="input w-full" placeholder="e.g. Riya"
                    value={form.personaName} onChange={(e) => set({ personaName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">What it does (one line, for your team)</label>
                <input className="input w-full" placeholder="e.g. Registers people for the 31 Oct webinar and answers questions about it"
                  value={form.description} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Reply language</label>
                  <CustomSelect value={form.language} onChange={(v) => set({ language: v })} options={LANGUAGES} style={SELECT_STYLE} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Status</label>
                  <CustomSelect value={form.status} onChange={(v) => set({ status: v })} options={STATUSES} style={SELECT_STYLE} />
                </div>
              </div>
            </div>
          )}

          {section === "talk" && (
            <div className="card p-5 space-y-4">
              {sectionTitle("How it talks", "The greeting, what it knows about your business, and its rules.")}
              <Row title="Send a greeting first" hint={form.greetingEnabled === false
                ? "Off: the first reply goes straight to the point. Right when your ad already greets people."
                : "Turn this off if your Click-to-WhatsApp ad already greets people, so nobody is welcomed twice."}>
                <Toggle on={form.greetingEnabled !== false} onChange={(v) => set({ greetingEnabled: v })} label="Send a greeting first" />
              </Row>
              {form.greetingEnabled !== false && (
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Greeting text <span className="font-normal">(optional, {"{{name}}"} works)</span></label>
                  <input className="input w-full" placeholder="Hi {{name}} 👋 Thanks for reaching out. How can I help you find your next home?"
                    value={form.greeting} onChange={(e) => set({ greeting: e.target.value })} />
                  <p className="text-xs text-app-soft mt-1">Leave empty and it greets in its own words.</p>
                </div>
              )}
              <Row title="Follow up if they go quiet" hint="If someone stops replying after a question, one gentle reminder after 15 minutes and one more before the day ends. Business hours only.">
                <Toggle on={flow.nudgesEnabled === true} onChange={(v) => setFlow({ nudgesEnabled: v })} label="Follow up if they go quiet" />
              </Row>
              {flow.nudgesEnabled === true && (
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Reminder wording</label>
                  <input className="input w-full" placeholder="Just checking in 🙂" maxLength={200}
                    value={flow.nudgeText || ""} onChange={(e) => setFlow({ nudgeText: e.target.value })} />
                  <p className="text-xs text-app-soft mt-1">Sent just above the repeated question, so keep it short.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">About your business</label>
                <textarea className="input w-full resize-none" rows={3}
                  placeholder="Who you are, the areas you cover, working hours, anything it should know."
                  value={form.businessContext} onChange={(e) => set({ businessContext: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-app-soft mb-1 block">Ground rules</label>
                <textarea className="input w-full resize-none" rows={3}
                  placeholder="Dos and don'ts. e.g. Never discuss other builders' prices. Always ask for a preferred visit day before booking."
                  value={form.groundRules} onChange={(e) => set({ groundRules: e.target.value })} />
                {/(₹|rs\.?\s?\d|inr\s?\d)\s?[\d,.]+\s?(l\b|lakh|lac|cr\b|crore|k\b)?/i.test(form.groundRules || "") && (
                  <p className="text-xs mt-1.5 font-semibold" style={{ color: "#dc2626" }}>
                    There is a price in these rules. Prices here go stale; set them on the Projects page and the assistant always reads the live one.
                  </p>
                )}
              </div>
            </div>
          )}

          {section === "knowledge" && (
            <div className="card p-5 space-y-4">
              {sectionTitle("What it knows", "Answers come from your Projects page. Change a price there and the next reply uses it.")}
              {projects.length === 0 ? (
                <p className="text-sm text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  No projects yet. Add one on the Projects page first.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-app">
                      {form.projectIds.length === 0
                        ? <>Can discuss <strong>all {projects.length}</strong> active projects.</>
                        : <>Can discuss <strong>{form.projectIds.length} of {projects.length}</strong> projects. For the others it says your team will follow up.</>}
                    </p>
                    {form.projectIds.length > 0 && (
                      <button type="button" onClick={() => set({ projectIds: [] })} className="text-xs font-semibold" style={{ color: "var(--app-primary)" }}>Allow all</button>
                    )}
                  </div>
                  <div className="rounded-xl divide-y max-h-72 overflow-y-auto" style={{ border: "1px solid var(--app-border)" }}>
                    {projects.map((p) => (
                      <label key={p._id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-[var(--app-surface-low)]">
                        <input type="checkbox" className="shrink-0" checked={form.projectIds.includes(p._id)} onChange={() => toggleProject(p._id)} />
                        <span className="flex-1 min-w-0 truncate text-app">{p.name}</span>
                        {p.location && <span className="text-xs text-app-soft truncate shrink-0 max-w-[40%]">{p.location}</span>}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-app-soft">Tick nothing to allow every active project, or tick only the ones this assistant is for.</p>
                </>
              )}
            </div>
          )}

          {section === "questions" && (
            <div className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {sectionTitle("Button questions", "Asked one at a time with WhatsApp buttons. Typed answers like \"1.5 cr\" count too.")}
                <label className="inline-flex items-center gap-2 shrink-0" style={{ cursor: flowAllowed ? "pointer" : "not-allowed", opacity: flowAllowed ? 1 : 0.6 }}
                  title={flowAllowed ? undefined : "Part of the Enterprise plan"}>
                  {!flowAllowed && <Lock className="w-3.5 h-3.5 text-app-soft" />}
                  <span className="text-xs font-semibold text-app">{flow.enabled ? "On" : "Off"}</span>
                  <Toggle on={flow.enabled} onChange={(v) => flowAllowed && setFlow({ enabled: v })} label="Button questions on or off" />
                </label>
              </div>

              {!flow.enabled ? (
                <p className="text-sm text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  Off. The assistant qualifies people in free text instead. Turn this on to ask your questions with tappable buttons and save the answers on the lead.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-app-soft mb-1 block">Welcome line <span className="font-normal">(optional, sent before the first question)</span></label>
                    <textarea className="input w-full resize-none" rows={2}
                      placeholder="Hi {{name}} 👋 Thanks for your interest in {{project}}!"
                      value={flow.welcomeText} onChange={(e) => setFlow({ welcomeText: e.target.value })} />
                    <p className="text-xs text-app-soft mt-1">Leave empty if your ad already greets people.</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-app-soft">Questions, in this order</p>
                    {flow.qualifyingQuestions.map((q, i) => (
                      <QualifyingQuestionEditor key={q.id} question={q} index={i} total={qCount}
                        allQuestions={flow.qualifyingQuestions}
                        open={openQuestion === q.id || !q.questionText.trim()}
                        onToggle={() => setOpenQuestion(openQuestion === q.id ? null : q.id)}
                        onChange={(next) => updateQuestion(i, next)}
                        onRemove={() => removeQuestion(i)}
                        onMoveUp={() => moveQuestion(i, -1)}
                        onMoveDown={() => moveQuestion(i, 1)} />
                    ))}
                    <button type="button" onClick={() => { addQuestion(); setOpenQuestion(null); }} disabled={qCount >= MAX_QUALIFYING_QUESTIONS}
                      className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 w-full">
                      <Plus className="w-3.5 h-3.5" /> Add a question
                    </button>
                  </div>

                  <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
                    <p className="text-sm font-semibold text-app">At the end, it offers</p>
                    <div className="space-y-2">
                      {CLOSING_DEFAULTS.map((d) => {
                        const row = flow.closingButtons.find((b) => b.id === d.id);
                        const isLast = !!row && flow.closingButtons.length === 1;
                        return (
                          <div key={d.id} className="flex items-center gap-2.5">
                            <input type="checkbox" className="shrink-0" checked={!!row} disabled={isLast}
                              title={isLast ? "At least one button has to stay" : undefined}
                              onChange={(e) => setClosingButton(d.id, e.target.checked ? {} : null)} />
                            <input className="input flex-1" maxLength={CLOSING_TITLE_MAX} disabled={!row}
                              value={row ? row.label : d.label}
                              onChange={(e) => setClosingButton(d.id, { label: e.target.value })} />
                            <span className="hidden sm:block text-[11px] text-app-soft w-40 shrink-0">{d.hint}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-soft mb-1 block">Closing question <span className="font-normal">({"{{name}}"} works)</span></label>
                      <input className="input w-full" placeholder="Would you like to talk to our advisor, or book a site visit?"
                        value={flow.closingPrompt} onChange={(e) => setFlow({ closingPrompt: e.target.value })} />
                    </div>
                    {flow.closingButtons.some((b) => b.id === "site_visit") && (
                      <div>
                        <label className="text-xs font-semibold text-app-soft mb-1 block">When they tap the site visit button</label>
                        <CustomSelect value={flow.closingSiteVisitNext || ""} onChange={(v) => setFlow({ closingSiteVisitNext: v })}
                          options={[
                            { value: "", label: "Ask the visit-time question if there is one, else book at once" },
                            { value: CLOSING_BOOK_IMMEDIATELY, label: "Book at once, no question" },
                            ...flow.qualifyingQuestions.filter((q) => q.options.length).map((q) => ({ value: q.id, label: `Ask: ${q.questionText.slice(0, 50) || "(untitled question)"}` })),
                          ]}
                          style={SELECT_STYLE} />
                      </div>
                    )}
                  </div>

                  {!isNew && <FlowFunnel agentId={id} />}
                </>
              )}
            </div>
          )}

          {section === "send" && (
            <div className="card p-5 space-y-3">
              {sectionTitle("What it can send", "Off by default. Only files uploaded on the Projects page are ever sent, and never in the first reply.")}
              {[
                ["shareProjectPhotos", "Project photos"],
                ["shareVideos", "Project video", "up to 10 MB"],
                ["shareBrochure", "Brochure (PDF)"],
                ["shareFloorPlan", "Floor plan (PDF)"],
              ].map(([key, label, note]) => (
                <Row key={key} title={label} hint={note}>
                  <Toggle on={!!form[key]} onChange={(v) => set({ [key]: v })} label={label} />
                </Row>
              ))}
              <p className="text-xs text-app-soft">Works on the direct Arthaleads connection only, not on AiSensy, Wati or Interakt.</p>
            </div>
          )}

          {section === "live" && (
            <div className="card p-5 space-y-4">
              {sectionTitle("Ads and go live", "Which conversations reach this assistant, and how to test it safely.")}
              <Row title="Status" hint={form.status === "active" ? "Answering customers now." : form.status === "paused" ? "Not answering. Chats go to your team." : "Still being written. Not answering."}>
                <div className="w-48 shrink-0"><CustomSelect value={form.status} onChange={(v) => set({ status: v })} options={STATUSES} style={SELECT_STYLE} /></div>
              </Row>

              <div className="rounded-2xl p-4 space-y-2" style={{ border: "1px solid var(--app-border)" }}>
                <p className="text-sm font-semibold text-app">Click-to-WhatsApp ads</p>
                <p className="text-xs text-app-soft">Paste the Ad ID from Ads Manager (the ad, not the campaign). Anyone messaging from that ad reaches this assistant.</p>
                <div className="flex items-center gap-2">
                  <input className="input flex-1 font-mono text-xs" placeholder="Ad ID e.g. 1202101234567890"
                    value={adDraft} onChange={(e) => setAdDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAd(); } }} />
                  <button type="button" onClick={addAd} disabled={!adDraft.trim()}
                    className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {form.adIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.adIds.map((ad) => (
                      <span key={ad} className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                        {ad}
                        <button type="button" onClick={() => set({ adIds: form.adIds.filter((a) => a !== ad) })} aria-label={`Remove ad ${ad}`}
                          className="text-app-soft hover:text-red-500 transition"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-app-soft">No ads yet{form.ctwaFlow.enabled ? ", so the button questions run for every conversation this assistant handles" : ""}.</p>
                )}
              </div>

              <div className="rounded-2xl p-4 space-y-2" style={testingLock
                ? { border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.05)" }
                : { border: "1px solid var(--app-border)" }}>
                <p className="text-sm font-semibold text-app">Test with your own number first</p>
                <p className="text-xs text-app-soft">While any number is listed here, only those numbers get the button questions. Everyone else gets the normal chat. Clear the list when you are done.</p>
                <div className="flex items-center gap-2">
                  <input className="input flex-1 font-mono text-xs" placeholder="e.g. 919876543210"
                    value={testPhoneDraft} onChange={(e) => setTestPhoneDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTestPhone(); } }} />
                  <button type="button" onClick={addTestPhone} disabled={!testPhoneDraft.trim()}
                    className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {flow.testPhones.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {flow.testPhones.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                        style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                        {p}
                        <button type="button" onClick={() => setFlow({ testPhones: flow.testPhones.filter((x) => x !== p) })} aria-label={`Remove ${p}`}
                          className="text-app-soft hover:text-red-500 transition"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {testingLock && (
                  <p className="text-xs font-semibold" style={{ color: "#dc2626" }}>
                    This assistant is live but locked to {flow.testPhones.length} test number{flow.testPhones.length > 1 ? "s" : ""}. Real leads are getting the normal chat, not the button questions. Clear the list to go live for everyone.
                  </p>
                )}
              </div>
            </div>
          )}

          {section === "advanced" && (
            <div className="card p-5 space-y-3">
              {sectionTitle("Advanced", "Write the whole instruction yourself. Most teams never need this.")}
              <textarea className="input w-full resize-none" rows={8}
                placeholder="Leave empty to use the settings in the other sections. Anything written here replaces them entirely."
                value={form.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
              <p className="text-xs text-app-soft">
                When this is filled in, the greeting, business context, ground rules and project list are all ignored.
              </p>
            </div>
          )}

          {section !== "advanced" && (
            <div className="flex items-center justify-between gap-3">
              <button type="button" disabled={currentIdx === 0} onClick={() => goTo(SECTIONS[currentIdx - 1].key)}
                className="btn-secondary rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-40">
                ← {currentIdx > 0 ? SECTIONS[currentIdx - 1].label : "Back"}
              </button>
              {currentIdx < SECTIONS.length - 1 ? (
                <button type="button" onClick={() => goTo(SECTIONS[currentIdx + 1].key)}
                  className="btn-secondary rounded-full px-4 py-2 text-xs font-semibold">
                  Next: {SECTIONS[currentIdx + 1].label} →
                </button>
              ) : (
                <button onClick={save} disabled={saving} className="btn-primary rounded-full px-5 py-2 text-xs font-bold disabled:opacity-40">
                  {isNew ? "Create agent" : "Save"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Preview beside the form: a chat you type into, or the button flow tapped through. */}
        <div className="space-y-3 lg:sticky lg:top-[76px]">
          <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "var(--app-surface-low)" }}>
            {[["chat", "Chat preview"], ["flow", "Button flow"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPreviewTab(k)}
                className="flex-1 rounded-full py-1.5 text-xs font-semibold transition"
                style={previewTab === k ? { background: "var(--app-card-solid, var(--app-surface-solid))", color: "var(--app-primary)", boxShadow: "var(--app-shadow-sm, 0 1px 2px rgba(0,0,0,0.08))" } : { color: "var(--app-text-soft)" }}>
                {label}
              </button>
            ))}
          </div>
          {previewTab === "chat" ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <h3 className="text-base font-bold text-app">Try it</h3>
            </div>

            <p className="text-xs text-app-soft">
              Uses what is on screen now, saved or not. Nothing is sent on WhatsApp, no credit used.
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
                    {(m.wantsPhotos || m.wantsBrochure || m.wantsVideos || m.wantsFloorPlan) && (
                      <span className="block text-[10px] font-bold mt-1.5" style={{ color: "var(--app-primary)" }}>
                        📎 would send {[m.wantsPhotos && "project photos", m.wantsVideos && "the video", m.wantsFloorPlan && "the floor plan", m.wantsBrochure && "the brochure"].filter(Boolean).join(" and ")} here — not sent in Try It
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

          ) : (
            <CtwaFlowPreviewPanel flow={form.ctwaFlow}
              projectName={projects.find((p) => form.projectIds.includes(String(p._id)))?.name} />
          )}
        </div>
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

// Mirrors ctwaFlowService.js's closing step: the buttons this agent offers
// (see resolveClosingButtons), reached once every question above has been
// asked with nothing else ending the flow first. A tap on either id still
// resolves even if the tenant left that button out of the flow.
const CLOSING_IDS = CLOSING_DEFAULTS.map((d) => d.id);
function closingPromptText(flow, buttons) {
  const stock = !flow.closingPrompt || flow.closingPrompt === DEFAULT_CLOSING_PROMPT;
  if (!stock) return flow.closingPrompt;
  return buttons.some((b) => b.id === "site_visit") ? DEFAULT_CLOSING_PROMPT : ADVISOR_ONLY_CLOSING_PROMPT;
}

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
    // the bot talking over itself. Skipped entirely when blank, same as the
    // backend — for when Meta's own ad-level "Automated greeting" is already
    // covering it and a second one here would be redundant.
    if (flow.welcomeText.trim()) {
      push({ from: "bot", text: fillVars(flow.welcomeText, vars) });
    }
    const first = flow.qualifyingQuestions?.[0];
    if (!first || !first.options.length) {
      push({ from: "bot", warn: true, text: "No qualifying questions configured yet — add at least one above to preview past this step." });
      setStep(null);
      return;
    }
    push({ from: "bot", text: fillVars(first.questionText, vars) || "(question text is empty)", buttons: first.options });
    setStep(first.id);
  };

  useEffect(() => { restart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sends one question, or a warning if it has no options yet (can happen
  // on an unsaved, still-being-edited question).
  const sendQuestion = (q) => {
    if (!q.options.length) {
      push({ from: "bot", warn: true, text: "This question has no options yet — add at least one above to preview past this step." });
      setStep(null);
      return;
    }
    push({ from: "bot", text: fillVars(q.questionText, vars) || "(question text is empty)", buttons: q.options });
    setStep(q.id);
  };

  const sendClosing = () => {
    const buttons = resolveClosingButtons(flow);
    push({ from: "bot", text: closingPromptText(flow, buttons), buttons });
    setStep("closing");
  };

  const bookSiteVisit = () => {
    push({ from: "bot", text: "Wonderful! Our team will confirm your visit shortly and take it from here." });
    push({ from: "bot", note: true, text: "✅ Lead updated: status → Site Visit, booking → Site Visit Booked, activity logged. Bot pauses and a human on your team is assigned and notified." });
    setStep(null);
  };

  // Matched by button id across every question, not by whatever step is
  // currently recorded — mirrors ctwaFlowService.advanceFlow exactly. A real
  // WhatsApp message's buttons never stop being tappable once a newer one
  // is sent, and a lead often wants to revisit an earlier question (check
  // the floor plan after already seeing the location; pick a different
  // budget) rather than being stuck wherever they last left off — so every
  // button in this preview stays live too, for as long as the flow hasn't
  // reached a true ending (advisor connected, or a site visit booked).
  const tap = (opt) => {
    push({ from: "user", text: opt.label });

    const questions = flow.qualifyingQuestions || [];
    const qIndex = questions.findIndex((q) => q.options.some((o) => o.id === opt.id));
    const inClosing = CLOSING_IDS.includes(opt.id);

    if (qIndex !== -1) {
      const action = opt.action || "none";
      if (action === "advisor") { pushAdvisorTerminal(); setStep(null); return; }
      if (action === "site_visit") { bookSiteVisit(); return; }
      // Informational — never a dead end, and never retires this question's
      // own buttons: they (and this one) stay tappable after.
      if (action === "photos") {
        push({ from: "bot", note: true, text: "🖼️ Sends up to 3 project photos and all uploaded videos, whatever is uploaded for this project." });
      } else if (action === "docs") {
        push({ from: "bot", note: true, text: "📄 Sends the floor plan PDF and the brochure PDF, whatever is uploaded for this project." });
      } else if (action === "location") {
        push({ from: "bot", text: `This project is located at: ${projectName ? "(the project's saved location)" : "(no single project — assign one above to resolve this)"}` });
      }
      // An explicit "then go to" wins over the default array-order
      // progression — mirrors ctwaFlowService.advanceFlow exactly.
      if (opt.next === NEXT_CLOSING) { sendClosing(); return; }
      const target = opt.next ? questions.find((q) => q.id === opt.next) : questions[qIndex + 1];
      if (target) sendQuestion(target); else sendClosing();
      return;
    }

    if (inClosing) {
      if (opt.id === "advisor") { pushAdvisorTerminal(); setStep(null); return; }
      // "Book Site Visit" from the closing prompt — a configured target
      // wins outright, else auto-detect a question where every option
      // books a visit, else book immediately. Mirrors ctwaFlowService.js.
      const configured = flow.closingSiteVisitNext || "";
      if (configured === CLOSING_BOOK_IMMEDIATELY) { bookSiteVisit(); return; }
      const target = configured
        ? questions.find((q) => q.id === configured)
        : questions.find((q) => q.options.length && q.options.every((o) => o.action === "site_visit"));
      if (target) sendQuestion(target); else bookSiteVisit();
      return;
    }
  };

  const pushAdvisorTerminal = () => {
    push({ from: "bot", text: "Connecting you with our advisor, they'll reach out to you shortly. You can also reach them directly on <their phone number>." });
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

// One qualifying question: its own text, which real Lead field (if any) the
// answer maps to, and its options — a budget-mapped question gets the
// min/max-aware BudgetBracketEditor, everything else gets the plain
// label-only ChipRowEditor. Replaces what used to be three separate fixed
// Purpose/Budget/Timeline sections with one repeatable card, since the
// qualifying phase is now an open-ended tenant-authored list.
function QualifyingQuestionEditor({ question, index, total, allQuestions, open = true, onToggle, onChange, onRemove, onMoveUp, onMoveDown }) {
  const setQ = (patch) => onChange({ ...question, ...patch });
  const presets = MAPS_TO_PRESETS[question.mapsTo];
  const mapsLabel = (MAPS_TO_OPTIONS.find((o) => o.value === question.mapsTo)?.label || "").replace(/\s*\(.*\)$/, "");
  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ border: "1px solid var(--app-border)" }}>
        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-app truncate">{question.questionText || "(untitled question)"}</p>
          <p className="text-[11px] text-app-soft truncate">
            {question.options.length ? question.options.map((o) => o.label).join(" · ") : "No buttons yet"}
            {question.mapsTo !== "none" && mapsLabel ? ` · saves to ${mapsLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0} title="Move up" aria-label="Move up"
            className="p-1 rounded-lg text-app-soft hover:text-app transition disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} title="Move down" aria-label="Move down"
            className="p-1 rounded-lg text-app-soft hover:text-app transition disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={onToggle} className="btn-secondary rounded-full px-3 py-1.5 text-xs font-semibold">Edit</button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid rgba(var(--app-primary-rgb),0.45)", background: "rgba(var(--app-primary-rgb),0.04)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--app-primary)" }}>Question {index + 1} of {total}</p>
        <div className="flex items-center gap-1">
          {onToggle && <button type="button" onClick={onToggle} className="btn-secondary rounded-full px-3 py-1 text-xs font-semibold mr-1">Done</button>}
          <button type="button" onClick={onMoveUp} disabled={index === 0} title="Move up"
            className="p-1 rounded-lg text-app-soft hover:text-app transition disabled:opacity-30 disabled:hover:text-app-soft">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} title="Move down"
            className="p-1 rounded-lg text-app-soft hover:text-app transition disabled:opacity-30 disabled:hover:text-app-soft">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} disabled={total <= 1} title="Remove question"
            className="p-1 rounded-lg text-app-soft hover:text-red-500 transition disabled:opacity-30 disabled:hover:text-app-soft">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-app-soft block mb-1">Question text</label>
        <input className="input w-full" placeholder="e.g. Are you looking for this primarily for:"
          value={question.questionText} onChange={(e) => setQ({ questionText: e.target.value })} />
      </div>

      <div>
        <label className="text-xs font-semibold text-app-soft block mb-1">Save the answer as</label>
        <CustomSelect value={question.mapsTo} onChange={(v) => setQ({ mapsTo: v })} options={MAPS_TO_OPTIONS} style={SELECT_STYLE} />
        <p className="text-[11px] text-app-soft mt-1">
          {question.mapsTo === "none"
            ? "Kept on the lead's Info tab as it was answered."
            : "Written to this field on the lead when the answer fits it."}
        </p>
      </div>

      {question.mapsTo === "budget"
        ? <BudgetBracketEditor rows={question.options} onChange={(rows) => setQ({ options: rows })} />
        : question.mapsTo === "none"
        ? <OptionActionEditor rows={question.options} onChange={(rows) => setQ({ options: rows })} presets={PRESET_MENU_OPTIONS}
            otherQuestions={allQuestions.filter((q) => q.id !== question.id)} />
        : <ChipRowEditor label="Options — up to 10, shown as buttons if 3 or fewer, a list if more" max={10} presets={presets}
            rows={question.options} onChange={(rows) => setQ({ options: rows })} />}
    </div>
  );
}

// Min/max are inferred from the label ("₹50L - ₹75L", "Under ₹50L", "₹1.5Cr+")
// so the tenant only types one thing. Unparseable labels get 0/0 and are
// recorded as an answer instead of written to the budget field.
function parseBracketLabel(label) {
  const nums = [...String(label).replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(cr|crore|l|lac|lakh|k)?/gi)]
    .map((m) => Number(m[1]) * ({ cr: 1e7, crore: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, k: 1e3 }[(m[2] || "").toLowerCase()] || 1));
  if (!nums.length) return { min: 0, max: 0 };
  if (/under|below|upto|up to|<|less/i.test(label)) return { min: 0, max: nums[0] };
  if (nums.length === 1) return { min: nums[0], max: 0 };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

function BudgetBracketEditor({ rows, onChange }) {
  const [label, setLabel] = useState("");
  const addRow = (row) => {
    if (rows.length >= 10 || rows.some((r) => r.label.toLowerCase() === row.label.toLowerCase())) return;
    onChange([...rows, { id: slugify(row.label, rows.length), ...row }]);
  };
  const add = () => {
    if (!label.trim()) return;
    addRow({ label: label.trim(), ...parseBracketLabel(label) });
    setLabel("");
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
        <button type="button" onClick={add} disabled={!label.trim() || rows.length >= 10}
          className="btn-secondary rounded-full px-2.5 py-1.5 disabled:opacity-40 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {rows.length > 0 && <DraggableChips rows={rows} onChange={onChange} />}
    </div>
  );
}

// Used on any question that doesn't map to a real lead field ("Maps to" =
// "none") — this is what a "what next?" menu or a "which time works for
// you" slot picker actually is now: an ordinary question whose options
// happen to carry an action. Each option gets its own action dropdown,
// editable any time — not fixed at add-time the way it used to be.
function OptionActionEditor({ rows, onChange, presets, otherQuestions = [] }) {
  const [draft, setDraft] = useState("");
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const add = (text) => {
    text = text.trim();
    if (!text || rows.length >= 10 || rows.some((r) => r.label.toLowerCase() === text.toLowerCase())) return;
    onChange([...rows, { id: slugify(text, rows.length), label: text, action: "none", next: "" }]);
    setDraft("");
  };
  const addPreset = (p) => {
    if (rows.length >= 10 || rows.some((r) => r.label.toLowerCase() === p.label.toLowerCase())) return;
    onChange([...rows, { id: slugify(p.label, rows.length), label: p.label, action: p.action, next: "" }]);
  };
  const setAction = (rowId, action) => onChange(rows.map((r) => (r.id === rowId ? { ...r, action } : r)));
  const setNext = (rowId, next) => onChange(rows.map((r) => (r.id === rowId ? { ...r, next } : r)));
  const NEXT_OPTIONS = [
    { value: "", label: "Continue automatically (default)" },
    ...otherQuestions.filter((q) => q.questionText.trim()).map((q) => ({ value: q.id, label: `Skip to: ${q.questionText.slice(0, 40)}` })),
    { value: NEXT_CLOSING, label: "Skip straight to closing" },
  ];
  const reorder = (from, to) => {
    if (from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const remaining = presets?.filter((p) => !rows.some((r) => r.label.toLowerCase() === p.label.toLowerCase()));

  return (
    <div>
      <label className="text-xs font-semibold text-app-soft block mb-1">Options — up to 10, shown as buttons if 3 or fewer, a list if more</label>
      <p className="text-[11px] text-app-soft mb-1">
        Each option can just record the answer and move to the next question, send something and still keep going
        (never a dead end), or end the flow outright.
      </p>
      {presets && remaining.length > 0 && (
        <CustomSelect value="" onChange={(v) => addPreset(remaining.find((p) => p.label === v))}
          options={remaining.map((p) => p.label)} placeholder="Quick add a common option…" style={PRESET_SELECT_STYLE} />
      )}
      <div className={`${ROW_CLS} mt-2`}>
        <input className={`${SMALL_INPUT} flex-1`} value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Or type your own…" disabled={rows.length >= 10}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} />
        <button type="button" onClick={() => add(draft)} disabled={!draft.trim() || rows.length >= 10}
          className="btn-secondary rounded-full px-2.5 py-1.5 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {rows.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {rows.map((r, i) => {
            const isTerminal = r.action === "advisor" || r.action === "site_visit";
            return (
              <div key={r.id} draggable
                onDragStart={(e) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
                onDrop={(e) => { e.preventDefault(); if (dragIndex.current !== null) reorder(dragIndex.current, i); dragIndex.current = null; setOverIndex(null); }}
                onDragEnd={() => { dragIndex.current = null; setOverIndex(null); }}
                className="rounded-xl px-2.5 py-1.5 cursor-grab active:cursor-grabbing space-y-1.5"
                style={{ background: "var(--app-surface-low)", border: overIndex === i ? "1px dashed var(--app-primary)" : "1px solid var(--app-border)" }}>
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3.5 h-3.5 text-app-soft shrink-0" />
                  <span className="text-xs font-semibold text-app flex-1 min-w-0 truncate">{r.label}</span>
                  <CustomSelect value={r.action || "none"} onChange={(v) => setAction(r.id, v)}
                    options={OPTION_ACTIONS} style={{ minWidth: 170, padding: "5px 10px", borderRadius: "0.6rem", fontSize: 11 }} />
                  <button type="button" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                    className="text-app-soft hover:text-red-500 transition shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
                {!isTerminal && (
                  <div className="flex items-center gap-2 pl-5.5" style={{ paddingLeft: 22 }}>
                    <span className="text-[10.5px] text-app-soft shrink-0">Then</span>
                    <CustomSelect value={r.next || ""} onChange={(v) => setNext(r.id, v)}
                      options={NEXT_OPTIONS} style={{ width: "100%", padding: "5px 10px", borderRadius: "0.6rem", fontSize: 11 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Where people drop off in this agent's button flow (last 30 days).
function FlowFunnel({ agentId }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    api.get(`/whatsapp/agents/${agentId}/funnel`, { params: { days } })
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData({ error: true }); });
    return () => { cancelled = true; };
  }, [agentId, days]);

  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--app-border)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-app">Flow drop-off</p>
          <p className="text-xs text-app-soft">How many people reached each step, and how it ended.</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${days === d ? "bg-orange-500 text-white border-orange-500" : "text-app-soft"}`}
              style={days === d ? undefined : { borderColor: "var(--app-border)" }}>{d}d</button>
          ))}
        </div>
      </div>
      {!data ? (
        <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      ) : data.error ? (
        <p className="text-xs text-app-soft">Couldn't load the funnel.</p>
      ) : data.started === 0 ? (
        <p className="text-xs text-app-soft">No conversations have gone through this flow in the last {days} days yet.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {[{ id: "_start", label: "Started the flow", reached: data.started }, ...data.steps].map((st) => (
              <div key={st.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 truncate text-app-soft" title={st.label}>{st.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--app-border)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    style={{ width: `${Math.round((st.reached / data.started) * 100)}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right font-semibold text-app">
                  {st.reached} <span className="font-normal text-app-soft">({Math.round((st.reached / data.started) * 100)}%)</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="rounded-full px-2.5 py-1 font-semibold bg-green-500/10 text-green-600">{data.outcomes.siteVisit} booked a site visit</span>
            <span className="rounded-full px-2.5 py-1 font-semibold bg-blue-500/10 text-blue-600">{data.outcomes.advisor} asked for an advisor</span>
            <span className="rounded-full px-2.5 py-1 font-semibold bg-gray-500/10 text-app-soft">{data.outcomes.exited} typed instead of tapping</span>
            <span className="rounded-full px-2.5 py-1 font-semibold bg-orange-500/10 text-orange-600">{data.outcomes.open} still open or went quiet</span>
          </div>
          <p className="text-[11px] text-app-soft">Steps a customer skipped because their form already answered them aren't counted, so those rows can read lower.</p>
        </>
      )}
    </div>
  );
}
