/**
 * One-time fix: update the misclassified "Test Lead (Facebook)" for Rayen Neell
 * Run: node backend/scripts/fix-rayen-lead.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Find the test lead - most recent Facebook test lead
  const lead = await Lead.findOne({
    name: "Test Lead (Facebook)",
    source: "Facebook",
  }).sort({ createdAt: -1 });

  if (!lead) {
    console.log("No test lead found - may already be fixed.");
    process.exit(0);
  }

  console.log("Found lead:", lead._id, "created:", lead.createdAt);

  lead.name        = "Rayen Neell";
  lead.phone       = "+919422522199";
  lead.email       = "rayenneell@rediffmail.com";
  lead.leadSourceLabel = lead.leadSourceLabel?.replace(" - Test", "") || "Facebook Lead Ads";

  // Update the note
  if (lead.notes?.length > 0) {
    lead.notes[0].text = [
      "Imported from Meta Lead Ads.",
      "Lead form ID: 1476500290614317",
      "Submitted: Tuesday, 21 April 2026 01:01",
      "full_name: Rayen Neell",
      "email: rayenneell@rediffmail.com",
      "phone_number: +919422522199",
      "What do you need help with?: Rental Agreement",
      "What is your property type?: 1 BHK / 2 BHK or more",
      "Street address: bibvewadi",
    ].join("\n");
  }

  await lead.save();
  console.log("✅ Lead updated successfully:", lead.name, lead.phone);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
