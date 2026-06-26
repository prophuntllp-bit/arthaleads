const mongoose = require("mongoose");

const waMessageSchema = new mongoose.Schema({
  orgId:           { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  conversationId:  { type: mongoose.Schema.Types.ObjectId, ref: "WaConversation", required: true, index: true },
  waMsgId:         { type: String },  // provider message ID — used for dedup
  direction:       { type: String, enum: ["inbound", "outbound"], required: true },
  sender:          { type: String, enum: ["bot", "agent", "customer"], required: true },
  senderName:      { type: String, default: "" },
  body:            { type: String, default: "" },
  mediaType:       { type: String, enum: ["text", "image", "audio", "document", "sticker", "video"], default: "text" },
  mediaUrl:        { type: String, default: "" },
  status:          { type: String, enum: ["sent", "delivered", "read", "failed"], default: "sent" },
  timestamp:       { type: Date, default: Date.now },
}, { timestamps: true });

waMessageSchema.index({ conversationId: 1, timestamp: 1 });
waMessageSchema.index({ waMsgId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("WaMessage", waMessageSchema);
