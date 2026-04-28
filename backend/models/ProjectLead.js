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
    followUp:  { type: Date, default: null },
    followUp2: { type: Date, default: null },
    booking: {
      type: String,
      enum: ["", "Interested", "Site Visit Booked", "Booked", "Not Interested", "Call Back"],
      default: "",
    },

    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tenant isolation — mirrors the parent Project's orgId for direct queries
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
