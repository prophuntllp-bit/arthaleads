// One Artha chat. Kept per person on the server so it survives a reload or a
// device change, and so a follow-up ("assign these to Arjun") can refer back
// to the leads an earlier answer found.
//
// Deleted automatically 90 days after its last message (privacy, and the plan
// approved on 14 Oct 2026). The person can delete a chat sooner.
const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema({
  id:   { type: String, required: true },
  kind: { type: String, enum: ["lead", "projectLead", "task"], required: true },
  name: { type: String, default: "" },
}, { _id: false });

const turnSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  text: { type: String, default: "", maxlength: 12000 },
  // Assistant turns only: what the answer was built from and what it proposed.
  steps:     [{ type: String, maxlength: 200 }],
  records:   [recordSchema],
  proposals: [{ _id: false, type: { type: String }, params: { type: mongoose.Schema.Types.Mixed } }],
  page:   { type: String, default: "", maxlength: 120 },
  rating: { type: String, enum: ["up", "down", null], default: null },
  at:     { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  orgId:  { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title:  { type: String, default: "New chat", maxlength: 120 },
  turns:  [turnSchema],
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ userId: 1, lastMessageAt: -1 });
schema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("CopilotThread", schema);
