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

  /** True only when this agent+conversation should start the button flow instead of the usual greeting/GPT path. */
  function shouldStartFlow(agent, conversation) {
    return !!agent?.ctwaFlow?.enabled
      && !!conversation.campaignRef
      && !conversation.flowState?.step;
  }

  // The one project this flow is grounded in. Unlike the GPT path's
  // resolveDiscussedProject, there's no reply text to match against here —
  // a button flow only makes sense when the agent is scoped to exactly one
  // project (or the org only has one), otherwise "which project's brochure/
  // location do I send" has no answer and the flow can't run.
  async function resolveFlowProject(org, agent) {
    const filter = { orgId: org._id, isArchived: { $ne: true } };
    if (agent.projectIds?.length) filter._id = { $in: agent.projectIds };
    const projects = await Project.find(filter).select("name location images brochureUrl").limit(2).lean();
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
    await WaMessage.create({
      orgId: org._id, conversationId: conversation._id, waMsgId: msgId,
      direction: "outbound", sender: "bot", senderName: botName,
      body: bodyText, status: "sent", timestamp: new Date(),
      reservedPaise: held, creditCategory: "service", freeTierApplied: q.freeCount > 0,
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

  /**
   * Sends the greeting as its own plain-text message, then the purpose
   * question with its buttons as a second, separate message — combining a
   * greeting with the first question into one interactive body reads as the
   * bot talking over itself rather than a real opening exchange — and marks
   * the conversation as being in the flow.
   */
  async function startFlow(org, agent, conversation) {
    const botName = agent.name || "Artha Assistant";
    const vars = { name: conversation.contactName || "there", project: (await resolveFlowProject(org, agent))?.name || "" };
    const greetingSent = await sendFlowStep(org, conversation, botName, { bodyText: fill(agent.ctwaFlow.welcomeText, vars) });
    if (!greetingSent) return;
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

    if (step === "purpose") {
      const opt = flow.purposeOptions.find((o) => o.id === interactiveId);
      if (!opt) { await exitFlow(); return false; }
      await updateLeadIfBlank(conversation.leadId, { purpose: /invest/i.test(opt.label) ? "Invest" : "Buy" });
      await sendFlowStep(org, conversation, botName, budgetStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "budget" });
      return true;
    }

    if (step === "budget") {
      const opt = flow.budgetBrackets.find((o) => o.id === interactiveId);
      if (!opt) { await exitFlow(); return false; }
      if (opt.max > 0) await updateLeadIfBlank(conversation.leadId, { "budget.min": opt.min || 0, "budget.max": opt.max });
      await sendFlowStep(org, conversation, botName, timelineStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "timeline" });
      return true;
    }

    if (step === "timeline") {
      const opt = flow.timelineOptions.find((o) => o.id === interactiveId);
      if (!opt) { await exitFlow(); return false; }
      if (conversation.leadId) {
        await Lead.updateOne({ _id: conversation.leadId }, { $addToSet: { tags: `timeline:${opt.id}` } });
      }
      await sendFlowStep(org, conversation, botName, menuStep(agent));
      await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "menu" });
      return true;
    }

    if (step === "menu") {
      const opt = flow.menuOptions.find((o) => o.id === interactiveId);
      if (!opt) { await exitFlow(); return false; }

      if (opt.action === "site_visit") {
        await sendFlowStep(org, conversation, botName, siteVisitStep(agent));
        await WaConversation.findByIdAndUpdate(conversation._id, { "flowState.step": "site_visit" });
        return true;
      }

      const project = await resolveFlowProject(org, agent);
      if (opt.action === "photos" && project) {
        await sendQualifiedMedia(org, agent, conversation, botName, project.name, { wantsPhotos: true, wantsBrochure: true });
      } else if (opt.action === "location" && project?.location) {
        await sendFlowStep(org, conversation, botName, { bodyText: `${project.name} is located at: ${project.location}`, buttons: [{ id: "site_visit", title: "Book Site Visit" }] });
      }
      await exitFlow();
      return true;
    }

    if (step === "site_visit") {
      const opt = flow.siteVisitSlots.find((o) => o.id === interactiveId);
      if (!opt) { await exitFlow(); return false; }
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
      await exitFlow();
      await autoAssignConversation(org, conversation);
      await handOffToHuman(org, conversation, { notify: true, reason: "requested a site visit" });
      return true;
    }

    await exitFlow();
    return false;
  }

  return { shouldStartFlow, startFlow, advanceFlow };
};
