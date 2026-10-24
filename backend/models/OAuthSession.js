// models/OAuthSession.js - ephemeral store for Facebook OAuth results
// TTL index automatically deletes documents after `expiresAt`
const mongoose = require("mongoose");

const oauthSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  // Who started the connect: only they may read the result (24 Oct 2026).
  userId:    { type: String, default: "" },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model("OAuthSession", oauthSessionSchema);
