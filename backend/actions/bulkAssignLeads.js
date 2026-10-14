// "Move Rahul's untouched leads to Arjun": one reviewable card for up to 50
// leads, instead of one card per lead. Managers and admins only, like the
// Leads page bulk assign it goes through.
const { objectId, Joi } = require("./_shared");
const Lead = require("../models/Lead");
const User = require("../models/User");
const leadService = require("../services/leadService");
const { sendPushToUser } = require("../utils/push");
const { AppError } = require("../middlewares/errorHandler");

const MAX_RECORDS = 50;

module.exports = {
  id: "bulk_assign_leads",
  v2Only: true,
  scopeLabel: "Leads",
  pages: "*",
  roles: ["admin", "manager"],
  params: Joi.object({
    leadIds: Joi.array().items(objectId).min(1).max(MAX_RECORDS).required(),
    agentId: objectId.required(),
  }),
  describe: {
    summary: "Assign several leads to one team member at once",
    params: `{ leadIds: [...], agentId } - at most ${MAX_RECORDS} leads`,
    when: "Only with lead ids from earlier results and an agent id from list_team.",
  },

  async preview({ params, user }) {
    const [agent, leads] = await Promise.all([
      User.findOne({ _id: params.agentId, orgId: user.orgId, isActive: true }).select("name").lean(),
      Lead.find({ _id: { $in: params.leadIds }, orgId: user.orgId, isDeleted: { $ne: true } }).select("name assignedToName assignedTo").limit(MAX_RECORDS).lean(),
    ]);
    if (!agent) throw new AppError("That team member was not found.", 404);
    const moving = leads.filter((l) => String(l.assignedTo || "") !== String(agent._id));
    // assignedToName is not always filled in (imports, older records); the owner's
    // own name is what the person approving needs to see.
    const ownerIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean).map(String))];
    const owners = new Map((await User.find({ _id: { $in: ownerIds }, orgId: user.orgId }).select("name").lean()).map((u) => [String(u._id), u.name]));
    return {
      subject: `${moving.length} lead${moving.length === 1 ? "" : "s"} to ${agent.name}`,
      rows: leads.map((l) => ({ id: String(l._id), name: l.name, from: (l.assignedTo && owners.get(String(l.assignedTo))) || l.assignedToName || "Unassigned", skip: String(l.assignedTo || "") === String(agent._id) ? `Already with ${agent.name}` : null })),
      fields: [{ label: "Assign to", param: null, from: null, to: agent.name }],
    };
  },

  async captureBefore({ params, user }) {
    const rows = await Lead.find({ _id: { $in: params.leadIds }, orgId: user.orgId }).select("assignedTo assignedToName").limit(MAX_RECORDS).lean();
    return { owners: rows.map((r) => ({ id: String(r._id), assignedTo: r.assignedTo ? String(r.assignedTo) : null, assignedToName: r.assignedToName || "" })) };
  },

  async execute({ params, user }) {
    const { modifiedCount, agent } = await leadService.bulkAssign(params.leadIds, params.agentId, user);
    if (modifiedCount) {
      Promise.resolve(sendPushToUser(agent._id, { type: "lead_assigned", title: "Leads assigned to you", body: `${user.name} assigned you ${modifiedCount} lead${modifiedCount === 1 ? "" : "s"}`, data: { url: "/leads" } })).catch(() => {});
    }
    return { message: `Assigned ${modifiedCount} lead${modifiedCount === 1 ? "" : "s"} to ${agent.name}.`, data: { count: modifiedCount } };
  },

  async undo({ before, user }) {
    let restored = 0;
    for (const o of before.owners || []) {
      const r = await Lead.updateOne({ _id: o.id, orgId: user.orgId }, { $set: { assignedTo: o.assignedTo, assignedToName: o.assignedToName } });
      restored += r.modifiedCount;
    }
    return { message: `Put ${restored} lead${restored === 1 ? "" : "s"} back with their previous owners.` };
  },
};
