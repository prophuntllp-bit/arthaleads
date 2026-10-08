const mongoose = require("mongoose");

/**
 * One conversion event we owe Meta for a lead reaching a pipeline stage. The
 * unique (orgId, leadId, eventName) index is what stops the same milestone
 * being reported twice, however many code paths notice it.
 */
const metaEventSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    leadId:    { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    stage:     { type: String, required: true },     // CRM status that triggered it
    eventName: { type: String, required: true },     // what Meta is told
    eventTime: { type: Date, required: true },       // when the lead reached the stage
    channel:   { type: String, enum: ["lead_ads", "whatsapp_ctwa"], required: true },
    status:    { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending", index: true },
    attempts:  { type: Number, default: 0 },
    sentAt:    { type: Date },
    error:     { type: String, default: "" },
    fbTraceId: { type: String, default: "" },
  },
  { timestamps: true }
);

metaEventSchema.index({ orgId: 1, leadId: 1, eventName: 1 }, { unique: true });
metaEventSchema.index({ orgId: 1, createdAt: -1 });

module.exports = mongoose.models.MetaEvent || mongoose.model("MetaEvent", metaEventSchema);
