// models/ProjectLead.js
const mongoose = require("mongoose");

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
      enum: ["", "Interested", "Site Visit Booked", "Site Visit Done", "Booked", "Not Interested", "Call Back", "Not Reachable", "Low Budget", "Other Location", "Commercial"],
      default: "",
    },

    status: {
      type: String,
      enum: ["", "New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"],
      default: "",
    },

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

module.exports = mongoose.model("ProjectLead", projectLeadSchema);
