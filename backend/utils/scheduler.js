const cron = require("node-cron");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const logger = require("../config/logger");
const { sendPushToUser } = require("./push");
const { runBackup } = require("./backup");

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}


async function notifyLeads(leads, labelFn) {
  if (!leads.length) return;

  for (const lead of leads) {
    const payload = {
      title: "Follow-up Reminder",
      body: labelFn(lead),
      data: { url: "/followups" },
    };

    // Priority: person who SET the follow-up → assignedTo → importedBy
    // This ensures only the person who actually set the reminder gets notified.
    const recipient = lead.followUpSetBy || lead.assignedTo || lead.importedBy || null;
    if (recipient) {
      await sendPushToUser(recipient, payload);
    }
  }
}

// ── Daily 9 AM: morning summary of all follow-ups today ─────────────────────
async function runDailyReminder() {
  const { start, end } = getTodayRange();

  const leads = await Lead.find({
    followUpDate: { $gte: start, $lte: end },
    isArchived: false,
    isDeleted: { $ne: true },
  }).select("name phone assignedTo followUpDate followUpSetBy orgId").lean();

  // Check both followUp and followUp2 — deduplicate by _id so a lead with both
  // dates today only fires one notification
  const projLeads = await ProjectLead.find({
    $or: [
      { followUp:  { $gte: start, $lte: end } },
      { followUp2: { $gte: start, $lte: end } },
    ],
  }).populate("project", "orgId").select("name phone followUp followUp2 project orgId importedBy followUpSetBy").lean();

  // Deduplicate project leads (same _id might match both followUp and followUp2)
  const seen = new Set();
  const uniqueProjLeads = projLeads.filter((l) => {
    const key = String(l._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const normalizedProjLeads = uniqueProjLeads.map((l) => ({
    ...l,
    orgId: l.orgId || l.project?.orgId,
  }));

  const allLeads = [...leads, ...normalizedProjLeads];

  if (!allLeads.length) {
    logger.info("Daily reminder: no follow-ups today");
    return;
  }

  logger.info(`Daily reminder: ${allLeads.length} follow-up(s) today`);
  await notifyLeads(allLeads, (lead) => `Follow-up due today: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`);
}

// ── Every minute: 10-minute-before alert ────────────────────────────────────
async function runUpcomingReminder() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000);  // now + 9 min
  const windowEnd   = new Date(now.getTime() + 10 * 60 * 1000); // now + 10 min (exclusive)

  const leads = await Lead.find({
    followUpDate: { $gte: windowStart, $lt: windowEnd },
    isArchived: false,
    isDeleted: { $ne: true },
  }).select("name phone assignedTo followUpDate followUpSetBy orgId").lean();

  // Check both followUp and followUp2 so project leads with either date get notified
  const projLeads = await ProjectLead.find({
    $or: [
      { followUp:  { $gte: windowStart, $lt: windowEnd } },
      { followUp2: { $gte: windowStart, $lt: windowEnd } },
    ],
  }).populate("project", "orgId").select("name phone followUp followUp2 project orgId importedBy followUpSetBy").lean();

  // Deduplicate (lead with both dates in window fires only one alert)
  const seen = new Set();
  const uniqueProjLeads = projLeads.filter((l) => {
    const key = String(l._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const normalizedProjLeads = uniqueProjLeads.map((l) => ({
    ...l,
    orgId: l.orgId || l.project?.orgId,
  }));

  const allLeads = [...leads, ...normalizedProjLeads];
  if (!allLeads.length) return;

  logger.info(`Upcoming reminder: ${allLeads.length} follow-up(s) in ~10 minutes`);
  await notifyLeads(allLeads, (lead) => `Follow-up in 10 minutes: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`);
}

// ── Daily 9 AM IST (UTC 03:30): follow-up reminders ─────────────────────────
cron.schedule("30 3 * * *", () => {
  runDailyReminder().catch((err) => logger.error(`Daily reminder error: ${err.message}`));
});

// ── Every minute: 10-min-before alert ───────────────────────────────────────
cron.schedule("* * * * *", () => {
  runUpcomingReminder().catch((err) => logger.error(`Upcoming reminder error: ${err.message}`));
});

// ── Daily 2 AM IST (UTC 8:30 PM = 20:30): full DB backup via email ──────────
cron.schedule("30 20 * * *", () => {
  runBackup().catch((err) => logger.error(`[backup] cron failed: ${err.message}`));
});

module.exports = { runDailyReminder, runUpcomingReminder, runBackup };
