/**
 * Moves each org's single WhatsApp assistant off the organisation document and
 * into its own WaAgent record, so a tenant can have more than one.
 *
 * Idempotent: an org that already has agents is skipped, so re-running is safe.
 * Nothing is deleted — the old `whatsapp.bot*` fields stay on the organisation
 * untouched, which means this can be rolled back by reverting the code alone.
 *
 *   node scripts/migrate-wa-agents.js          # report only
 *   node scripts/migrate-wa-agents.js --commit # write
 */
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const WaAgent = require("../models/WaAgent");

const COMMIT = process.argv.includes("--commit");

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(COMMIT ? "MODE: committing\n" : "MODE: dry run (pass --commit to write)\n");

  const orgs = await Organization.find({}).select("name whatsapp").lean();
  let created = 0, skipped = 0, noConfig = 0;

  for (const org of orgs) {
    const wa = org.whatsapp || {};
    const existing = await WaAgent.countDocuments({ orgId: org._id });
    if (existing) {
      console.log(`SKIP    ${org.name} — already has ${existing} agent(s)`);
      skipped++;
      continue;
    }

    // Only orgs that actually configured WhatsApp get an agent. Creating one
    // for a tenant that never connected would put an empty card in their UI.
    const hasConfig = wa.enabled || wa.apiKey || wa.botGreeting || wa.botSystemPrompt
      || wa.botBusinessContext || wa.botGroundRules || (wa.botProjectIds || []).length;
    if (!hasConfig) {
      noConfig++;
      continue;
    }

    const adIds = (wa.botAdProjectMap || []).map((m) => m.adId).filter(Boolean);
    const doc = {
      orgId: org._id,
      name: (wa.botName || "Artha Assistant").slice(0, 60),
      description: "Migrated from your previous single-assistant setup.",
      // Carries over the org-wide switch: an org with the bot off gets a
      // paused agent rather than one that starts answering on deploy.
      status: (wa.botEnabled ?? true) ? "active" : "paused",
      isDefault: true,
      greeting: wa.botGreeting || "",
      businessContext: wa.botBusinessContext || "",
      groundRules: wa.botGroundRules || "",
      projectIds: wa.botProjectIds || [],
      systemPrompt: wa.botSystemPrompt || "",
      adIds,
    };

    console.log(`CREATE  ${org.name} -> "${doc.name}" [${doc.status}] `
      + `projects=${doc.projectIds.length || "all"} ads=${adIds.length} `
      + `${doc.systemPrompt ? "customPrompt " : ""}`
      + `${doc.greeting ? "greeting " : ""}${doc.businessContext ? "context " : ""}${doc.groundRules ? "rules" : ""}`);

    if (COMMIT) await WaAgent.create(doc);
    created++;
  }

  console.log(`\n${created} agent(s) ${COMMIT ? "created" : "would be created"}`
    + ` · ${skipped} org(s) skipped · ${noConfig} org(s) never configured WhatsApp`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
