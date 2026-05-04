const cron = require("node-cron");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const User = require("../models/User");
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

// Cache managers per org to avoid redundant queries within a single scheduler run
async function getManagersByOrg(orgIds) {
  const managers = await User.find({
    orgId: { $in: orgIds },
    role: { $in: ["admin", "manager"] },
  }).select("_id orgId").lean();

  // Map orgId -> [userId, ...]
  const map = {};
  for (const m of managers) {
    const key = String(m.orgId);
    if (!map[key]) map[key] = [];
    map[key].push(m._id);
  }
  return map;
}

async function notifyLeads(leads, labelFn) {
  if (!leads.length) return;

  // Collect distinct orgIds so we only query managers for relevant orgs
  const orgIds = [...new Set(leads.map((l) => l.orgId).filter(Boolean).map(String))];
  const managersByOrg = await getManagersByOrg(orgIds);

  for (const lead of leads) {
    const payload = {
      title: "Follow-up Reminder",
      body: labelFn(lead),
      data: { url: "/leads" },
    };

    if (lead.assignedTo) {
      await sendPushToUser(lead.assignedTo, payload);
    }

    // Only notify managers/admins from the same org
    const orgManagers = managersByOrg[String(lead.orgId)] || [];
    for (const managerId of orgManagers) {
      if (lead.assignedTo && managerId.toString() === lead.assignedTo.toString()) continue;
      await sendPushToUser(managerId, payload);
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
  }).select("name phone assignedTo followUpDate orgId").lean();

  // ProjectLead now has orgId; for legacy rows without orgId, resolve via project
  const projLeads = await ProjectLead.find({
    followUp: { $gte: start, $lte: end },
  }).populate("project", "orgId").select("name phone followUp project orgId").lean();

  // Ensure orgId is set (fallback to project.orgId for legacy docs without orgId)
  const normalizedProjLeads = projLeads.map((l) => ({
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
  }).select("name phone assignedTo followUpDate orgId").lean();

  const projLeads = await ProjectLead.find({
    followUp: { $gte: windowStart, $lt: windowEnd },
  }).populate("project", "orgId").select("name phone followUp project orgId").lean();

  const normalizedProjLeads = projLeads.map((l) => ({
    ...l,
    orgId: l.orgId || l.project?.orgId,
  }));

  const allLeads = [...leads, ...normalizedProjLeads];
  if (!allLeads.length) return;

  logger.info(`Upcoming reminder: ${allLeads.length} follow-up(s) in ~10 minutes`);
  await notifyLeads(allLeads, (lead) => `Follow-up in 10 minutes: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`);
}

// ── Daily 9 AM IST: follow-up reminders ─────────────────────────────────────
cron.schedule("0 9 * * *", () => {
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
