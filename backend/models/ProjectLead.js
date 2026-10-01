// models/ProjectLead.js
const mongoose = require("mongoose");
const OPTS = require("../constants/leadOptions");

const noteSchema = new mongoose.Schema(
  {
    text:        { type: String, required: true },
    addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    addedByName: { type: String, default: "" },
    createdAt:   { type: Date, default: Date.now },
  },
  { _id: true }
);

// Same shape as Lead's activitySchema — needed so EnableX calling (recordings,
// AI call summary, duration/status tracking) works identically for project leads.
const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status_changed", "assigned", "note_added", "note_updated", "note_deleted", "follow_up_set", "site_visit", "called", "emailed", "duplicate_flagged", "consent_changed", "transferred"],
      required: true,
    },
    description:     { type: String, required: true },
    performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performedByName: { type: String },
    meta:            { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const projectLeadSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name:   { type: String, required: true, trim: true },
    phone:  { type: String, required: true, trim: true },
    email:  { type: String, trim: true, lowercase: true, default: "" },
    source: { type: String, default: "Facebook" },

    // Mirrors Lead's source-tracking fields — preserved on transfer so a lead
    // moved into a project doesn't lose which page/domain it came from.
    leadSourceLabel: { type: String, trim: true, default: "" },
    sourcePage:      { type: String, trim: true, default: "" },
    sourceDomain:    { type: String, trim: true, default: "" },

    // Set when this record was created by moving a Lead into the project. The
    // original Lead stays archived; everything on it is copied here (see
    // utils/projectLeadFromLead.js) and createdAt keeps the lead's own date.
    fromLeadId:    { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    transferredAt: { type: Date, default: null },

    // Mirrors Lead's pipeline fields so a transferred lead keeps its details.
    // Deliberately no defaults: a bulk-imported contact has none of these, and a
    // default of "Buy" / "Apartment" would invent values nobody entered.
    priority:          { type: String, enum: OPTS.PRIORITY },
    propertyType:      { type: String, enum: OPTS.PROPERTY_TYPE },
    bhk:               { type: String, enum: OPTS.BHK },
    purpose:           { type: String, enum: OPTS.PURPOSE },
    budget:            { min: { type: Number }, max: { type: Number }, currency: { type: String } },
    timeline:          { type: String, trim: true },
    preferredLocation: { type: String, trim: true },
    city:              { type: String, trim: true },
    streetAddress:     { type: String, trim: true },
    requirements:      { type: String, trim: true },
    formResponses:     [{ _id: false, fieldKey: { type: String, trim: true }, label: { type: String, trim: true }, value: { type: String } }],
    tags:              [{ type: String, trim: true }],
    assignedTo:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedToName:    { type: String, default: "" },
    followUpNote:      { type: String, default: "" },
    siteVisitDate:     { type: Date, default: null },
    siteVisitDone:     { type: Boolean, default: false },
    firstContactedAt:  { type: Date, default: null },
    formPlugin:        { type: String, trim: true, default: "" },
    campaignRef: {
      type: { adId: String, headline: String, body: String, sourceUrl: String, ctwaClid: String },
      default: undefined,
    },
    whatsappConsent: {
      status:     { type: String, enum: ["granted", "denied", "unknown"] },
      source:     { type: String },
      capturedAt: { type: Date },
    },

    // Remark system for telecallers
    remark: {
      type: String,
      enum: ["", "Not Contacted", "Contacted"],
      default: "",
    },
    remarkNote: {
      type: String,
      trim: true,
      default: "",
    },
    remarkUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    remarkUpdatedAt: { type: Date, default: null },

    // ── Telecaller extra columns ──────────────────────────────────────────────
    remark1:   { type: String, trim: true, default: "" },
    remark2:   { type: String, trim: true, default: "" },
    remark3:   { type: String, trim: true, default: "" },
    remark4:   { type: String, trim: true, default: "" },
    followUp:           { type: Date, default: null },
    followUp2:          { type: Date, default: null },
    followUpSetBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    followUpSetByName:  { type: String, default: "" },
    booking: {
      type: String,
      enum: OPTS.BOOKING,
      default: "",
    },

    status: {
      type: String,
      enum: ["", ...OPTS.STATUS],
      default: "",
    },

    // Notes added by agents (same structure as Lead.notes)
    notes: [noteSchema],

    // Call history (same structure as Lead.activities) — powers EnableX
    // click-to-call, recordings, and AI call summaries for project leads.
    activities: [activitySchema],

    // Set to true when booking reaches Interested/Site Visit Booked - never unset
    isProspective: { type: Boolean, default: false, index: true },

    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tenant isolation - mirrors the parent Project's orgId for direct queries
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

projectLeadSchema.index({ project: 1, createdAt: -1 });
projectLeadSchema.index({ orgId: 1, createdAt: -1 });
projectLeadSchema.index({ project: 1, isProspective: 1, createdAt: -1 });
projectLeadSchema.index({ orgId: 1, followUp: 1 });
projectLeadSchema.index({ orgId: 1, followUp2: 1 });
projectLeadSchema.index({ orgId: 1, sourceDomain: 1 });

module.exports = mongoose.model("ProjectLead", projectLeadSchema);
