// models/DemoRequest.js - a "Book a Demo" request from the website (/book-demo).
//
// Not a CRM lead and not an account: these are prospects for Arthaleads itself,
// reviewed by the platform team in the super admin panel (Demo requests), the
// same place new trial sign-ups are approved. No orgId on purpose.
const mongoose = require("mongoose");

const STATUSES = ["new", "contacted", "scheduled", "done", "not_a_fit"];

const demoRequestSchema = new mongoose.Schema(
  {
    // About you
    name:    { type: String, required: true, trim: true, maxlength: 100 },
    email:   { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone:   { type: String, required: true, trim: true, maxlength: 20 },
    city:    { type: String, required: true, trim: true, maxlength: 80 },

    // Your business
    company:      { type: String, required: true, trim: true, maxlength: 120 },
    role:         { type: String, required: true, trim: true, maxlength: 60 },
    businessType: { type: String, required: true, trim: true, maxlength: 60 },
    teamSize:     { type: String, required: true, trim: true, maxlength: 20 },
    monthlyLeads: { type: String, trim: true, maxlength: 20, default: "" },
    leadSources:  { type: [String], default: [] },
    currentTool:  { type: String, trim: true, maxlength: 120, default: "" },

    // The demo
    preferredDate: { type: String, trim: true, maxlength: 20, default: "" },   // YYYY-MM-DD, IST
    preferredTime: { type: String, trim: true, maxlength: 30, default: "" },
    format:        { type: String, trim: true, maxlength: 30, default: "" },
    language:      { type: String, trim: true, maxlength: 20, default: "" },
    message:       { type: String, trim: true, maxlength: 2000, default: "" },

    // Handling (super admin)
    status:    { type: String, enum: STATUSES, default: "new", index: true },
    notes:     { type: String, trim: true, maxlength: 2000, default: "" },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },

    source:    { type: String, trim: true, maxlength: 200, default: "" },   // page the visitor came from
  },
  { timestamps: true }
);

demoRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DemoRequest", demoRequestSchema);
module.exports.STATUSES = STATUSES;
