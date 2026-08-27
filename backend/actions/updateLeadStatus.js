const { objectId, resolveLead, Joi } = require("./_shared");
const { STATUS } = require("../constants/leadOptions");
const leadService = require("../services/leadService");
const projectService = require("../services/projectService");

module.exports = {
  id: "update_lead_status",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline", "/dashboard", "/followups", "/projects", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    status: Joi.string().valid(...STATUS).required(),
  }),
  describe: {
    summary: "Change a lead's pipeline status",
    params: `{ leadId, status } - status must be one of: ${STATUS.join(", ")}`,
  },

  async preview({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    return {
      subject: doc.name,
      fields: [{
        label: "Status", param: "status",
        from: doc.status || "(none)", to: params.status,
        editor: { type: "select", options: STATUS },
      }],
    };
  },

  async captureBefore({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    return { leadId: params.leadId, status: doc.status || "" };
  },

  async undo({ before, user }) {
    const { isProject } = await resolveLead(before.leadId, user);
    if (isProject) await projectService.updateLeadFields(before.leadId, { status: before.status }, user);
    else           await leadService.update(before.leadId, { status: before.status }, user);
    return { message: `Status put back to "${before.status || "(none)"}".` };
  },

  async execute({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (isProject) await projectService.updateLeadFields(params.leadId, { status: params.status }, user);
    else           await leadService.update(params.leadId, { status: params.status }, user);
    return { message: `${doc.name}'s status updated to "${params.status}".`, data: { leadId: params.leadId, status: params.status } };
  },
};
