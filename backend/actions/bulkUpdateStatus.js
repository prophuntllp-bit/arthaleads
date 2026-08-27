const { objectId, Joi } = require("./_shared");
const { STATUS } = require("../constants/leadOptions");
const leadService = require("../services/leadService");
const Lead = require("../models/Lead");

// The cap is the point of this action. A vague bulk request is where a
// copilot does real damage, because the user approves a sentence rather than
// a number — so the preview states the count and the schema refuses to go
// past a size a person can sensibly eyeball.
const MAX_RECORDS = 50;

module.exports = {
  id: "bulk_update_status",
  scopeLabel: "Leads",
  pages: ["/leads", "/pipeline"],
  // Mirrors PATCH /api/leads/bulk-status. leadService.bulkUpdateStatus
  // refuses agents on its own too.
  roles: ["admin", "manager"],
  params: Joi.object({
    leadIds: Joi.array().items(objectId).min(1).max(MAX_RECORDS).required(),
    status: Joi.string().valid(...STATUS).required(),
  }),
  maxRecords: MAX_RECORDS,
  describe: {
    summary: "Change the status of several leads at once",
    params: `{ leadIds: [...], status } - at most ${MAX_RECORDS} leads per action`,
    when: "Only when the specific lead ids are present in context. Never guess which leads were meant.",
  },

  async preview({ params, user }) {
    // Count what will actually be touched, not what was asked for: ids from
    // another org, or already-deleted leads, must not inflate the number the
    // user is approving.
    const matching = await Lead.find({
      _id: { $in: params.leadIds },
      orgId: user.orgId,
      isDeleted: { $ne: true },
    }).select("name status").limit(MAX_RECORDS).lean();

    const changing = matching.filter((l) => l.status !== params.status);
    const sample = changing.slice(0, 5).map((l) => l.name).join(", ");

    return {
      subject: `${changing.length} lead${changing.length === 1 ? "" : "s"} will change`,
      fields: [{
        label: "Status", param: "status",
        from: changing.length ? `${changing.length} of ${matching.length} selected` : "nothing to change",
        to: params.status,
        editor: { type: "select", value: params.status, options: STATUS },
      }, {
        label: "Affected", param: null, from: null,
        to: sample + (changing.length > 5 ? ` and ${changing.length - 5} more` : "") || "(none)",
      }],
    };
  },

  async execute({ params, user }) {
    const { modified } = await leadService.bulkUpdateStatus(params.leadIds, params.status, user);
    return {
      message: `${modified} lead${modified === 1 ? "" : "s"} updated to "${params.status}".`,
      data: { modified, status: params.status },
    };
  },
};
