// models/ContentReport.js
//
// Reports of AI-generated content, raised from inside the app.
//
// Google Play's AI-Generated Content policy requires apps that generate content
// with AI to carry an in-app way to flag offensive output, and expects those
// reports to actually inform moderation rather than disappear into a mailbox.
// Storing them makes that possible: a repeated complaint about the same kind of
// answer is a prompt problem, and you can only see that if the reports are in
// one place.
//
// The reported text is stored verbatim. The copilot does not persist its
// answers anywhere else, so without a copy here a report would name a message
// nobody can look at.

const mongoose = require("mongoose");

const REASONS = ["offensive", "inaccurate", "harmful", "privacy", "other"];

const contentReportSchema = new mongoose.Schema(
  {
    orgId:  { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    // Not required, deliberately: account deletion unlinks the reporter and
    // keeps the report, so an anonymised row has to still be a valid document.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    reason: { type: String, enum: REASONS, default: "other" },
    // Free text, optional — most people flag without explaining, and requiring
    // a reason is how you end up with no reports at all.
    detail: { type: String, trim: true, maxlength: 1000, default: "" },

    // What was actually said, both halves. The answer alone is rarely enough to
    // judge: a reasonable reply to a hostile question reads very differently
    // from the same reply unprompted.
    reportedText: { type: String, required: true, maxlength: 8000 },
    prompt:       { type: String, maxlength: 2000, default: "" },
    page:         { type: String, maxlength: 80, default: "" },
    surface:      { type: String, enum: ["web", "mobile"], default: "web" },

    status:     { type: String, enum: ["open", "reviewed", "actioned"], default: "open", index: true },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContentReport", contentReportSchema);
module.exports.REASONS = REASONS;
