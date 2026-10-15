// What Vistrow said about a call we asked for, written on the lead itself so a
// salesperson opening the lead sees why nobody was called, or when the call is
// scheduled (calling window closed). Called from services/vistrowOutbound
// (index.js onCallResult) after each delivered auto_call:true event.

const Lead = require("../models/Lead");
const { fmtIST } = require("../services/vistrowOutbound/callReasons");

const BY = "Vistrow Voice";

function callResultActivity({ queued, reason, reasonText, queuedUntil, deliveryId, agentLabel } = {}) {
  const meta = { queued: !!queued, reason: reason || "", deliveryId: deliveryId ? String(deliveryId) : "", agentLabel: agentLabel || "" };
  if (queued) {
    const at = queuedUntil ? new Date(queuedUntil) : null;
    if (at && !Number.isNaN(at.getTime())) {
      return { type: "vistrow_voice", description: `Vistrow Voice call scheduled for ${fmtIST(at)}`, performedByName: BY, meta: { ...meta, queuedUntil: at.toISOString() } };
    }
    return { type: "vistrow_voice", description: "Vistrow Voice is calling this lead now", performedByName: BY, meta };
  }
  return { type: "vistrow_voice", description: `Vistrow Voice did not call: ${reasonText || "the call was not queued"}`, performedByName: BY, meta };
}

async function recordCallResult(job, result) {
  if (!job?.leadId || !job?.orgId) return false;
  const activity = callResultActivity({ ...result, deliveryId: job._id, agentLabel: job.agentLabel });
  const r = await Lead.updateOne({ _id: job.leadId, orgId: job.orgId }, { $push: { activities: activity } });
  return r.modifiedCount === 1;
}

module.exports = { recordCallResult, callResultActivity };
