const mongoose = require("mongoose");

const waConversationSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  leadId:       { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
  contactPhone: { type: String, required: true },  // E.164 without +, e.g. "919876543210"
  contactName:  { type: String, default: "" },
  waContactId:  { type: String, default: "" },     // WhatsApp's wa_id
  botEnabled:   { type: Boolean, default: true },

  // Which assistant is handling this thread. Pinned on the first bot reply and
  // never re-resolved, so editing routing or pausing an agent cannot swap the
  // voice a customer is already mid-conversation with.
  agentId:      { type: mongoose.Schema.Types.ObjectId, ref: "WaAgent", default: null },
  assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  assignedToName: { type: String, default: "" },
  status: {
    type: String,
    enum: ["bot", "open", "resolved"],
    default: "bot",
  },
  lastMessageAt:      { type: Date, default: Date.now },
  lastMessagePreview: { type: String, default: "" },
  unreadCount:        { type: Number, default: 0 },

  // Meta CTWA ad attribution, set once from the first message's `referral`
  // block (see Lead.campaignRef for the field meanings) and re-read on every
  // bot reply so the AI stays grounded in the ad that started this thread for
  // the whole conversation, not just its first turn.
  campaignRef: {
    type: {
      adId:      { type: String, trim: true, default: "" },
      headline:  { type: String, trim: true, default: "" },
      body:      { type: String, trim: true, default: "" },
      sourceUrl: { type: String, trim: true, default: "" },
      ctwaClid:  { type: String, trim: true, default: "" },
    },
    default: undefined,
  },

  // Last time the outside-business-hours away message was sent on this
  // thread — lets the bot send it once per closed day instead of once per
  // message (see isWithinBusinessHours / triggerBotReply in whatsappRoutes.js).
  awayMessageSentAt: { type: Date, default: null },
}, { timestamps: true });

waConversationSchema.index({ orgId: 1, contactPhone: 1 }, { unique: true });
waConversationSchema.index({ orgId: 1, lastMessageAt: -1 });

module.exports = mongoose.model("WaConversation", waConversationSchema);
