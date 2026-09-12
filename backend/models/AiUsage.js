const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    orgId:            { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    month:            { type: String, required: true }, // "2026-06"
    calls:            { type: Number, default: 0 },
    promptTokens:     { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens:      { type: Number, default: 0 },
    waDraftCalls:     { type: Number, default: 0 },
    waDraftTokens:    { type: Number, default: 0 },

    // Template generation already incremented these two, but they were never
    // declared — strict mode silently dropped them from every $inc.
    templateGenCalls:  { type: Number, default: 0 },
    templateGenTokens: { type: Number, default: 0 },

    // The WhatsApp assistant. Each customer reply is an OpenAI call we pay for
    // on the org's behalf, and until now none of it was counted anywhere.
    botReplyCalls:     { type: Number, default: 0 },
    botReplyTokens:    { type: Number, default: 0 },
    botEnrichCalls:    { type: Number, default: 0 },
    botEnrichTokens:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ orgId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("AiUsage", schema);
