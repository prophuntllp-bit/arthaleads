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
// Only the closing step is fixed (talk to an advisor, or book a site visit —
// the only two ways this flow is allowed to end). Everything before that,
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
const { normalizePurpose, parseIndianCurrencyRange, normalizeBhk, normalizePropertyType, normalizeTimeline } = require("../utils/formFieldMapper");

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

  const fill = (text, vars) =>
    String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));

  /**
   * True only when this agent+conversation should start the button flow
   * instead of the usual greeting/GPT path.
   *
   * Whether a real ad click is required depends on how "Route ads to this
   * agent" (WaAgent.adIds) is set up:
   *   - left empty → nothing to restrict to, so the flow runs for every
   *     conversation this agent handles. This is also what makes the flow
   *     testable before a real ad exists — message the number yourself and
   *     it behaves exactly as it will once ads are live.
   *   - one or more ad IDs set → the flow is reserved for leads that
   *     genuinely came from one of those ads (conversation.campaignRef set
   *     by campaignRefFromReferral); an organic "hi" that reached this
   *     agent as the org's default still gets the normal free-text agent.
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
      return agent.ctwaFlow.testPhones.includes(conversation.contactPhone);
    }
    if (!isNewConversation) return false;
    if (agent.adIds?.length) return agent.adIds.includes(conversation.campaignRef?.adId);
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
      case "budget":   return (lead.budget?.min || 0) > 0 || (lead.budget?.max || 0) > 0;
      case "timeline": return !!String(lead.timeline || "").trim();
      case "bhk":      return !!lead.bhk && lead.bhk !== "N/A";
      case "city":
      case "preferredLocation":
      case "streetAddress": return !!String(lead[mapsTo] || "").trim();
      default: return false;
    }
  }

  // First question at or after `from` the lead hasn't already answered
  // elsewhere — asking someone for a budget they typed into the form five
  // minutes ago is the fastest way to lose them.
  async function nextUnansweredIndex(questions, from, leadId) {
    let lead = null;
    if (leadId) lead = await Lead.findById(leadId).select("budget timeline bhk city preferredLocation streetAddress").lean();
    let i = from;
    while (i < questions.length && leadKnows(lead, questions[i].mapsTo)) i++;
    return i;
  }

  // The only two ways this flow is allowed to end: a human advisor, or a
  // booked site visit — fixed, not agent-configurable, so "Photos &
  // Brochure" / "Location Details" never become dead ends with no next step.
  const CLOSING_OPTIONS = [{ id: "advisor", title: "Talk to Advisor" }, { id: "site_visit", title: "Book Site Visit" }];
  // The one non-question value an option's `next` may point to — matches
  // whatsappRoutes.js's sanitizeCtwaFlow exactly.
  const NEXT_CLOSING = "__closing__";
  // The one non-question value closingSiteVisitNext may point to — matches
  // whatsappRoutes.js's sanitizeCtwaFlow exactly.
  const CTWA_BOOK_IMMEDIATELY = "__book__";
  function closingStep(agent) {
    return { bodyText: agent.ctwaFlow.closingPrompt || "Would you like to talk to our advisor, or book a site visit?", buttons: CLOSING_OPTIONS };
  }

  /**
   * The one real terminal action: hands the conversation to a human. If the
   * discussed project has its own designated advisor (Project.advisorId —
   * set in the Projects page so different projects can route to different
   * people), the conversation goes straight to them instead of round-robin —
   * a tenant running several projects usually wants each one's leads landing
   * with that project's own point of contact, not whoever's turn it is.
   */
  async function terminalAdvisor(org, agent, conversation, botName, project) {
    const advisor = project?.advisorId;
    // The phone number is what actually lets the lead act right now instead
    // of waiting on a callback — WhatsApp auto-links a plain digit string
    // like this into a tappable number. First name only, not the advisor's
    // full name — reads like a person texting, not a formal handoff notice.
    const advisorFirstName = advisor?.name ? advisor.name.trim().split(/\s+/)[0] : "";
    const line = advisorFirstName
      ? `Connecting you with ${advisorFirstName} from our team, they'll reach out to you shortly.${advisor.phone ? ` You can also reach them directly on ${advisor.phone}.` : ""}`
      : "Connecting you with our team, someone will reach out to you shortly.";
    await sendFlowStep(org, conversation, botName, { bodyText: line, previewLabel: "→ Connected to advisor" });
    if (advisor?._id) {
      await WaConversation.findByIdAndUpdate(conversation._id, { assignedTo: advisor._id, assignedToName: advisor.name });
    } else {
      await autoAssignConversation(org, conversation);
    }
    await funnelOutcome(conversation._id, "advisor");
    await handOffToHuman(org, conversation, { notify: true, reason: "asked to talk to an advisor" });
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
   * interest" from here too.
   */
  async function startFlow(org, agent, conversation) {
    const botName = agent.name || "Artha Assistant";
    const vars = { name: conversation.contactName || "there", project: (await resolveFlowProject(org, agent))?.name || "" };
    if (agent.ctwaFlow.welcomeText?.trim()) {
      const greetingSent = await sendFlowStep(org, conversation, botName, { bodyText: fill(agent.ctwaFlow.welcomeText, vars) });
      if (!greetingSent) return;
    }
    const questions = getQualifyingQuestions(agent);
    if (!questions.length) return; // sanitizeCtwaFlow blocks enabling without this — never crash live traffic over it regardless
    const firstIdx = await nextUnansweredIndex(questions, 0, conversation.leadId);
    if (firstIdx >= questions.length) {
      // Everything we'd ask is already on the lead — straight to closing.
      const closingSent = await sendFlowStep(org, conversation, botName, { ...closingStep(agent), previewLabel: "Started qualification" });
      if (closingSent) await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: "closing", startedAt: new Date() }, flowFunnel: { startedAt: new Date(), stepsReached: ["closing"], lastStep: "closing" } });
      return;
    }
    const first = questions[firstIdx];
    const questionSent = await sendFlowStep(org, conversation, botName, { ...questionStep(first, vars), previewLabel: "Started qualification" });
    if (questionSent) {
      await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: first.id, startedAt: new Date() }, flowFunnel: { startedAt: new Date(), stepsReached: [first.id], lastStep: first.id } });
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
        if (mapped && leadId) await Lead.updateOne({ _id: leadId }, { $set: { purpose: mapped } });
        break;
      case "budget": {
        const range = option.max > 0 ? { min: option.min || 0, max: option.max } : parseIndianCurrencyRange(value);
        if (range) { mapped = range; await updateLeadIfBlank(leadId, { "budget.min": range.min, "budget.max": range.max }); }
        break;
      }
      case "timeline":
        mapped = normalizeTimeline(value);
        if (mapped) await updateLeadIfBlank(leadId, { timeline: mapped });
        break;
      case "bhk":
        mapped = normalizeBhk(value);
        if (mapped) await updateLeadIfBlank(leadId, { bhk: mapped });
        break;
      case "propertyType":
        mapped = normalizePropertyType(value);
        if (mapped) await updateLeadIfBlank(leadId, { propertyType: mapped });
        break;
      case "city":
      case "preferredLocation":
      case "streetAddress": {
        const trimmed = String(value || "").trim();
        mapped = trimmed || null;
        if (mapped) await updateLeadIfBlank(leadId, { [question.mapsTo]: mapped });
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
  async function advanceFlow(org, agent, conversation, { interactiveId, msgText }) {
    const step = conversation.flowState?.step;
    if (!step || !agent?.ctwaFlow?.enabled) return false;
    const botName = agent.name || "Artha Assistant";
    const questions = getQualifyingQuestions(agent);
    const vars = { name: conversation.contactName || "there" };

    const exitFlow = async () => {
      await funnelOutcome(conversation._id, "exited");
      return WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });
    };

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
        await sendFlowStep(org, conversation, botName, closingStep(agent));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "closing" });
        await funnelStep(conversation._id, "closing");
      }
    };

    // Default when an option doesn't explicitly say where to go next: the
    // next still-unanswered question in array order, or closing once none
    // are left.
    const advancePast = async (questionIndex) => {
      const nextIdx = await nextUnansweredIndex(questions, questionIndex + 1, conversation.leadId);
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
    let matchedQuestionIndex = -1, matchedOption = null;
    for (let i = 0; i < questions.length; i++) {
      const opt = questions[i].options.find((o) => o.id === interactiveId);
      if (opt) { matchedQuestionIndex = i; matchedOption = opt; break; }
    }
    const closingOpt = CLOSING_OPTIONS.find((o) => o.id === interactiveId);

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
      if (action === "photos" || action === "docs") {
        const project = await resolveFlowProject(org, agent);
        if (project) {
          // The customer tapped this button, so it's an explicit ask — sent
          // regardless of the free-text "what it can send" toggles. Anything
          // not uploaded for the project is said plainly, never faked.
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
      } else if (action === "location") {
        const project = await resolveFlowProject(org, agent);
        if (project?.location) {
          await sendFlowStep(org, conversation, botName, { bodyText: `${project.name} is located at: ${project.location}` });
        }
      }

      await applyQuestionAnswer(conversation.leadId, question, matchedOption);

      // Where the conversation actually is right now. Tapping an earlier
      // question's button again (changing an answer, re-requesting photos,
      // or a double tap) updates the answer / resends info above, but must
      // not re-send whatever already followed it.
      const currentIdx = questions.findIndex((q) => q.id === step);
      const position = currentIdx === -1 ? questions.length : currentIdx;
      if (matchedQuestionIndex < position) return true;

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
      if (closingOpt.id === "advisor") {
        await terminalAdvisor(org, agent, conversation, botName, await resolveFlowProject(org, agent));
        await exitFlow();
        return true;
      }
      // "Book Site Visit" from the closing prompt. Tenant-configured target
      // (closingSiteVisitNext) wins outright — a specific question id asks
      // that question, "__book__" always books immediately. With nothing
      // configured, fall back to auto-detecting any question whose every
      // option books a site visit, or book immediately if none exists. This
      // is deliberately independent of any option's own `next` — it's what
      // lets "Book Site Visit" lead somewhere different than an ordinary
      // menu option that also happens to reach a site-visit question.
      const configuredNext = agent.ctwaFlow.closingSiteVisitNext || "";
      if (configuredNext !== CTWA_BOOK_IMMEDIATELY) {
        const target = configuredNext
          ? questions.find((q) => q.id === configuredNext)
          : questions.find((q) => q.options.length && q.options.every((o) => o.action === "site_visit"));
        if (target) {
          await goTo(target.id);
          return true;
        }
      }
      return completeSiteVisit(org, conversation, botName, { id: "site_visit", label: "General enquiry" });
    }

    // No known button matched — a free-typed message. Exit the flow rather
    // than dead-ending; the normal GPT agent answers it instead.
    await exitFlow();
    return false;
  }

  // The other true terminal (besides terminalAdvisor above): a picked
  // site-visit slot. Lead written the same way the rest of this flow writes
  // it — real fields the existing scorer already weights, not a second
  // scoring system — then handed to a human, same as the advisor path.
  async function completeSiteVisit(org, conversation, botName, opt) {
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
    await sendFlowStep(org, conversation, botName, { bodyText: "Wonderful! Our team will confirm your visit shortly and take it from here.", previewLabel: "🏡 Site visit requested" });
    await WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });
    await autoAssignConversation(org, conversation);
    await funnelOutcome(conversation._id, "site_visit");
    await handOffToHuman(org, conversation, { notify: true, reason: "requested a site visit" });
    return true;
  }

  // ── Follow-up nudges ───────────────────────────────────────────────────────
  // Someone who stops answering mid-flow gets one gentle nudge (about 15
  // minutes after the bot's last message) and one final reminder shortly
  // before the 24h reply window closes, each re-sending the pending question
  // with its buttons so continuing is a single tap. Only for agents that turned
  // it on, only in business hours, only while the bot spoke last, and at most
  // two per silence (the count resets when the customer writes again). Inside
  // the reply window these are ordinary free service messages.
  const MIN = 60 * 1000, HOUR = 60 * MIN;

  function pendingStepContent(agent, conversation) {
    const step = conversation.flowState?.step;
    const vars = { name: conversation.contactName || "there" };
    if (step === "closing") return closingStep(agent);
    const q = getQualifyingQuestions(agent).find((x) => x.id === step);
    return q ? questionStep(q, vars) : null;
  }

  async function nudgeOne(conv, now) {
    if (!conv.agentId) return false;
    const [agent, org] = await Promise.all([
      WaAgent.findById(conv.agentId).lean(),
      Organization.findById(conv.orgId),
    ]);
    if (!agent?.ctwaFlow?.enabled || !agent.ctwaFlow.nudgesEnabled || !org) return false;
    if (isWithinBusinessHours && !isWithinBusinessHours(org)) return false;

    const [last, lastIn] = await Promise.all([
      WaMessage.findOne({ conversationId: conv._id }).sort({ timestamp: -1 }).select("direction sender timestamp").lean(),
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

    const content = pendingStepContent(agent, conv);
    if (!content) return false;
    const prefix = kind === "final"
      ? "Quick reminder before this chat closes 🙂"
      : (agent.ctwaFlow.nudgeText?.trim() || "Just checking in 🙂");
    const ok = await sendFlowStep(org, conv, agent.name || "Artha Assistant", {
      ...content, bodyText: `${prefix}\n\n${content.bodyText}`, previewLabel: kind === "final" ? "Final reminder" : "Follow-up nudge",
    });
    if (!ok) return false;
    await WaConversation.updateOne({ _id: conv._id }, { $set: { nudgeCount: kind === "final" ? 2 : 1, lastNudgeAt: now } });
    return true;
  }

  async function runNudges(now = new Date()) {
    const convs = await WaConversation.find({
      "flowState.step": { $exists: true, $ne: null },
      botEnabled: true,
      nudgeCount: { $lt: 2 },
      lastMessageAt: { $gte: new Date(now - 23 * HOUR) },
    }).limit(300);
    let sent = 0;
    for (const c of convs) {
      try { if (await nudgeOne(c, now)) sent++; }
      catch (err) { console.error("[CTWA Flow] nudge failed:", err?.response?.data || err.message); }
    }
    return { checked: convs.length, sent };
  }

  return { shouldStartFlow, startFlow, advanceFlow, runNudges, getQualifyingQuestions };
};
