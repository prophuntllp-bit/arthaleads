// services/ctwaFlowService.js — the CTWA button-driven qualification flow.
//
// An alternative to the free-text GPT qualification (whatsappRoutes.js's
// triggerBotReply), only for threads that started from a Click-to-WhatsApp ad
// (conversation.campaignRef set — see campaignRefFromReferral) on an agent
// that has opted into it (WaAgent.ctwaFlow.enabled). Real WhatsApp interactive
// buttons/lists for the first few qualifying questions, deterministic
// branching, answers written straight onto the Lead record using the exact
// "never overwrite a real value" discipline enrichWhatsAppLead already uses —
// so the existing rule-based scorer (utils/leadScorer.js) reacts to a CTWA
// lead exactly the same way it reacts to any other lead. No second scoring
// system.
//
// Fixed 5-step shape (purpose → budget → timeline → menu → site-visit slot),
// matching the flow product/support specced out — every label/option is
// tenant-editable through AgentBuilder, the branching shape itself is not.
// A generic drag-and-drop flow builder is explicitly out of scope here; see
// the plan this was built from.
//
// Constructed with its dependencies rather than requiring whatsappRoutes.js
// directly — those helpers (sendInteractive, sendQualifiedMedia, ...) are
// private closures in that file, and reaching into a route file from a
// service would invert the codebase's normal dependency direction.
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

  function purposeStep(agent, vars) {
    return { bodyText: fill(agent.ctwaFlow.purposeQuestion, vars), buttons: agent.ctwaFlow.purposeOptions.map((o) => ({ id: o.id, title: o.label })) };
  }
  function budgetStep(agent) {
    return { bodyText: "Perfect. What's your approximate budget range?", list: { buttonLabel: "Select budget", rows: agent.ctwaFlow.budgetBrackets.map((b) => ({ id: b.id, title: b.label })) } };
  }
  function timelineStep(agent) {
    return { bodyText: "Got it. When are you looking to finalize?", list: { buttonLabel: "Select timeline", rows: agent.ctwaFlow.timelineOptions.map((t) => ({ id: t.id, title: t.label })) } };
  }
  function menuStep(agent) {
    return { bodyText: "Great — what would you like to see next?", buttons: agent.ctwaFlow.menuOptions.map((m) => ({ id: m.id, title: m.label })) };
  }
  function siteVisitStep(agent) {
    return { bodyText: "Which time works best for your visit?", buttons: agent.ctwaFlow.siteVisitSlots.map((s) => ({ id: s.id, title: s.label })) };
  }

  // The only two ways this flow is allowed to end: a human advisor, or a
  // booked site visit — fixed, not agent-configurable, so "Price & Floor
  // Plan" / "Location Details" never become dead ends with no next step.
  const CLOSING_OPTIONS = [{ id: "advisor", title: "Talk to Advisor" }, { id: "site_visit", title: "Book Site Visit" }];
  function closingStep() {
    return { bodyText: "Would you like to talk to our advisor, or book a site visit?", buttons: CLOSING_OPTIONS };
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
    // like this into a tappable number.
    const line = advisor?.name
      ? `Connecting you with ${advisor.name} from our team — they'll reach out to you shortly.${advisor.phone ? ` You can also reach them directly on ${advisor.phone}.` : ""}`
      : "Connecting you with our team — someone will reach out to you shortly.";
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
    const questionSent = await sendFlowStep(org, conversation, botName, { ...purposeStep(agent, vars), previewLabel: "Started qualification" });
    if (questionSent) {
      await WaConversation.findByIdAndUpdate(conversation._id, { flowState: { step: "purpose", startedAt: new Date() } });
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
    const purposeOpt  = flow.purposeOptions.find((o) => o.id === interactiveId);
    const budgetOpt   = flow.budgetBrackets.find((o) => o.id === interactiveId);
    const timelineOpt = flow.timelineOptions.find((o) => o.id === interactiveId);
    const menuOpt      = flow.menuOptions.find((o) => o.id === interactiveId);
    const closingOpt   = CLOSING_OPTIONS.find((o) => o.id === interactiveId);
    const slotOpt       = flow.siteVisitSlots.find((o) => o.id === interactiveId);

    if (purposeOpt) {
      await updateLeadIfBlank(conversation.leadId, { purpose: /invest/i.test(purposeOpt.label) ? "Invest" : "Buy" });
      await sendFlowStep(org, conversation, botName, budgetStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "budget" });
      return true;
    }

    if (budgetOpt) {
      if (budgetOpt.max > 0) await updateLeadIfBlank(conversation.leadId, { "budget.min": budgetOpt.min || 0, "budget.max": budgetOpt.max });
      await sendFlowStep(org, conversation, botName, timelineStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "timeline" });
      return true;
    }

    if (timelineOpt) {
      if (conversation.leadId) {
        await Lead.updateOne({ _id: conversation.leadId }, { $addToSet: { tags: `timeline:${timelineOpt.id}` } });
      }
      await sendFlowStep(org, conversation, botName, menuStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "menu" });
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
      await sendFlowStep(org, conversation, botName, closingStep());
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
    await sendFlowStep(org, conversation, botName, { bodyText: "Wonderful — our team will confirm your visit shortly and take it from here.", previewLabel: "🏡 Site visit requested" });
    await WaConversation.findByIdAndUpdate(conversation._id, { $unset: { flowState: 1 } });
    await autoAssignConversation(org, conversation);
    await handOffToHuman(org, conversation, { notify: true, reason: "requested a site visit" });
    return true;
  }

  return { shouldStartFlow, startFlow, advanceFlow };
};
