// models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "plan_change", "org_activated", "org_deactivated",
        "trial_extended", "impersonate", "org_name_changed",
        "logo_changed", "brand_color_changed", "broadcast_sent",
      ],
    },
    performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performedByName: { type: String },
    targetOrg:       { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    targetOrgName:   { type: String },
    targetUser:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetUserName:  { type: String },
    details:         { type: mongoose.Schema.Types.Mixed },
    ip:              { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetOrg: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
