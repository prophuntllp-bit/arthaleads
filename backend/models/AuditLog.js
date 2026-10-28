// models/AuditLog.js
const mongoose = require("mongoose");

// Two kinds of row share this collection:
//
//  * Platform admin actions (plan_change, impersonate, user_switched, ...),
//    written by superAdminController and authController since before Oct 2026.
//    They carry createdAt only and are kept indefinitely, as before.
//
//  * Activity rows (DPDP Rules 2025, owner, 28 Oct 2026): sign-ins, sign-outs,
//    password resets, support access, data exports, bulk and permanent
//    deletions, and every authenticated POST/PUT/PATCH/DELETE. Written by
//    middlewares/auditTrail.js. They carry `at`, and the TTL index on `at`
//    removes them after RETENTION_DAYS, so at least one full year is always
//    on hand. Rows without `at` are never touched by that index.
//
// What an activity row never holds: request bodies, passwords, tokens, OTPs,
// API keys, or a lead's phone number or email. Paths are stored with ids,
// emails, long numbers and token-like segments replaced (see auditTrail.js).
//
// Kept in this collection, rather than a new one, so the account deletion
// rules already written for AuditLog apply unchanged: erasing a person unlinks
// performedBy/targetUser and blanks the IP; closing an organisation removes
// the rows whose targetOrg is that organisation.
const RETENTION_DAYS = 400;

const ACTIVITY_ACTIONS = [
  "api_request",
  "login_success", "login_failed", "logout",
  "otp_verified", "otp_failed",
  "password_reset_requested", "password_reset", "password_reset_failed", "password_changed",
  "switch_user", "switch_user_failed", "session_restored", "support_access",
  "data_export", "bulk_delete", "permanent_delete", "account_deletion_requested",
];

const auditLogSchema = new mongoose.Schema(
  {
    requestId: { type: String }, // correlation ID from X-Request-Id header
    action: {
      type: String,
      required: true,
      enum: [
        "plan_change", "org_activated", "org_deactivated",
        "trial_extended", "impersonate", "org_name_changed",
        "logo_changed", "brand_color_changed", "broadcast_sent",
        "user_created", "user_deactivated", "user_reactivated",
        "user_role_changed", "user_password_reset",
        "org_approved", "org_rejected", "user_switched", "storage_updated", "referral_reward",
        ...ACTIVITY_ACTIONS,
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

    // ── Activity rows only ──
    at:        { type: Date },               // when; the TTL clock
    role:      { type: String },             // role of the signed-in account
    via:       { type: String },             // "switch_user" | "support_access" | "api_key" when not the person themselves
    method:    { type: String },
    path:      { type: String },             // sanitised, no query string
    status:    { type: Number },
    targetIds: { type: [String], default: undefined }, // record ids taken from the path
    userAgent: { type: String },             // first 200 characters
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetOrg: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
// Activity rows: expiry, and the org-scoped read endpoint.
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });
auditLogSchema.index({ targetOrg: 1, at: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
AuditLog.RETENTION_DAYS = RETENTION_DAYS;
AuditLog.ACTIVITY_ACTIONS = ACTIVITY_ACTIONS;
module.exports = AuditLog;
