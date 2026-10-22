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

    // Artha v2 (utils/ai/provider.js). Cost is kept in millionths of a US
    // dollar so the monthly allowance can be checked without float drift.
    arthaCalls:        { type: Number, default: 0 },
    arthaInputTokens:  { type: Number, default: 0 },
    arthaCachedTokens: { type: Number, default: 0 },
    arthaOutputTokens: { type: Number, default: 0 },
    arthaCostMicroUsd: { type: Number, default: 0 },

    // AI lead scoring (services/aiLeadScore.js): one call per scored lead.
    leadScoreCalls:    { type: Number, default: 0 },
    leadScoreTokens:   { type: Number, default: 0 },

    // Button flows: a small model call reading a typed reply as a button
    // (utils/flowAnswer.js aiMatch), only when the rules couldn't.
    flowMatchCalls:    { type: Number, default: 0 },
    flowMatchTokens:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ orgId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("AiUsage", schema);
