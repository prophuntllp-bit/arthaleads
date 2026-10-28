// models/ClosedOrgBilling.js
// Who a closed company was, for the billing records we keep after it closes
// its account (owner, 28 Oct 2026): GST law needs our own sales records
// (plan payments, credit and storage purchases) kept for about six years, and
// a payment row alone no longer says whom it was billed to once the
// Organization is gone. Holds only billing identity, nothing about leads.
// Keyed by formerOrgId, not orgId, so the org purge (which deletes every
// collection with an orgId) leaves it alone. Removed by itself after 8 years.
const mongoose = require("mongoose");

const EIGHT_YEARS_S = 8 * 366 * 24 * 60 * 60;

const closedOrgBillingSchema = new mongoose.Schema(
  {
    formerOrgId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name:     { type: String, default: "" },
    gstNo:    { type: String, default: "" },
    pan:      { type: String, default: "" },
    address:  { type: String, default: "" },
    email:    { type: String, default: "" },
    phone:    { type: String, default: "" },
    closedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

closedOrgBillingSchema.index({ closedAt: 1 }, { expireAfterSeconds: EIGHT_YEARS_S });

module.exports = mongoose.model("ClosedOrgBilling", closedOrgBillingSchema);
