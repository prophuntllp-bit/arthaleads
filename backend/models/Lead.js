// models/Lead.js - Full Real Estate CRM Lead Schema
const mongoose = require("mongoose");

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    addedByName: { type: String }, // denormalized for fast display
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status_changed", "assigned", "note_added", "follow_up_set", "site_visit", "called", "emailed"],
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
      enum: ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "Other"],
      default: "Manual",
    },

    // ── Ownership & Assignment ────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedToName: { type: String, default: "" }, // denormalized

    // ── Follow-up ─────────────────────────────────────────────────────────────
    followUpDate: { type: Date, default: null },
    followUpNote: { type: String, default: "" },

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
    remark:    { type: String, trim: true, default: "" },
    followUp2: { type: Date, default: null },
    booking: {
      type: String,
      enum: ["", "Interested", "Site Visit Booked", "Booked", "Not Interested", "Call Back"],
      default: "",
    },

    // ── Lead Source Metadata ───────────────────────────────────────────────────
    leadSourceLabel: { type: String, trim: true, default: "" }, // e.g. "PropHunt LLP — Lead Ads", "prophuntllp.com"
    formPlugin:      { type: String, trim: true, default: "" }, // e.g. "metform", "elementor_form", "cf7"

    // ── Misc ──────────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true }],
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ followUpDate: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ createdAt: -1 });

const Lead = mongoose.model("Lead", leadSchema);
module.exports = Lead;
