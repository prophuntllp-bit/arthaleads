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

    // What the record looked like before, captured immediately before the
    // write. This is the undo receipt: confirmation stops most mistakes, and
    // this handles the ones that were confirmed too quickly.
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    undoneAt: { type: Date, default: null },

    // Artha v2 (Phase 0, Oct 2026): which assistant wrote it, the chat it came
    // from, and the records it touched, so an admin log can answer "what did
    // Artha change on this lead, for whom, from which conversation".
    source:   { type: String, enum: ["helpbot", "artha"], default: "helpbot" },
    threadId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    subjects: [{
      _id: false,
      kind: { type: String, enum: ["lead", "projectLead", "task"] },
      id:   { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, default: "" },
    }],
  },
  { timestamps: true }
);

copilotActionSchema.index({ orgId: 1, createdAt: -1 });
copilotActionSchema.index({ "subjects.id": 1, createdAt: -1 });

// A claim older than this that never reached "done" belongs to a request that
// died mid-way (a crash or a lost connection). It must not block that
// proposal forever, so it can be cleared and the user asked to apply again.
copilotActionSchema.statics.STALE_PENDING_MS = 2 * 60 * 1000;
copilotActionSchema.statics.clearStalePending = function (idempotencyKey) {
  return this.deleteOne({ idempotencyKey, status: "pending", createdAt: { $lt: new Date(Date.now() - this.STALE_PENDING_MS) } });
};

module.exports = mongoose.model("CopilotAction", copilotActionSchema);
