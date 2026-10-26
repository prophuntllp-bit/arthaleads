// One-off (26 Oct 2026): report to Meta the Click to WhatsApp leads that
// qualified themselves in the button flow (budget and timeline answered, or a
// site visit / advisor / registration tap) before QualifiedLead was sent for
// them. Meta accepts events up to 7 days old, so only those are sent, dated
// when the lead last acted in the flow.
//
//   node scripts/capiCatchUpQualified.js            # dry run: lists, writes nothing
//   node scripts/capiCatchUpQualified.js --apply    # sends
//
// Goes through the normal sender, so a lead already reported is not sent again
// and companies without Conversions API on are skipped.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const Lead = require("../models/Lead");
  const MetaEvent = require("../models/MetaEvent");
  const Organization = require("../models/Organization");
  const capi = require("../services/metaConversions");

  const since = new Date(Date.now() - 7 * 86400000 + 15 * 60000); // a margin inside Meta's 7 days
  const orgs = await Organization.find({ "metaCapi.enabled": true }).select("_id name").lean();
  let total = 0, sent = 0;
  for (const org of orgs) {
    const leads = await Lead.find({ orgId: org._id, ...capi.CHAT_QUALIFIED_QUERY, "engagement.at": { $gte: since }, "campaignRef.ctwaClid": { $nin: ["", null] } })
      .select("orgId name phone email metaLeadId campaignRef createdAt engagement").lean();
    const done = new Set((await MetaEvent.find({ orgId: org._id, eventName: "QualifiedLead", leadId: { $in: leads.map((l) => l._id) } }).select("leadId").lean()).map((e) => String(e.leadId)));
    const todo = leads.filter((l) => capi.isChatQualified(l) && !done.has(String(l._id)));
    total += todo.length;
    console.log(`${org.name}: ${todo.length} to send (${done.size} already sent)`);
    for (const l of todo) {
      const why = capi.QUALIFYING_CLOSINGS.includes(l.engagement.closing) ? l.engagement.closing : `budget + ${l.engagement.flow.timeline}`;
      console.log(`  ${l.name} | ${new Date(l.engagement.at).toISOString().slice(0, 16)} | ${why}`);
      if (apply) {
        await capi.trackChatQualified(l, l.engagement.at);
        const ev = await MetaEvent.findOne({ leadId: l._id, eventName: "QualifiedLead" }).lean();
        if (ev?.status === "sent") sent++;
        else console.log(`    -> ${ev?.status || "not queued"} ${ev?.error || ""}`);
      }
    }
  }
  console.log(`\n${total} lead(s)${apply ? `, ${sent} accepted by Meta` : " (dry run, nothing sent)"}.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
