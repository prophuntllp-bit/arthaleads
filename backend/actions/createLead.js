const { Joi } = require("./_shared");
const OPTS = require("../constants/leadOptions");
const leadService = require("../services/leadService");
const { AppError } = require("../middlewares/errorHandler");

module.exports = {
  id: "create_lead",
  scopeLabel: "Leads",
  pages: ["/leads", "/dashboard", "/pipeline", "/"],
  // POST /api/leads carries no authorize(), so every role may create.
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    phone: Joi.string().trim().min(6).max(20).required(),
    email: Joi.string().trim().email().allow("").max(120),
    source: Joi.string().valid(...OPTS.SOURCE),
    priority: Joi.string().valid(...OPTS.PRIORITY),
    propertyType: Joi.string().valid(...OPTS.PROPERTY_TYPE),
    bhk: Joi.string().valid(...OPTS.BHK),
    purpose: Joi.string().valid(...OPTS.PURPOSE),
    preferredLocation: Joi.string().trim().max(120),
  }),
  describe: {
    summary: "Create a new lead",
    params: "{ name, phone, and optionally email, source, priority, propertyType, bhk, purpose, preferredLocation }",
    when: "Only when the user gives at least a name and a phone number. Never invent a phone number.",
  },

  async preview({ params }) {
    const order = ["phone", "email", "source", "priority", "propertyType", "bhk", "purpose", "preferredLocation"];
    const labels = {
      phone: "Phone", email: "Email", source: "Source", priority: "Priority",
      propertyType: "Property", bhk: "BHK", purpose: "Purpose", preferredLocation: "Location",
    };
    // from is null throughout: nothing exists yet, so there is no "before".
    const fields = order
      .filter((k) => params[k])
      .map((k) => ({ label: labels[k], param: k, from: null, to: params[k] }));

    return {
      subject: `New lead: ${params.name}`,
      fields: [{ label: "Name", param: "name", from: null, to: params.name, editor: { type: "text", value: params.name } }, ...fields],
    };
  },

  // Nothing exists yet, so there is no "before" to snapshot — undo works off
  // the id the execute returned instead.
  async captureBefore() { return { created: true }; },

  async undo({ result, user }) {
    const leadId = result && result.data && result.data.leadId;
    if (!leadId) throw new AppError("Cannot undo: the new lead's id was not recorded.", 400);
    // Soft delete for every role that can reach this action. super_admin is
    // not in roles above, so the hard-delete branch of leadService.delete is
    // unreachable here.
    await leadService.delete(String(leadId), user);
    return { message: "The new lead was removed." };
  },

  async execute({ params, user }) {
    // create() round-robins the assignee when the org has autoAssign on, and
    // writes the "created" timeline entry.
    const lead = await leadService.create(params, user);
    const owner = lead?.assignedToName ? ` and assigned to ${lead.assignedToName}` : "";
    return { message: `Created lead ${params.name}${owner}.`, data: { leadId: lead?._id } };
  },
};
