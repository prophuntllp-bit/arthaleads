// Owner decision 17 Oct 2026: when Vistrow Voice queues the first automatic
// call for a WhatsApp lead, the WhatsApp assistant tells the customer a call is
// coming (Vistrow waits ~60 s before dialling a WhatsApp lead).
//
//   * Only for the WhatsApp hand-off (origin whatsapp-*): never "Call now"
//     (origin manual-call) and never Vistrow's own follow-up calls, which do
//     not pass through the outbound queue.
//   * Only inside WhatsApp's 24 h session window, on a connected org, for a
//     chat that is not marked "Not a buyer". Otherwise nothing, logged.
//   * Once per delivery: claimed on OutboundDelivery.waHeadsUpAt before sending.
//   * Sent through the assistant's own plain-text path (sendBotNotice in
//     routes/whatsappRoutes.js), so it is billed and stored in the Inbox like
//     any bot message. Never throws.

const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");
const WaAgent = require("../models/WaAgent");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const OutboundDelivery = require("../models/OutboundDelivery");
const logger = require("../config/logger");

const WINDOW_MS = 24 * 60 * 60 * 1000;
const SOON_MS = 120 * 1000;
const TZ = "Asia/Kolkata";

const istDay = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const istTime = (d) => d.toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();

// "aaj 4:30 pm", "kal 10:00 am", or "19 Oct, 10:00 am" (IST).
function whenText(at, now) {
  const day = istDay(at);
  if (day === istDay(now)) return `aaj ${istTime(at)}`;
  if (day === istDay(new Date(now.getTime() + 86400e3))) return `kal ${istTime(at)}`;
  return `${at.toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" })}, ${istTime(at)}`;
}

function headsUpText(queuedUntil, now = new Date()) {
  const at = queuedUntil ? new Date(queuedUntil) : null;
  if (!at || Number.isNaN(at.getTime()) || at.getTime() <= now.getTime() + SOON_MS) {
    return "Dhanyavaad! 🙏 Hamari property advisor aapko lagbhag 1 minute mein call karengi, taaki aapki requirement achhe se samajh sakein.";
  }
  return `Dhanyavaad! 🙏 Hamari property advisor aapko ${whenText(at, now)} call karengi.`;
}

async function sendCallHeadsUp(job, { queuedUntil = null, now = new Date() } = {}) {
  const tag = `[vistrow-headsup] event=${job?.eventId} lead=${job?.leadId}`;
  const skip = (why) => { logger.info(`${tag} not sent: ${why}`); return { sent: false, reason: why }; };
  try {
    if (!String(job?.origin || "").startsWith("whatsapp-") || !job.leadId || !job._id) return skip("not a WhatsApp hand-off");
    const [org, conv, lead] = await Promise.all([
      Organization.findById(job.orgId).lean(),
      WaConversation.findOne({ orgId: job.orgId, leadId: job.leadId }).sort({ createdAt: -1 }).lean(),
      Lead.findById(job.leadId).select("tags").lean(),
    ]);
    if (!org?.whatsapp?.enabled || !org.whatsapp.apiKey) return skip("WhatsApp is not connected");
    if (!conv) return skip("no WhatsApp chat for this lead");
    if ((lead?.tags || []).includes("Not a buyer")) return skip("chat is marked Not a buyer");
    const lastIn = await WaMessage.findOne({ conversationId: conv._id, direction: "inbound" }).sort({ timestamp: -1 }).select("timestamp").lean();
    if (!lastIn || now.getTime() - new Date(lastIn.timestamp).getTime() > WINDOW_MS) return skip("no customer message in the last 24 hours");

    // The claim: only the first queued answer for this delivery goes on.
    const claim = await OutboundDelivery.updateOne({ _id: job._id, waHeadsUpAt: null }, { $set: { waHeadsUpAt: now } });
    if (!claim.modifiedCount) return skip("already sent for this delivery");

    const agent = conv.agentId ? await WaAgent.findById(conv.agentId).select("name").lean() : null;
    const { _sendBotNotice } = require("../routes/whatsappRoutes");
    const ok = await _sendBotNotice(org, conv, headsUpText(queuedUntil, now), agent?.name || undefined);
    if (!ok) return skip("send failed (see the WhatsApp Bot log)");
    logger.info(`${tag} sent`);
    return { sent: true };
  } catch (err) {
    logger.error(`${tag} failed: ${err?.name || "Error"}`);
    return { sent: false, reason: "error" };
  }
}

module.exports = { sendCallHeadsUp, headsUpText };
