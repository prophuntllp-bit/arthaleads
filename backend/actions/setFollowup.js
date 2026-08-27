const { objectId, resolveLead, Joi } = require("./_shared");
const leadService = require("../services/leadService");
const projectService = require("../services/projectService");
const { formatISTDateShort } = require("../utils/datetime");

module.exports = {
  id: "set_followup",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline", "/dashboard", "/followups", "/projects", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    date: Joi.date().required(),
  }),
  describe: {
    summary: "Set a follow-up date on a lead",
    params: '{ leadId, date } - date as ISO 8601 (e.g. "2026-09-05T00:00:00.000Z")',
    when: 'Compute relative dates ("tomorrow", "next Monday") from Today in the context.',
  },

  async preview({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    const current = isProject ? doc.followUp : doc.followUpDate;
    return {
      subject: doc.name,
      fields: [{
        label: "Follow-up", param: "date",
        from: current ? formatISTDateShort(current) : "(none)",
        to: formatISTDateShort(params.date),
        // The editor needs the raw value; the label above is for reading.
        editor: { type: "date", value: new Date(params.date).toISOString().slice(0, 10) },
      }],
    };
  },

  async execute({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    // The collections name this differently: Lead.followUpDate, ProjectLead.followUp.
    if (isProject) await projectService.updateLeadFields(params.leadId, { followUp: params.date }, user);
    else           await leadService.update(params.leadId, { followUpDate: params.date }, user);
    return {
      message: `Follow-up for ${doc.name} set to ${formatISTDateShort(params.date)}.`,
      data: { leadId: params.leadId, date: new Date(params.date).toISOString() },
    };
  },
};
