const mongoose = require("mongoose");

// Which lead-creation channel this rule applies to. Missing/undefined on any
// document created before this field existed means "facebook" — every rule
// saved before multi-source routing shipped was a Facebook rule.
const SOURCES = ["facebook", "whatsapp", "google", "website"];

// Which matchField values are valid for each source — enforced in
// routingRuleRoutes.js, not here, so the enum below stays permissive across
// all sources (Mongoose enums can't be conditional on a sibling field).
// WhatsApp CTWA only offers ad_id, not ctwa_clid — the click id Meta sends is
// unique per click/lead, never reused, so it could never match a second lead
// and isn't a usable routing key. ad_id (the ad itself) is stable and repeats
// across every lead that clicks the same ad.
const MATCH_FIELDS_BY_SOURCE = {
  facebook: ["form_id", "campaign_id", "adset_id", "ad_id"],
  whatsapp: ["ad_id"],
  google:   ["campaign_id"],
  website:  ["domain", "page_path"],
};

const routingRuleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    source: { type: String, enum: SOURCES, default: "facebook" },
    // What field to match on — meaning depends on `source` (see MATCH_FIELDS_BY_SOURCE)
    matchField: {
      type: String,
      enum: ["form_id", "campaign_id", "adset_id", "ad_id", "domain", "page_path"],
      default: "form_id",
    },
    matchValue: { type: String, required: true, trim: true },
    // Agent to assign to when rule matches
    assignTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignToName: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  },
  { timestamps: true }
);

routingRuleSchema.index({ isActive: 1, source: 1, matchField: 1, matchValue: 1 });

const RoutingRule = mongoose.model("RoutingRule", routingRuleSchema);
RoutingRule.SOURCES = SOURCES;
RoutingRule.MATCH_FIELDS_BY_SOURCE = MATCH_FIELDS_BY_SOURCE;

module.exports = RoutingRule;
