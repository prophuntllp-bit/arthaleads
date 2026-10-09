// Production wiring for the Vistrow outbound integration.
//
// Creation paths call enqueueLeadCreated(lead, ctx) AFTER a lead is committed.
// It never throws and never waits on the network, so it is safe to call without
// await from a webhook handler that must answer quickly:
//
//     enqueueLeadCreated(lead, { origin: "webhook-website", ... });
//
// Disabled unless the owner has explicitly enabled it for the organisation; an
// org that has not is a single indexed read and nothing else.

const logger = require("../../config/logger");
const { createService } = require("./service");
const { mongoStore } = require("./store.mongo");

async function notifyAdmins(cfg, { code }) {
  const User = require("../../models/User");
  const { sendPushToUser } = require("../../utils/push");
  const admins = await User.find({ orgId: cfg.orgId, role: "admin", isActive: { $ne: false } }).select("_id").lean();
  const declined = code === "CALL_NOT_QUEUED";
  const payload = {
    type: "integration_alert",
    title: declined ? "Vistrow did not queue a call" : "Vistrow auto-call is failing",
    body: declined
      ? "Vistrow received a new lead but did not place the call (check the selected agent and its caller number). Open Integrations."
      : `A new lead could not be sent to Vistrow Voice (${code}). Open Integrations to check.`,
    data: { url: "/integrations" },
  };
  await Promise.all(admins.map((a) => sendPushToUser(a._id, payload).catch(() => {})));
}

const service = createService({ store: mongoStore, logger, notifyFailure: notifyAdmins });

let timer = null;
function startWorker({ intervalMs = 5000 } = {}) {
  if (timer || process.env.NODE_ENV === "test") return false;
  let running = false;
  timer = setInterval(async () => {
    if (running) return; // a slow tick must not stack up behind itself
    running = true;
    try { await service.processDue({ limit: 25 }); }
    catch (err) { logger.error(`[vistrow-outbound] worker tick failed: ${err?.name || "Error"}`); }
    finally { running = false; }
  }, intervalMs);
  timer.unref?.();
  return true;
}

function stopWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  service,
  enqueueLeadCreated: (lead, ctx) => service.enqueueLeadCreated(lead, ctx),
  enqueueLeadsCreated: (leads, ctx) => service.enqueueLeadsCreated(leads, ctx),
  startWorker,
  stopWorker,
};
