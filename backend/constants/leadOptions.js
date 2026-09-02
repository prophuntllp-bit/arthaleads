// ── Canonical lead option lists ───────────────────────────────────────────────
// THE single source of truth for every enumerated lead field.
//
// These lists used to be copy-pasted into four places — the Mongoose model, the
// Joi validators, the web constants, and the mobile constants — and they drifted.
// Values existed on the model but not in the validator, so the UI offered
// choices the API rejected with a bare 400 ("Save failed"): booking gained
// "Other Location"/"Commercial", source gained "QR Code"/"Custom"/
// "Vistrow Voice". Each was a live bug that took a log dig to explain.
//
// Now:
//   - models/Lead.js + models/ProjectLead.js take their `enum` from here
//   - validations/schemas.js takes its `.valid()` from here
//   - GET /api/public/options serves them, so the web app and (crucially) old
//     sideloaded Android builds render exactly what the API will accept
//
// Adding a value here is all that is required — nothing else needs editing.
// Order matters: it is the order shown in every dropdown.

const STATUS = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];

const PRIORITY = ["Low", "Medium", "High", "Hot"];

const SOURCE = [
  "Facebook", "Google", "WhatsApp", "Manual", "Website", "Custom",
  "Vistrow Voice", "Referral", "Walk-in", "PropTiger", "99acres",
  "MagicBricks", "QR Code", "Other",
];

// "" is a real, selectable value here — it means "no booking status set".
const BOOKING = [
  "", "Interested", "Not Interested", "Not Reachable", "Low Budget",
  "Call Back", "Site Visit Booked", "Site Visit Done", "Booked",
  "Other Location", "Commercial",
];

const PROPERTY_TYPE = ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse", "Other"];

const BHK = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK+", "Studio", "N/A"];

const PURPOSE = ["Buy", "Rent", "Invest", "N/A"];

module.exports = {
  STATUS,
  PRIORITY,
  SOURCE,
  BOOKING,
  PROPERTY_TYPE,
  BHK,
  PURPOSE,
};
