// Restores the details of leads that were moved into a project before the
// transfer copied everything. Their full data is still on the archived original
// Lead; this finds that original, copies across whatever the project record is
// missing, and gives the project record its lead's real created date.
//
// Never overwrites anything the team has entered on the project record since
// the move: only blank fields are filled, notes and call history are merged,
// and nothing is deleted.
//
//   node scripts/backfill-transferred-leads.js            # report only
//   node scripts/backfill-transferred-leads.js --apply    # write the changes
//
// A project record is matched to its original only when both are in the same
// org, have the same phone number, and the original was archived within ten
// minutes of the project record being created, which is how a real transfer
// looks. Anything else is reported and left alone.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Project = require("../models/Project");
const { projectLeadFromLead } = require("../utils/projectLeadFromLead");

const APPLY = process.argv.includes("--apply");
const WINDOW_MS = 10 * 60 * 1000;

const SCALARS = [
  "status", "priority", "propertyType", "bhk", "purpose", "timeline", "preferredLocation", "city",
  "streetAddress", "requirements", "assignedTo", "assignedToName", "followUpNote", "siteVisitDate",
  "firstContactedAt", "formPlugin", "leadSourceLabel", "sourcePage", "sourceDomain",
];
const blank = (v) => v === undefined || v === null || v === "" || (typeof v === "number" && v === 0);

function buildPatch(pl, lead, projectName) {
  const full = projectLeadFromLead(lead, pl.project, { _id: pl.importedBy, orgId: pl.orgId, name: "System" }, { projectName });
  const $set = { fromLeadId: lead._id, transferredAt: pl.createdAt };
  for (const k of SCALARS) if (blank(pl[k]) && !blank(full[k])) $set[k] = full[k];
  if ((!pl.budget || (!pl.budget.min && !pl.budget.max)) && (full.budget?.min || full.budget?.max)) $set.budget = full.budget;
  if (!pl.formResponses?.length && full.formResponses?.length) $set.formResponses = full.formResponses;
  if (!pl.tags?.length && full.tags?.length) $set.tags = full.tags;
  if (!pl.campaignRef && full.campaignRef) $set.campaignRef = full.campaignRef;
  if (!pl.whatsappConsent?.status && full.whatsappConsent) $set.whatsappConsent = full.whatsappConsent;

  const seenNote = new Set((pl.notes || []).map((n) => `${n.text}|${new Date(n.createdAt).getTime()}`));
  const olderNotes = full.notes.filter((n) => !seenNote.has(`${n.text}|${new Date(n.createdAt).getTime()}`));
  if (olderNotes.length) $set.notes = [...olderNotes, ...(pl.notes || []).map((n) => (n.toObject ? n.toObject() : n))];

  // The lead's own history, without the "moved" entry full carries (the
  // original transfer already predates this backfill, so one is added only
  // when the record has no history at all).
  const history = full.activities.filter((a) => a.type !== "transferred");
  const seenAct = new Set((pl.activities || []).map((a) => `${a.type}|${a.description}|${new Date(a.createdAt).getTime()}`));
  const olderActs = history.filter((a) => !seenAct.has(`${a.type}|${a.description}|${new Date(a.createdAt).getTime()}`));
  if (olderActs.length) $set.activities = [...olderActs, ...(pl.activities || []).map((a) => (a.toObject ? a.toObject() : a))];

  // The real arrival date, so date filters and sorting see the lead where it
  // belongs. Only ever moves it earlier.
  if (lead.createdAt && lead.createdAt < pl.createdAt) $set.createdAt = lead.createdAt;
  return $set;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const stats = { scanned: 0, matched: 0, noOriginal: 0, ambiguous: 0, alreadyDone: 0, updated: 0 };
  const samples = [];

  const projectNames = Object.fromEntries((await Project.find({}).select("name").lean()).map((p) => [String(p._id), p.name]));
  const cursor = ProjectLead.find({}).cursor();
  for await (const pl of cursor) {
    stats.scanned++;
    if (pl.fromLeadId) { stats.alreadyDone++; continue; }

    const candidates = await Lead.find({
      orgId: pl.orgId, phone: pl.phone, isArchived: true,
      updatedAt: { $gte: new Date(pl.createdAt - WINDOW_MS), $lte: new Date(+pl.createdAt + WINDOW_MS) },
    });
    if (!candidates.length) { stats.noOriginal++; continue; }
    // Closest in time wins; two equally close originals for one record is
    // ambiguous and is left for a person to look at.
    candidates.sort((a, b) => Math.abs(a.updatedAt - pl.createdAt) - Math.abs(b.updatedAt - pl.createdAt));
    if (candidates.length > 1 && Math.abs(candidates[0].updatedAt - pl.createdAt) === Math.abs(candidates[1].updatedAt - pl.createdAt)) {
      stats.ambiguous++; continue;
    }
    const lead = candidates[0];
    const patch = buildPatch(pl, lead, projectNames[String(pl.project)]);
    stats.matched++;
    if (samples.length < 8) samples.push({ name: pl.name, phone: pl.phone, restores: Object.keys(patch).filter((k) => !["fromLeadId", "transferredAt"].includes(k)) });

    if (APPLY) {
      // Raw driver update: Mongoose treats createdAt as immutable and silently
      // drops it from a normal update, which is the one field this must restore.
      await ProjectLead.collection.updateOne({ _id: pl._id }, { $set: patch });
      stats.updated++;
    }
  }

  console.log(APPLY ? "APPLIED" : "DRY RUN (nothing written)", JSON.stringify(stats));
  for (const s of samples) console.log(" ", s.name, s.phone, "->", s.restores.join(", "));
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
