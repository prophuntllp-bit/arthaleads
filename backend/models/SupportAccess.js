const mongoose = require("mongoose");

const supportAccessSchema = new mongoose.Schema(
  {
    orgId:            { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    requestedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedByName:  { type: String, default: "" },
    orgAdminId:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason:           { type: String, required: true, enum: ["customer_support", "onboarding", "bug_investigation", "data_migration", "billing_issue", "other"] },
    notes:            { type: String, default: "", maxlength: 500 },
    // pending → approved/denied → (if approved) active → completed
    status:           { type: String, enum: ["pending", "approved", "denied", "active", "completed"], default: "pending" },
    resolvedAt:       { type: Date, default: null },  // when org admin approved/denied
    accessedAt:       { type: Date, default: null },  // when super admin actually entered the session
    endedAt:          { type: Date, default: null },  // when session ended
    // notification tracking
    notifiedAt:       { type: Date, default: null },  // when push was sent to org admin
    seenByOrgAdmin:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

supportAccessSchema.index({ orgId: 1, createdAt: -1 });
supportAccessSchema.index({ status: 1 });

module.exports = mongoose.model("SupportAccess", supportAccessSchema);
