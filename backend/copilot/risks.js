// Artha risk alerts (Phase 3): deals quietly slipping, found by code from the
// CRM itself (no AI call). Shown in the morning brief under "Needs attention".
//
// Rules (open leads only; "contact" means a call, note, status change,
// follow-up or site-visit entry by a person, or a WhatsApp reply from the team):
//   hot_cold       Hot or High priority, no contact for 2+ days
//   visit_silent   site visit done, no contact for 3+ days since
//   visit_missed   site visit date has passed (last 14 days), not marked done
//   new_waiting    new lead, nobody has contacted it for 24+ hours
//   chat_closing   customer wrote on WhatsApp, no reply yet, and the 24-hour
//                  reply window closes within 6 hours
//   unassigned_waiting  (managers) new leads with no owner and no contact,
//                  shown as one line with the count, not one row each
// Agents get their own leads and chats; managers and admins get the whole
// company's, each with the owner's name. All dates are IST.
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");

const CLOSED = ["Closed Won", "Closed Lost"];
const TOUCH = ["status_changed", "note_added", "follow_up_set", "site_visit", "called", "emailed"];
const HOUR = 3600e3, DAY = 24 * HOUR;
const MAX_RISKS = 8;
const SEVERITY = { chat_closing: 0, unassigned_waiting: 1, visit_missed: 2, hot_cold: 3, visit_silent: 4, new_waiting: 5 };

const oid = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));
const dateIST = (d) => new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const days = (ms) => Math.max(1, Math.floor(ms / DAY));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Latest time the team replied on WhatsApp, per lead id.
async function lastWhatsAppReply(orgId, leadIds) {
  if (!leadIds.length) return new Map();
  const convs = await WaConversation.find({ orgId, leadId: { $in: leadIds } }).select("leadId").lean();
  if (!convs.length) return new Map();
  const rows = await WaMessage.aggregate([
    { $match: { conversationId: { $in: convs.map((c) => c._id) }, direction: "outbound", sender: "agent" } },
    { $group: { _id: "$conversationId", at: { $max: "$timestamp" } } },
  ]);
  const leadOf = new Map(convs.map((c) => [String(c._id), String(c.leadId)]));
  const out = new Map();
  for (const r of rows) {
    const lid = leadOf.get(String(r._id));
    if (lid && (!out.has(lid) || r.at > out.get(lid))) out.set(lid, r.at);
  }
  return out;
}

async function leadRisks(user, now, team) {
  const t = now.getTime();
  const base = { orgId: oid(user.orgId), isArchived: { $ne: true }, isDeleted: { $ne: true }, status: { $nin: CLOSED } };
  if (!team) base.assignedTo = oid(user._id);
  const candidates = await Lead.aggregate([
    { $match: { ...base, $or: [
      { priority: { $in: ["Hot", "High"] } },
      { siteVisitDone: true, siteVisitDate: { $gte: new Date(t - 30 * DAY) } },
      { siteVisitDone: { $ne: true }, siteVisitDate: { $gte: new Date(t - 14 * DAY), $lt: new Date(t - 2 * HOUR) } },
      { status: "New", firstContactedAt: null, createdAt: { $gte: new Date(t - 14 * DAY), $lt: new Date(t - DAY) } },
    ] } },
    { $limit: 1500 },
    { $project: {
      name: 1, phone: 1, priority: 1, status: 1, booking: 1, siteVisitDate: 1, siteVisitDone: 1, firstContactedAt: 1, createdAt: 1, assignedTo: 1, assignedToName: 1,
      lastTouch: { $max: [
        { $max: { $map: { input: { $filter: { input: { $ifNull: ["$activities", []] }, cond: { $and: [{ $in: ["$$this.type", TOUCH] }, { $ne: [{ $ifNull: ["$$this.performedBy", null] }, null] }] } } }, in: "$$this.createdAt" } } },
        { $max: { $map: { input: { $filter: { input: { $ifNull: ["$notes", []] }, cond: { $ne: [{ $ifNull: ["$$this.addedBy", null] }, null] } } }, in: "$$this.createdAt" } } },
      ] },
    } },
  ]);
  const replies = await lastWhatsAppReply(user.orgId, candidates.map((l) => l._id));

  const risks = [];
  for (const l of candidates) {
    const wa = replies.get(String(l._id));
    const touched = [l.lastTouch, wa].filter(Boolean).map((d) => new Date(d).getTime());
    const last = touched.length ? Math.max(...touched) : null;
    const since = (from) => t - Math.max(from, last || 0);
    const r = { id: String(l._id), kind: "lead", name: l.name || "Unnamed lead", phone: l.phone || "", owner: team ? (l.assignedToName || "Unassigned") : undefined, ownerId: team && l.assignedTo ? String(l.assignedTo) : undefined };
    const visitAt = l.siteVisitDate ? new Date(l.siteVisitDate).getTime() : null;
    if (visitAt && !l.siteVisitDone && l.booking !== "Site Visit Done" && visitAt < t - 2 * HOUR && visitAt >= t - 14 * DAY && !(last && last > visitAt)) {
      risks.push({ ...r, type: "visit_missed", reason: `Site visit was due ${dateIST(visitAt)}. Not marked done or moved since.`, at: visitAt });
    } else if (visitAt && (l.siteVisitDone || l.booking === "Site Visit Done") && since(visitAt) >= 3 * DAY) {
      risks.push({ ...r, type: "visit_silent", reason: `Visited ${dateIST(visitAt)}, no contact for ${plural(days(since(visitAt)), "day")}. Ask how it went.`, at: visitAt });
    } else if (["Hot", "High"].includes(l.priority) && since(new Date(l.createdAt).getTime()) >= 2 * DAY) {
      risks.push({ ...r, type: "hot_cold", reason: `${l.priority} lead, no contact for ${plural(days(since(new Date(l.createdAt).getTime())), "day")}.`, at: last || l.createdAt });
    } else if (l.status === "New" && !l.firstContactedAt && !last && t - new Date(l.createdAt).getTime() >= DAY) {
      risks.push({ ...r, type: "new_waiting", reason: `New lead waiting ${plural(days(t - new Date(l.createdAt).getTime()), "day")} without a call.`, at: l.createdAt });
    }
  }
  return risks;
}

// Chats where the customer is waiting and WhatsApp will soon allow only a template.
async function chatRisks(user, now, team) {
  const t = now.getTime();
  const q = { orgId: user.orgId, status: { $ne: "resolved" }, lastMessageAt: { $gte: new Date(t - DAY) } };
  if (!team) q.assignedTo = oid(user._id);
  const convs = await WaConversation.find(q).select("contactName contactPhone leadId assignedToName").limit(300).lean();
  if (!convs.length) return [];
  const rows = await WaMessage.aggregate([
    { $match: { conversationId: { $in: convs.map((c) => c._id) }, timestamp: { $gte: new Date(t - DAY) } } },
    { $group: {
      _id: "$conversationId",
      lastIn: { $max: { $cond: [{ $eq: ["$direction", "inbound"] }, "$timestamp", null] } },
      lastOut: { $max: { $cond: [{ $and: [{ $eq: ["$direction", "outbound"] }, { $eq: ["$sender", "agent"] }] }, "$timestamp", null] } },
    } },
  ]);
  const byId = new Map(convs.map((c) => [String(c._id), c]));
  const out = [];
  for (const r of rows) {
    if (!r.lastIn) continue;
    const inAt = new Date(r.lastIn).getTime();
    const left = inAt + DAY - t;
    if (left <= 0 || left > 6 * HOUR) continue;               // window not closing soon
    if (r.lastOut && new Date(r.lastOut).getTime() > inAt) continue; // already answered
    const c = byId.get(String(r._id));
    const hrs = Math.max(1, Math.floor(left / HOUR));
    out.push({
      id: c.leadId ? String(c.leadId) : String(c._id), kind: c.leadId ? "lead" : "chat", conversationId: String(c._id),
      name: c.contactName || `+${c.contactPhone}`, phone: c.contactPhone || "", owner: team ? (c.assignedToName || "Unassigned") : undefined,
      type: "chat_closing", reason: `Waiting for a WhatsApp reply. The reply window closes in ${hrs < 2 ? "under 2 hours" : `${hrs} hours`}, then only a template can be sent.`, at: inAt,
    });
  }
  return out;
}

async function buildRisks(user, now = new Date()) {
  const team = user.role === "admin" || user.role === "manager";
  const [found, chats] = await Promise.all([leadRisks(user, now, team), chatRisks(user, now, team)]);
  // Unowned new leads are a team problem, not a list of names: one line.
  const unowned = team ? found.filter((r) => r.type === "new_waiting" && !r.ownerId) : [];
  const leads = found.filter((r) => !unowned.includes(r));
  if (unowned.length) {
    const oldest = Math.max(...unowned.map((r) => now.getTime() - new Date(r.at).getTime()));
    leads.push({ id: "unassigned", kind: "summary", name: "Unassigned new leads", phone: "", type: "unassigned_waiting", count: unowned.length,
      reason: `${plural(unowned.length, "new lead")} from the last 14 days ${unowned.length === 1 ? "has" : "have"} no owner and no call yet (oldest ${plural(days(oldest), "day")}). Assign them from Leads.`, at: now });
  }
  const seen = new Set();
  const all = [...chats, ...leads]
    .filter((r) => { const k = `${r.kind}:${r.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => SEVERITY[a.type] - SEVERITY[b.type] || new Date(a.at) - new Date(b.at));
  const counts = {};
  for (const r of all) counts[r.type] = (counts[r.type] || 0) + 1;
  // Per person, for the team table.
  const byOwner = {};
  if (team) for (const r of all) if (r.ownerId) byOwner[r.ownerId] = (byOwner[r.ownerId] || 0) + 1;
  return { total: all.length, counts, list: all.slice(0, MAX_RISKS).map(({ ownerId, ...r }) => ({ ...r, at: r.at ? new Date(r.at).toISOString() : null })), byOwner };
}

module.exports = { buildRisks, TOUCH };
