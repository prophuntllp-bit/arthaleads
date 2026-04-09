const cron = require("node-cron");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const User = require("../models/User");
const logger = require("../config/logger");
const { sendPushToUser } = require("./push");

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function notifyLeads(leads, labelFn) {
  if (!leads.length) return;

  const managers = await User.find({ role: { $in: ["admin", "manager"] } }).select("_id").lean();
  const managerIds = managers.map((u) => u._id);

  for (const lead of leads) {
    const payload = {
      title: "Follow-up Reminder",
      body: labelFn(lead),
      data: { url: "/leads" },
    };

    if (lead.assignedTo) {
      await sendPushToUser(lead.assignedTo, payload);
    }

    for (const managerId of managerIds) {
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
  }).select("name phone assignedTo followUpDate").lean();

  const projLeads = await ProjectLead.find({
    followUp: { $gte: start, $lte: end },
  }).select("name phone assignedTo followUp").lean();

  const allLeads = [...leads, ...projLeads];

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
  }).select("name phone assignedTo followUpDate").lean();

  const projLeads = await ProjectLead.find({
    followUp: { $gte: windowStart, $lt: windowEnd },
  }).select("name phone assignedTo followUp").lean();

  const allLeads = [...leads, ...projLeads];
  if (!allLeads.length) return;

  logger.info(`Upcoming reminder: ${allLeads.length} follow-up(s) in ~10 minutes`);
  await notifyLeads(allLeads, (lead) => `Follow-up in 10 minutes: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`);
}

cron.schedule("0 9 * * *", () => {
  runDailyReminder().catch((err) => logger.error(`Daily reminder error: ${err.message}`));
});

cron.schedule("* * * * *", () => {
  runUpcomingReminder().catch((err) => logger.error(`Upcoming reminder error: ${err.message}`));
});

module.exports = { runDailyReminder, runUpcomingReminder };
