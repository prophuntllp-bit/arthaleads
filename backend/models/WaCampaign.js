const mongoose = require("mongoose");

/**
 * A template broadcast to a filtered set of leads.
 *
 * The audience is stored as the filter that produced it, not as a frozen list
 * of ids: a campaign is usually built, reviewed, then sent minutes later, and
 * re-running the filter at send time means leads that opted out in between are
 * correctly dropped. `recipients` is written as the send progresses, so it is
 * the record of what actually happened rather than what was intended.
 */
const waCampaignSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, default: "" },

    name: { type: String, required: true, trim: true },

    // What gets sent. Category is copied from the template at send time because
    // it drives the price, and a template can be recategorised by Meta later.
    templateName:     { type: String, required: true },
    templateLanguage: { type: String, default: "en_US" },
    templateCategory: { type: String, default: "MARKETING" },

    // Which lead fields fill {{1}}, {{2}}… in order. "name" and "phone" are
    // lead fields; anything else is treated as a literal.
    variableMapping: { type: [String], default: [] },

    // The Leads-page filter that defines the audience, stored verbatim so the
    // campaign can explain itself later.
    audienceFilter: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ["draft", "sending", "sent", "failed", "cancelled"],
      default: "draft",
      index: true,
    },

    // Counts, updated as the send runs.
    stats: {
      audience:     { type: Number, default: 0 },  // matched the filter
      skippedNoConsent: { type: Number, default: 0 },
      skippedNoPhone:   { type: Number, default: 0 },
      queued:       { type: Number, default: 0 },
      sent:         { type: Number, default: 0 },
      failed:       { type: Number, default: 0 },
      // Meta silently drops marketing messages when a recipient has hit their
      // per-user cap across all businesses. Reported separately so a tenant
      // does not read it as us being broken.
      droppedByMeta: { type: Number, default: 0 },
    },

    // Credit held for the whole run up front — never start a 10,000-message
    // campaign that can run dry at 6,000.
    reservedPaise: { type: Number, default: 0 },
    spentPaise:    { type: Number, default: 0 },

    startedAt:  { type: Date },
    finishedAt: { type: Date },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

waCampaignSchema.index({ orgId: 1, createdAt: -1 });

module.exports = mongoose.model("WaCampaign", waCampaignSchema);
