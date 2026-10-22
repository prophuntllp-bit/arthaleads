// One-off (22 Oct 2026, owner approved): undo the duplicates made when a lead
// that had been moved into a project wrote on WhatsApp again (before the fix
// in relinkConversationLead, such a customer got a second, empty lead in
// Leads). For each one: the chat goes back to the original lead (the one in
// the project) and the empty duplicate goes to Dump Leads.
//
//   node scripts/fixProjectLeadDuplicates.js          # dry run: lists them, writes nothing
//   node scripts/fixProjectLeadDuplicates.js --apply  # fixes them
//
// Run only once the fix is live, or the next message re-creates the duplicate.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const dupes = await db.collection("leads").find({
    isDeleted: { $ne: true },
    "activities.description": { $regex: "^Lead re-created: .*previous lead was archived" },
  }).toArray();
  let fixed = 0;
  for (const d of dupes) {
    const prevId = d.activities.find((a) => /^Lead re-created/.test(a.description))?.meta?.previousLeadId;
    if (!prevId) continue;
    const prev = await db.collection("leads").findOne({ _id: prevId });
    const inProject = prev && await db.collection("projectleads").countDocuments({ fromLeadId: prevId });
    if (!prev || prev.isDeleted || !prev.isArchived || !inProject) continue;
    const conv = await db.collection("waconversations").findOne({ leadId: d._id });
    console.log(`${apply ? "Fixing" : "Would fix"}: ${d.name} (${d.phone}) duplicate ${d._id} -> original ${prevId}${conv ? `, chat ${conv._id}` : ""}`);
    if (!apply) { fixed++; continue; }
    if (conv) {
      await db.collection("waconversations").updateOne({ _id: conv._id }, { $set: { leadId: prevId } });
      await db.collection("leads").updateOne({ _id: prevId }, { $set: { whatsappConversationId: conv._id } });
    }
    await db.collection("leads").updateOne({ _id: d._id }, {
      $set: { isDeleted: true, deletedAt: new Date(), deletedByName: "System", deletedFrom: { kind: "leads" }, whatsappConversationId: null },
      $push: { activities: { type: "note_added", description: "Moved to Dump Leads: duplicate of a lead that is in a project", meta: { originalLeadId: prevId }, createdAt: new Date(), updatedAt: new Date() } },
    });
    fixed++;
  }
  console.log(`${apply ? "Fixed" : "Would fix"} ${fixed} duplicate(s).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
