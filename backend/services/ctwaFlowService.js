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
// The backbone (qualify → menu → close) is fixed, matching the flow product/
// support specced out — but the qualifying phase itself is a tenant-managed
// list of 1-5 questions (WaAgent.ctwaFlow.qualifyingQuestions), each with its
// own explicit mapsTo telling this file which real Lead field the answer
// should write to (or "none"). This is a platform feature every tenant uses,
// not just real-estate ones — the leads data this session's form-field-mapper
// work surfaced tenants whose questions look nothing like Purpose/Budget/
// Timeline, so those three can no longer be hardcoded. A generic drag-and-
// drop flow builder covering the menu/close phase too is separate, explicitly
// out-of-scope future work; see the plan this was built from.
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
}) {
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
    if (agent.adIds?.length) return !!conversation.campaignRef;
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
      .select("name location images brochureUrl advisorId")
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
  // existed) still have the old purposeQuestion/purposeOptions/budgetBrackets/
  // timelineOptions fields and nothing else — synthesized into the same
  // 3-question shape they always behaved as, so nothing about them changes
  // until the tenant actually edits and re-saves through the new UI. No
  // migration script needed; this runs on every read instead.
  function legacyToQualifyingQuestions(ctwaFlow) {
    const qs = [];
    if (ctwaFlow?.purposeOptions?.length) {
      qs.push({ id: "purpose", questionText: ctwaFlow.purposeQuestion || "Are you exploring this primarily for:", options: ctwaFlow.purposeOptions, mapsTo: "purpose" });
    }
    if (ctwaFlow?.budgetBrackets?.length) {
      qs.push({ id: "budget", questionText: "Perfect. What's your approximate budget range?", options: ctwaFlow.budgetBrackets, mapsTo: "budget" });
    }
    if (ctwaFlow?.timelineOptions?.length) {
      qs.push({ id: "timeline", questionText: "Got it. When are you looking to finalize?", options: ctwaFlow.timelineOptions, mapsTo: "timeline" });
    }
    return qs;
  }

  function getQualifyingQuestions(agent) {
    const qs = agent?.ctwaFlow?.qualifyingQuestions;
    return qs?.length ? qs : legacyToQualifyingQuestions(agent?.ctwaFlow);
  }

  function menuStep(agent) {
    return { bodyText: agent.ctwaFlow.menuPrompt || "Great, what would you like to see next?", buttons: agent.ctwaFlow.menuOptions.map((m) => ({ id: m.id, title: m.label })) };
  }
  function siteVisitStep(agent) {
    return { bodyText: agent.ctwaFlow.siteVisitPrompt || "Which time works best for your visit?", buttons: agent.ctwaFlow.siteVisitSlots.map((s) => ({ id: s.id, title: s.label })) };
  }

  // The only two ways this flow is allowed to end: a human advisor, or a
  // booked site visit — fixed, not agent-configurable, so "Photos &
  // Brochure" / "Location Details" never become dead ends with no next step.
  const CLOSING_OPTIONS = [{ id: "advisor", title: "Talk to Advisor" }, { id: "site_visit", title: "Book Site Visit" }];
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
    const first = questions[0];
    const questionSent = await sendFlowStep(org, conversation, botName, { ...questionStep(first, vars), previewLabel: "Started qualification" });
    if (questionSent) {
      await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: first.id, startedAt: new Date() } });
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
        if (mapped) await updateLeadIfBlank(leadId, { purpose: mapped });
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
    const flow = agent.ctwaFlow;
    const questions = getQualifyingQuestions(agent);

    const exitFlow = async () => WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });

    // Matched by button id across every step this flow has, not by whatever
    // step we last recorded — Meta doesn't let us disable a button on a
    // message already sent, and a lead often wants to revisit an earlier
    // question (see the location, then still tap the floor plan; pick a
    // different budget after moving on) rather than being stuck wherever
    // they last left off. So any earlier message's button keeps doing
    // exactly what it says, for as long as the flow hasn't reached a true
    // terminal (advisor connected, or a site-visit slot picked — both hand
    // off to a human and clear flowState, so nothing reaches this function
    // again after that).
    let matchedQuestionIndex = -1, matchedOption = null;
    for (let i = 0; i < questions.length; i++) {
      const opt = questions[i].options.find((o) => o.id === interactiveId);
      if (opt) { matchedQuestionIndex = i; matchedOption = opt; break; }
    }
    const menuOpt     = flow.menuOptions.find((o) => o.id === interactiveId);
    const closingOpt  = CLOSING_OPTIONS.find((o) => o.id === interactiveId);
    const slotOpt      = flow.siteVisitSlots.find((o) => o.id === interactiveId);

    if (matchedQuestionIndex !== -1) {
      const question = questions[matchedQuestionIndex];
      await applyQuestionAnswer(conversation.leadId, question, matchedOption);
      const next = questions[matchedQuestionIndex + 1];
      if (next) {
        await sendFlowStep(org, conversation, botName, questionStep(next, { name: conversation.contactName || "there" }));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": next.id });
      } else {
        await sendFlowStep(org, conversation, botName, menuStep(agent));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "menu" });
      }
      return true;
    }

    if (slotOpt) return completeSiteVisit(org, conversation, botName, slotOpt);

    if (menuOpt || closingOpt) {
      const action = menuOpt ? menuOpt.action : closingOpt.id; // closing ids ARE their action
      if (action === "site_visit") {
        await sendFlowStep(org, conversation, botName, siteVisitStep(agent));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "site_visit" });
        return true;
      }
      if (action === "advisor") {
        await terminalAdvisor(org, agent, conversation, botName, await resolveFlowProject(org, agent));
        await exitFlow();
        return true;
      }
      // Informational — photos / location — never a dead end: after
      // showing what was asked for, nudge toward the same two real endings
      // again, and stay open for more exploring.
      const project = await resolveFlowProject(org, agent);
      if (action === "photos" && project) {
        await sendQualifiedMedia(org, agent, conversation, botName, project.name, { wantsPhotos: true, wantsBrochure: true });
      } else if (action === "location" && project?.location) {
        await sendFlowStep(org, conversation, botName, { bodyText: `${project.name} is located at: ${project.location}` });
      }
      await sendFlowStep(org, conversation, botName, closingStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "menu" });
      return true;
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
    await handOffToHuman(org, conversation, { notify: true, reason: "requested a site visit" });
    return true;
  }

  return { shouldStartFlow, startFlow, advanceFlow };
};
