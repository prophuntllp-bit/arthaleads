const { objectId, resolveLead, Joi } = require("./_shared");
const OPTS = require("../constants/leadOptions");
const { AppError } = require("../middlewares/errorHandler");
const projectService = require("../services/projectService");

// Project leads track a "booking" outcome rather than the pipeline status
// regular leads use. Interested / Site Visit Booked / Site Visit Done also
// flip the lead to prospective, which projectService handles.
module.exports = {
  id: "update_project_lead_booking",
  scopeLabel: "Projects",
  pages: ["/projects", "/"],
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    booking: Joi.string().valid(...OPTS.BOOKING.filter(Boolean)).required(),
    remarkNote: Joi.string().trim().max(500).allow(""),
  }),
  describe: {
    summary: "Set a project lead's booking outcome",
    params: `{ leadId, booking, remarkNote? } - booking one of: ${OPTS.BOOKING.filter(Boolean).join(", ")}`,
    when: "Only for leads inside a project, not regular leads.",
  },

  async preview({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (!isProject) throw new AppError("That is a regular lead - use update_lead_status instead.", 400);

    const fields = [{
      label: "Booking", param: "booking",
      from: doc.booking || "(none)", to: params.booking,
      editor: { type: "select", value: params.booking, options: OPTS.BOOKING.filter(Boolean) },
    }];
    if (params.remarkNote) {
      fields.push({
        label: "Remark", param: "remarkNote",
        from: doc.remarkNote || null, to: params.remarkNote,
        editor: { type: "text", value: params.remarkNote },
      });
    }
    return { subject: doc.name, fields };
  },

  async captureBefore({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    return { leadId: params.leadId, booking: doc.booking || "", remarkNote: doc.remarkNote || "" };
  },

  async undo({ before, user }) {
    // isProspective is one-way by design in projectService and is deliberately
    // not reverted here — undo restores the booking value, not that flag.
    await projectService.updateLeadFields(
      before.leadId,
      { booking: before.booking, remarkNote: before.remarkNote },
      user
    );
    return { message: `Booking put back to "${before.booking || "(none)"}".` };
  },

  async execute({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (!isProject) throw new AppError("That is a regular lead - use update_lead_status instead.", 400);

    const patch = { booking: params.booking };
    if (params.remarkNote) patch.remarkNote = params.remarkNote;
    await projectService.updateLeadFields(params.leadId, patch, user);

    return { message: `${doc.name} marked "${params.booking}".`, data: { leadId: params.leadId, booking: params.booking } };
  },
};
