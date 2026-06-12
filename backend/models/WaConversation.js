const mongoose = require("mongoose");

const waConversationSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  leadId:       { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
  contactPhone: { type: String, required: true },  // E.164 without +, e.g. "919876543210"
  contactName:  { type: String, default: "" },
  waContactId:  { type: String, default: "" },     // WhatsApp's wa_id
  botEnabled:   { type: Boolean, default: true },
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
}, { timestamps: true });

waConversationSchema.index({ orgId: 1, contactPhone: 1 }, { unique: true });
waConversationSchema.index({ orgId: 1, lastMessageAt: -1 });

module.exports = mongoose.model("WaConversation", waConversationSchema);
