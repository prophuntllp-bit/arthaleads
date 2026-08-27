const { objectId, resolveLead, Joi } = require("./_shared");
const leadService = require("../services/leadService");
const projectService = require("../services/projectService");

module.exports = {
  id: "add_lead_note",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline", "/dashboard", "/followups", "/projects", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    note: Joi.string().trim().min(1).max(2000).required(),
  }),
  describe: {
    summary: "Add a note to a lead",
    params: "{ leadId, note }",
    when: 'Use for "add a note", "note that...", "record that...".',
  },

  async preview({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    return {
      subject: doc.name,
      fields: [{
        label: "Note", param: "note", from: null, to: params.note,
        editor: { type: "text", value: params.note },
      }],
    };
  },

  async execute({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (isProject) await projectService.addNote(String(doc.project), params.leadId, params.note, user);
    else           await leadService.addNote(params.leadId, params.note, user);
    return { message: `Note added to ${doc.name}'s profile.`, data: { leadId: params.leadId } };
  },
};
