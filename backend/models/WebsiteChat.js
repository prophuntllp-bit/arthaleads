// models/WebsiteChat.js - one visitor conversation with Artha on the marketing
// website (POST /api/public/chat), saved so the team can read what visitors
// ask (super admin > Website chats). Owner's call, 27 Oct 2026.
//
// Anonymous: keyed by a random id the browser makes per visit, no account, no
// IP. A visitor's own words can contain a name or number, so conversations
// expire a year after the last message.
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "bot"], required: true },
    text: { type: String, required: true, maxlength: 4000 },
    cta:  { type: String, maxlength: 20, default: null },
    at:   { type: Date, default: Date.now },
  },
  { _id: false }
);

const websiteChatSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, maxlength: 64 },
    page:      { type: String, maxlength: 200, default: "" },   // where the chat started
    device:    { type: String, enum: ["mobile", "desktop"], default: "desktop" },
    messages:  { type: [messageSchema], default: [] },
    questions: { type: Number, default: 0, index: true },
    lastAt:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

websiteChatSchema.index({ lastAt: -1 });
websiteChatSchema.index({ lastAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.models.WebsiteChat || mongoose.model("WebsiteChat", websiteChatSchema);
