// models/Lead.js - Full Real Estate CRM Lead Schema
const mongoose = require("mongoose");

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
      enum: ["created", "status_changed", "assigned", "note_added", "follow_up_set", "site_visit", "called", "emailed", "duplicate_flagged"],
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
    transcript:      { type: [voiceTurnSchema], default: undefined },
    sentiment:       { type: String, enum: ["positive", "neutral", "negative"], default: undefined },
    durationSeconds: { type: Number, default: undefined },
    channel:         { type: String, trim: true, default: undefined },
    language:        { type: String, trim: true, default: undefined },
    agentName:       { type: String, trim: true, default: undefined },
    // Free-form dict of whatever the voice agent captured (budget/location/…).
    // Schema is intentionally variable — stored raw, never normalized.
    extractedData:   { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
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
      enum: ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse", "Other"],
      default: "Apartment",
    },
    budget: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    preferredLocation: { type: String, trim: true, default: "" },
    bhk: { type: String, enum: ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK+", "Studio", "N/A"], default: "N/A" },
    purpose: { type: String, enum: ["Buy", "Rent", "Invest", "N/A"], default: "Buy" },

    // ── Pipeline ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"],
        message: "Invalid status",
      },
      default: "New",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Hot"],
      default: "Medium",
    },

    // ── Lead Source ───────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Custom", "Vistrow Voice", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "QR Code", "Other"],
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
      enum: ["", "Interested", "Not Interested", "Not Reachable", "Low Budget", "Call Back", "Site Visit Booked", "Site Visit Done", "Booked", "Other Location", "Commercial"],
      default: "",
    },

    // ── Lead Source Metadata ───────────────────────────────────────────────────
    leadSourceLabel: { type: String, trim: true, default: "" }, // e.g. "PropHunt LLP - Lead Ads", "prophuntllp.com"
    formPlugin:      { type: String, trim: true, default: "" }, // e.g. "metform", "elementor_form", "cf7"
    sourcePage:      { type: String, trim: true, default: "" }, // full page URL where the form was submitted
    sourceDomain:    { type: String, trim: true, default: "" }, // clean hostname auto-extracted from sourcePage (e.g. "shaporjipallonji.com")
    requirements:    { type: String, trim: true, default: "" }, // extracted from form answers (custom questions)

    // Upstream system's unique ID for this record, for integrations that pull
    // data on a schedule rather than receive a push (e.g. Google Ads API
    // polling — dedupes by lead_form_submission_data.resource_name). Push-based
    // webhooks dedupe by recent phone number instead and leave this unset.
    externalId: { type: String, trim: true, default: "", index: true },

    // ── Vistrow Voice (AI calling) transcript & metadata ───────────────────────
    // Set only for leads ingested via /webhook/lead with voice data. Unset otherwise.
    voiceCall: { type: voiceCallSchema, default: undefined },

    // ── Response Time Tracking ────────────────────────────────────────────────
    firstContactedAt: { type: Date, default: null }, // set once when status first moves to "Contacted"

    // ── Misc ──────────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true }],
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt:  { type: Date, default: null },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    whatsappConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "WaConversation", default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Single-field (kept for backward compat)
leadSchema.index({ followUpDate: 1 });
leadSchema.index({ createdAt: -1 });

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
// domain filter
leadSchema.index({ orgId: 1, sourceDomain: 1 });

const Lead = mongoose.model("Lead", leadSchema);
module.exports = Lead;
