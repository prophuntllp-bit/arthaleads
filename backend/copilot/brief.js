// Artha morning brief (Phase 3): what to do first today, worked out by code
// from the CRM itself. No AI call, so it is instant, free and predictable.
//
// "Mine" here is the to-do rule, not the visibility rule: leads assigned to
// the person, project leads of projects they are on (or assigned to them), and
// WhatsApp chats assigned to them. Managers and admins also get a per-person
// team summary. Closed leads are left out. All days are IST.
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Project = require("../models/Project");
const User = require("../models/User");
const WaConversation = require("../models/WaConversation");
const { istTodayRange, istDateKey } = require("../utils/datetime");

const CLOSED = ["Closed Won", "Closed Lost"];
const NEW_WINDOW_DAYS = 7;
const MAX_ITEMS = 8;
const DAY = 86400000;

const oid = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

// "2:30 pm" in IST.
const timeIST = (d) => new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
// "Tue 13 Oct, 6:00 pm" in IST.
const shortIST = (d) => `${new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })}, ${timeIST(d)}`;
const daysAgo = (d, todayStart) => Math.max(1, Math.ceil((todayStart - new Date(d)) / DAY));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function projectScope(user) {
  const projects = await Project.find({ orgId: user.orgId, assignedTo: user._id }).select("_id").lean();
  return { orgId: user.orgId, isProspective: { $ne: true }, status: { $nin: CLOSED }, $or: [{ project: { $in: projects.map((p) => p._id) } }, { assignedTo: user._id }] };
}

const leadItem = (l, kind, tag, reason, at) => ({
  id: String(l._id), kind, name: l.name || "Unnamed lead", phone: l.phone || "",
  projectId: kind === "projectLead" ? String(l.project?._id || l.project || "") : undefined,
  projectName: kind === "projectLead" ? (l.project?.name || "") : undefined,
  status: l.status || null, tag, reason, at: at ? new Date(at).toISOString() : null,
});

async function buildBrief(user, now = new Date()) {
  const { start, end } = istTodayRange(now);
  const me = oid(user._id);
  const leadBase = { orgId: user.orgId, assignedTo: me, isArchived: { $ne: true }, isDeleted: { $ne: true }, status: { $nin: CLOSED } };
  const projBase = await projectScope(user);
  const newSince = new Date(now.getTime() - NEW_WINDOW_DAYS * DAY);
  const today = { $gte: start, $lte: end };
  // Project leads never record a first contact, and most arrive as imported
  // lists (source "Manual"): cold data, not someone waiting for a call. A
  // project lead is "new" when it came in by itself and has no remark or note.
  const projFresh = { ...projBase, status: { $in: ["", "New"] }, source: { $ne: "Manual" }, remark: { $in: ["", null] }, "notes.0": { $exists: false }, createdAt: { $gte: newSince } };
  const fields = "name phone status followUpDate followUp followUp2 siteVisitDate createdAt project";
  const projSelect = (q) => ProjectLead.find(q).select(fields).populate("project", "name");

  const [visits, pVisits, overdue, pOverdue, dueToday, pDueToday, fresh, pFresh, chats, counts] = await Promise.all([
    Lead.find({ ...leadBase, siteVisitDate: today, siteVisitDone: { $ne: true } }).select(fields).sort({ siteVisitDate: 1 }).limit(10).lean(),
    projSelect({ ...projBase, siteVisitDate: today, siteVisitDone: { $ne: true } }).sort({ siteVisitDate: 1 }).limit(10).lean(),
    Lead.find({ ...leadBase, followUpDate: { $lt: start } }).select(fields).sort({ followUpDate: -1 }).limit(10).lean(),
    projSelect({ ...projBase, followUp: { $lt: start } }).sort({ followUp: -1 }).limit(10).lean(),
    Lead.find({ ...leadBase, followUpDate: today }).select(fields).sort({ followUpDate: 1 }).limit(10).lean(),
    projSelect({ ...projBase, $and: [{ $or: [{ followUp: today }, { followUp2: today }] }] }).sort({ followUp: 1 }).limit(10).lean(),
    Lead.find({ ...leadBase, status: "New", firstContactedAt: null, createdAt: { $gte: newSince } }).select(fields).sort({ createdAt: -1 }).limit(10).lean(),
    projSelect(projFresh).sort({ createdAt: -1 }).limit(10).lean(),
    WaConversation.find({ orgId: user.orgId, assignedTo: me, unreadCount: { $gt: 0 }, status: { $ne: "resolved" } })
      .select("contactName contactPhone leadId unreadCount lastMessageAt lastMessagePreview").sort({ lastMessageAt: -1 }).limit(10).lean(),
    Promise.all([
      Lead.countDocuments({ ...leadBase, followUpDate: { $lt: start } }),
      ProjectLead.countDocuments({ ...projBase, followUp: { $lt: start } }),
      Lead.countDocuments({ ...leadBase, followUpDate: today }),
      ProjectLead.countDocuments({ ...projBase, $and: [{ $or: [{ followUp: today }, { followUp2: today }] }] }),
      Lead.countDocuments({ ...leadBase, status: "New", firstContactedAt: null, createdAt: { $gte: newSince } }),
      ProjectLead.countDocuments(projFresh),
      WaConversation.countDocuments({ orgId: user.orgId, assignedTo: me, unreadCount: { $gt: 0 }, status: { $ne: "resolved" } }),
    ]),
  ]);

  // Order is the advice: a visit today beats a waiting chat beats a missed
  // follow-up beats a brand-new lead beats a follow-up later today.
  const items = [];
  const seen = new Set();
  const add = (it) => { const k = `${it.kind}:${it.id}`; if (seen.has(k)) return; seen.add(k); items.push(it); };
  for (const l of visits) add(leadItem(l, "lead", "visit", `Site visit today at ${timeIST(l.siteVisitDate)}. Confirm they are coming.`, l.siteVisitDate));
  for (const l of pVisits) add(leadItem(l, "projectLead", "visit", `Site visit today at ${timeIST(l.siteVisitDate)}. Confirm they are coming.`, l.siteVisitDate));
  for (const c of chats) {
    if (c.leadId && seen.has(`lead:${c.leadId}`)) continue;
    add({ id: c.leadId ? String(c.leadId) : String(c._id), kind: c.leadId ? "lead" : "chat", conversationId: String(c._id),
      name: c.contactName || `+${c.contactPhone}`, phone: c.contactPhone || "", tag: "chat",
      reason: `${plural(c.unreadCount, "unread WhatsApp message")}, last at ${shortIST(c.lastMessageAt)}.`, at: c.lastMessageAt });
  }
  const od = [...overdue.map((l) => ({ l, kind: "lead", at: l.followUpDate })), ...pOverdue.map((l) => ({ l, kind: "projectLead", at: l.followUp }))]
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  for (const { l, kind, at } of od) add(leadItem(l, kind, "overdue", `Follow-up missed ${plural(daysAgo(at, start), "day")} ago (${shortIST(at)}).`, at));
  const nw = [...fresh.map((l) => ({ l, kind: "lead" })), ...pFresh.map((l) => ({ l, kind: "projectLead" }))]
    .sort((a, b) => new Date(b.l.createdAt) - new Date(a.l.createdAt));
  for (const { l, kind } of nw) {
    const hours = Math.max(1, Math.round((now - new Date(l.createdAt)) / 3600000));
    add(leadItem(l, kind, "new", `New lead, not contacted yet (came in ${hours < 24 ? plural(hours, "hour") : plural(Math.round(hours / 24), "day")} ago).`, l.createdAt));
  }
  const dt = [...dueToday.map((l) => ({ l, kind: "lead", at: l.followUpDate })), ...pDueToday.map((l) => ({ l, kind: "projectLead", at: [l.followUp, l.followUp2].find((d) => d && d >= start && d <= end) }))]
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  for (const { l, kind, at } of dt) add(leadItem(l, kind, "today", `Follow-up due today at ${timeIST(at)}.`, at));

  const [ovL, ovP, tdL, tdP, nwL, nwP, chatN] = counts;
  const brief = {
    date: istDateKey(now),
    counts: { visits: visits.length + pVisits.length, chats: chatN, overdue: ovL + ovP, today: tdL + tdP, fresh: nwL + nwP },
    items: items.slice(0, MAX_ITEMS),
    more: Math.max(0, items.length - MAX_ITEMS),
    team: null,
  };
  if (user.role === "admin" || user.role === "manager") brief.team = await teamSummary(user, { start, end, newSince });
  return brief;
}

// Per person, for managers: who has missed follow-ups or untouched new leads.
async function teamSummary(user, { start, end, newSince }) {
  const base = { orgId: oid(user.orgId), isArchived: { $ne: true }, isDeleted: { $ne: true }, status: { $nin: CLOSED }, assignedTo: { $ne: null } };
  const rows = await Lead.aggregate([
    { $match: base },
    { $group: {
      _id: "$assignedTo",
      overdue: { $sum: { $cond: [{ $and: [{ $gt: ["$followUpDate", null] }, { $lt: ["$followUpDate", start] }] }, 1, 0] } },
      today: { $sum: { $cond: [{ $and: [{ $gte: ["$followUpDate", start] }, { $lte: ["$followUpDate", end] }] }, 1, 0] } },
      fresh: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "New"] }, { $eq: [{ $ifNull: ["$firstContactedAt", null] }, null] }, { $gte: ["$createdAt", newSince] }] }, 1, 0] } },
      visits: { $sum: { $cond: [{ $and: [{ $gte: ["$siteVisitDate", start] }, { $lte: ["$siteVisitDate", end] }, { $ne: ["$siteVisitDone", true] }] }, 1, 0] } },
    } },
  ]);
  const users = await User.find({ orgId: user.orgId, isActive: true }).select("name role").lean();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return users
    .map((u) => { const r = byId.get(String(u._id)) || {}; return { id: String(u._id), name: u.name, overdue: r.overdue || 0, today: r.today || 0, fresh: r.fresh || 0, visits: r.visits || 0 }; })
    .filter((r) => r.overdue || r.today || r.fresh || r.visits)
    .sort((a, b) => (b.overdue + b.fresh) - (a.overdue + a.fresh) || a.name.localeCompare(b.name))
    .slice(0, 12);
}

// What the model gets when someone asks "who should I call first": no phone
// numbers, ids for linking only.
function briefForModel(brief) {
  return {
    date: brief.date,
    counts: brief.counts,
    callFirst: brief.items.map(({ id, kind, name, tag, reason, status, projectName }) => ({ id, kind, name, tag, reason, status, project: projectName || undefined })),
    more: brief.more,
    team: brief.team,
  };
}

module.exports = { buildBrief, briefForModel };
