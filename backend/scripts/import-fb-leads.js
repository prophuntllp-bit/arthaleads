/**
 * One-time script to import the 5 Facebook leads from the Joyville campaign
 * that came in 2026-04-15 to 2026-04-17 but were not captured due to token issue.
 *
 * Run: node scripts/import-fb-leads.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");

const LEADS = [
  // ── Joyville-Hinjewadi-Video-05/03/2026 form ─────────────────────────────
  {
    name: "Abhas Sarkar",
    phone: "+918349671954",
    email: "abhas.sarkar@azaindimobility.com",
    city: "Delhi",
    budget: "₹80 Lakh – ₹1 Cr",
    timeline: "Within 6–12 months",
    purpose: "Investment",
    fbLeadId: "1564762735649357",
    form: "Joyville-Hinjewadi-Video-05/03/2026",
    createdAt: new Date("2026-04-17T23:09:48+05:30"),
  },
  {
    name: "Mehul Nalawade",
    phone: "+917218425240",
    email: "mehulnalwade@hotmail.com",
    city: "Navi Mumbai",
    budget: "₹1.8 Cr+",
    timeline: "Within 3–6 months",
    purpose: "Investment",
    fbLeadId: "1620906312340269",
    form: "Joyville-Hinjewadi-Video-05/03/2026",
    createdAt: new Date("2026-04-17T21:31:04+05:30"),
  },
  {
    name: "Tejas Korad",
    phone: "+919970386501",
    email: "tejas.korad@gmail.com",
    city: "Pune",
    budget: "₹80 Lakh – ₹1 Cr",
    timeline: "Immediately (0–3 months)",
    purpose: "Investment",
    fbLeadId: "1949188679060693",
    form: "Joyville-Hinjewadi-Video-05/03/2026",
    createdAt: new Date("2026-04-17T20:51:39+05:30"),
  },
  {
    name: "Abhishek Ghadge",
    phone: "7447614970",
    email: "abhighadge1509@gmail.com",
    city: "Pune",
    budget: "₹80 Lakh – ₹1 Cr",
    timeline: "Within 3–6 months",
    purpose: "Investment",
    fbLeadId: "1624924688796390",
    form: "Joyville-Hinjewadi-Video-05/03/2026",
    createdAt: new Date("2026-04-17T20:49:33+05:30"),
  },
  // ── Joyville-Hinjewadi-Image1-06/03/2026 form ────────────────────────────
  {
    name: "MD. Tarif",
    phone: "+919120111229",
    email: "yb3247925@gmail.com",
    city: "",
    budget: "₹80 Lakh – ₹1 Cr",
    timeline: "Immediately (0–3 months)",
    purpose: "Self-use",
    fbLeadId: "885462247875698",
    form: "Joyville-Hinjewadi-Image1-06/03/2026",
    createdAt: new Date("2026-04-17T20:23:24+05:30"),
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const admin = await User.findOne({ role: "admin" }).select("_id name");
  if (!admin) { console.error("No admin user found"); process.exit(1); }

  let created = 0, skipped = 0;

  for (const lead of LEADS) {
    // Find by FB lead ID in notes (these were saved as "Test Lead (Facebook)")
    const existing = await Lead.findOne({ "notes.text": { $regex: lead.fbLeadId } });

    const noteLines = [
      `Imported from Meta Lead Ads.`,
      `Lead ID: ${lead.fbLeadId}`,
      `Form: ${lead.form}`,
      lead.budget   ? `Budget: ${lead.budget}` : null,
      lead.timeline ? `Timeline: ${lead.timeline}` : null,
      lead.purpose  ? `Purpose: ${lead.purpose}` : null,
      lead.city     ? `City: ${lead.city}` : null,
    ].filter(Boolean).join("\n");

    if (existing) {
      // Update the existing "Test Lead" record with real data
      existing.name = lead.name;
      existing.phone = lead.phone;
      existing.email = lead.email || existing.email;
      existing.leadSourceLabel = lead.form;
      existing.notes[0].text = noteLines;
      await existing.save();
      console.log(`  UPDATED: ${lead.name} | ${lead.phone} (was: ${existing.name})`);
      created++;
      continue;
    }

    // Create new if not found
    await Lead.create({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: "Facebook",
      status: "New",
      leadSourceLabel: lead.form,
      createdBy: admin._id,
      assignedTo: admin._id,
      assignedToName: admin.name,
      createdAt: lead.createdAt,
      updatedAt: lead.createdAt,
      notes: [{ text: noteLines, addedBy: admin._id, addedByName: admin.name }],
      activities: [{ type: "created", description: "Lead imported from Facebook Lead Ads (backfill)", performedBy: admin._id, performedByName: admin.name }],
    });

    console.log(`  CREATED: ${lead.name} | ${lead.phone}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
