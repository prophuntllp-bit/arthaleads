import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Building2, Megaphone, Plus, X, Check, Loader2,
  ChevronDown, ChevronUp, MessageSquare, Send, AlertTriangle, Eye, Trash2, Image as ImageIcon,
  MousePointerClick, Lock, GripVertical,
} from "lucide-react";
import api from "../../services/api";
import CustomSelect from "../../components/CustomSelect";
import DateTimePicker from "../../components/DateTimePicker";
import { STATUS_OPTIONS } from "../../utils/constants";
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

// A number as WhatsApp sends it: a 10-digit Indian mobile gets its 91.
// Matches backend utils/phone.js normalizeTestPhone.
function normalizeTestPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  return digits;
}

const slugify = (v, i) => `${String(v || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "option"}_${i}`;

// The one non-question value an option's `next` may point to — matches
// backend whatsappRoutes.js's sanitizeCtwaFlow / ctwaFlowService.js exactly.
const NEXT_CLOSING = "__closing__";
// The one non-question value closingSiteVisitNext may point to — matches
// backend whatsappRoutes.js's sanitizeCtwaFlow / ctwaFlowService.js exactly.
const CLOSING_BOOK_IMMEDIATELY = "__book__";

// The closing step, built per agent (23 Oct 2026): up to three buttons, each
// with its own action and, optionally, its own reply, tag, status, team alert
// and a typed question first. Mirrors ctwaFlowService.js's getClosingButtons
// and whatsappRoutes.js's sanitizeCtwaFlow. A button saved the old way
// ({ id: "advisor" | "site_visit", label }) keeps its meaning.
const CLOSING_TITLE_MAX = 20;
const CLOSING_MAX = 3; // WhatsApp's reply-button limit
const DEFAULT_CLOSING_PROMPT = "Would you like to talk to our advisor, or book a site visit?";
const ADVISOR_ONLY_CLOSING_PROMPT = "Would you like to talk to our advisor?";
const CUSTOM_CLOSING_PROMPT = "How would you like to continue?";
const CLOSING_ACTIONS = [
  { value: "handoff",    label: "Connect them to your team" },
  { value: "site_visit", label: "Book a site visit" },
  { value: "register",   label: "Register them for your event or webinar" },
  { value: "photos",     label: "Send photos & videos, then finish" },
  { value: "docs",       label: "Send floor plan & brochure, then finish" },
  { value: "location",   label: "Send the project location, then finish" },
  { value: "question",   label: "Ask another question" },
  { value: "end",        label: "Thank them and finish" },
];
const LEGACY_CLOSING_ACTION = { advisor: "handoff", site_visit: "site_visit" };
// Actions that alert your team unless the alert is turned off; the others
// alert only when it is turned on. Matches finishClosing.
const ALERT_BY_DEFAULT = ["handoff", "site_visit", "register"];
const CLOSING_SAVE_TO = [
  { value: "name",  label: "Save it as the lead's name" },
  { value: "email", label: "Save it as the lead's email (if empty)" },
  { value: "notes", label: "Save it as a note on the lead" },
];
// What the bot says when a button's own reply is left blank (ctwaFlowService.js).
const CLOSING_REPLY_DEFAULT = {
  handoff: "Connecting you with our advisor, they'll reach out to you shortly.",
  site_visit: "Wonderful! Our team will confirm your visit shortly and take it from here.",
  register: "You're registered for {{event}} on {{time}}. We'll send you the joining link here {{minutes}} minutes before it starts.",
  end: "Thank you! Message us here anytime if you need anything.",
};
const DEFAULT_REMINDER_TEXT = "Hi {{name}}, {{event}} starts in {{minutes}} minutes. Join here: {{link}}";
const EMPTY_EVENT = { title: "", startsAt: null, link: "", reminderMinutes: 30, reminderText: "", templateName: "", templateLanguage: "", templateVars: [] };
const EVENT_TEMPLATE_VARS = [
  { value: "name",  label: "Customer's first name" },
  { value: "link",  label: "Joining link" },
  { value: "event", label: "Event name" },
  { value: "time",  label: "Event date and time" },
];

const newClosingId = () => `close_${Math.random().toString(36).slice(2, 8)}`;
function closingButton(b = {}) {
  return {
    id: b.id || newClosingId(), label: b.label || "", action: b.action || "end",
    reply: b.reply || "", tag: b.tag || "", status: b.status || "",
    notify: typeof b.notify === "boolean" ? b.notify : undefined, next: b.next || "",
    askText: b.askText?.prompt !== undefined && b.askText !== null ? { prompt: b.askText.prompt || "", saveTo: b.askText.saveTo || "notes" } : null,
  };
}
// Starting points: each fills in the question and the buttons, all editable after.
const CLOSING_PRESETS = [
  { key: "site_visit", label: "Site visit", hint: "Talk to Advisor or Book Site Visit", prompt: DEFAULT_CLOSING_PROMPT,
    buttons: () => [
      { id: "advisor", label: "Talk to Advisor", action: "handoff" },
      { id: "site_visit", label: "Book Site Visit", action: "site_visit" },
    ] },
  { key: "event", label: "Webinar or event", hint: "Asks the name, reserves a seat, sends the joining link before it starts",
    prompt: "Shall I reserve your seat for the {{event}} on {{time}}?",
    buttons: () => [
      { label: "Reserve my seat", action: "register", tag: "Webinar registered", notify: true,
        askText: { prompt: "May I have your full name for the registration?", saveTo: "name" },
        reply: "Thanks {{name}}, your seat is reserved for {{event}} on {{time}}. We'll send the joining link here {{minutes}} minutes before it starts." },
      { label: "Not now", action: "end", tag: "Webinar not now", notify: false, reply: "No problem! Message us here anytime if you change your mind." },
    ] },
  { key: "brochure", label: "Brochure", hint: "Sends the brochure, or connects them to your team",
    prompt: "Would you like the brochure and floor plan here on WhatsApp?",
    buttons: () => [
      { label: "Send brochure", action: "docs", reply: "Here you go! Ask me anything about the project." },
      { label: "Talk to Advisor", action: "handoff" },
    ] },
  { key: "callback", label: "Callback", hint: "Asks when to call and alerts your team",
    prompt: "Would you like a call from our team?",
    buttons: () => [
      { label: "Call me now", action: "handoff", tag: "Callback requested", reply: "Sure! Our team will call you shortly." },
      { label: "Call me later", action: "handoff", tag: "Callback requested", reply: "Noted, {{name}}. Our team will call you then.",
        askText: { prompt: "What day and time suits you for a call?", saveTo: "notes" } },
      { label: "Not now", action: "end", notify: false },
    ] },
];

function resolveClosingButtons(flow) {
  const seen = new Set();
  const out = [];
  for (const b of Array.isArray(flow?.closingButtons) ? flow.closingButtons : []) {
    const action = CLOSING_ACTIONS.some((a) => a.value === b?.action) ? b.action : LEGACY_CLOSING_ACTION[b?.id];
    if (!b?.id || !action || !String(b.label || "").trim() || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(closingButton({ ...b, action, label: String(b.label).slice(0, CLOSING_TITLE_MAX), askText: b.askText?.prompt ? b.askText : null }));
    if (out.length >= CLOSING_MAX) break;
  }
  return out.length ? out : CLOSING_PRESETS[0].buttons().map(closingButton);
}

// {{event}}, {{time}}, {{link}}, {{minutes}} — same values and IST wording as
// ctwaFlowService.js's eventVars.
function eventVars(ev) {
  if (!ev?.title && !ev?.startsAt) return {};
  let time = "";
  const at = ev.startsAt ? new Date(ev.startsAt) : null;
  if (at && !Number.isNaN(at.getTime())) {
    const d = new Date(at.getTime() + 5.5 * 3600000);
    const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    time = `${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
  }
  return { event: ev.title || "the event", time, link: ev.link || "", minutes: String(ev.reminderMinutes || 30) };
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
  closingButtons: CLOSING_PRESETS[0].buttons().map(closingButton),
  closingTemplate: "",
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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
        setForm({
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
                testPhones: [...new Set((a.ctwaFlow.testPhones || []).map(normalizeTestPhone).filter(Boolean))],
                closingButtons: resolveClosingButtons(a.ctwaFlow),
              }
            : DEFAULT_CTWA_FLOW,
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

  const addTestPhone = () => {
    const v = normalizeTestPhone(testPhoneDraft);
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
                Name customers hear <span className="font-normal">(when someone asks "what is your name")</span>
              </label>
              <input className="input w-full" placeholder="e.g. Riya. Leave blank to use a friendly name automatically"
                value={form.personaName} onChange={(e) => set({ personaName: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-app-soft mb-1 block">
                What it does <span className="font-normal">(for your team, never sent to customers)</span>
              </label>
              <input className="input w-full" placeholder="e.g. Qualifies leads and books site visits for Green Valley Villas"
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-semibold text-app-soft">
                  Greeting <span className="font-normal">(optional)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                  <input type="checkbox" checked={form.greetingEnabled !== false}
                    onChange={(e) => set({ greetingEnabled: e.target.checked })} />
                  <span className="text-xs font-semibold text-app">{form.greetingEnabled !== false ? "On" : "Off"}</span>
                </label>
              </div>
              {form.greetingEnabled !== false ? (
                <>
                  <input className="input w-full" placeholder="Hi {{name}} 👋 Thanks for reaching out, how can I help you find your next home?"
                    value={form.greeting} onChange={(e) => set({ greeting: e.target.value })} />
                  <p className="text-xs text-app-soft mt-1">
                    Sent as the first message when someone new writes in, and the assistant won't say hello again after
                    it. Leave it empty to let the assistant greet in its own first reply. Use <code>{"{{name}}"}</code>.
                    Turn this off if your Click-to-WhatsApp ad already shows Meta's automated greeting, so customers
                    aren't welcomed twice.
                  </p>
                </>
              ) : (
                <p className="text-xs text-app-soft rounded-xl px-3 py-2.5" style={{ background: "var(--app-surface-low)" }}>
                  Off: no greeting is sent, and the assistant doesn't say hello or introduce itself. It answers the
                  customer's message straight away. Use this when your Click-to-WhatsApp ad already welcomes people
                  with Meta's automated greeting.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border p-4" style={{ borderColor: "var(--app-border)" }}>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 shrink-0"
                  checked={form.ctwaFlow.nudgesEnabled === true} onChange={(e) => setFlow({ nudgesEnabled: e.target.checked })} />
                <span>
                  <span className="text-app font-semibold block">Follow up if they go quiet</span>
                  <span className="text-xs text-app-soft">
                    If a customer stops replying after the assistant asked them something, send one gentle reminder
                    after about 15 minutes and one last reminder shortly before the 24-hour reply window closes. In a
                    normal chat it repeats the assistant's last question; in the button flow it re-sends the question
                    with its buttons. Business hours only, never more than two, and they stop as soon as the customer
                    writes back or someone from your team takes over.
                  </span>
                </span>
              </label>
              {form.ctwaFlow.nudgesEnabled === true && (
                <div>
                  <label className="text-xs font-semibold text-app-soft block mb-1">First reminder wording</label>
                  <input className="input w-full" placeholder="Just checking in 🙂" maxLength={200}
                    value={form.ctwaFlow.nudgeText || ""} onChange={(e) => setFlow({ nudgeText: e.target.value })} />
                  <p className="text-[11px] text-app-soft mt-1">
                    Use <code>{"{{name}}"}</code>. Keep this to a short "just checking in": it is sent directly above the
                    question being repeated, so don't ask anything here yourself.
                  </p>
                </div>
              )}
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
              {/(₹|rs\.?\s?\d|inr\s?\d)\s?[\d,.]+\s?(l\b|lakh|lac|cr\b|crore|k\b)?/i.test(form.groundRules || "") && (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: "#dc2626" }}>
                  These rules contain a price. Prices typed here go stale the moment you edit the project,
                  and the assistant may still quote the old one. Set prices on the Projects page instead;
                  the assistant always reads those live.
                </p>
              )}
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
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" className="mt-0.5 shrink-0"
                checked={form.shareVideos} onChange={(e) => set({ shareVideos: e.target.checked })} />
              <span>
                <span className="text-app font-semibold block">Can send the project video</span>
                <span className="text-xs text-app-soft">
                  Only for projects that have a video uploaded (up to 10MB) — add one on the Projects page.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" className="mt-0.5 shrink-0"
                checked={form.shareFloorPlan} onChange={(e) => set({ shareFloorPlan: e.target.checked })} />
              <span>
                <span className="text-app font-semibold block">Can send the floor plan (PDF)</span>
                <span className="text-xs text-app-soft">
                  Only for projects that have a floor plan uploaded — add one on the Projects page.
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
              Running a Click-to-WhatsApp ad? Paste its Ad ID (from Ads Manager — the ad, not the
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
            {!isNew && form.adIds.length > 0 && <AdMessages agentId={id} adIds={form.adIds} />}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
                <h3 className="text-base font-bold text-app">CTWA button flow</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                  <Lock className="w-2.5 h-2.5" /> Enterprise
                </span>
              </div>
              <label className="inline-flex items-center gap-2 shrink-0" style={{ cursor: flowAllowed ? "pointer" : "not-allowed", opacity: flowAllowed ? 1 : 0.55 }}
                title={flowAllowed ? undefined : "The button flow is part of the Enterprise plan"}>
                <input type="checkbox" checked={form.ctwaFlow.enabled} disabled={!flowAllowed}
                  onChange={(e) => setFlow({ enabled: e.target.checked })} />
                <span className="text-xs font-semibold text-app">{form.ctwaFlow.enabled ? "On" : "Off"}</span>
              </label>
            </div>
            <p className="text-sm text-app-soft">
              Replace the first few free-text qualifying questions with real WhatsApp buttons/lists — your own
              questions, in your own order — followed by what they want next and a site-visit time. Answers write
              straight onto the lead when they clearly map to a field; anything else is still recorded, just not
              forced onto the wrong one. Anyone who free-types instead of tapping drops back into this assistant's
              usual conversation.
            </p>
            <p className="text-xs rounded-xl px-3 py-2.5" style={form.ctwaFlow.testPhones.length && form.status === "active"
                ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#dc2626" }
                : { background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)" }}>
              {form.ctwaFlow.testPhones.length
                ? (form.status === "active"
                    ? <><strong>This assistant is live, but locked to testing</strong> — only the {form.ctwaFlow.testPhones.length} number{form.ctwaFlow.testPhones.length > 1 ? "s" : ""} below get this flow. Every real lead reaching it right now silently falls back to the normal conversation instead. Clear the list below to actually turn this flow on for real leads.</>
                    : <>Locked to testing — only the {form.ctwaFlow.testPhones.length} number{form.ctwaFlow.testPhones.length > 1 ? "s" : ""} below get this flow right now. Everyone else, including genuine leads, gets the normal conversation. Clear the list below once you're done verifying it.</>)
                : form.adIds.length
                ? <>Runs for every new lead this assistant answers: the {form.adIds.length} ad{form.adIds.length > 1 ? "s" : ""} routed above, and any other ad whose message names this assistant's project, so a new ad never silently loses the flow.</>
                : <>"Route ads to this agent" above is empty, so this runs for <strong>every</strong> conversation this assistant handles — including genuine leads reaching it right now. Add test numbers below to restrict it to just your own team while you verify it, or add an Ad ID above once you're ready to restrict it to actual ad clicks.</>}
            </p>

            <div className="rounded-2xl p-4 space-y-2" style={{ border: "1px solid var(--app-border)" }}>
              <p className="text-xs font-semibold text-app">
                Test phone numbers <span className="font-normal text-app-soft">(temporary — for verifying live before real leads see it)</span>
              </p>
              <p className="text-xs text-app-soft">
                Add your own WhatsApp numbers here. While this list isn't empty, the button flow only replies to
                these numbers — every other conversation this assistant handles falls back to the normal chat,
                so you can message the number yourself and watch it work without touching real leads.
              </p>
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-mono text-xs" placeholder="e.g. 9876543210 (91 is added for you)"
                  value={testPhoneDraft} onChange={(e) => setTestPhoneDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTestPhone(); } }} />
                <button type="button" onClick={addTestPhone} disabled={!testPhoneDraft.trim()}
                  className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {form.ctwaFlow.testPhones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.ctwaFlow.testPhones.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                      style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                      {p}
                      <button type="button" onClick={() => setFlow({ testPhones: form.ctwaFlow.testPhones.filter((x) => x !== p) })}
                        className="text-app-soft hover:text-red-500 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft">Message 1 of 2 — sent first, plain text (optional)</p>
              <div>
                <label className="text-xs font-semibold text-app-soft block mb-1">Welcome message</label>
                <textarea className="input w-full resize-none" rows={2}
                  placeholder="Hi {{name}} 👋 Thanks for your interest in {{project}}!"
                  value={form.ctwaFlow.welcomeText} onChange={(e) => setFlow({ welcomeText: e.target.value })} />
                <p className="text-[11px] text-app-soft mt-1">
                  Use <code>{"{{name}}"}</code> and <code>{"{{project}}"}</code>. Sent on its own — a greeting bundled
                  into the same message as the first question reads as the bot talking over itself. Leave this blank
                  if the ad's own "Automated greeting" (Ads Manager → Conversations) already covers it — the flow
                  then opens straight with the first question below, no double greeting.
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft mb-2">
                Qualifying questions — sent one at a time, in this order
              </p>
              <div className="space-y-3">
                {form.ctwaFlow.qualifyingQuestions.map((q, i) => (
                  <QualifyingQuestionEditor key={q.id} question={q} index={i} total={form.ctwaFlow.qualifyingQuestions.length}
                    allQuestions={form.ctwaFlow.qualifyingQuestions}
                    onChange={(next) => updateQuestion(i, next)}
                    onRemove={() => removeQuestion(i)}
                    onMoveUp={() => moveQuestion(i, -1)}
                    onMoveDown={() => moveQuestion(i, 1)} />
                ))}
              </div>
              <button type="button" onClick={addQuestion} disabled={form.ctwaFlow.qualifyingQuestions.length >= MAX_QUALIFYING_QUESTIONS}
                className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 w-full mt-3">
                <Plus className="w-3.5 h-3.5" /> Add another question
              </button>
            </div>

            <ClosingStepEditor flow={form.ctwaFlow} setFlow={setFlow} />

            {!isNew && form.ctwaFlow.enabled && <FlowFunnel agentId={id} />}
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

// The last step of the button flow: one question and up to three buttons, each
// doing whatever this ad needs (book a visit, register for a webinar, send the
// brochure, ask for a callback...). A starter fills everything in.
function ClosingStepEditor({ flow, setFlow }) {
  const buttons = flow.closingButtons || [];
  const questions = flow.qualifyingQuestions || [];
  const event = { ...EMPTY_EVENT, ...(flow.event || {}) };
  const hasRegister = buttons.some((b) => b.action === "register");
  const [more, setMore] = useState({});
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState("");

  const setButtons = (next) => setFlow({ closingButtons: next, closingTemplate: "custom" });
  const update = (i, patch) => setButtons(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const remove = (i) => { if (buttons.length > 1) setButtons(buttons.filter((_, j) => j !== i)); };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= buttons.length) return;
    const next = [...buttons];
    [next[i], next[j]] = [next[j], next[i]];
    setButtons(next);
  };
  const add = () => { if (buttons.length < CLOSING_MAX) setButtons([...buttons, closingButton({ label: "", action: "end" })]); };
  const setEvent = (patch) => setFlow({ event: { ...event, ...patch } });

  const onlyStock = buttons.every((b) => LEGACY_CLOSING_ACTION[b.id] === b.action);
  const activePreset = flow.closingTemplate || (onlyStock ? "site_visit" : "custom");
  const applyPreset = (p) => {
    if (p.key === activePreset) return;
    if (!window.confirm(`Replace the closing question and buttons with the "${p.label}" starter? You can edit everything after.`)) return;
    setFlow({
      closingTemplate: p.key, closingPrompt: p.prompt, closingSiteVisitNext: "",
      closingButtons: p.buttons().map(closingButton),
      ...(p.key === "event" && !flow.event ? { event: { ...EMPTY_EVENT } } : {}),
    });
  };

  // Approved templates, for the reminder to people outside the 24-hour window.
  useEffect(() => {
    if (!hasRegister || templates) return;
    api.get("/whatsapp/templates")
      .then(({ data }) => setTemplates((data.templates || []).filter((t) => t.status === "APPROVED")))
      .catch((e) => { setTemplates([]); setTemplatesError(e.response?.data?.message || "Could not load your WhatsApp templates."); });
  }, [hasRegister, templates]);

  const chosenTemplate = (templates || []).find((t) => t.name === event.templateName && (!event.templateLanguage || t.language === event.templateLanguage));
  const templateBody = chosenTemplate?.components?.find((c) => c.type === "BODY")?.text || "";
  const templateSlots = [...new Set((templateBody.match(/\{\{\s*\d+\s*\}\}/g) || []).map((m) => Number(m.replace(/\D/g, ""))))].sort((a, b) => a - b);
  const linkOk = !event.link || /^https?:\/\//i.test(event.link.trim());
  const startsInPast = event.startsAt && new Date(event.startsAt) < new Date();

  const label = "text-xs font-semibold text-app-soft block mb-1";
  const hint = "text-[11px] text-app-soft mt-1";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft mb-2">The ending: what you offer after the questions</p>
        <p className="text-[11px] text-app-soft mb-2">Start from what this ad is for, then change anything.</p>
        <div className="flex flex-wrap gap-2">
          {[...CLOSING_PRESETS, { key: "custom", label: "Custom", hint: "Your own buttons" }].map((p) => {
            const on = activePreset === p.key;
            return (
              <button key={p.key} type="button" title={p.hint}
                onClick={() => (p.key === "custom" ? setFlow({ closingTemplate: "custom" }) : applyPreset(p))}
                className="rounded-full px-3.5 py-2 text-xs font-semibold border transition"
                style={on
                  ? { background: "var(--app-primary)", borderColor: "var(--app-primary)", color: "#fff" }
                  : { background: "var(--app-card-solid)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={label}>Closing question</label>
        <input className="input w-full" placeholder={onlyStock ? DEFAULT_CLOSING_PROMPT : CUSTOM_CLOSING_PROMPT}
          value={flow.closingPrompt} onChange={(e) => setFlow({ closingPrompt: e.target.value })} />
        <p className={hint}>
          Sent once every question above has been asked. You can use <code>{"{{name}}"}</code>
          {hasRegister && <>, <code>{"{{event}}"}</code>, <code>{"{{time}}"}</code> and <code>{"{{link}}"}</code></>}.
        </p>
      </div>

      <div className="space-y-2.5">
        {buttons.map((b, i) => {
          const isMore = !!more[b.id];
          const alertOn = typeof b.notify === "boolean" ? b.notify : ALERT_BY_DEFAULT.includes(b.action);
          const canAsk = b.action !== "question";
          return (
            <div key={b.id} className="rounded-2xl p-3.5 space-y-2.5" style={{ border: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-app-soft w-14 shrink-0">Button {i + 1}</span>
                <input className="input flex-1 min-w-0" maxLength={CLOSING_TITLE_MAX} placeholder="Button name, e.g. Reserve my seat"
                  value={b.label} onChange={(e) => update(i, { label: e.target.value })} />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-app-soft hover:text-app disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === buttons.length - 1} className="p-1.5 rounded-lg text-app-soft hover:text-app disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => remove(i)} disabled={buttons.length === 1}
                  title={buttons.length === 1 ? "At least one button has to stay" : "Remove this button"}
                  className="p-1.5 rounded-lg text-app-soft hover:text-red-500 disabled:opacity-30" aria-label="Remove button"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <label className={label}>When tapped</label>
                <CustomSelect value={b.action} options={CLOSING_ACTIONS}
                  onChange={(v) => update(i, { action: v, next: "", ...(v === "question" ? { askText: null } : {}) })}
                  style={SELECT_STYLE} />
              </div>

              {b.action === "question" && (
                <div>
                  <label className={label}>Which question</label>
                  <CustomSelect value={b.next || ""} onChange={(v) => update(i, { next: v })}
                    options={[{ value: "", label: "Choose a question" }, ...questions.filter((q) => q.options.length).map((q) => ({ value: q.id, label: q.questionText.slice(0, 60) || "(untitled question)" }))]}
                    style={SELECT_STYLE} />
                  {!b.next && <p className="text-[11px] mt-1" style={{ color: "#b45309" }}>Pick a question, or this button just thanks them and finishes.</p>}
                </div>
              )}

              {b.action === "site_visit" && (
                <div>
                  <label className={label}>Before booking</label>
                  <CustomSelect value={b.next || flow.closingSiteVisitNext || ""}
                    onChange={(v) => { update(i, { next: v }); setFlow({ closingSiteVisitNext: "" }); }}
                    options={[
                      { value: "", label: "Ask the time question, if there is one" },
                      { value: CLOSING_BOOK_IMMEDIATELY, label: "Book straight away, no question" },
                      ...questions.filter((q) => q.options.length).map((q) => ({ value: q.id, label: `Ask: ${q.questionText.slice(0, 50) || "(untitled question)"}` })),
                    ]}
                    style={SELECT_STYLE} />
                </div>
              )}

              {canAsk && (
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-app cursor-pointer">
                    <input type="checkbox" checked={!!b.askText}
                      onChange={(e) => update(i, { askText: e.target.checked ? { prompt: "", saveTo: b.action === "register" ? "name" : "notes" } : null })} />
                    Ask them to type something first
                  </label>
                  {b.askText && (
                    <div className="grid sm:grid-cols-2 gap-2 mt-2">
                      <input className="input w-full" placeholder="e.g. May I have your full name?"
                        value={b.askText.prompt} onChange={(e) => update(i, { askText: { ...b.askText, prompt: e.target.value } })} />
                      <CustomSelect value={b.askText.saveTo} options={CLOSING_SAVE_TO}
                        onChange={(v) => update(i, { askText: { ...b.askText, saveTo: v } })} style={SELECT_STYLE} />
                    </div>
                  )}
                  {b.askText && !b.askText.prompt.trim() && <p className="text-[11px] mt-1" style={{ color: "#b45309" }}>Write the question, or it is skipped.</p>}
                </div>
              )}

              {b.action !== "question" && (
                <div>
                  <label className={label}>Reply</label>
                  <textarea className="input w-full resize-none" rows={2}
                    placeholder={CLOSING_REPLY_DEFAULT[b.action] ? `Leave blank for: ${CLOSING_REPLY_DEFAULT[b.action]}` : "Optional: a line sent after the files"}
                    value={b.reply} onChange={(e) => update(i, { reply: e.target.value })} />
                </div>
              )}

              <button type="button" onClick={() => setMore((m) => ({ ...m, [b.id]: !isMore }))}
                className="flex items-center gap-1 text-[11px] font-semibold text-app-soft hover:text-app transition">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMore ? "rotate-180" : ""}`} />
                Tag, status and alert
                {(b.tag || b.status) && <span className="font-normal">: {[b.tag, b.status].filter(Boolean).join(", ")}</span>}
              </button>
              {isMore && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className={label}>Tag the lead</label>
                    <input className="input w-full" maxLength={40} placeholder="e.g. Webinar 31 Oct" value={b.tag} onChange={(e) => update(i, { tag: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>Set the lead's status</label>
                    <CustomSelect value={b.status || ""} onChange={(v) => update(i, { status: v })}
                      options={[{ value: "", label: "Don't change it" }, ...STATUS_OPTIONS.map((st) => ({ value: st, label: st }))]}
                      style={SELECT_STYLE} />
                  </div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold text-app cursor-pointer">
                    <input type="checkbox" checked={alertOn} onChange={(e) => update(i, { notify: e.target.checked })} />
                    Alert your team when someone taps this
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={add} disabled={buttons.length >= CLOSING_MAX}
        className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 w-full">
        <Plus className="w-3.5 h-3.5" /> {buttons.length >= CLOSING_MAX ? "WhatsApp allows three buttons" : "Add a button"}
      </button>
      <p className={hint}>Button names are limited to {CLOSING_TITLE_MAX} characters, the most WhatsApp allows. Every tap is logged on the lead.</p>

      {hasRegister && (
        <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft">Your event</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label className={label}>Event name</label>
              <input className="input w-full" maxLength={120} placeholder="e.g. Green Valley Launch Webinar" value={event.title} onChange={(e) => setEvent({ title: e.target.value })} />
            </div>
            <div>
              <label className={label}>Date and time (IST)</label>
              <DateTimePicker value={event.startsAt || ""} onChange={(v) => setEvent({ startsAt: v })}
                triggerClassName="w-full" triggerStyle={{ padding: "12px 16px", borderRadius: "1rem", fontSize: 14, minWidth: 0 }} />
              {startsInPast && <p className="text-[11px] mt-1" style={{ color: "#b45309" }}>This time has passed. Nobody new gets a reminder.</p>}
            </div>
          </div>
          {(!event.title.trim() || !event.startsAt) && (
            <p className="text-[11px]" style={{ color: "#b91c1c" }}>Add the event's name and date and time. A registration button can't be saved without them.</p>
          )}
          <div>
            <label className={label}>Joining link</label>
            <input className="input w-full" placeholder="https://meet.google.com/..." value={event.link} onChange={(e) => setEvent({ link: e.target.value })} />
            {!linkOk && <p className="text-[11px] mt-1" style={{ color: "#b91c1c" }}>The link has to start with https://</p>}
          </div>
          <div className="grid sm:grid-cols-[160px_1fr] gap-2.5">
            <div>
              <label className={label}>Send it (minutes before)</label>
              <input className="input w-full" type="number" min={5} max={1440} value={event.reminderMinutes}
                onChange={(e) => setEvent({ reminderMinutes: e.target.value === "" ? "" : Number(e.target.value) })}
                onBlur={() => setEvent({ reminderMinutes: Math.min(1440, Math.max(5, Number(event.reminderMinutes) || 30)) })} />
            </div>
            <div>
              <label className={label}>Reminder message</label>
              <textarea className="input w-full resize-none" rows={2} placeholder={DEFAULT_REMINDER_TEXT}
                value={event.reminderText} onChange={(e) => setEvent({ reminderText: e.target.value })} />
            </div>
          </div>
          <p className={hint}>
            Use <code>{"{{name}}"}</code>, <code>{"{{event}}"}</code>, <code>{"{{time}}"}</code>, <code>{"{{minutes}}"}</code> and <code>{"{{link}}"}</code>.
            The reminder goes once to everyone who registered. If you move the event, saved reminders move with it.
          </p>

          <div>
            <label className={label}>Approved template, for people who haven't written in 24 hours</label>
            <p className="text-[11px] text-app-soft mb-1.5">
              WhatsApp only lets a business send a normal message within 24 hours of the customer's last message.
              After that, the link can only go as an approved template. Without one, those people don't get the reminder.
            </p>
            {templates === null ? (
              <p className="text-xs text-app-soft flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your templates...</p>
            ) : templatesError ? (
              <p className="text-[11px]" style={{ color: "#b91c1c" }}>{templatesError}</p>
            ) : (
              <CustomSelect value={event.templateName ? `${event.templateName}|${event.templateLanguage || ""}` : ""}
                onChange={(v) => {
                  if (!v) return setEvent({ templateName: "", templateLanguage: "", templateVars: [] });
                  const [name, language] = v.split("|");
                  const t = templates.find((x) => x.name === name && x.language === language);
                  const body = t?.components?.find((c) => c.type === "BODY")?.text || "";
                  const n = new Set(body.match(/\{\{\s*\d+\s*\}\}/g) || []).size;
                  setEvent({ templateName: name, templateLanguage: language, templateVars: ["name", "link", "event", "time"].slice(0, n) });
                }}
                options={[{ value: "", label: templates.length ? "None: skip people outside the 24 hours" : "No approved templates yet" },
                  ...templates.map((t) => ({ value: `${t.name}|${t.language}`, label: `${t.name} (${t.language})` }))]}
                style={SELECT_STYLE} />
            )}
            {chosenTemplate && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-app-soft rounded-xl px-3 py-2 whitespace-pre-wrap" style={{ background: "var(--app-surface-low)" }}>{templateBody}</p>
                {templateSlots.map((n, k) => (
                  <div key={n} className="flex items-center gap-2">
                    <code className="text-xs w-12 shrink-0">{`{{${n}}}`}</code>
                    <div className="flex-1 min-w-0">
                      <CustomSelect value={event.templateVars[k] || "name"} options={EVENT_TEMPLATE_VARS}
                        onChange={(v) => { const vars = [...event.templateVars]; vars[k] = v; setEvent({ templateVars: vars.map((x) => x || "name") }); }}
                        style={SELECT_STYLE} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Mirrors ctwaFlowService.js's closingStep wording: a prompt the tenant wrote
// is used as is; the stock one changes with the buttons on offer.
function closingPromptText(flow, buttons) {
  const stock = !flow.closingPrompt || flow.closingPrompt === DEFAULT_CLOSING_PROMPT;
  if (!stock) return flow.closingPrompt;
  if (!buttons.every((b) => LEGACY_CLOSING_ACTION[b.id] === b.action)) return CUSTOM_CLOSING_PROMPT;
  return buttons.some((b) => b.action === "site_visit") ? DEFAULT_CLOSING_PROMPT : ADVISOR_ONLY_CLOSING_PROMPT;
}

function CtwaFlowPreviewPanel({ flow, projectName }) {
  const [log, setLog] = useState([]);
  const [step, setStep] = useState(null); // mirrors WaConversation.flowState.step
  const [freeText, setFreeText] = useState("");
  const vars = { name: "Ananya", project: projectName || "this project", ...eventVars(flow.event) };

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
    push({ from: "bot", text: fillVars(closingPromptText(flow, buttons), vars), buttons, closing: true });
    setStep("closing");
  };

  const bookSiteVisit = (reply = "") => {
    push({ from: "bot", text: fillVars(reply, vars) || "Wonderful! Our team will confirm your visit shortly and take it from here." });
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
    const closingBtn = opt.closing ? resolveClosingButtons(flow).find((b) => b.id === opt.id) : null;

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

    if (closingBtn) {
      // A typed question first: asked now, the button's action runs once
      // they answer (see sendFreeText). Mirrors ctwaFlowService.advanceFlow.
      if (closingBtn.askText?.prompt && closingBtn.action !== "question") {
        push({ from: "bot", text: fillVars(closingBtn.askText.prompt, vars) });
        setStep(`__ask__:${closingBtn.id}`);
        return;
      }
      finishClosing(closingBtn, vars);
    }
  };

  // Mirrors ctwaFlowService.js's finishClosing.
  const finishClosing = (b, v) => {
    const reply = fillVars(b.reply, v);
    const extras = [b.tag && `tag "${b.tag}"`, b.status && `status → ${b.status}`].filter(Boolean);
    const alertOn = typeof b.notify === "boolean" ? b.notify : ALERT_BY_DEFAULT.includes(b.action);
    const logged = `✅ Logged on the lead: chose "${b.label}"${extras.length ? `, ${extras.join(", ")}` : ""}.${alertOn ? " Your team is alerted." : ""}`;
    const questions = flow.qualifyingQuestions || [];
    if (b.action === "question") {
      const target = questions.find((q) => q.id === b.next);
      if (target) { push({ from: "bot", note: true, text: logged }); sendQuestion(target); return; }
    }
    if (b.action === "handoff") {
      if (reply) push({ from: "bot", text: reply }); else pushAdvisorTerminal();
      push({ from: "bot", note: true, text: logged });
      setStep(null);
      return;
    }
    if (b.action === "site_visit") {
      const configured = b.next || flow.closingSiteVisitNext || "";
      if (configured !== CLOSING_BOOK_IMMEDIATELY) {
        const target = configured
          ? questions.find((q) => q.id === configured)
          : questions.find((q) => q.options.length && q.options.every((o) => o.action === "site_visit"));
        if (target) { sendQuestion(target); return; }
      }
      bookSiteVisit(b.reply);
      return;
    }
    if (b.action === "photos" || b.action === "docs" || b.action === "location") {
      push({ from: "bot", note: true, text: b.action === "photos" ? "🖼️ Sends the project's photos and videos." : b.action === "docs" ? "📄 Sends the floor plan and brochure PDFs." : "📍 Sends the project's location." });
      if (reply) push({ from: "bot", text: reply });
      push({ from: "bot", note: true, text: logged });
      setStep(null);
      return;
    }
    if (b.action === "register") {
      const ev = flow.event || {};
      push({ from: "bot", text: reply || fillVars(ev.startsAt ? CLOSING_REPLY_DEFAULT.register : "You're registered for {{event}}. We'll send you the joining details here before it starts.", v) });
      push({ from: "bot", note: true, text: logged });
      if (ev.startsAt) {
        push({ from: "bot", note: true, text: `⏰ ${v.minutes} minutes before ${v.time || "the start"} IST, this goes to them:` });
        push({ from: "bot", text: fillVars(ev.reminderText || DEFAULT_REMINDER_TEXT, v) });
      } else {
        push({ from: "bot", warn: true, text: "Add the event's date and time above, or no joining link is sent." });
      }
      setStep(null);
      return;
    }
    push({ from: "bot", text: reply || CLOSING_REPLY_DEFAULT.end });
    push({ from: "bot", note: true, text: `${logged} The assistant stays on for anything they ask next.` });
    setStep(null);
  };

  const pushAdvisorTerminal = () => {
    push({ from: "bot", text: "Connecting you with our advisor, they'll reach out to you shortly. You can also reach them directly on <their phone number>." });
    push({ from: "bot", note: true, text: "✅ Uses this project's \"Talk to Advisor\" contact if one is set (Projects page) — real name and phone number included so the lead can call directly; otherwise falls back to normal round-robin assignment with no number shown. Bot pauses and that person is notified." });
  };

  const sendFreeText = () => {
    const text = freeText.trim();
    if (!text) return;
    push({ from: "user", text });
    // The answer to a closing button's typed question (a question mark means
    // they asked something instead: the assistant answers, then asks again).
    if (step?.startsWith("__ask__:")) {
      const b = resolveClosingButtons(flow).find((x) => `__ask__:${x.id}` === step);
      setFreeText("");
      if (b && !/\?\s*$/.test(text)) {
        const saved = { name: "Lead's name", email: "Lead's email", notes: "A note on the lead" }[b.askText.saveTo] || "A note";
        push({ from: "bot", note: true, text: `✅ ${saved} saved: "${text}"` });
        finishClosing(b, { ...vars, name: b.askText.saveTo === "name" ? text.split(/\s+/)[0] : vars.name });
      } else if (b) {
        push({ from: "bot", note: true, text: "→ The assistant answers their question, then:" });
        push({ from: "bot", text: `Coming back to my earlier question:\n\n${fillVars(b.askText.prompt, vars)}` });
      }
      return;
    }
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
                      <button key={o.id} type="button" onClick={() => tap(m.closing ? { ...o, closing: true } : o)}
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
function QualifyingQuestionEditor({ question, index, total, allQuestions, onChange, onRemove, onMoveUp, onMoveDown }) {
  const setQ = (patch) => onChange({ ...question, ...patch });
  const presets = MAPS_TO_PRESETS[question.mapsTo];
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--app-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-app-soft">Question {index + 1} of {total}</p>
        <div className="flex items-center gap-1">
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
        <label className="text-xs font-semibold text-app-soft block mb-1">Maps to</label>
        <CustomSelect value={question.mapsTo} onChange={(v) => setQ({ mapsTo: v })} options={MAPS_TO_OPTIONS} style={SELECT_STYLE} />
        <p className="text-[11px] text-app-soft mt-1">
          {question.mapsTo === "none"
            ? "The answer is just recorded and shown on the lead's Info tab — nothing is forced onto a specific field."
            : "Only written to this field when the tapped option actually resolves to something real for it — anything else is recorded instead of guessed at, same as the field above."}
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
// The pre-filled message of each of this agent's ads. Meta sometimes sends
// an ad click with no ad details; the chat is then placed by this text
// (backend utils/adPrefill.js). Learned from real clicks, counted once two
// clicks opened with the same text, or added here by hand.
function AdMessages({ agentId, adIds }) {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [adId, setAdId] = useState(adIds[0] || "");
  const [busy, setBusy] = useState(false);
  const savedAds = adIds.join(",");

  useEffect(() => {
    api.get(`/whatsapp/agents/${agentId}/ad-messages`)
      .then(({ data }) => setRows(data.messages || []))
      .catch(() => setRows([]));
  }, [agentId, savedAds]);
  useEffect(() => { if (!adIds.includes(adId)) setAdId(adIds[0] || ""); }, [savedAds]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/whatsapp/agents/${agentId}/ad-messages`, { adId, text });
      setRows((r) => [data.message, ...(r || []).filter((x) => x.id !== data.message.id)]);
      setText("");
      toast.success("Saved. Chats that open with this message now reach this assistant.");
    } catch (e) { toast.error(e.response?.data?.message || "Could not save that message"); }
    finally { setBusy(false); }
  };
  const remove = async (row) => {
    try {
      await api.delete(`/whatsapp/agents/${agentId}/ad-messages/${row.id}`);
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e) { toast.error(e.response?.data?.message || "Could not remove it"); }
  };

  return (
    <div className="pt-1 space-y-2">
      <p className="text-xs font-semibold text-app">Ad messages</p>
      <p className="text-xs text-app-soft">
        Meta sometimes sends an ad click without the ad's details. When a chat opens with one of these
        messages, it still reaches this assistant and its buttons start. They are learned from real clicks;
        add one yourself if the ad is new (paste the ad's pre-filled message exactly).
      </p>
      {rows === null ? (
        <p className="text-xs text-app-soft flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-app-soft rounded-xl px-3 py-2" style={{ background: "var(--app-surface-low)" }}>None yet. They appear after the first clicks on these ads.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-app break-words">{r.text}</p>
                <p className="text-[11px] text-app-soft mt-0.5">
                  <span className="font-mono">{r.adId}</span>
                  {" · "}{r.manual ? "added by you" : `${r.count} click${r.count === 1 ? "" : "s"}`}
                  {!r.active && " · used once two clicks open with it"}
                </p>
              </div>
              <button type="button" onClick={() => remove(r)} title="Stop using this message" className="p-1 text-app-soft hover:text-red-500 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input flex-1 min-w-0 text-xs" placeholder="e.g. Hi, I'd like details of the Green Valley plots."
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        {adIds.length > 1 && (
          <div className="sm:w-56">
            <CustomSelect value={adId} onChange={setAdId} options={adIds.map((a) => ({ value: a, label: a }))} style={{ ...SELECT_STYLE, fontSize: 12 }} />
          </div>
        )}
        <button type="button" onClick={add} disabled={!text.trim() || busy}
          className="btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-[11px] text-app-soft">Save the assistant after adding a new ad ID, then add its message.</p>
    </div>
  );
}

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
