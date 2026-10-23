// services/ctwaFlowService.js — the CTWA button-driven qualification flow.
//
// An alternative to the free-text GPT qualification (whatsappRoutes.js's
// triggerBotReply), only for threads that started from a Click-to-WhatsApp ad
// (conversation.campaignRef set — see campaignRefFromReferral) on an agent
// that has opted into it (WaAgent.ctwaFlow.enabled). Real WhatsApp interactive
// buttons/lists for the qualifying questions, deterministic branching,
// answers written straight onto the Lead record using the exact "never
// overwrite a real value" discipline enrichWhatsAppLead already uses — so the
// existing rule-based scorer (utils/leadScorer.js) reacts to a CTWA lead
// exactly the same way it reacts to any other lead. No second scoring system.
//
// The closing step is built per agent (23 Oct 2026): up to three buttons,
// each with its own action (hand to the team, end politely, book a site visit,
// send photos/brochure/location, go to a question, or register for an event),
// reply text, tag, status and team alert, optionally after asking the customer
// to type something (their name). Agents saved before that keep the old two
// buttons, Talk to Advisor and Book Site Visit. Everything before that,
// including what used to be separate hardcoded "menu" and "site visit"
// steps, is one tenant-managed, freely reorderable list of questions
// (WaAgent.ctwaFlow.qualifyingQuestions) — each with its own explicit mapsTo
// telling this file which real Lead field the answer should write to (or
// "none"), and each option optionally carrying an `action` (send photos/
// docs/location and keep going, hand off to an advisor, or book a site
// visit) — see the option-level comment on the schema for the full list.
// This is a platform feature every tenant uses, not just real-estate ones —
// the leads data this session's form-field-mapper work surfaced tenants
// whose questions look nothing like Purpose/Budget/Timeline, so those three
// can no longer be hardcoded, and neither can a fixed "what next" menu.
//
// Constructed with its dependencies rather than requiring whatsappRoutes.js
// directly — those helpers (sendInteractive, sendQualifiedMedia, ...) are
// private closures in that file, and reaching into a route file from a
// service would invert the codebase's normal dependency direction.
const { levelOf } = require("../middlewares/planGate");
const flowAnswer = require("../utils/flowAnswer");
const AiUsage = require("../models/AiUsage");
const { noDashes } = require("../utils/botText");
const { normalizePurpose, parseIndianCurrencyRange, normalizeBhk, normalizePropertyType, normalizeTimeline, fillTemplate: fill } = require("../utils/formFieldMapper");

module.exports = function createCtwaFlowService({
  WaConversation, Lead, Project,
  sendInteractive, sendProviderMessage, sendQualifiedMedia, handOffToHuman, autoAssignConversation,
  credits,
  WaMessage,
  Organization, WaAgent, isWithinBusinessHours, notifyHotSignal,
}) {
  // Funnel tracking: which steps a customer reached and how the flow ended.
  // Survives the flow itself (flowState is cleared at the end), so drop-off is
  // measurable per step instead of being read off chats by hand.
  const funnelStep = (id, step) => WaConversation.updateOne(
    { _id: id }, { $addToSet: { "flowFunnel.stepsReached": step }, $set: { "flowFunnel.lastStep": step } }
  ).catch(() => {});
  const funnelOutcome = (id, outcome) => WaConversation.updateOne(
    { _id: id, "flowFunnel.outcome": { $exists: false } }, { $set: { "flowFunnel.outcome": outcome, "flowFunnel.outcomeAt": new Date() } }
  ).catch(() => {});

  /**
   * True only when this agent+conversation should start the button flow
   * instead of the usual greeting/GPT path.
   *
   * Which agent answers a thread is decided before this (by ad id, else by
   * the project the first message names), so every genuinely new thread an
   * enabled agent is answering gets the flow. The ad list on the agent
   * (WaAgent.adIds) only routes ads to it; it is not a second filter, so a
   * new ad never silently loses the flow.
   *
   * ctwaFlow.testPhones is a stronger, temporary override on top of either
   * mode: when set, ONLY those exact numbers get the flow — including while
   * adIds is empty, which otherwise means "everyone." It exists so a team can
   * verify the flow live on themselves without it also reaching genuine
   * inbound leads before it's proven out. Clear it to go back to normal.
   *
   * Every other path only ever starts on a conversation's genuine first
   * message (isNewConversation) — nobody should be re-qualified on message
   * #50. Test numbers are the one exception: they can retrigger the flow on
   * any message (as long as they're not already mid-flow), so the team can
   * retest repeatedly from the same number instead of needing a fresh one or
   * wiping conversation history every time.
   */
  function shouldStartFlow(agent, conversation, { isNewConversation = true } = {}) {
    if (!agent?.ctwaFlow?.enabled || conversation.flowState?.step) return false;
    if (agent.ctwaFlow.testPhones?.length) {
      // Normalised both sides: a number saved as 10 digits before 23 Oct 2026
      // never matched the 91-prefixed number WhatsApp sends.
      const { normalizeTestPhone } = require("../utils/phone");
      return agent.ctwaFlow.testPhones.map(normalizeTestPhone).includes(normalizeTestPhone(conversation.contactPhone));
    }
    if (!isNewConversation) return false;
    // Whether this agent should answer the thread at all is decided before we
    // get here (resolveAgentForConversation: by ad id, else by the project the
    // first message names, and an ad-tied agent never takes a lead it cannot
    // place). So an agent that is answering a genuinely new thread runs its
    // flow, whatever ad id the click carried. This used to also require the
    // ad id to be on the agent's list, which silently switched the flow off
    // for every lead from any ad created after the list was last edited (a
    // new Everglades II ad: every lead got free-text GPT replies, no buttons).
    return true;
  }

  // The one project this flow is grounded in. Unlike the GPT path's
  // resolveDiscussedProject, there's no reply text to match against here —
  // a button flow only makes sense when the agent is scoped to exactly one
  // project (or the org only has one), otherwise "which project's brochure/
  // location do I send" has no answer and the flow can't run.
  async function resolveFlowProject(org, agent) {
    const filter = { orgId: org._id, isArchived: { $ne: true } };
    if (agent.projectIds?.length) filter._id = { $in: agent.projectIds };
    const projects = await Project.find(filter)
      .select("name location images videos brochureUrl floorPlanUrl advisorId")
      .populate("advisorId", "name phone")
      .limit(2).lean();
    return projects.length === 1 ? projects[0] : null;
  }

  /**
   * Reserves a credit, sends one message — plain text if neither `buttons`
   * nor `list` is given, interactive otherwise — and logs it exactly like
   * every other bot send.
   */
  async function sendFlowStep(org, conversation, botName, { bodyText, buttons, list, previewLabel }) {
    bodyText = noDashes(bodyText);
    const q = await credits.quote(org._id, "service", 1);
    let held = 0;
    try {
      held = await credits.reserve(org._id, { category: "service", count: 1 });
    } catch (err) {
      if (err instanceof credits.InsufficientCreditsError) {
        console.warn(`[CTWA Flow] org ${org._id} out of credits — flow step skipped`);
        return false;
      }
      throw err;
    }
    let msgId;
    try {
      msgId = buttons || list
        ? await sendInteractive(org, conversation.contactPhone, { bodyText, buttons, list })
        : await sendProviderMessage(org, conversation.contactPhone, bodyText);
    } catch (err) {
      await credits.release(org._id, held);
      console.error("[CTWA Flow] send failed:", err?.response?.data || err.message);
      return false;
    }
    // Stored so the Inbox can show what the customer actually saw — a
    // button/list send that isn't remembered as one renders as if it were
    // plain text in the CRM even though it went out with real buttons.
    const interactiveOptions = (buttons || list?.rows || []).map((o) => ({ id: o.id, title: o.title }));
    await WaMessage.create({
      orgId: org._id, conversationId: conversation._id, waMsgId: msgId,
      direction: "outbound", sender: "bot", senderName: botName,
      body: bodyText, status: "sent", timestamp: new Date(),
      reservedPaise: held, creditCategory: "service", freeTierApplied: q.freeCount > 0,
      ...(interactiveOptions.length ? { interactiveOptions } : {}),
    });
    await WaConversation.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(), lastMessagePreview: previewLabel || bodyText.slice(0, 80),
    });
    return true;
  }

  // WhatsApp allows at most 3 reply buttons — a list is only actually needed
  // once there are more options than that. Renders as inline buttons (same as
  // purpose/menu/site-visit) whenever the tenant has kept it to 3 or fewer,
  // which is the common case, rather than always opening a "Select..." list.
  function optionsAsButtonsOrList(options, { bodyText, buttonLabel }) {
    const rows = options.map((o) => ({ id: o.id, title: o.label }));
    return rows.length <= 3
      ? { bodyText, buttons: rows }
      : { bodyText, list: { buttonLabel, rows } };
  }

  // One qualifying question, tenant-authored — questionText and options are
  // never hardcoded. {{name}}/{{project}} supported like welcomeText, though
  // only the very first question (sent from startFlow) actually has
  // {{project}} available; later ones in the same conversation just get name.
  function questionStep(question, vars) {
    return optionsAsButtonsOrList(question.options, { bodyText: fill(question.questionText, vars), buttonLabel: "Select" });
  }

  // Pre-existing agent docs (e.g. Riya's, saved before qualifyingQuestions
  // existed, or before menu/site-visit were folded into it) still have the
  // old purposeQuestion/purposeOptions/budgetBrackets/timelineOptions/
  // menuOptions/siteVisitSlots fields — synthesized into the same question
  // shape they always behaved as, so nothing about them changes until the
  // tenant actually edits and re-saves through the current UI. No migration
  // script needed; this runs on every read instead.
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
  //      timeline were migrated at some point) but menuOptions/
  //      siteVisitSlots are STILL separate, un-folded fields — those two
  //      questions are appended on top, since otherwise this in-between
  //      state silently drops the menu/site-visit steps entirely (this was
  //      a real bug: an agent migrated before menu/site-visit were folded
  //      in lost both steps from its live flow, not just the editor).
  //   3. qualifyingQuestions already includes a folded-in "menu" /
  //      "site_visit_slots" question (tenant re-saved through the current
  //      builder) — nothing appended, no duplicates.
  function getQualifyingQuestions(agent) {
    const flow = agent?.ctwaFlow;
    const saved = flow?.qualifyingQuestions;
    const qs = saved?.length ? [...saved] : legacyPurposeBudgetTimeline(flow);
    const hasMenu  = qs.some((q) => q.id === "menu");
    const hasSlots = qs.some((q) => q.id === "site_visit_slots");
    if (!hasMenu || !hasSlots) {
      for (const q of legacyMenuAndSiteVisit(flow)) {
        if ((q.id === "menu" && !hasMenu) || (q.id === "site_visit_slots" && !hasSlots)) qs.push(q);
      }
    }
    return qs;
  }

  // Whether the lead record already holds a real answer for a mapped field
  // (typically from a lead form). Deliberately narrow: purpose and
  // propertyType are left out because the Lead schema pre-fills them with
  // defaults ("Buy", "Apartment"), so a value there proves nothing.
  function leadKnows(lead, mapsTo) {
    if (!lead) return false;
    switch (mapsTo) {
      case "budget":       return (lead.budget?.min || 0) > 0 || (lead.budget?.max || 0) > 0;
      case "timeline":     return !!String(lead.timeline || "").trim();
      case "bhk":          return !!lead.bhk && lead.bhk !== "N/A";
      case "purpose":      return !!lead.purpose && lead.purpose !== "N/A";
      case "propertyType": return !!lead.propertyType && lead.propertyType !== "N/A";
      case "city":
      case "preferredLocation":
      case "streetAddress": return !!String(lead[mapsTo] || "").trim();
      default: return false;
    }
  }

  // First question at or after `from` the lead hasn't already answered
  // elsewhere — asking someone for a budget they typed into the form five
  // minutes ago is the fastest way to lose them.
  // Answers already on the lead only count when they were given for this
  // campaign: a lead created in the last day from one of this agent's own ads
  // (or with no ad at all, e.g. the form they filled just before writing).
  // 23 Oct 2026: a customer who had enquired about another project weeks ago
  // clicked the webinar ad and got the closing question straight away, every
  // question skipped on the strength of the old project's answers.
  const FRESH_LEAD_MS = 24 * 3600 * 1000;
  // trustLead: the Inbox's "Start qualification flow", which first reads the
  // answers out of the chat so far (inferAnsweredFromTranscript): those count.
  async function nextUnansweredIndex(questions, from, leadId, agent = null, { trustLead = false } = {}) {
    let lead = null;
    // purpose/propertyType were missing here entirely — leadKnows() had no
    // case for them, so a question mapped to either NEVER counted as
    // answered even when the lead record already had a real value, and the
    // flow always re-asked it. Selected here now that leadKnows() actually
    // checks them.
    if (leadId) lead = await Lead.findById(leadId).select("budget timeline bhk purpose propertyType city preferredLocation streetAddress createdAt campaignRef").lean();
    const fresh = lead && Date.now() - new Date(lead.createdAt).getTime() < FRESH_LEAD_MS
      && (!lead.campaignRef?.adId || !agent || (agent.adIds || []).includes(lead.campaignRef.adId));
    if (!fresh && !trustLead) lead = null;
    let i = from;
    while (i < questions.length && leadKnows(lead, questions[i].mapsTo)) i++;
    return i;
  }

  // The only two ways this flow is allowed to end: a human advisor, or a
  // booked site visit — fixed, not agent-configurable, so "Photos &
  // Brochure" / "Location Details" never become dead ends with no next step.
  const CLOSING_OPTIONS = [{ id: "advisor", title: "Talk to Advisor" }, { id: "site_visit", title: "Book Site Visit" }];
  const DEFAULT_CLOSING_PROMPT = "Would you like to talk to our advisor, or book a site visit?";
  const CLOSING_ADVISOR_ONLY_PROMPT = "Would you like to talk to our advisor?";
  // WhatsApp reply-button titles are capped at 20 characters.
  const CLOSING_TITLE_MAX = 20;

  const CLOSING_ACTIONS = ["handoff", "end", "site_visit", "photos", "docs", "location", "question", "register"];
  // A button saved before closing buttons had actions: its id says what it does.
  const LEGACY_CLOSING_ACTION = { advisor: "handoff", site_visit: "site_visit" };
  // While the customer is typing the answer a closing button asked for.
  const ASK_PREFIX = "__ask__:";

  // The closing buttons this agent offers, each with what it does. Matching a
  // tap (advanceFlow) also accepts the two legacy ids, so a "Book Site Visit"
  // button already sitting in an older chat keeps working after a tenant
  // removes it from the flow.
  function getClosingButtons(agent) {
    const seen = new Set();
    const out = [];
    for (const b of agent?.ctwaFlow?.closingButtons || []) {
      const id = String(b?.id || "").trim();
      const title = String(b?.label || "").trim().slice(0, CLOSING_TITLE_MAX);
      const action = CLOSING_ACTIONS.includes(b?.action) ? b.action : LEGACY_CLOSING_ACTION[id];
      if (!id || !title || !action || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id, title, action,
        reply: String(b.reply || ""), tag: String(b.tag || ""), status: String(b.status || ""),
        notify: b.notify, next: String(b.next || ""),
        askText: b.askText?.prompt ? { prompt: b.askText.prompt, saveTo: b.askText.saveTo || "notes" } : null,
      });
      if (out.length >= 3) break; // WhatsApp's reply-button limit
    }
    return out.length ? out : CLOSING_OPTIONS.map((o) => ({ ...o, action: LEGACY_CLOSING_ACTION[o.id], reply: "", tag: "", status: "", next: "", askText: null }));
  }
  // The one non-question value an option's `next` may point to — matches
  // whatsappRoutes.js's sanitizeCtwaFlow exactly.
  const NEXT_CLOSING = "__closing__";
  // The one non-question value closingSiteVisitNext may point to — matches
  // whatsappRoutes.js's sanitizeCtwaFlow exactly.
  const CTWA_BOOK_IMMEDIATELY = "__book__";
  function closingStep(agent, vars) {
    const buttons = getClosingButtons(agent);
    // The stock wording asks about a site visit, which reads wrong once that
    // button is gone. A prompt the tenant actually wrote is left alone.
    const offersSiteVisit = buttons.some((b) => b.action === "site_visit");
    const onlyStock = buttons.every((b) => LEGACY_CLOSING_ACTION[b.id] === b.action);
    const saved = agent.ctwaFlow.closingPrompt;
    const stock = !saved || saved === DEFAULT_CLOSING_PROMPT;
    const text = !stock ? saved
      : !onlyStock ? "How would you like to continue?"
      : offersSiteVisit ? DEFAULT_CLOSING_PROMPT : CLOSING_ADVISOR_ONLY_PROMPT;
    return { bodyText: fill(text, { ...eventVars(agent), ...vars }), buttons: buttons.map((b) => ({ id: b.id, title: b.title })) };
  }

  // {{event}}, {{time}}, {{link}} for anything an agent with an event writes.
  function eventVars(agent) {
    const ev = agent?.ctwaFlow?.event;
    if (!ev?.title && !ev?.startsAt) return {};
    let time = "";
    if (ev.startsAt) {
      const d = new Date(new Date(ev.startsAt).getTime() + 5.5 * 3600000);
      const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      time = `${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
    }
    return { event: ev.title || "the event", time, link: ev.link || "", minutes: String(ev.reminderMinutes || 30) };
  }

  // What the customer was last asked, for a step id: a question, the closing
  // buttons, or the typed question a closing button asked.
  function stepContent(agent, step, vars) {
    if (step === "closing") return closingStep(agent, vars);
    if (String(step || "").startsWith(ASK_PREFIX)) {
      const b = getClosingButtons(agent).find((x) => x.id === step.slice(ASK_PREFIX.length));
      return b?.askText?.prompt ? { bodyText: fill(b.askText.prompt, { ...eventVars(agent), ...vars }) } : null;
    }
    const q = getQualifyingQuestions(agent).find((x) => x.id === step);
    return q ? questionStep(q, vars) : null;
  }

  /**
   * The one real terminal action: hands the conversation to a human. If the
   * discussed project has its own designated advisor (Project.advisorId —
   * set in the Projects page so different projects can route to different
   * people), the conversation goes straight to them instead of round-robin —
   * a tenant running several projects usually wants each one's leads landing
   * with that project's own point of contact, not whoever's turn it is.
   */
  async function terminalAdvisor(org, agent, conversation, botName, project, { reply = "", notify = true, reason = "asked to talk to an advisor" } = {}) {
    const advisor = project?.advisorId;
    // The phone number is what actually lets the lead act right now instead
    // of waiting on a callback — WhatsApp auto-links a plain digit string
    // like this into a tappable number. First name only, not the advisor's
    // full name — reads like a person texting, not a formal handoff notice.
    const advisorFirstName = advisor?.name ? advisor.name.trim().split(/\s+/)[0] : "";
    const line = reply ? reply : advisorFirstName
      ? `Connecting you with ${advisorFirstName} from our team, they'll reach out to you shortly.${advisor.phone ? ` You can also reach them directly on ${advisor.phone}.` : ""}`
      : "Connecting you with our team, someone will reach out to you shortly.";
    await sendFlowStep(org, conversation, botName, { bodyText: line, previewLabel: "→ Connected to advisor" });
    if (advisor?._id) {
      await WaConversation.findByIdAndUpdate(conversation._id, { assignedTo: advisor._id, assignedToName: advisor.name });
    } else {
      await autoAssignConversation(org, conversation);
    }
    await funnelOutcome(conversation._id, "advisor");
    await handOffToHuman(org, conversation, { notify, reason });
  }

  /**
   * Sends the greeting as its own plain-text message, then the purpose
   * question with its buttons as a second, separate message — combining a
   * greeting with the first question into one interactive body reads as the
   * bot talking over itself rather than a real opening exchange — and marks
   * the conversation as being in the flow.
   *
   * The greeting is skipped entirely when welcomeText is blank — a tenant
   * running Meta's own "automated greeting" on the ad itself (Ads Manager →
   * Conversations, shown the instant someone taps the ad, before this bot
   * ever sees a message) doesn't want a second, redundant "thanks for your
   * interest" from here too. It's also skipped whenever the bot has already
   * said anything at all in this thread — a brand-new conversation is the
   * only time "thanks for your interest" reads naturally; a lead who was
   * already greeted (by the free-text agent, or manually via the Inbox's
   * "Start qualification flow" recovery button on an existing thread) just
   * needs the flow's actual first question, not a second hello.
   */
  async function startFlow(org, agent, conversation, { trustLead = false } = {}) {
    const botName = agent.name || "Artha Assistant";
    const vars = { name: conversation.contactName || "there", project: (await resolveFlowProject(org, agent))?.name || "" };
    const alreadyGreeted = await WaMessage.exists({ conversationId: conversation._id, direction: "outbound", sender: "bot" });
    if (agent.ctwaFlow.welcomeText?.trim() && !alreadyGreeted) {
      const greetingSent = await sendFlowStep(org, conversation, botName, { bodyText: fill(agent.ctwaFlow.welcomeText, vars) });
      if (!greetingSent) return;
    }
    const questions = getQualifyingQuestions(agent);
    if (!questions.length) return; // sanitizeCtwaFlow blocks enabling without this — never crash live traffic over it regardless
    const firstIdx = await nextUnansweredIndex(questions, 0, conversation.leadId, agent, { trustLead });
    if (firstIdx >= questions.length) {
      // Everything we'd ask is already on the lead — straight to closing.
      const closingSent = await sendFlowStep(org, conversation, botName, { ...closingStep(agent, vars), previewLabel: "Started qualification" });
      if (closingSent) await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: "closing", startedAt: new Date(), ...(trustLead ? { trustLead: true } : {}) }, flowFunnel: { startedAt: new Date(), stepsReached: ["closing"], lastStep: "closing" } });
      return;
    }
    const first = questions[firstIdx];
    const questionSent = await sendFlowStep(org, conversation, botName, { ...questionStep(first, vars), previewLabel: "Started qualification" });
    if (questionSent) {
      await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: first.id, startedAt: new Date(), ...(trustLead ? { trustLead: true } : {}) }, flowFunnel: { startedAt: new Date(), stepsReached: [first.id], lastStep: first.id } });
    }
  }

  // Only ever fills a field still at its neutral default — same rule
  // autoCaptureWhatsAppLead / enrichWhatsAppLead already apply, so a button
  // flow answer never clobbers something a human or the GPT path already set.
  async function updateLeadIfBlank(leadId, setOps) {
    if (!leadId || !Object.keys(setOps).length) return;
    const topLevelFields = [...new Set(Object.keys(setOps).map((k) => k.split(".")[0]))];
    const lead = await Lead.findById(leadId).select(topLevelFields.join(" ")).lean();
    if (!lead) return;
    const toSet = {};
    for (const [k, v] of Object.entries(setOps)) {
      const current = k.includes(".") ? k.split(".").reduce((o, p) => o?.[p], lead) : lead[k];
      if (!current || current === "N/A") toSet[k] = v;
    }
    if (Object.keys(toSet).length) await Lead.updateOne({ _id: leadId }, { $set: toSet });
  }

  /**
   * Writes a qualifying-question answer onto the real Lead field the tenant
   * chose (question.mapsTo), reusing formFieldMapper.js's exact value
   * normalizers — the same ones a webhook-sourced lead (Facebook/Google/
   * website forms) is mapped through, so a "budget" question behaves
   * identically regardless of where it came from. A mapping that doesn't
   * apply (mapsTo "none") or whose value doesn't cleanly parse for that
   * field (a custom, non-real-estate question) never forces a bad value —
   * it's recorded on Lead.formResponses instead, replacing any earlier
   * answer to the same question, exactly like the "Additional Questions"
   * leftovers a webhook-sourced lead gets.
   */
  // A button-flow answer for one lead field: written when the field is empty
  // (or still the "Buy" / "N/A" placeholder); a different real value already
  // on the lead is not overwritten but offered on the Artha card ("Update
  // budget to ...?"), like a detail read from the chat or a call. Same value,
  // or one the team dismissed before: nothing.
  async function fillOrSuggest(leadId, key, value) {
    if (!leadId || value == null || value === "") return;
    const { isBlank, sameValue, untouchedDefaults } = require("../utils/leadFieldFill");
    const lead = await Lead.findById(leadId).select(`${key} arthaSuggest source detailsSetByPerson`).lean();
    if (!lead) return;
    const write = key === "budget" ? { "budget.min": value.min || 0, "budget.max": value.max || 0 } : { [key]: value };
    const placeholder = isBlank(key, lead[key]) || untouchedDefaults(lead).includes(key) || (key === "purpose" && lead.purpose === "Buy");
    if (placeholder) { await Lead.updateOne({ _id: leadId }, { $set: write }); return; }
    if (sameValue(value, lead[key])) return;
    if ((lead.arthaSuggest?.dismissed?.[key] || []).some((d) => sameValue(value, d))) return;
    const shown = key === "budget" ? { min: value.min || 0, max: value.max || 0 } : value;
    await Lead.updateOne({ _id: leadId }, { $set: { [`arthaSuggest.fields.${key}`]: shown, [`arthaSuggest.from.${key}`]: "button_flow", "arthaSuggest.at": new Date() } });
  }

  async function applyQuestionAnswer(leadId, question, option) {
    const value = option.label;
    let mapped = null;
    switch (question.mapsTo) {
      case "purpose":
        mapped = normalizePurpose(value);
        // Not updateLeadIfBlank: the Lead schema pre-fills purpose with "Buy",
        // so "blank" never applied and an "Investment" tap was silently
        // dropped. The customer's latest tap is the best evidence we have, so
        // it wins (this also lets them change their mind).
        if (mapped) await fillOrSuggest(leadId, "purpose", mapped);
        break;
      case "budget": {
        const range = option.max > 0 ? { min: option.min || 0, max: option.max } : parseIndianCurrencyRange(value);
        if (range) { mapped = range; await fillOrSuggest(leadId, "budget", range); }
        break;
      }
      case "timeline":
        mapped = normalizeTimeline(value);
        if (mapped) await fillOrSuggest(leadId, "timeline", mapped);
        break;
      case "bhk":
        mapped = normalizeBhk(value);
        if (mapped) await fillOrSuggest(leadId, "bhk", mapped);
        break;
      case "propertyType":
        mapped = normalizePropertyType(value);
        if (mapped) await fillOrSuggest(leadId, "propertyType", mapped);
        break;
      case "city":
      case "preferredLocation":
      case "streetAddress": {
        const trimmed = String(value || "").trim();
        mapped = trimmed || null;
        if (mapped) await fillOrSuggest(leadId, question.mapsTo, mapped);
        break;
      }
      default:
        mapped = null;
    }

    if (!mapped && leadId) {
      // Latest answer wins here (unlike updateLeadIfBlank above) — this is
      // just a record of what was asked, not a scored field, so revisiting
      // and changing an answer should show the current one, not the first.
      await Lead.updateOne({ _id: leadId }, { $pull: { formResponses: { fieldKey: question.id } } });
      await Lead.updateOne({ _id: leadId }, { $push: { formResponses: { fieldKey: question.id, label: question.questionText, value } } });
    }
  }

  /**
   * Advances the flow by one step given the customer's tap (or free-typed
   * message, which never matches and falls the conversation out of the flow
   * back to the normal GPT path rather than dead-ending).
   *
   * Returns true if the flow handled this message, false if the caller should
   * fall through to the usual triggerBotReply.
   */
  async function advanceFlow(org, agent, conversation, { interactiveId: tappedId, msgText, inboundAt = null }) {
    let interactiveId = tappedId;
    const step = conversation.flowState?.step;
    if (!step || !agent?.ctwaFlow?.enabled) return false;
    const botName = agent.name || "Artha Assistant";
    const questions = getQualifyingQuestions(agent);
    const vars = { name: conversation.contactName || "there" };

    const exitFlow = async () => {
      await funnelOutcome(conversation._id, "exited");
      return WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });
    };
    const closingButtons = getClosingButtons(agent);

    // Sends a specific question (or the closing prompt, for the "__closing__"
    // sentinel) and records it as the new step — the one thing every
    // non-terminal option's tap eventually leads to, whatever it did along
    // the way (recorded an answer, sent photos, ...).
    const goTo = async (targetId) => {
      const target = targetId === NEXT_CLOSING ? null : questions.find((q) => q.id === targetId);
      if (target) {
        await sendFlowStep(org, conversation, botName, questionStep(target, vars));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": target.id });
        await funnelStep(conversation._id, target.id);
      } else {
        await sendFlowStep(org, conversation, botName, closingStep(agent, vars));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "closing" });
        await funnelStep(conversation._id, "closing");
      }
    };

    // Default when an option doesn't explicitly say where to go next: the
    // next still-unanswered question in array order, or closing once none
    // are left.
    const advancePast = async (questionIndex) => {
      const nextIdx = await nextUnansweredIndex(questions, questionIndex + 1, conversation.leadId, agent, { trustLead: !!conversation.flowState?.trustLead });
      await goTo(questions[nextIdx]?.id ?? NEXT_CLOSING);
    };

    // Matched by button id across every question this flow has, not by
    // whatever step we last recorded — Meta doesn't let us disable a button
    // on a message already sent, and a lead often wants to revisit an
    // earlier question (see the location, then still tap the floor plan;
    // pick a different budget after moving on) rather than being stuck
    // wherever they last left off. So any earlier message's button keeps
    // doing exactly what it says, for as long as the flow hasn't reached a
    // true terminal (advisor connected, or a site-visit slot picked — both
    // hand off to a human and clear flowState, so nothing reaches this
    // function again after that).
    // Someone who types the answer ("investment", "3-6 months", "photos")
    // instead of tapping it is answering the question, not leaving the flow.
    // Matched only against what is on screen right now (the current
    // question, or the closing buttons), and only on a clear match.
    const current = questions.find((q) => q.id === step);

    // The customer is typing what a closing button asked for (their name, an
    // email). A short plain answer is taken; a question gets the AI's answer
    // and the ask once more, like a question step; anything else ends the flow.
    if (step.startsWith(ASK_PREFIX)) {
      const button = closingButtons.find((b) => b.id === step.slice(ASK_PREFIX.length));
      if (!button) { await exitFlow(); return false; }
      const said = String(msgText || "").replace(/\s+/g, " ").trim();
      if (!interactiveId && said) {
        // Read against the chat, not taken as is (23 Oct 2026: "no" to "May I
        // have your full name?" was saved as the name and the seat confirmed
        // to "Thanks no").
        const recent = (await WaMessage.find({ conversationId: conversation._id }).sort({ timestamp: -1 }).limit(8).select("direction body").lean())
          .reverse().map((m) => ({ from: m.direction === "inbound" ? "customer" : "bot", text: m.body }));
        const read = await flowAnswer.readTypedAnswer(
          { prompt: button.askText?.prompt || "", saveTo: button.askText?.saveTo || "notes", said, recent, choice: button.title },
          (usage) => AiUsage.updateOne(
            { orgId: org._id, month: new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7) },
            { $inc: { flowMatchCalls: 1, flowMatchTokens: usage?.total_tokens || 0 } }, { upsert: true },
          ).catch(() => {}));
        if (read.kind === "answer") {
          await saveTypedAnswer(conversation, button.askText?.saveTo, read.value);
          return finishClosing(org, agent, conversation, botName, button, questions, goTo);
        }
        // Would rather not say: what they chose still happens, without it.
        if (read.kind === "skip") return finishClosing(org, agent, conversation, botName, button, questions, goTo);
        if (read.kind === "cancel") {
          await sendFlowStep(org, conversation, botName, { bodyText: read.reply || "No problem! Message us here anytime if you change your mind." });
          if (conversation.leadId) await Lead.updateOne({ _id: conversation.leadId }, { $push: { activities: { type: "note_added", description: `Chose "${button.title}" on WhatsApp, then changed their mind` } } });
          await WaConversation.updateOne({ _id: conversation._id }, { $unset: { flowState: 1 } });
          await funnelOutcome(conversation._id, "ended");
          return true;
        }
      }
      if (msgText && conversation.flowState?.reasked !== step) {
        await WaConversation.updateOne({ _id: conversation._id }, { $set: { "flowState.reasked": step, "flowState.resumeAfterReply": true } });
        return false;
      }
      await exitFlow();
      return false;
    }

    let typedBudget = null;
    if (!interactiveId && msgText) {
      const norm = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9₹+ ]/g, " ").replace(/\s+/g, " ").trim();
      const said = norm(msgText);
      const onScreen = current ? current.options.map((o) => ({ id: o.id, label: o.label }))
        : step === "closing" ? closingButtons.map((b) => ({ id: b.id, label: b.title })) : [];
      if (said && said.length <= 40) {
        const hits = onScreen.filter((o) => {
          const l = norm(o.label);
          return l && (said === l || (l.length >= 4 && said.includes(l)) || (said.length >= 4 && l.split(" ").length > 1 && l.startsWith(said)));
        });
        if (hits.length === 1) interactiveId = hits[0].id;
      }

      // A typed budget ("1.5 cr", "150 lakh", "around 90"): the button its
      // amount falls in, or, when it fits none, the amount itself still
      // answers the question (22 Oct 2026: "1.5 cr" used to end the flow).
      // Any agent's budget question: one mapped to budget, or whose buttons
      // are all rupee ranges.
      if (!interactiveId && current && (current.mapsTo === "budget" || current.options.every((o) => flowAnswer.optionRange(o)))) {
        const b = flowAnswer.matchBudget(msgText, current.options);
        if (b?.option) interactiveId = b.option.id;
        else if (b?.amount) typedBudget = b.amount;
      }

      // Anything else ("next month", "for my family", "haan call karo"): a
      // small AI check maps it to one on-screen button, only when clear. A
      // question is never read as an answer.
      if (!interactiveId && !typedBudget && onScreen.length && !flowAnswer.looksLikeQuestion(msgText)) {
        const pick = await flowAnswer.aiMatch(current ? fill(current.questionText, vars) : (agent.ctwaFlow.closingPrompt || "How would you like to continue?"),
          onScreen, msgText, (usage) => AiUsage.updateOne(
            { orgId: org._id, month: new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7) },
            { $inc: { flowMatchCalls: 1, flowMatchTokens: usage?.total_tokens || 0 } }, { upsert: true },
          ).catch(() => {}));
        if (pick) interactiveId = pick.id;
      }
    }

    // A budget amount that fits none of the buttons still answers the budget
    // question: saved on the lead, and the flow moves on.
    if (typedBudget && current) {
      await applyQuestionAnswer(conversation.leadId, current, { label: String(msgText).slice(0, 60), min: typedBudget.min, max: typedBudget.max || typedBudget.min });
      await advancePast(questions.indexOf(current));
      return true;
    }

    let matchedQuestionIndex = -1, matchedOption = null;
    for (let i = 0; i < questions.length; i++) {
      const opt = questions[i].options.find((o) => o.id === interactiveId);
      if (opt) { matchedQuestionIndex = i; matchedOption = opt; break; }
    }
    const closingOpt = closingButtons.find((o) => o.id === interactiveId)
      || (LEGACY_CLOSING_ACTION[interactiveId] ? { id: interactiveId, title: interactiveId, action: LEGACY_CLOSING_ACTION[interactiveId], reply: "", tag: "", status: "", next: "", askText: null } : null);

    if (matchedQuestionIndex !== -1) {
      const question = questions[matchedQuestionIndex];
      const action = matchedOption.action || "none";

      // Terminal actions win outright, regardless of whether this button
      // came from an earlier, already-passed message — an explicit "Talk to
      // Advisor" or a picked site-visit slot always means what it says.
      if (action === "advisor") {
        await applyQuestionAnswer(conversation.leadId, question, matchedOption);
        await terminalAdvisor(org, agent, conversation, botName, await resolveFlowProject(org, agent));
        await exitFlow();
        return true;
      }
      if (action === "site_visit") {
        return completeSiteVisit(org, conversation, botName, matchedOption);
      }

      // Informational — photos / docs / location — never a dead end, and
      // always re-sent on tap even if this button is from an earlier,
      // already-passed message: someone scrolling back up to ask for photos
      // again is a legitimate repeat request, not a correction.
      if (action === "photos" || action === "docs" || action === "location") {
        await sendProjectInfo(org, agent, conversation, botName, action);
      }

      await applyQuestionAnswer(conversation.leadId, question, matchedOption);

      // Where the conversation actually is right now. Tapping an earlier
      // question's button again (changing an answer, re-requesting photos,
      // or a double tap) updates the answer / resends info above, but must
      // not re-send whatever already followed it.
      const currentIdx = questions.findIndex((q) => q.id === step);
      const position = currentIdx === -1 ? questions.length : currentIdx;
      if (matchedQuestionIndex < position) return true;

      // Another tap from this same question (or a later one) is already
      // queued: "Location Details" then "Photos & Videos" a second later. Let
      // that turn move the conversation on, so the closing question comes
      // once, after both answers, instead of between them.
      const waiting = conversation._pendingTaps?.() || [];
      if (waiting.some((id) => closingButtons.some((o) => o.id === id) || LEGACY_CLOSING_ACTION[id]
        || questions.some((q, i) => i >= matchedQuestionIndex && q.options.some((o) => o.id === id)))) {
        return true;
      }

      // An explicit "then go to" wins over the default array-order
      // progression — this is what lets two different buttons on the same
      // question (e.g. "Photos & Videos" vs. "Book a Private Preview") lead
      // to different next steps instead of both always landing on whatever
      // is positionally next.
      if (matchedOption.next) await goTo(matchedOption.next);
      else await advancePast(matchedQuestionIndex);
      return true;
    }

    if (closingOpt) {
      // A typed question first ("May I have your full name?"), then the rest.
      if (closingOpt.askText?.prompt && closingOpt.action !== "question") {
        const vars2 = { ...eventVars(agent), name: conversation.contactName || "there" };
        await sendFlowStep(org, conversation, botName, { bodyText: fill(closingOpt.askText.prompt, vars2) });
        await WaConversation.updateOne({ _id: conversation._id }, { $set: { "flowState.step": ASK_PREFIX + closingOpt.id }, $unset: { "flowState.reasked": 1 } });
        await funnelStep(conversation._id, "ask");
        return true;
      }
      return finishClosing(org, agent, conversation, botName, closingOpt, questions, goTo);
    }

    // Typed before the customer could have seen our latest question (their
    // own follow-up to the ad's prefilled message, sent while the first
    // question was on its way): it crossed with the question rather than
    // replying to it. The question is on their screen now, so stay in the
    // flow instead of throwing it away over a message that predates it.
    if (inboundAt) {
      const lastBot = await WaMessage.findOne({ conversationId: conversation._id, direction: "outbound", sender: "bot" })
        .sort({ timestamp: -1 }).select("timestamp").lean();
      if (lastBot && new Date(lastBot.timestamp) > new Date(inboundAt)) return true;
    }

    // Not an answer: a question ("where is the plot?") or something else.
    // The first time at a question, the AI answers it and the question is
    // asked once more (resumeFlow, after the reply), so one question doesn't
    // end the flow. If they still don't answer, the flow ends as before and
    // the AI carries on with the chat.
    if (current && msgText && conversation.flowState?.reasked !== step) {
      await WaConversation.updateOne({ _id: conversation._id }, { $set: { "flowState.reasked": step, "flowState.resumeAfterReply": true } });
      return false;
    }
    await exitFlow();
    return false;
  }

  /** The pending question's text while the AI answers a side question, else null. */
  async function pendingResume(agent, conversationId) {
    const conv = await WaConversation.findById(conversationId).select("flowState contactName").lean();
    if (!conv?.flowState?.resumeAfterReply) return null;
    return stepContent(agent, conv.flowState.step, { name: conv.contactName || "there" })?.bodyText || null;
  }

  /**
   * After the AI answered a side question mid-flow: ask the pending question
   * again, with its buttons. Once per question (flowState.reasked).
   */
  async function resumeFlow(org, agent, conversationId) {
    const conv = await WaConversation.findById(conversationId);
    if (!conv?.flowState?.resumeAfterReply) return false;
    await WaConversation.updateOne({ _id: conv._id }, { $unset: { "flowState.resumeAfterReply": 1 } });
    if (!conv.botEnabled) return false; // a person took over meanwhile
    const stepMsg = stepContent(agent, conv.flowState.step, { name: conv.contactName || "there" });
    if (!stepMsg) return false;
    stepMsg.bodyText = `Coming back to my earlier question:

${stepMsg.bodyText}`;
    await sendFlowStep(org, conv, agent.name || "Artha Assistant", stepMsg);
    return true;
  }

  // The other true terminal (besides terminalAdvisor above): a picked
  // site-visit slot. Lead written the same way the rest of this flow writes
  // it — real fields the existing scorer already weights, not a second
  // scoring system — then handed to a human, same as the advisor path.
  async function completeSiteVisit(org, conversation, botName, opt, { reply = "", notify = true } = {}) {
    if (conversation.leadId) {
      await Lead.updateOne(
        { _id: conversation.leadId },
        {
          $set: { status: "Site Visit", booking: "Site Visit Booked" },
          $push: {
            activities: {
              type: "site_visit",
              description: `Requested a site visit via WhatsApp (preferred slot: ${opt.label})`,
              meta: { slot: opt.id, source: "ctwa_flow" },
            },
          },
        }
      );
    }
    await sendFlowStep(org, conversation, botName, { bodyText: reply || "Wonderful! Our team will confirm your visit shortly and take it from here.", previewLabel: "🏡 Site visit requested" });
    await WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });
    await autoAssignConversation(org, conversation);
    await funnelOutcome(conversation._id, "site_visit");
    await handOffToHuman(org, conversation, { notify, reason: "requested a site visit" });
    return true;
  }

  // Photos & videos, the brochure & floor plan, or the location of the one
  // project this flow is about. The customer tapped for it, so it is sent
  // whatever the free-text "what it can send" switches say; anything not
  // uploaded is said plainly, never faked.
  async function sendProjectInfo(org, agent, conversation, botName, action) {
    const project = await resolveFlowProject(org, agent);
    if (!project) return;
    if (action === "location") {
      // Just the location: project names usually already say where they
      // are ("Shapoorji Pallonji Khopoli Plots"), so "<name> is located
      // at: Near Khopoli" read twice.
      if (project.location) await sendFlowStep(org, conversation, botName, { bodyText: `📍 Location: ${project.location}` });
      return;
    }
    const wants = action === "photos"
      ? { wantsPhotos: true, wantsVideos: true }
      : { wantsBrochure: true, wantsFloorPlan: true };
    notifyHotSignal?.(org, conversation, action === "photos" ? "asked for photos & videos" : "asked for the floor plan & brochure");
    const { sent, missing } = (await sendQualifiedMedia(org, agent, conversation, botName, project.name, { ...wants, force: true, project })) || { sent: [], missing: [] };
    if (missing.length) {
      const label = missing.map((m) => ({ photos: "photos", videos: "the video", brochure: "the brochure", floorplan: "the floor plan" }[m])).join(" and ");
      const lead = sent.length ? "The rest" : `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
      await sendFlowStep(org, conversation, botName, {
        bodyText: sent.length
          ? `${lead} isn't ready on my side yet. Our team will send ${label} across shortly.`
          : `${lead} isn't ready on my side yet, our team will send it across shortly.`,
      });
    }
  }

  // What the customer typed when a closing button asked for it.
  async function saveTypedAnswer(conversation, saveTo, text) {
    const leadId = conversation.leadId;
    if (saveTo === "name") {
      const name = text.replace(/[^\p{L}\p{M} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (!name) return;
      await WaConversation.updateOne({ _id: conversation._id }, { $set: { contactName: name } });
      conversation.contactName = name;
      if (leadId) {
        const lead = await Lead.findById(leadId).select("name").lean();
        await Lead.updateOne({ _id: leadId }, {
          $set: { name },
          $push: { activities: { type: "note_added", description: `Gave their name on WhatsApp: ${name}${lead?.name && lead.name !== name ? ` (was "${lead.name}")` : ""}` } },
        });
      }
      return;
    }
    if (!leadId) return;
    if (saveTo === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      const lead = await Lead.findById(leadId).select("email").lean();
      if (!lead?.email) await Lead.updateOne({ _id: leadId }, { $set: { email: text.toLowerCase() } });
      return;
    }
    await Lead.updateOne({ _id: leadId }, { $push: { notes: { text: `Said on WhatsApp: "${text}"`, addedByName: "WhatsApp assistant" } } });
  }

  // The lead remembers which closing button was chosen: a tag, a status if the
  // button sets one, and a line in its activity.
  async function recordClosingChoice(leadId, button) {
    if (!leadId) return;
    const OPTS = require("../constants/leadOptions");
    const update = { $push: { activities: { type: "note_added", description: `Chose "${button.title}" on WhatsApp` } } };
    if (button.tag) update.$addToSet = { tags: button.tag.slice(0, 40) };
    if (button.status && (OPTS.STATUS || []).includes(button.status)) update.$set = { status: button.status };
    await Lead.updateOne({ _id: leadId }, update);
  }

  /**
   * What a closing button does once tapped (and once anything it asked for
   * was typed). Every action ends the flow except "question", which carries
   * on at the chosen question.
   */
  async function finishClosing(org, agent, conversation, botName, button, questions, goTo) {
    const fresh = await WaConversation.findById(conversation._id).select("contactName").lean();
    // A WhatsApp profile name that isn't a person's ("no", "Prophunt Consulting"
    // still reads fine; "~", "." or "no" alone does not) becomes "there".
    const { looksLikeCallerName } = require("../utils/personName");
    const first = String(fresh?.contactName || conversation.contactName || "").trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}]/gu, "");
    const vars = { ...eventVars(agent), name: looksLikeCallerName(first) ? first : "there" };
    const reply = button.reply ? fill(button.reply, vars) : "";
    const endFlow = () => WaConversation.updateOne({ _id: conversation._id }, { $unset: { flowState: 1 } });
    await recordClosingChoice(conversation.leadId, button);

    switch (button.action) {
      case "question": {
        if (button.next && questions.some((q) => q.id === button.next)) { await goTo(button.next); return true; }
        break; // nowhere to go: treated as "end" below
      }
      case "handoff":
        await terminalAdvisor(org, agent, conversation, botName, await resolveFlowProject(org, agent),
          { reply, notify: button.notify !== false, reason: `chose "${button.title}"` });
        await endFlow();
        return true;
      case "site_visit": {
        // Tenant-configured target (closingSiteVisitNext) wins outright — a
        // specific question id asks that question, "__book__" always books
        // immediately. With nothing configured, any question whose every
        // option books a site visit is asked, else it books at once.
        const configuredNext = button.next || agent.ctwaFlow.closingSiteVisitNext || "";
        if (configuredNext !== CTWA_BOOK_IMMEDIATELY) {
          const target = configuredNext
            ? questions.find((q) => q.id === configuredNext)
            : questions.find((q) => q.options.length && q.options.every((o) => o.action === "site_visit"));
          if (target) { await goTo(target.id); return true; }
        }
        return completeSiteVisit(org, conversation, botName, { id: "site_visit", label: "General enquiry" }, { reply, notify: button.notify !== false });
      }
      case "photos":
      case "docs":
      case "location":
        await sendProjectInfo(org, agent, conversation, botName, button.action);
        if (reply) await sendFlowStep(org, conversation, botName, { bodyText: reply });
        await endFlow();
        await funnelOutcome(conversation._id, button.action);
        if (button.notify === true) notifyHotSignal?.(org, conversation, `chose "${button.title}"`);
        return true;
      case "register":
        await registerForEvent(org, agent, conversation, botName, button, vars, reply);
        await endFlow();
        await funnelOutcome(conversation._id, "registered");
        if (button.notify !== false) notifyHotSignal?.(org, conversation, `registered for ${vars.event || "the event"}`);
        return true;
      default:
        break;
    }
    // "end" (and a "question" button with nowhere to go): a polite last line;
    // the assistant stays on for anything they write next.
    await sendFlowStep(org, conversation, botName, { bodyText: reply || "Thank you! Message us here anytime if you need anything." });
    await endFlow();
    await funnelOutcome(conversation._id, "ended");
    if (button.notify === true) notifyHotSignal?.(org, conversation, `chose "${button.title}"`);
    return true;
  }

  // Confirms the registration and schedules the joining-link reminder.
  async function registerForEvent(org, agent, conversation, botName, button, vars, reply) {
    const ev = agent.ctwaFlow.event || {};
    const startsAt = ev.startsAt ? new Date(ev.startsAt) : null;
    const minutes = Number(ev.reminderMinutes) || 30;
    const text = reply || (startsAt
      ? `You're registered for ${vars.event} on ${vars.time}. We'll send you the joining link here ${minutes} minutes before it starts.`
      : `You're registered for ${vars.event}. We'll send you the joining details here before it starts.`);
    await sendFlowStep(org, conversation, botName, { bodyText: text, previewLabel: "✅ Registered" });
    if (!startsAt || startsAt <= new Date()) return;
    const EventReminder = require("../models/EventReminder");
    const sendAt = new Date(Math.max(Date.now(), startsAt.getTime() - minutes * 60000));
    const fresh = await WaConversation.findById(conversation._id).select("contactName contactPhone").lean();
    await EventReminder.updateOne(
      { agentId: agent._id, conversationId: conversation._id, eventStartsAt: startsAt },
      { $set: { orgId: org._id, leadId: conversation.leadId || null, phone: fresh?.contactPhone || conversation.contactPhone,
          name: fresh?.contactName || conversation.contactName || "", eventTitle: ev.title || "", sendAt, status: "pending", error: "" } },
      { upsert: true },
    );
  }

  // ── Event reminders: the joining link, reminderMinutes before the event ─────
  // Inside the customer's 24-hour reply window it goes as plain text (a free
  // service message); outside it, only an approved template is allowed, so the
  // agent's chosen one is sent with its {{n}} filled in. With neither, the
  // reminder is skipped and the reason kept, rather than failing silently.
  async function runEventReminders(now = new Date()) {
    const EventReminder = require("../models/EventReminder");
    const templates = require("./whatsappTemplateService");
    const due = await EventReminder.find({ status: "pending", sendAt: { $lte: now } }).sort({ sendAt: 1 }).limit(100);
    let sent = 0;
    for (const r of due) {
      // Claimed first, so two runs can never send the same reminder twice.
      const claimed = await EventReminder.findOneAndUpdate({ _id: r._id, status: "pending" }, { $set: { status: "sent", sentAt: now } });
      if (!claimed) continue;
      const finish = (patch) => EventReminder.updateOne({ _id: r._id }, { $set: patch });
      try {
        const [agent, org, conv] = await Promise.all([
          WaAgent.findById(r.agentId).lean(),
          Organization.findById(r.orgId),
          WaConversation.findById(r.conversationId),
        ]);
        const ev = agent?.ctwaFlow?.event;
        if (!agent || !org || !conv || !ev) { await finish({ status: "skipped", error: "agent, chat or event no longer exists" }); continue; }
        if (ev.startsAt && new Date(ev.startsAt).getTime() < now.getTime() - 60 * 60000) { await finish({ status: "skipped", error: "the event is over" }); continue; }
        const vars = { ...eventVars(agent), name: String(conv.contactName || r.name || "there").split(/\s+/)[0] };
        const lastIn = await WaMessage.findOne({ conversationId: conv._id, direction: "inbound" }).sort({ timestamp: -1 }).select("timestamp").lean();
        const windowOpen = lastIn && now - new Date(lastIn.timestamp) < 23.5 * 3600000;
        if (windowOpen) {
          const text = fill(ev.reminderText || "Hi {{name}}, {{event}} starts in {{minutes}} minutes. Join here: {{link}}", vars);
          const ok = await sendFlowStep(org, conv, agent.name || "Artha Assistant", { bodyText: text, previewLabel: "🔔 Event reminder" });
          await finish(ok ? { via: "text" } : { status: "failed", error: "send failed or no credits" });
          if (ok) sent++;
          continue;
        }
        if (!ev.templateName) { await finish({ status: "skipped", error: "the 24-hour window had closed and no template is chosen" }); continue; }
        const values = (ev.templateVars || []).map((k) => vars[k] || "-");
        let held = 0;
        try { held = await credits.reserve(org._id, { category: "utility", count: 1 }); }
        catch (err) { if (err instanceof credits.InsufficientCreditsError) { await finish({ status: "failed", error: "not enough credits" }); continue; } throw err; }
        try {
          const msgId = await sendProviderMessage(org, conv.contactPhone, "", {
            name: ev.templateName, language: ev.templateLanguage || "en_US",
            components: templates.buildSendComponents({ components: [] }, values),
          });
          await WaMessage.create({
            orgId: org._id, conversationId: conv._id, waMsgId: msgId || undefined,
            direction: "outbound", sender: "bot", senderName: agent.name || "Artha Assistant",
            body: `[${ev.templateName}] ${values.join(" · ")}`, status: "sent", timestamp: new Date(),
            reservedPaise: held, creditCategory: "utility",
          });
          await finish({ via: "template" });
          sent++;
        } catch (err) {
          await credits.release(org._id, held);
          await finish({ status: "failed", error: String(err?.response?.data?.error?.message || err.message).slice(0, 200) });
        }
      } catch (err) {
        await finish({ status: "failed", error: String(err.message).slice(0, 200) });
      }
    }
    return { sent, checked: due.length };
  }

  // ── Follow-up nudges ───────────────────────────────────────────────────────
  // Applies to button-flow chats AND (since 21 Oct 2026) ordinary AI chats of
  // an agent with "Follow up if they go quiet" on. In an ordinary chat the
  // nudge repeats the assistant's last question, and is sent only when that
  // last message actually asked something.
  // Someone who stops answering mid-flow gets one gentle nudge (about 15
  // minutes after the bot's last message) and one final reminder shortly
  // before the 24h reply window closes, each re-sending the pending question
  // with its buttons so continuing is a single tap. Only for agents that turned
  // it on, only in business hours, only while the bot spoke last, and at most
  // two per silence (the count resets when the customer writes again). Inside
  // the reply window these are ordinary free service messages.
  const MIN = 60 * 1000, HOUR = 60 * MIN;

  function pendingStepContent(agent, conversation) {
    return stepContent(agent, conversation.flowState?.step, { name: conversation.contactName || "there" });
  }

  async function nudgeOne(conv, now) {
    if (!conv.agentId) return false;
    const [agent, org] = await Promise.all([
      WaAgent.findById(conv.agentId).lean(),
      Organization.findById(conv.orgId),
    ]);
    if (!agent?.ctwaFlow?.nudgesEnabled || !org) return false;
    const inFlow = !!conv.flowState?.step;
    // Nothing is sent once the feature or the assistant has been switched off since the last message:
    // a downgrade, a paused assistant, the org-wide bot switch, WhatsApp disconnected, or a human taking over.
    // Button-flow nudges are Enterprise (the flow is); chat nudges come with the AI agent (Growth).
    if (inFlow && !agent.ctwaFlow.enabled) return false;
    if (levelOf(org.plan) < levelOf(inFlow ? "enterprise" : "growth")) return false;
    if (agent.status && agent.status !== "active") return false;
    if (org.whatsapp?.botEnabled === false || !org.whatsapp?.enabled) return false;
    if (conv.botEnabled === false) return false;
    if (isWithinBusinessHours && !isWithinBusinessHours(org)) return false;

    const [last, lastIn] = await Promise.all([
      WaMessage.findOne({ conversationId: conv._id }).sort({ timestamp: -1 }).select("direction sender timestamp body isGreeting isNotice").lean(),
      WaMessage.findOne({ conversationId: conv._id, direction: "inbound" }).sort({ timestamp: -1 }).select("timestamp").lean(),
    ]);
    // Only while the bot spoke last: a human reply, or the customer's own
    // message, means there's nothing to chase.
    if (!last || last.direction !== "outbound" || last.sender !== "bot") return false;
    const sinceBot = now - new Date(last.timestamp);
    const sinceIn = now - new Date(lastIn?.timestamp || conv.createdAt);
    if (sinceIn > 23 * HOUR) return false; // window closed or about to

    const count = conv.nudgeCount || 0;
    let kind = null;
    if (sinceIn >= 20 * HOUR) kind = "final";
    else if (count === 0 && sinceBot >= 15 * MIN && sinceBot <= 3 * HOUR) kind = "first";
    if (!kind) return false;

    const content = inFlow ? pendingStepContent(agent, conv) : chatQuestion(last);
    if (!content) return false;
    const vars = { name: conv.contactName || "there" };
    const prefix = kind === "final"
      ? "One last check-in from me, happy to pick this up whenever suits you 👋"
      : (fill(agent.ctwaFlow.nudgeText, vars).trim() || "Just checking in 🙂");
    const ok = await sendFlowStep(org, conv, agent.name || "Artha Assistant", {
      ...content, bodyText: `${prefix}\n\n${content.bodyText}`, previewLabel: kind === "final" ? "Final reminder" : "Follow-up nudge",
    });
    if (!ok) return false;
    await WaConversation.updateOne({ _id: conv._id }, { $set: { nudgeCount: kind === "final" ? 2 : 1, lastNudgeAt: now } });
    return true;
  }

  // The question an ordinary AI chat is waiting on: the last sentence with a
  // "?" in the assistant's last message. Nothing to chase without one (a
  // thank-you, a hand-off note, the away message), so no nudge.
  function chatQuestion(last) {
    if (!last || last.isNotice || last.isGreeting) return null;
    const body = String(last.body || "").trim();
    if (!body.includes("?")) return null;
    const parts = body.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    const q = [...parts].reverse().find((x) => x.endsWith("?")) || body;
    return { bodyText: q.slice(0, 600) };
  }

  async function runNudges(now = new Date()) {
    // Every chat the bot is handling, not only button-flow ones; nudgeOne
    // decides per chat (agent setting, plan, who spoke last, timing).
    const convs = await WaConversation.find({
      botEnabled: true,
      nudgeCount: { $lt: 2 },
      lastMessageAt: { $gte: new Date(now - 23 * HOUR) },
    }).limit(1000);
    let sent = 0;
    for (const c of convs) {
      try { if (await nudgeOne(c, now)) sent++; }
      catch (err) { console.error("[CTWA Flow] nudge failed:", err?.response?.data || err.message); }
    }
    return { checked: convs.length, sent };
  }

  return { shouldStartFlow, startFlow, advanceFlow, pendingResume, resumeFlow, runNudges, runEventReminders, getQualifyingQuestions, getClosingButtons, applyQuestionAnswer };
};
