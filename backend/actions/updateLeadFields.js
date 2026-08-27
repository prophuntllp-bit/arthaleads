const { objectId, resolveLead, Joi } = require("./_shared");
const OPTS = require("../constants/leadOptions");
const leadService = require("../services/leadService");
const projectService = require("../services/projectService");

// Only these fields. leadService.update ends in Object.assign(lead, updates),
// so this schema is the whitelist — anything not named here is dropped by
// stripUnknown before it can reach a document.
const EDITABLE = {
  priority:          { label: "Priority",   options: OPTS.PRIORITY },
  propertyType:      { label: "Property",   options: OPTS.PROPERTY_TYPE },
  bhk:               { label: "BHK",        options: OPTS.BHK },
  purpose:           { label: "Purpose",    options: OPTS.PURPOSE },
  preferredLocation: { label: "Location",   text: true },
};

module.exports = {
  id: "update_lead_fields",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline", "/dashboard", "/followups", "/projects", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    priority: Joi.string().valid(...OPTS.PRIORITY),
    propertyType: Joi.string().valid(...OPTS.PROPERTY_TYPE),
    bhk: Joi.string().valid(...OPTS.BHK),
    purpose: Joi.string().valid(...OPTS.PURPOSE),
    preferredLocation: Joi.string().trim().max(120),
  }).min(2), // leadId plus at least one field to change
  describe: {
    summary: "Update a lead's details",
    params: `{ leadId, and any of: priority (${OPTS.PRIORITY.join("/")}), propertyType, bhk, purpose, preferredLocation }`,
    when: "Use for requirement changes — budget bracket, BHK, location preference, priority.",
  },

  async preview({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    const fields = Object.entries(EDITABLE)
      .filter(([key]) => key in params)
      .map(([key, meta]) => ({
        label: meta.label,
        param: key,
        from: doc[key] || "(none)",
        to: params[key],
        editor: meta.options
          ? { type: "select", value: params[key], options: meta.options }
          : { type: "text", value: params[key] },
      }));
    return { subject: doc.name, fields };
  },

  async execute({ params, user }) {
    const { leadId, ...updates } = params;
    const { doc, isProject } = await resolveLead(leadId, user);

    if (isProject) {
      // ProjectLead has a narrower schema — updateLeadFields ignores anything
      // it does not recognise, so unsupported keys are dropped rather than
      // silently written.
      await projectService.updateLeadFields(leadId, updates, user);
    } else {
      await leadService.update(leadId, updates, user);
    }

    const changed = Object.keys(updates).map((k) => EDITABLE[k]?.label || k).join(", ");
    return { message: `Updated ${changed} on ${doc.name}.`, data: { leadId, updates } };
  },
};
