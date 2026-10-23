// A joining-link reminder for someone who registered for an event through an
// agent's button flow (a "register" closing button, 23 Oct 2026). Sent by the
// one-minute job in utils/scheduler.js at sendAt: as plain text while the
// customer's 24-hour reply window is open, else as the agent's chosen
// approved template.
const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    orgId:          { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    agentId:        { type: mongoose.Schema.Types.ObjectId, ref: "WaAgent", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "WaConversation", required: true },
    leadId:         { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    phone:          { type: String, required: true },
    name:           { type: String, default: "" },
    eventTitle:     { type: String, default: "" },
    eventStartsAt:  { type: Date },
    sendAt:         { type: Date, required: true },
    status:         { type: String, enum: ["pending", "sent", "skipped", "failed"], default: "pending" },
    via:            { type: String, default: "" }, // "text" | "template"
    sentAt:         { type: Date },
    error:          { type: String, default: "" },
  },
  { timestamps: true }
);
schema.index({ status: 1, sendAt: 1 });
// One reminder per person per event (the same agent can run a new event later).
schema.index({ agentId: 1, conversationId: 1, eventStartsAt: 1 }, { unique: true });

module.exports = mongoose.model("EventReminder", schema);
