// models/Lead.js - Full Real Estate CRM Lead Schema
const mongoose = require("mongoose");
// Enumerated option lists live in one place so the model, the Joi validators
// and both clients cannot drift apart. See constants/leadOptions.js.
const OPTS = require("../constants/leadOptions");

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // optional - system/webhook notes have no user
    addedByName: { type: String, default: "" },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status_changed", "assigned", "note_added", "note_updated", "note_deleted", "follow_up_set", "site_visit", "called", "emailed", "duplicate_flagged", "consent_changed", "vistrow_voice"],
      required: true,
    },
    description: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performedByName: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { from: "New", to: "Contacted" }
  },
  { timestamps: true }
);

const formResponseSchema = new mongoose.Schema(
  {
    fieldKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    value: { type: String, default: "", trim: true },
  },
  { _id: false }
);

// ── Vistrow Voice (AI calling) sub-schemas ──────────────────────────────────────
// Populated only for leads that arrive via POST /webhook/lead with a transcript.
// Absent on every other lead — the frontend hides the Transcript tab when unset.
const voiceTurnSchema = new mongoose.Schema(
  {
    // "Caller" | "Agent" — kept as a free string (no enum) so an unexpected
    // speaker value can never make webhook ingestion throw.
    speaker: { type: String, default: "" },
    text:    { type: String, default: "" },
  },
  { _id: false }
);

const voiceCallSchema = new mongoose.Schema(
  {
    // Vistrow's own call id (e.g. 947). The idempotency key for re-sends —
    // see POST /webhook/lead. Only Vistrow calls set this; kept a plain Number
    // (not required/enum) so a malformed value degrades to "treat as a new,
    // un-deduplicated call" rather than throwing.
    externalCallId:  { type: Number, default: undefined },
    transcript:      { type: [voiceTurnSchema], default: undefined },
    sentiment:       { type: String, enum: ["positive", "neutral", "negative"], default: undefined },
    durationSeconds: { type: Number, default: undefined },
    channel:         { type: String, trim: true, default: undefined },
    language:        { type: String, trim: true, default: undefined },
    agentName:       { type: String, trim: true, default: undefined },
    // Page the call/chat widget was opened from (Vistrow's page_path).
    pagePath:        { type: String, trim: true, default: undefined },
    // A stable bearer URL on Vistrow's own domain that redirects to a fresh,
    // short-lived storage link on every playback — never a downloaded copy or
    // a private storage key. Validated at ingestion (SSRF guard) to only ever
    // be an https://api.vistrowvoice.com/public/calls/<id>/recording link;
    // treat as sensitive (bearer-style) and never log it.
    recordingUrl:       { type: String, trim: true, default: undefined },
    recordingMimeType:  { type: String, trim: true, default: undefined },
    // Free-form dict of whatever the voice agent captured (budget/location/…).
    // Schema is intentionally variable — stored raw, never normalized.
    extractedData:   { type: mongoose.Schema.Types.Mixed, default: undefined },
    // Vistrow's own retries and scheduled follow-ups (15 Oct 2026): how many
    // dials this report covers, which scheduled call it was (callback /
    // visit_reminder / nurture), and the booking Vistrow reported, kept even
    // when the forward-only rules did not let it change the lead.
    attempts:        { type: Number, default: undefined },
    followUpKind:    { type: String, trim: true, default: undefined },
    result:          { type: String, trim: true, default: undefined },
    // The caller asked for the brochure on this call (crm_outcome.brochure_requested).
    // Set once, atomically, before the team is told, so a re-sent webhook
    // never creates a second task (routes/webhookRoutes.js).
    brochureRequestedAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

// ── Main Lead Schema ───────────────────────────────────────────────────────────

const leadSchema = new mongoose.Schema(
  {
    // ── Basic Info ────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name too short"],
      maxlength: [100, "Name too long"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
      default: "",
    },
    streetAddress: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Real Estate Specific ──────────────────────────────────────────────────
    propertyType: {
      type: String,
      enum: OPTS.PROPERTY_TYPE,
      default: "Apartment",
    },
    budget: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    preferredLocation: { type: String, trim: true, default: "" },
    bhk: { type: String, enum: OPTS.BHK, default: "N/A" },
    purpose: { type: String, enum: OPTS.PURPOSE, default: "Buy" },
    // Free text, not an enum — every source phrases this differently
    // ("within_30_days", "0-3 months", "6+ months"...) and it's purely
    // informational, not branched on anywhere, so normalizing to a fixed set
    // would only lose the tenant's original wording for no benefit.
    timeline: { type: String, trim: true, default: "" },

    // ── Pipeline ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: OPTS.STATUS,
        message: "Invalid status",
      },
      default: "New",
    },
    // Who set the current status when it was not a person: { by: "vistrow_voice",
    // status, at } from a Vistrow Voice call result. The UI shows the pill as an
    // AI-call status only while `status` here still equals the lead's status, so
    // any later change (by anyone, on any path) makes it a normal pill again;
    // leadService.update and bulkUpdateStatus also clear it.
    statusSetBy: {
      type: {
        by:     { type: String },
        status: { type: String },
        at:     { type: Date },
      },
      default: undefined,
      _id: false,
    },
    // Detail fields a person changed after the lead was created
    // (leadService.update), e.g. ["propertyType"]. Automatic readers treat an
    // untouched default ("Apartment" / "Buy") as not known yet; a field listed
    // here is a person's choice and is never filled over (utils/leadFieldFill).
    detailsSetByPerson: { type: [String], default: undefined },
    priority: {
      type: String,
      enum: OPTS.PRIORITY,
      default: "Medium",
    },

    // ── Lead Source ───────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: OPTS.SOURCE,
      default: "Manual",
    },

    // ── Ownership & Assignment ────────────────────────────────────────────────
    // required removed - external webhook leads (Facebook, Website) have no CRM creator
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedToName: { type: String, default: "" }, // denormalized

    // ── Follow-up ─────────────────────────────────────────────────────────────
    followUpDate:       { type: Date,   default: null },
    followUpNote:       { type: String, default: "" },
    // The free note on the Follow Ups page (project leads call it the same thing).
    remarkNote:         { type: String, default: "" },
    followUpSetBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    followUpSetByName:  { type: String, default: "" },

    // ── Activity & Notes ──────────────────────────────────────────────────────
    notes: [noteSchema],
    activities: [activitySchema],
    formResponses: [formResponseSchema],

    // ── Site Visit ────────────────────────────────────────────────────────────
    siteVisitDate: { type: Date, default: null },
    siteVisitDone: { type: Boolean, default: false },

    // ── Telecaller Remarks ────────────────────────────────────────────────────
    remark1:   { type: String, trim: true, default: "" },
    remark2:   { type: String, trim: true, default: "" },
    remark3:   { type: String, trim: true, default: "" },
    remark4:   { type: String, trim: true, default: "" },
    remark:    { type: String, trim: true, default: "" },
    followUp2: { type: Date, default: null },
    booking: {
      type: String,
      enum: OPTS.BOOKING,
      default: "",
    },

    // ── Lead Source Metadata ───────────────────────────────────────────────────
    leadSourceLabel: { type: String, trim: true, default: "" }, // e.g. "PropHunt LLP - Lead Ads", "prophuntllp.com"

    // Meta "Click to WhatsApp" ad attribution — present only when this lead's
    // first WhatsApp message carried a `referral` block (i.e. it came from an
    // ad's "Send Message" CTA, not an organic "hi"). Lets Leads be filtered
    // by campaign and ctwaClid fed back to Meta's Conversions API later.
    // Undefined (not an empty object) for every non-ad lead, matching the
    // voiceCalls convention so existing "field absent" checks keep working.
    campaignRef: {
      type: {
        adId:      { type: String, trim: true, default: "" }, // Meta ad ID (referral.source_id)
        headline:  { type: String, trim: true, default: "" },
        body:      { type: String, trim: true, default: "" }, // the ad's pre-filled WhatsApp message
        sourceUrl: { type: String, trim: true, default: "" },
        ctwaClid:  { type: String, trim: true, default: "" }, // click id, for Conversions API
      },
      default: undefined,
    },
    // Meta's own id for a Facebook/Instagram lead-form submission (leadgen_id).
    // What lets Conversions API tie later stages back to the ad that made it.
    metaLeadId: { type: String, trim: true, default: "" },
    formPlugin:      { type: String, trim: true, default: "" }, // e.g. "metform", "elementor_form", "cf7"
    sourcePage:      { type: String, trim: true, default: "" }, // full page URL where the form was submitted
    sourceDomain:    { type: String, trim: true, default: "" }, // clean hostname auto-extracted from sourcePage (e.g. "shaporjipallonji.com")
    requirements:    { type: String, trim: true, default: "" }, // extracted from form answers (custom questions)

    // Upstream system's unique ID for this record, for integrations that pull
    // data on a schedule rather than receive a push (e.g. Google Ads API
    // polling — dedupes by lead_form_submission_data.resource_name). Push-based
    // webhooks dedupe by recent phone number instead and leave this unset.
    externalId: { type: String, trim: true, default: "", index: true },

    // A WhatsApp enquiry waiting to be handed to Vistrow Voice (owner decision
    // 15 Oct 2026): sent once the chat's first AI read has run, or at dueAt,
    // whichever comes first, so the payload carries what the person said and
    // the project their message names. Stored, not just timed in memory, so a
    // restart still sends it (routes/whatsappRoutes.js, emitDueWhatsAppLead).
    // dueAt is removed when it is handed over; repeatAt marks a known lead
    // enquiring again (a separate Vistrow event).
    vistrowEmit: {
      type: {
        dueAt:       { type: Date },
        origin:      { type: String },
        projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
        projectName: { type: String },
        repeatAt:    { type: Date },
        adId:        { type: String },
        lockedUntil: { type: Date },
        emittedAt:   { type: Date },
        // Owner decision 17 Oct 2026: a chat the WhatsApp assistant is handling
        // is handed over without a call (awaitingCallSince). ONE call follows,
        // claimed on callRequestedAt: when the customer asks for one or the
        // chat is handed to the team, or at quietDueAt (15 min after their last
        // message). callWanted: a call was asked for before the first hand-off.
        awaitingCallSince: { type: Date },
        quietDueAt:        { type: Date },
        callWanted:        { type: String },
        callRequestedAt:   { type: Date },
        callTrigger:       { type: String },
      },
      default: undefined,
      _id: false,
    },

    // ── Vistrow Voice (AI calling) transcript & metadata ───────────────────────
    // One entry per completed call (a lead can be called more than once).
    // Set only for leads ingested via /webhook/lead with voice data; unset
    // (undefined, not []) otherwise so the frontend's hasVoice check and the
    // dump-leads / analytics aggregations that already treat "field absent" as
    // "not a voice lead" keep working unchanged.
    // NOTE: replaces the old singular `voiceCall` field — see the boot-time
    // migration in server.js that folds any pre-existing `voiceCall` into this
    // array so historical leads aren't orphaned.
    voiceCalls: { type: [voiceCallSchema], default: undefined },

    // ── Artha suggestions ─────────────────────────────────────────────────────
    // Details the customer stated on WhatsApp that differ from what the lead
    // already holds (the automatic reader never overwrites a real value). The
    // team confirms or dismisses them on a card; a dismissed value is not
    // suggested again. See routes/whatsappRoutes.js enrichWhatsAppLead.
    arthaSuggest: {
      type: {
        fields:    { type: mongoose.Schema.Types.Mixed, default: undefined }, // { preferredLocation: "Wakad", bhk: "3BHK", budget: {min,max}, ... }
        at:        { type: Date },
        dismissed: { type: mongoose.Schema.Types.Mixed, default: undefined }, // { preferredLocation: ["Wakad"] }
        // Where a suggestion came from when it was not the WhatsApp chat:
        // { propertyType: "vistrow_voice" }. Absent = WhatsApp.
        from:      { type: mongoose.Schema.Types.Mixed, default: undefined },
      },
      default: undefined,
    },

    // ── Response Time Tracking ────────────────────────────────────────────────
    firstContactedAt: { type: Date, default: null }, // set once when status first moves to "Contacted"

    // ── AI lead scoring (21 Oct 2026, services/aiLeadScore.js) ───────────────
    // When the CUSTOMER last did something: wrote on WhatsApp, or talked on a
    // call (team call with a transcript, or a Vistrow AI call). Never set by
    // anything we send. The AI only reads leads with one in the last 14 days.
    lastCustomerSignalAt: { type: Date, default: undefined },
    // Set when the lead arrived through a spreadsheet import. The AI skips it
    // until the customer replies after that (lastCustomerSignalAt > importedAt).
    importedAt: { type: Date, default: undefined },
    // The AI's read of the last 14 days of chat and call summaries, on top of
    // the rule score (utils/leadScorer.js adds `adjust`, at most +-20, while
    // signalAt is within 14 days). Undefined until a lead is first scored.
    aiScore: {
      type: {
        level:      { type: String, enum: ["hot", "warm", "cold"] },
        adjust:     { type: Number, default: 0 },
        confidence: { type: Number, default: 0 },
        reason:     { type: String, default: "" },
        signals:    { type: [String], default: undefined },
        nextStep:   { type: String, default: "" },
        scoredAt:   { type: Date },
        signalAt:   { type: Date },   // the lastCustomerSignalAt this score read up to
        model:      { type: String, default: "" },
        // An agent tapped "AI got it wrong". Kept for review; changes nothing.
        feedback:   { type: { wrong: Boolean, by: mongoose.Schema.Types.ObjectId, byName: String, at: Date }, default: undefined },
      },
      default: undefined,
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true }],
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt:  { type: Date, default: null },
    // Who deleted it and from where, so Dump can say so and Restore can put it
    // back. kind "leads": deleted from the Leads list. kind "project": deleted
    // from that project's lead list. Undefined on rows deleted before this existed.
    deletedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedByName: { type: String, trim: true, default: "" },
    deletedFrom: {
      type: {
        kind:        { type: String, enum: ["leads", "project"] },
        projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
        projectName: { type: String, trim: true, default: "" },
      },
      default: undefined,
      _id: false,
    },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    // ── WhatsApp marketing consent ───────────────────────────────────────────
  // Meta requires recorded opt-in before a marketing template goes out, and we
  // hold the credit line, so a tenant blasting non-consented numbers is our
  // exposure. Campaigns filter on this — an unset lead is treated as NO.
  //
  // Replying to us is implicit consent for service messages only. Marketing
  // needs an explicit yes, which is why source is recorded alongside.
  whatsappConsent: {
    status:     { type: String, enum: ["granted", "denied", "unknown"], default: "unknown", index: true },
    source:     { type: String, default: "" },   // web-form | imported | manual | whatsapp-reply
    capturedAt: { type: Date },
  },

  whatsappConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "WaConversation", default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Single-field (kept for backward compat)
// A Vistrow AI call reaching the lead (pushed, or a re-send filling in the
// transcript) is the customer talking: stamp lastCustomerSignalAt in the same
// write, so every webhook path counts without each one remembering to.
function stampVoiceSignal() {
  const u = this.getUpdate() || {};
  const set = u.$set || {};
  const addsCall = (u.$push && u.$push.voiceCalls) || Object.keys(set).some((k) => /^voiceCalls(\.\$)?\.transcript$/.test(k));
  if (!addsCall) return;
  this.setUpdate({ ...u, $set: { ...set, lastCustomerSignalAt: new Date() } });
}
leadSchema.pre("updateOne", stampVoiceSignal);
leadSchema.pre("findOneAndUpdate", stampVoiceSignal);
leadSchema.pre("save", async function stampNewVoiceLead() {
  if (this.isNew && Array.isArray(this.voiceCalls) && this.voiceCalls.length && !this.lastCustomerSignalAt) this.lastCustomerSignalAt = new Date();
});

leadSchema.index({ followUpDate: 1 });
leadSchema.index({ createdAt: -1 });
// The AI scoring sweep: leads with recent customer activity.
leadSchema.index({ orgId: 1, lastCustomerSignalAt: -1 }, { partialFilterExpression: { lastCustomerSignalAt: { $exists: true } } });

// Compound indexes - these cover the most common multi-field queries:
// "all active leads for this org sorted by date" (dashboard, leads list)
leadSchema.index({ orgId: 1, isArchived: 1, createdAt: -1 });
// "leads by status for this org" (pipeline, analytics)
leadSchema.index({ orgId: 1, status: 1, isArchived: 1 });
// "leads assigned to a user for this org" (agent view, performance)
leadSchema.index({ orgId: 1, assignedTo: 1, isArchived: 1 });
// "deleted/dump leads for this org"
leadSchema.index({ orgId: 1, isDeleted: 1 });
// "follow-up leads for this org by date" (followups page)
leadSchema.index({ orgId: 1, followUpDate: 1, isArchived: 1 });
// "alerts: new leads by org + date" (sidebar alert polling)
leadSchema.index({ orgId: 1, createdAt: -1, isArchived: 1 });
// "recent activity feed sort" (analytics dashboard recentActivity facet)
leadSchema.index({ orgId: 1, updatedAt: -1, isArchived: 1 });
// phone dedup check
leadSchema.index({ orgId: 1, phone: 1 });
// One lead per Facebook lead id / Google lead id per company: Meta and Google
// re-send a lead after a slow or failed answer (17 Oct 2026). Only set ids count.
leadSchema.index({ orgId: 1, metaLeadId: 1 }, { unique: true, name: "orgId_metaLeadId_unique", partialFilterExpression: { metaLeadId: { $type: "string", $gt: "" } } });
leadSchema.index({ orgId: 1, externalId: 1 }, { unique: true, name: "orgId_externalId_unique", partialFilterExpression: { externalId: { $type: "string", $gt: "" } } });
// Only leads with a WhatsApp hand-off to Vistrow still waiting carry dueAt.
leadSchema.index({ "vistrowEmit.dueAt": 1 }, { sparse: true });
leadSchema.index({ "vistrowEmit.quietDueAt": 1 }, { sparse: true });
// domain filter
leadSchema.index({ orgId: 1, sourceDomain: 1 });

// Vistrow Voice call idempotency: within one org+source, the same external
// call_id must never be attached to two different leads/array entries. A
// partial index (only applies where the field is actually set) — every other
// lead source never populates voiceCalls.externalCallId, so this can't
// collide with unrelated leads. POST /webhook/lead relies on this at the DB
// level to close a create/create race between two near-simultaneous
// deliveries of a brand-new call_id (see that route for the retry-as-update
// handling of the resulting E11000 duplicate-key error).
leadSchema.index(
  { orgId: 1, source: 1, "voiceCalls.externalCallId": 1 },
  { unique: true, partialFilterExpression: { "voiceCalls.externalCallId": { $exists: true } } }
);

// Activity added while Artha acts on someone's behalf is marked "(via Artha)".
leadSchema.plugin(require("../utils/requestContext").attributionPlugin);

const Lead = mongoose.model("Lead", leadSchema);
module.exports = Lead;
