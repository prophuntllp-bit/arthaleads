const cron = require("node-cron");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Organization = require("../models/Organization");
const logger = require("../config/logger");
const { sendPushToUser } = require("./push");
const { runBackup } = require("./backup");

function getDateRange(offsetDays = 0) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Keep backward-compatible alias used nowhere internally but exported for tests
function getTodayRange() { return getDateRange(0); }


async function notifyLeads(leads, labelFn) {
  if (!leads.length) return;

  for (const lead of leads) {
    const payload = {
      title: "Follow-up Reminder",
      body: labelFn(lead),
      data: { url: "/followups" },
    };

    // Priority for project leads:
    //   1. followUpSetBy  - person who explicitly set this follow-up date
    //   2. project.assignedTo[] - agents assigned to work this project
    //   3. (importedBy is intentionally skipped - that's an admin action, not work)
    //
    // Priority for main pipeline leads:
    //   1. followUpSetBy → assignedTo

    if (lead.followUpSetBy) {
      // Someone explicitly set this follow-up - notify only them
      await sendPushToUser(lead.followUpSetBy, payload);
    } else if (lead.project?.assignedTo?.length) {
      // Project lead with no explicit setter - notify all agents assigned to that project
      for (const userId of lead.project.assignedTo) {
        await sendPushToUser(userId, payload);
      }
    } else if (lead.assignedTo) {
      // Main pipeline lead with an assigned agent
      await sendPushToUser(lead.assignedTo, payload);
    }
    // If none of the above match, skip silently (no notification to wrong people)
  }
}

// ── Daily 9 AM: morning summary, respecting each org's alertLeadDays ─────────
async function runDailyReminder() {
  // Fetch every org's lead-time setting
  const orgs = await Organization.find({}).select("_id alertLeadDays").lean();
  if (!orgs.length) { logger.info("Daily reminder: no orgs found"); return; }

  // Group org IDs by their alertLeadDays value so we do one DB query per unique offset
  const byOffset = {}; // { "0": [orgId,...], "2": [orgId,...], ... }
  for (const org of orgs) {
    const days = org.alertLeadDays ?? 0;
    if (!byOffset[days]) byOffset[days] = [];
    byOffset[days].push(org._id);
  }

  let totalNotified = 0;

  for (const [daysStr, orgIds] of Object.entries(byOffset)) {
    const days = Number(daysStr);
    const { start, end } = getDateRange(days);

    // Build a human-readable label for the push body
    const labelFn = days === 0
      ? (lead) => `Follow-up due today: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`
      : days === 1
        ? (lead) => `Follow-up due tomorrow: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`
        : (lead) => `Follow-up in ${days} days: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`;

    // Main pipeline leads
    const leads = await Lead.find({
      orgId: { $in: orgIds },
      followUpDate: { $gte: start, $lte: end },
      isArchived: false,
      isDeleted: { $ne: true },
    }).select("name phone assignedTo followUpDate followUpSetBy orgId").lean();

    // Project leads — check both followUp and followUp2
    const projLeads = await ProjectLead.find({
      orgId: { $in: orgIds },
      $or: [
        { followUp:  { $gte: start, $lte: end } },
        { followUp2: { $gte: start, $lte: end } },
      ],
    }).populate("project", "orgId assignedTo").select("name phone followUp followUp2 project orgId followUpSetBy").lean();

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
    if (!allLeads.length) continue;

    logger.info(`Daily reminder (lead=${days}d): ${allLeads.length} follow-up(s) for ${orgIds.length} org(s)`);
    await notifyLeads(allLeads, labelFn);
    totalNotified += allLeads.length;
  }

  if (!totalNotified) logger.info("Daily reminder: no follow-ups to notify");
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
  }).populate("project", "orgId assignedTo").select("name phone followUp followUp2 project orgId followUpSetBy").lean();

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
