// What a Vistrow Voice call result does to an EXISTING lead's details, and the
// brochure request (16 Oct 2026). Called from POST /webhook/lead.
//
// Details: the same rules as the WhatsApp chat reader (utils/leadFieldFill.js).
// A field the caller stated is written only while the lead's field is empty; a
// different value from one already on the lead becomes an Artha suggestion
// (lead.arthaSuggest, marked as from the call) and a "Not changed" note line.
//
// Brochure: the caller asked for it (crm_outcome.brochure_requested === true).
// Nothing is sent to the buyer (owner decision 16 Oct 2026); the team gets a
// task due now (the lead's assignee, else every active admin), a push and an
// activity. Claimed atomically on the call's own voiceCalls entry, so a re-sent
// webhook, or two arriving together, never creates a second task.

const Lead = require("../models/Lead");
const Task = require("../models/Task");
const User = require("../models/User");
const Project = require("../models/Project");
const logger = require("../config/logger");
const { sendPushToUser } = require("./push");
const { planFieldFill, suggestionsFrom, sameValue, describeFields, LABEL, showValue } = require("./leadFieldFill");

const BY = "Vistrow Voice";
const DETAIL_FIELDS = "propertyType purpose bhk preferredLocation budget arthaSuggest source vistrowEmit";

// The property type the CRM may itself have guessed for this lead: only the
// WhatsApp reader guesses one (from the chat's project). The project a
// WhatsApp lead was handed to Vistrow with is the closest stored record of it.
async function guessedProjectType(lead) {
  if (lead.source !== "WhatsApp" || !lead.vistrowEmit?.projectId) return null;
  const p = await Project.findById(lead.vistrowEmit.projectId).select("propertyType").lean();
  return p?.propertyType && p.propertyType !== "N/A" ? p.propertyType : null;
}

/**
 * Fill empty details on an existing lead from the call. Idempotent: a re-send
 * finds the fields already filled and changes nothing.
 * @returns {Promise<{ filled: object, suggested: object, noteLines: string[] }>}
 */
async function applyCallDetails(leadId, mapped) {
  const none = { filled: {}, suggested: {}, noteLines: [] };
  if (!mapped || !Object.keys(mapped).length) return none;
  const lead = await Lead.findById(leadId).select(DETAIL_FIELDS).lean();
  if (!lead) return none;
  const setOps = planFieldFill(lead, mapped, { projectType: await guessedProjectType(lead) });
  const suggest = suggestionsFrom(lead, mapped, setOps);
  // Already suggested with the same value: nothing new to say.
  for (const k of Object.keys(suggest)) {
    const pending = lead.arthaSuggest?.fields?.[k];
    if (pending !== undefined && sameValue(suggest[k], pending)) delete suggest[k];
  }
  if (!Object.keys(setOps).length && !Object.keys(suggest).length) return none;

  const $set = { ...setOps };
  for (const [k, v] of Object.entries(suggest)) {
    $set[`arthaSuggest.fields.${k}`] = v;
    $set[`arthaSuggest.from.${k}`] = "vistrow_voice";
  }
  if (Object.keys(suggest).length) $set["arthaSuggest.at"] = new Date();
  const update = { $set };
  const noteLines = [];
  if (Object.keys(setOps).length) {
    const description = `Lead details updated from Vistrow Voice call: ${describeFields(setOps)}`;
    update.$push = { activities: { type: "vistrow_voice", description, performedByName: BY, meta: { fields: Object.keys(setOps) } } };
    noteLines.push(`Filled on the lead: ${describeFields(setOps)}`);
  }
  if (Object.keys(suggest).length) {
    noteLines.push(`Not changed (already set on the lead): ${Object.keys(suggest).map((k) => `${LABEL[k]} ${showValue(k, suggest[k])} (lead has ${showValue(k, lead[k])})`).join(", ")}`);
  }
  await Lead.updateOne({ _id: leadId }, update);
  return { filled: setOps, suggested: suggest, noteLines };
}

/**
 * The caller asked for the brochure on call `callId`. Creates the team's
 * task(s) once per (lead, call). Never throws; failures are logged on the lead.
 * @returns {Promise<{ created: number, skipped?: string }>}
 */
async function notifyBrochureRequest({ orgId, leadId, callId, projectName = "" }) {
  // The claim: only the delivery that sets brochureRequestedAt goes on.
  const claim = await Lead.updateOne(
    { _id: leadId, voiceCalls: { $elemMatch: { externalCallId: callId, brochureRequestedAt: { $exists: false } } } },
    { $set: { "voiceCalls.$.brochureRequestedAt": new Date() } }
  );
  if (!claim.modifiedCount) return { created: 0, skipped: "already handled" };

  try {
    const lead = await Lead.findById(leadId).select("name assignedTo").lean();
    let people = [];
    if (lead?.assignedTo) {
      const u = await User.findOne({ _id: lead.assignedTo, orgId, isActive: { $ne: false } }).select("name").lean();
      if (u) people = [u];
    }
    if (!people.length) people = await User.find({ orgId, role: "admin", isActive: { $ne: false } }).select("name").lean();
    if (!people.length) throw new Error("no assignee and no active admin to give the task to");

    const project = String(projectName || "").trim().slice(0, 100);
    const title = "Send brochure (asked on Vistrow Voice call)";
    const description = `${lead?.name || "The caller"} asked for the brochure${project ? ` of ${project}` : ""} on a Vistrow Voice call. The AI agent said it will be sent on WhatsApp after the call.`;
    const now = new Date();
    for (const p of people) {
      const task = await Task.create({
        orgId, title, description, priority: "high", dueDate: now,
        assignedTo: p._id, assignedToName: p.name || "",
        // Task.assignedBy is required and must be a user; a system task is
        // recorded as the assignee's own, signed "Vistrow Voice".
        assignedBy: p._id, assignedByName: BY,
        lead: leadId, leadName: lead?.name || "",
      });
      sendPushToUser(p._id, {
        type: "task_assigned",
        title: "Send brochure",
        body: `${lead?.name || "A caller"} asked for the brochure on a Vistrow Voice call`,
        data: { url: "/tasks", taskId: String(task._id), leadId: String(leadId) },
      }).catch(() => {});
    }
    const names = people.map((p) => p.name).filter(Boolean).join(", ");
    await Lead.updateOne({ _id: leadId }, { $push: { activities: {
      type: "vistrow_voice",
      description: `Caller asked for the brochure on the Vistrow Voice call${project ? ` (${project})` : ""}. Task created for ${names || "the team"}.`,
      performedByName: BY, meta: { callId, brochureRequested: true, taskCount: people.length },
    } } });
    return { created: people.length };
  } catch (err) {
    logger.warn(`[vistrow brochure] lead ${leadId} call ${callId}: ${err.message}`);
    // Release the claim so a re-send can try again, and say what happened.
    await Lead.updateOne(
      { _id: leadId, "voiceCalls.externalCallId": callId },
      {
        $unset: { "voiceCalls.$.brochureRequestedAt": "" },
        $push: { activities: { type: "vistrow_voice", description: `Caller asked for the brochure on the Vistrow Voice call, but no task could be created: ${err.message}`, performedByName: BY, meta: { callId, brochureRequested: true, error: err.message } } },
      }
    ).catch(() => {});
    return { created: 0, skipped: err.message };
  }
}

module.exports = { applyCallDetails, notifyBrochureRequest };
