const { objectId, resolveLead, Joi } = require("./_shared");
const { AppError } = require("../middlewares/errorHandler");
const leadService = require("../services/leadService");
const User = require("../models/User");

module.exports = {
  id: "assign_lead",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline", "/dashboard", "/"],
  // Mirrors POST /api/leads/:id/assign, which is authorize("admin","manager").
  // leadService.assign refuses agents on its own too, so this is defence in
  // depth rather than the only check.
  roles: ["admin", "manager"],
  params: Joi.object({
    leadId: objectId.required(),
    agentId: objectId.required(),
  }),
  describe: {
    summary: "Assign a lead to an agent",
    params: "{ leadId, agentId } - only propose when the agentId is known from context",
  },

  async preview({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (isProject) throw new AppError("Project leads follow the project's team and have no individual owner.", 400);
    const agent = await User.findOne({ _id: params.agentId, orgId: user.orgId }).select("name").lean();
    if (!agent) throw new AppError("Agent not found.", 404);
    // Offer the org's team as options: picking the wrong colleague is the
    // most likely thing for the model to get wrong here, and correcting it in
    // place beats rephrasing the question.
    const team = await User.find({ orgId: user.orgId, isActive: true })
      .select("name").sort({ name: 1 }).limit(50).lean();

    return {
      subject: doc.name,
      fields: [{
        label: "Assigned", param: "agentId",
        from: doc.assignedToName || "(unassigned)", to: agent.name,
        editor: {
          type: "select",
          value: String(params.agentId),
          options: team.map((t) => ({ value: String(t._id), label: t.name })),
        },
      }],
    };
  },

  async captureBefore({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    return { leadId: params.leadId, assignedTo: doc.assignedTo ? String(doc.assignedTo) : null };
  },

  async undo({ before, user }) {
    // assign() requires an agent, so an originally-unassigned lead is put back
    // through update() with an explicit null instead.
    if (before.assignedTo) await leadService.assign(before.leadId, before.assignedTo, user);
    else                   await leadService.update(before.leadId, { assignedTo: null }, user);
    return { message: before.assignedTo ? "Assignment put back." : "Lead unassigned again." };
  },

  async execute({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (isProject) {
      throw new AppError("Project leads follow the project's team. Change the project's assignees instead.", 400);
    }
    // Reads the agent's name from the user record rather than trusting the
    // client, writes the timeline entry, and notifies the new owner.
    const updated = await leadService.assign(params.leadId, params.agentId, user);
    return {
      message: `${doc.name} assigned to ${updated.assignedToName || "the agent"}.`,
      data: { leadId: params.leadId, agentId: params.agentId },
    };
  },
};
