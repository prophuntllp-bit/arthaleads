const cron = require("node-cron");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Automation = require("../models/Automation");
const Task = require("../models/Task");
const logger = require("../config/logger");
const { sendPushToUser } = require("./push");
const { runBackup } = require("./backup");
const { pollGoogleAdsLeads } = require("./googleAdsPoller");

const META_GRAPH_VERSION = "v23.0";

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

// ── Daily 9 AM: morning summary of all follow-ups today ─────────────────────
async function runDailyReminder() {
  const { start, end } = getTodayRange();

  const leads = await Lead.find({
    followUpDate: { $gte: start, $lte: end },
    isArchived: { $ne: true },
    isDeleted: { $ne: true },
  }).select("name phone assignedTo followUpDate followUpSetBy orgId").lean();

  // Check both followUp and followUp2 - deduplicate by _id so a lead with both
  // dates today only fires one notification
  const projLeads = await ProjectLead.find({
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
    isArchived: { $ne: true },
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

// ── Daily 9 AM: tasks due today reminder ────────────────────────────────────
async function runTaskReminder() {
  const { start, end } = getTodayRange();

  const tasks = await Task.find({
    status: "pending",
    dueDate: { $gte: start, $lte: end },
  }).select("title assignedTo dueDate").lean();

  if (!tasks.length) {
    logger.info("Task reminder: no tasks due today");
    return;
  }

  logger.info(`Task reminder: ${tasks.length} task(s) due today`);
  for (const task of tasks) {
    await sendPushToUser(task.assignedTo, {
      type: "task_due",
      title: "Task Due Today",
      body: task.title,
      data: { url: "/tasks", taskId: String(task._id) },
    });
  }
}

// ── Facebook token refresh ────────────────────────────────────────────────────
// Facebook long-lived user tokens expire after 60 days.
// We refresh any token expiring within 20 days so it never actually expires.
// Runs daily at 10 AM IST (UTC 04:30) — low traffic window.
async function refreshFacebookTokens() {
  if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
    logger.warn("[fb-token-refresh] FB_APP_ID or FB_APP_SECRET not set — skipping");
    return;
  }

  // Find automations whose userToken expires within 20 days (or has no expiry recorded yet)
  const threshold = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const automations = await Automation.find({
    platform: "Facebook",
    isActive: true,
    userToken: { $exists: true, $ne: "" },
    $or: [
      { userTokenExpiresAt: { $lte: threshold } },
      { userTokenExpiresAt: null },
    ],
  });

  if (!automations.length) {
    logger.info("[fb-token-refresh] All Facebook tokens are fresh — nothing to refresh");
    return;
  }

  logger.info(`[fb-token-refresh] Refreshing ${automations.length} Facebook token(s)`);
  let refreshed = 0, failed = 0;

  for (const auto of automations) {
    try {
      // Exchange current long-lived user token for a new 60-day token
      const params = new URLSearchParams({
        grant_type:       "fb_exchange_token",
        client_id:        process.env.FB_APP_ID,
        client_secret:    process.env.FB_APP_SECRET,
        fb_exchange_token: auto.userToken,
      });
      const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
      const json = await resp.json();

      if (!json.access_token) {
        logger.warn(`[fb-token-refresh] "${auto.name}" (${auto._id}): token exchange failed — ${JSON.stringify(json.error || json)}`);
        failed++;
        continue;
      }

      const freshUserToken = json.access_token;
      const updates = {
        userToken:           freshUserToken,
        userTokenExpiresAt:  new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenRefreshedAt:    new Date(),
      };

      // Also refresh the page access token from the new user token
      if (auto.pageId) {
        try {
          const pageParams = new URLSearchParams({ access_token: freshUserToken, fields: "access_token" });
          const pageResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${auto.pageId}?${pageParams.toString()}`);
          const pageJson = await pageResp.json();
          if (pageJson.access_token) {
            updates.accessToken = pageJson.access_token;
            logger.info(`[fb-token-refresh] "${auto.name}": page token also refreshed`);
          }
        } catch (pe) {
          logger.warn(`[fb-token-refresh] "${auto.name}": page token refresh failed — ${pe.message}`);
        }
      }

      await Automation.findByIdAndUpdate(auto._id, updates);
      logger.info(`[fb-token-refresh] "${auto.name}" (${auto._id}): user token refreshed — expires ${updates.userTokenExpiresAt.toDateString()}`);
      refreshed++;
    } catch (err) {
      logger.error(`[fb-token-refresh] "${auto.name}" (${auto._id}): unexpected error — ${err.message}`);
      failed++;
    }
  }

  logger.info(`[fb-token-refresh] Done — ${refreshed} refreshed, ${failed} failed`);
}

// ── Daily 9 AM IST (UTC 03:30): follow-up reminders ─────────────────────────
cron.schedule("30 3 * * *", () => {
  runDailyReminder().catch((err) => logger.error(`Daily reminder error: ${err.message}`));
});

// ── Every minute: 10-min-before alert ───────────────────────────────────────
cron.schedule("* * * * *", () => {
  runUpcomingReminder().catch((err) => logger.error(`Upcoming reminder error: ${err.message}`));
});

// ── Daily 9 AM IST (UTC 03:30): tasks due today ──────────────────────────────
cron.schedule("30 3 * * *", () => {
  runTaskReminder().catch((err) => logger.error(`Task reminder error: ${err.message}`));
});

// ── Daily 2 AM IST (UTC 8:30 PM = 20:30): full DB backup via email ──────────
cron.schedule("30 20 * * *", () => {
  runBackup().catch((err) => logger.error(`[backup] cron failed: ${err.message}`));
});

// ── Daily 10 AM IST (UTC 04:30): Facebook token proactive refresh ─────────────
cron.schedule("30 4 * * *", () => {
  refreshFacebookTokens().catch((err) => logger.error(`[fb-token-refresh] cron failed: ${err.message}`));
});

// ── Every 5 minutes: pull new leads for OAuth-connected Google Ads accounts ───
// (webhook-mode Google connections don't need this — Google pushes to them directly)
cron.schedule("*/5 * * * *", () => {
  pollGoogleAdsLeads().catch((err) => logger.error(`[google-ads-poll] cron failed: ${err.message}`));
});

module.exports = { runDailyReminder, runUpcomingReminder, runTaskReminder, runBackup, refreshFacebookTokens };
