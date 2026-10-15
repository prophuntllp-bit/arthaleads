// Lead-level view of the Vistrow Voice integration, for the lead page.
// Live since 06c0327 (its Railway deploy was cancelled; redeployed 15 Oct 2026).
// Mounted at /api/integrations/vistrow-outbound/leads (before the admin-only
// owner controls, which never touch leads).
//
//   GET  /:id/status  any signed-in user of the org: the newest delivery for
//                     this lead (scheduled time / why no call) and whether
//                     "Call now via Vistrow" is available.
//   POST /:id/call    admin or manager, Enterprise plan, integration enabled:
//                     re-emits the lead to Vistrow with auto_call:true for the
//                     agent its source routes to. Refused (400) when no agent
//                     routes. Idempotent per minute per lead. Audited on the lead.

const express = require("express");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
const ProjectLead = require("../models/ProjectLead");
const OutboundIntegration = require("../models/OutboundIntegration");
const OutboundDelivery = require("../models/OutboundDelivery");
const { protect, authorize } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const logger = require("../config/logger");
const R = require("../services/vistrowOutbound/routing");
const { toConfig } = require("../services/vistrowOutbound/store.mongo");
const { notQueuedText, notRoutedText } = require("../services/vistrowOutbound/callReasons");
const { emitLeadCreated } = require("../utils/emitLeadCreated");

const router = express.Router();
router.use(protect);

const REQUEST_GAP_MS = 60 * 1000;
const ORIGIN = "manual-call";
// Lead.source -> routing source. Anything else cannot be routed to an agent.
const ROUTE_SOURCE = { Website: "website", Facebook: "facebook", WhatsApp: "whatsapp", Google: "google" };

const fail = (res, err, where) => {
  logger.error(`[vistrow-outbound] ${where} failed: ${err?.name || "Error"}${err?.code ? `:${err.code}` : ""}`);
  return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
};

const loadLead = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return null;
  return Lead.findOne({ _id: req.params.id, orgId: req.user.orgId, isDeleted: { $ne: true } }).lean();
};

// The facts routing is decided from, for a lead that already exists: its
// source, the page it came from, the ad behind its chat, and the project it was
// filed under (its project copy, or the project its WhatsApp hand-off named).
async function routingContext(lead) {
  const routeSource = ROUTE_SOURCE[lead.source] || "";
  let project;
  const pid = lead.vistrowEmit?.projectId;
  if (pid) project = { id: String(pid), name: lead.vistrowEmit.projectName || "" };
  if (!project && lead.phone) {
    const copy = await ProjectLead.findOne({ orgId: lead.orgId, phone: lead.phone, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).select("project").lean();
    if (copy?.project) {
      const p = await Project.findById(copy.project).select("name").lean();
      project = { id: String(copy.project), name: p?.name || "" };
    }
  }
  const adId = lead.campaignRef?.adId || "";
  return { origin: ORIGIN, routeSource, project, ...(adId ? { attribution: { ad_id: adId } } : {}) };
}

function deliveryView(d) {
  if (!d) return null;
  return {
    id: d._id, status: d.status, origin: d.origin, createdAt: d.createdAt, deliveredAt: d.deliveredAt,
    autoCall: d.autoCall, autoCallReason: d.autoCallReason, agentLabel: d.agentLabel,
    callQueued: d.callQueued, callReason: d.callReason,
    callReasonText: d.autoCall && d.callQueued === false ? notQueuedText(d.callReason) : (!d.autoCall && d.status !== "skipped" ? notRoutedText(d.autoCallReason) : ""),
    callQueuedUntil: d.callQueuedUntil || null,
    lastErrorCode: d.lastErrorCode || "",
  };
}

// GET /:id/status
router.get("/:id/status", async (req, res) => {
  try {
    const lead = await loadLead(req);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
    const [doc, last] = await Promise.all([
      OutboundIntegration.findOne({ orgId: req.user.orgId, provider: "vistrow" }).select("+secretEnc"),
      OutboundDelivery.findOne({ orgId: req.user.orgId, leadId: lead._id, isTest: false }).sort({ createdAt: -1 }).lean(),
    ]);
    const enabled = !!doc?.enabled;
    let canCall = false;
    let whyNot = "";
    if (enabled && lead.phone) {
      const ctx = await routingContext(lead);
      const decision = R.resolveRouting(toConfig(doc), R.routingInputsFrom(lead, ctx));
      canCall = decision.autoCall === true;
      if (!canCall) whyNot = notRoutedText(decision.reason);
    } else if (!enabled) whyNot = "Vistrow Voice calling is not switched on";
    else whyNot = "This lead has no phone number";
    res.json({ success: true, enabled, canCall, whyNot, lastDelivery: deliveryView(last) });
  } catch (err) { fail(res, err, "lead status"); }
});

// POST /:id/call
router.post("/:id/call", authorize("admin", "manager"), planGate("enterprise"), async (req, res) => {
  try {
    const lead = await loadLead(req);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
    if (!lead.phone) return res.status(400).json({ success: false, reason: "no_phone", message: "This lead has no phone number." });
    const doc = await OutboundIntegration.findOne({ orgId: req.user.orgId, provider: "vistrow" }).select("enabled").lean();
    if (!doc?.enabled) return res.status(400).json({ success: false, reason: "disabled", message: "Vistrow Voice calling is not switched on. Open Integrations." });

    // One request per lead per minute, whoever presses: the first one stands.
    const recent = await OutboundDelivery.findOne({
      orgId: req.user.orgId, leadId: lead._id, origin: ORIGIN, createdAt: { $gte: new Date(Date.now() - REQUEST_GAP_MS) },
    }).select("_id status").lean();
    if (recent) return res.json({ success: true, queued: false, reason: "recent_request", message: "A call was already requested in the last minute.", deliveryId: recent._id });

    const now = new Date();
    const ctx = { ...(await routingContext(lead)), callRequest: true, submittedAt: now, requestedBy: req.user.name || "" };
    const r = await emitLeadCreated(lead, ctx);
    if (!r || !r.queued) {
      const reason = r?.reason || "error";
      return res.status(400).json({ success: false, reason, message: reason === "error" ? "Could not request the call. Please try again." : notRoutedText(reason) });
    }
    await Lead.updateOne({ _id: lead._id }, {
      $push: { activities: {
        type: "vistrow_voice", description: `${req.user.name || "A team member"} asked Vistrow Voice to call this lead now`,
        performedBy: req.user._id, performedByName: req.user.name || "", meta: { deliveryId: String(r.deliveryId), eventId: r.eventId },
      } },
    });
    logger.info(`[vistrow-outbound] call requested lead=${lead._id} org=${req.user.orgId} by=${req.user._id} event=${r.eventId}`);
    res.json({ success: true, queued: true, deliveryId: r.deliveryId, eventId: r.eventId });
  } catch (err) { fail(res, err, "lead call"); }
});

module.exports = router;
