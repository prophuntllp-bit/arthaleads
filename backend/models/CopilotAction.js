// models/CopilotAction.js
//
// One row per copilot write the user approved. It exists for idempotency: a
// flaky connection and a second tap on Apply must not apply the change twice,
// and the only reliable way to know "this is the same intent, not a new one"
// is a key minted when the proposal was shown.
//
// It doubles as attribution — who approved what, and the message that led to
// it — which is the question support actually gets asked ("why is this lead
// assigned to Ravi?").

const mongoose = require("mongoose");

const copilotActionSchema = new mongoose.Schema(
  {
    // Minted client-side when the preview is rendered, so every retry of that
    // one proposal carries the same key.
    idempotencyKey: { type: String, required: true, unique: true, index: true },

    orgId:  { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, default: "" },

    actionId: { type: String, required: true },
    params:   { type: mongoose.Schema.Types.Mixed },
    page:     { type: String, default: "" },

    // "pending" is claimed-but-not-finished. A row stuck here means the
    // process died mid-execute; the claim is released on a failed execute so
    // the user can simply try again.
    status:  { type: String, enum: ["pending", "done"], default: "pending", index: true },
    result:  { type: mongoose.Schema.Types.Mixed },

    // The question that produced the proposal, for support and for deciding
    // later which actions are safe to make lower-friction.
    prompt: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

copilotActionSchema.index({ orgId: 1, createdAt: -1 });

module.exports = mongoose.model("CopilotAction", copilotActionSchema);
