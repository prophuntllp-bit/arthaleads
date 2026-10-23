const mongoose = require("mongoose");

// The message a Click-to-WhatsApp ad pre-fills ("Hi, I'd like details of ...
// plots near Khopoli."), per ad. Learned from real ad clicks (the first
// message of a chat that arrived with the ad's referral), or added by hand in
// the agent editor. Meta sometimes delivers an ad click with no ad details at
// all; the text then still says which ad it was (utils/adPrefill.js).
const schema = new mongoose.Schema(
  {
    orgId:      { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    adId:       { type: String, required: true },
    norm:       { type: String, required: true }, // normalised text, the match key
    sample:     { type: String, default: "" },    // as the customer sent it, for the editor
    count:      { type: Number, default: 0 },     // ad clicks that opened with it
    manual:     { type: Boolean, default: false },
    hidden:     { type: Boolean, default: false }, // removed in the editor: never matched, never re-learned
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

schema.index({ orgId: 1, adId: 1, norm: 1 }, { unique: true });

module.exports = mongoose.models.AdPrefill || mongoose.model("AdPrefill", schema);
