const mongoose = require("mongoose");

const routingRuleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    // What field to match on from the Facebook webhook payload
    matchField: {
      type: String,
      enum: ["form_id", "campaign_id", "adset_id", "ad_id"],
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

routingRuleSchema.index({ isActive: 1, matchField: 1, matchValue: 1 });

module.exports = mongoose.model("RoutingRule", routingRuleSchema);
