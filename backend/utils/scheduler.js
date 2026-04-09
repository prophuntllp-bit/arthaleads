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

async function runFollowUpReminder() {
  const { start, end } = getTodayRange();

  // Fetch all admin and manager user IDs
  const managers = await User.find({ role: { $in: ["admin", "manager"] } }).select("_id").lean();
  const managerIds = managers.map((u) => u._id);

  // Regular leads with follow-up today
  const leads = await Lead.find({
    followUpDate: { $gte: start, $lte: end },
    isArchived: false,
    isDeleted: { $ne: true },
  }).select("name phone status assignedTo assignedToName followUpDate").lean();

  // Project leads with follow-up today
  const projLeads = await ProjectLead.find({
    followUp: { $gte: start, $lte: end },
  }).select("name phone status assignedTo assignedToName followUp").lean();

  const allLeads = [...leads, ...projLeads];

  if (!allLeads.length) {
    logger.info("Follow-up reminder: no leads due today");
    return;
  }

  logger.info(`Follow-up reminder: ${allLeads.length} lead(s) due today`);

  for (const lead of allLeads) {
    const payload = {
      title: "Follow-up Reminder",
      body: `Follow-up due today: ${lead.name}${lead.phone ? ` (${lead.phone})` : ""}`,
      data: { url: "/leads" },
    };

    // Notify the assigned agent
    if (lead.assignedTo) {
      await sendPushToUser(lead.assignedTo, payload);
    }

    // Notify all admins and managers
    for (const managerId of managerIds) {
      // Skip if already notified as assigned agent
      if (lead.assignedTo && managerId.toString() === lead.assignedTo.toString()) continue;
      await sendPushToUser(managerId, payload);
    }
  }

  logger.info(`Follow-up reminder: notifications sent for ${allLeads.length} lead(s)`);
}

cron.schedule("0 9 * * *", () => {
  runFollowUpReminder().catch((err) => logger.error(`Scheduler error: ${err.message}`));
});

module.exports = { runFollowUpReminder };
