// Per-organisation settings for pushing new leads OUT to Vistrow Voice.
//
// Deliberately separate from Automation. The Vistrow Voice Automation is the
// INBOUND connection (qualified-call results arriving at /webhook/lead, keyed
// by its plaintext verifyToken); adding outbound fields there would put a
// second credential on a document that is serialised in many places, and
// would risk the inbound path the customer already depends on.
//
// Off by default and only ever switched on by an explicit owner action
// (POST /enable), which stamps enabledAt: the watermark that guarantees no
// lead created before that moment is ever sent.

const mongoose = require("mongoose");
const { encryptField, decryptField } = require("../utils/fieldCrypto");

// One row of a source's routing table: "a lead matching THIS goes to THAT
// Vistrow agent", the same shape as the Website Widget's Page rules in Vistrow.
// agentId is the Vistrow agent chosen by the owner; blank means "Unassigned",
// which resolves to no call. There is no default agent anywhere.
const routeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 120, default: "" },
    // website -> url_contains; facebook -> project; whatsapp -> project | ad_id
    matchKind: { type: String, enum: ["url_contains", "project", "ad_id"], required: true },
    matchValue: { type: String, trim: true, required: true, maxlength: 300 },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectName: { type: String, trim: true, default: "" },
    agentId: { type: String, trim: true, default: "" },
    agentLabel: { type: String, trim: true, maxlength: 120, default: "" },
  },
  { timestamps: true }
);

// Each source is opt-in and OFF until the owner switches it on.
const sourceRoutingSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    enabledAt: { type: Date, default: null },
    routes: { type: [routeSchema], default: [] },
  },
  { _id: false }
);

const outboundIntegrationSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    provider: { type: String, enum: ["vistrow"], default: "vistrow" },

    enabled: { type: Boolean, default: false },
    enabledAt: { type: Date, default: null },
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    enabledByName: { type: String, default: "" },

    // Vistrow's endpoint: POST {baseUrl}/leads/inbound/{accountId}
    baseUrl: { type: String, trim: true, default: "" },
    accountId: { type: String, trim: true, default: "" },
    // How the credential is presented. Always a header, never the URL (URLs
    // are recorded by every proxy and access log on the way to Vistrow):
    //   "header" -> X-Vistrow-Webhook-Token   "bearer" -> Authorization: Bearer
    authMode: { type: String, enum: ["header", "bearer"], default: "header" },

    // AES-256-GCM at rest (utils/fieldCrypto), never selected by default and
    // never serialised: read it only through getSecret(), write via setSecret().
    secretEnc: { type: String, default: "", select: false },
    secretUpdatedAt: { type: Date, default: null },

    defaultCountryCode: { type: String, trim: true, default: "91" },
    // Skip a lead whose phone already had a delivery inside this window, so
    // one person re-submitting a form is not phoned repeatedly. 0 = off.
    dedupeWindowHours: { type: Number, default: 24, min: 0, max: 720 },
    // Skip leads whose enquiry is older than this (stale polled leads).
    maxLeadAgeMinutes: { type: Number, default: 15, min: 1, max: 180 },
    // Calls are opt-in per source, and only when a route row names an agent
    // (see services/vistrowOutbound/routing.js). Everything not routed is still
    // sent as a Contact, with auto_call:false.
    routing: {
      website:  { type: sourceRoutingSchema, default: () => ({}) },
      facebook: { type: sourceRoutingSchema, default: () => ({}) },
      whatsapp: { type: sourceRoutingSchema, default: () => ({}) },
    },
    // Bulk imports are a spreadsheet, not leads arriving: opt-in, and capped.
    emitImports: { type: Boolean, default: false },

    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastError: {
      type: { code: String, message: String, at: Date, deliveryId: mongoose.Schema.Types.ObjectId },
      default: undefined,
      _id: false,
    },
    // A delivery Vistrow ACCEPTED but did not queue a call for although we asked
    // (bad agent id, no caller number...). Not a failure, but the owner must see it.
    lastWarning: {
      type: { code: String, message: String, at: Date, deliveryId: mongoose.Schema.Types.ObjectId },
      default: undefined,
      _id: false,
    },
    lastAlertAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

outboundIntegrationSchema.index({ orgId: 1, provider: 1 }, { unique: true });

outboundIntegrationSchema.methods.setSecret = function setSecret(plain) {
  this.secretEnc = encryptField(String(plain));
  this.secretUpdatedAt = new Date();
};

// Returns the decrypted credential, or "" when none is stored. Requires the
// document to have been loaded with .select("+secretEnc").
outboundIntegrationSchema.methods.getSecret = function getSecret() {
  return this.secretEnc ? decryptField(this.secretEnc) : "";
};

module.exports = mongoose.model("OutboundIntegration", outboundIntegrationSchema);
