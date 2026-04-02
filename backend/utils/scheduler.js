const cron = require("node-cron");
const Lead = require("../models/Lead");
const logger = require("../config/logger");

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function runFollowUpReminder() {
  const { start, end } = getTodayRange();
  const leads = await Lead.find({
    followUpDate: { $gte: start, $lte: end },
    isArchived: false,
  }).select("name phone status assignedToName followUpDate");

  if (!leads.length) {
    logger.info("Follow-up reminder: no leads due today");
    return;
  }

  logger.info(`Follow-up reminder: ${leads.length} lead(s) due today`);
  leads.forEach((lead) => {
    logger.info(
      `Reminder -> ${lead.name} | ${lead.phone} | ${lead.status} | ${lead.assignedToName || "Unassigned"}`
    );
  });
}

cron.schedule("0 9 * * *", () => {
  runFollowUpReminder().catch((err) => logger.error(`Scheduler error: ${err.message}`));
});

module.exports = { runFollowUpReminder };
