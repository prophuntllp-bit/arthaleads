// models/OAuthSession.js - ephemeral store for Facebook OAuth results
// TTL index automatically deletes documents after `expiresAt`
const mongoose = require("mongoose");

const oauthSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model("OAuthSession", oauthSessionSchema);
