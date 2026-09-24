const mongoose = require("mongoose");

/**
 * A WhatsApp AI assistant.
 *
 * This used to be a single set of fields on the organisation
 * (`whatsapp.botName`, `whatsapp.botGreeting`, …), which meant one assistant
 * per tenant with no way to add a second, name it, pause it or delete it. Those
 * fields are migrated into one agent per org by
 * scripts/migrate-wa-agents.js and are no longer read.
 *
 * Routing, in the order `resolveAgentForConversation` tries it:
 *   1. the agent already pinned to the conversation (threads never switch
 *      assistant mid-conversation — the customer would notice)
 *   2. an active agent that claims the Click-to-WhatsApp ad this thread
 *      started from
 *   3. the default active agent
 *   4. any active agent
 * With no active agent at all, nothing auto-replies and the thread waits for a
 * human, which is the same outcome as pausing the org-wide switch.
 */
const waAgentSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },

    name:        { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, default: "", maxlength: 280 },

    // draft is "being written, never answers"; paused is "finished but off".
    // Keeping them apart is what lets the list say whether setup is incomplete
    // or somebody deliberately switched it off.
    status: { type: String, enum: ["active", "paused", "draft"], default: "draft", index: true },

    // Exactly one per org, enforced in the routes rather than the schema
    // because "unset the old one, set the new one" is two writes.
    isDefault: { type: Boolean, default: false },

    // ── What it knows and how it talks ──────────────────────────────────────
    greeting:        { type: String, default: "" },
    businessContext: { type: String, default: "" },
    groundRules:     { type: String, default: "" },

    // Empty means every active project in the org. A narrow list here is the
    // most common reason an assistant answers "our team will confirm shortly"
    // to everything, so the UI warns about it.
    projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],

    // Full override. When set, everything above is ignored.
    systemPrompt: { type: String, default: "" },

    // ── Media permission ─────────────────────────────────────────────────────
    // Off by default. Some tenants deliberately don't want prices, photos or
    // documents going out before a human has qualified the lead themselves —
    // this is their gate for it, independent of whether the project actually
    // has photos/a brochure uploaded (buildProjectGroundedPrompt checks both).
    shareProjectPhotos: { type: Boolean, default: false },
    shareBrochure:      { type: Boolean, default: false },
    shareVideos:        { type: Boolean, default: false },
    shareFloorPlan:     { type: Boolean, default: false },

    // A hint in the prompt, not a translation layer — the model answers in
    // whatever the customer writes unless told otherwise.
    language: { type: String, default: "auto" },

    // ── Routing ─────────────────────────────────────────────────────────────
    // Meta ad IDs this agent answers for. A generic ad ("DM us for our best
    // deals") gives the model nothing to match a project on, so naming the ad
    // here is what guarantees the first reply is about the right thing.
    adIds: [{ type: String, trim: true }],

    // ── CTWA button-driven qualification flow ───────────────────────────────
    // An alternative to the free-text GPT qualification, only for threads that
    // started from a Click-to-WhatsApp ad (conversation.campaignRef set) — real
    // WhatsApp interactive buttons/lists for the qualifying questions,
    // deterministic branching, answers written straight onto the Lead
    // record. See services/ctwaFlowService.js. Only the closing step (talk
    // to an advisor, or book a site visit — the only two ways this flow is
    // allowed to end) is fixed. Everything before it, including what used
    // to be the separate hardcoded "menu" and "site visit" steps, is now
    // just more entries in the same tenant-managed qualifyingQuestions list
    // (add/remove/reorder freely) — not a hardcoded Purpose/Budget/Timeline
    // triad, and not a hardcoded "what next" menu either. This is a
    // platform feature every tenant uses, not just real-estate ones.
    ctwaFlow: {
      enabled:     { type: Boolean, default: false },
      // Sent as its own plain-text message, before the first qualifying
      // question — combining a greeting with the first question into one
      // interactive message reads as the bot talking over itself.
      // "{{name}}"/"{{project}}" supported.
      welcomeText:     { type: String, default: "" },
      // Tenant-managed list of questions, each with its own options (≤10)
      // and an explicit mapsTo telling ctwaFlowService.advanceFlow which
      // real Lead field (if any) the answer should write to. mapsTo is a
      // statement of intent, not a guarantee — the answer's VALUE still has
      // to parse for that field (see formFieldMapper.js's normalizers);
      // anything that doesn't, or is "none", lands in Lead.formResponses
      // instead of forcing a bad value.
      //
      // Each OPTION can additionally carry an `action`, independent of the
      // question's own mapsTo:
      //   "none"      (default) — just record the answer, then move to the
      //                next question in this same array (this is how a
      //                former "what next?" menu button that should lead
      //                into a site-visit-slot question works — that
      //                question simply comes right after it in the array).
      //   "photos"/"docs"/"location" — send the project's photos/videos,
      //                brochure/floor plan, or its location text, THEN
      //                still move to the next question — never a dead end,
      //                but also never forced straight to closing either.
      //   "advisor"   — terminal: hands off to a human advisor immediately,
      //                regardless of where the flow currently is.
      //   "site_visit"— terminal: books a site visit using this option's
      //                own label as the requested slot, then hands off.
      //                Use this on every option of a dedicated "which time
      //                works for you" question.
      //
      // For a "none"/"photos"/"docs"/"location" option, `next` picks what
      // comes after: blank (default) continues to the next question in this
      // same array; a question's own id jumps straight to that question
      // instead (so two different buttons on the same question — e.g.
      // "Photos & Videos" vs. "Book a Private Preview" — can lead to
      // different next steps rather than both always landing on whatever is
      // positionally next); the literal string "__closing__" skips straight
      // to the closing prompt. Ignored on a terminal option (advisor /
      // site_visit), since those already end the flow.
      qualifyingQuestions: [{
        id: String,
        questionText: String,
        options: [{
          id: String, label: String, min: Number, max: Number, // min/max only meaningful when mapsTo is "budget"
          action: { type: String, enum: ["none", "photos", "docs", "location", "advisor", "site_visit"], default: "none" },
          next: { type: String, default: "" },
        }],
        mapsTo: {
          type: String,
          enum: ["purpose", "budget", "timeline", "bhk", "propertyType", "city", "preferredLocation", "streetAddress", "none"],
          default: "none",
        },
      }],
      // Legacy-only from here down — no longer written by new saves, kept
      // so an agent saved before this change still reads and behaves
      // exactly as it did (see ctwaFlowService.legacyToQualifyingQuestions),
      // until the tenant opens and re-saves it through the current UI.
      menuPrompt:      { type: String, default: "Great, what would you like to see next?" },
      menuOptions:     [{ id: String, label: String, action: { type: String, enum: ["photos", "docs", "location", "site_visit", "advisor"] } }],
      siteVisitPrompt: { type: String, default: "Which time works best for your visit?" },
      siteVisitSlots:  [{ id: String, label: String }],
      closingPrompt:   { type: String, default: "Would you like to talk to our advisor, or book a site visit?" },
      // What happens when the closing prompt's fixed "Book Site Visit"
      // button is tapped: "" (default) auto-detects any question where
      // every option's action is "site_visit" and asks that, or books
      // immediately if none exists; "__book__" always books immediately,
      // skipping any question even if one would auto-detect; a question's
      // own id always asks that specific question instead of auto-detecting
      // — lets "Book Site Visit" lead somewhere different than an ordinary
      // option's own "Then go to" (e.g. a fuller "when would you like to
      // visit" question rather than a plain time-of-day picker).
      closingSiteVisitNext: { type: String, default: "" },
      // Gentle follow-ups for someone who stops mid-flow: one after ~15 minutes
      // and one shortly before the 24h reply window closes. Off unless enabled.
      nudgesEnabled:   { type: Boolean, default: false },
      nudgeText:       { type: String, default: "" },
      // Temporary testing gate: when non-empty, the flow only starts for a
      // conversation whose contact phone is in this list — regardless of
      // adIds/campaignRef — so the team can verify it live on themselves
      // without it also firing for genuine inbound leads while unproven.
      // Clear this once the flow's confirmed working to go back to normal
      // (adIds-set = real ad leads only, adIds-empty = every lead).
      testPhones:      [String],

      // ── Legacy shape, kept for existing agent docs (e.g. Riya's live
      // config) — no longer written by sanitizeCtwaFlow, read only by
      // ctwaFlowService's migration fallback when qualifyingQuestions is
      // empty. Safe to remove once every live tenant has saved through the
      // new AgentBuilder UI at least once.
      purposeQuestion: { type: String, default: "" },
      purposeOptions:  [{ id: String, label: String }],
      budgetBrackets:  [{ id: String, label: String, min: Number, max: Number }],
      timelineOptions: [{ id: String, label: String }],
    },

    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true }
);

waAgentSchema.index({ orgId: 1, status: 1 });
waAgentSchema.index({ orgId: 1, adIds: 1 });

/**
 * How much of this agent is actually filled in, for the readiness meter on the
 * list. Deliberately counts things that change the replies a customer gets,
 * not every field on the form.
 */
waAgentSchema.methods.readiness = function readiness(activeProjectCount = 0) {
  const checks = [
    { key: "name",     ok: !!this.name?.trim(),        label: "Has a name" },
    { key: "purpose",  ok: !!this.description?.trim(), label: "Describes what it does" },
    { key: "greeting", ok: !!this.greeting?.trim(),    label: "Opens with a greeting" },
    { key: "context",  ok: !!this.businessContext?.trim() || !!this.systemPrompt?.trim(), label: "Knows about your business" },
    { key: "rules",    ok: !!this.groundRules?.trim() || !!this.systemPrompt?.trim(),     label: "Has ground rules" },
    {
      key: "knowledge",
      // An override prompt carries its own knowledge; otherwise it needs
      // projects to talk about, and "all of them" only counts if any exist.
      ok: !!this.systemPrompt?.trim()
        || (this.projectIds?.length ? true : activeProjectCount > 0),
      label: "Has projects to discuss",
    },
  ];
  return { score: checks.filter((c) => c.ok).length, total: checks.length, checks };
};

module.exports = mongoose.model("WaAgent", waAgentSchema);
