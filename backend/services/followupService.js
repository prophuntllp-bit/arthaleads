const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const mongoose = require("mongoose");

const followupService = {
  async get(user, { section, from, to, page = 1, limit = 50 }) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Agent-scoped conditions for main leads only.
    // Project leads are shared project resources — org is enforced via project lookup, no per-agent filter.
    const agentLeadCond = user.role === "agent"
      ? [{ $or: [{ assignedTo: user._id }, { createdBy: user._id }] }]
      : [];

    const baseLeadFilter = {
      orgId: user.orgId,
      isArchived: false,
      isDeleted: { $ne: true },
    };

    let leadFilter = {};
    let projFilter = {};

    if (section === "past") {
      const pastFilter = { $lt: todayStart };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...agentLeadCond,
          {
            status: { $nin: ["Closed Won", "Closed Lost"] },
            $or: [
              { followUpDate: pastFilter },
              { followUpDate: null, createdAt: pastFilter, status: "New" },
            ],
          },
        ],
      };
      projFilter = {
        booking: { $nin: ["Not Interested", "Booked"] },
        $or: [
          { followUp: pastFilter },
          { followUp: null, createdAt: pastFilter, remark: { $in: ["", null] } },
        ],
      };
    } else if (section === "present") {
      const todayRange = { $gte: todayStart, $lte: todayEnd };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...agentLeadCond,
          { followUpDate: todayRange },
        ],
      };
      projFilter = { followUp: todayRange };
    } else if (section === "future") {
      const fromDate = from ? new Date(from) : new Date(todayEnd.getTime() + 1000);
      const toDate   = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : null;
      const futureFollowUp = { $gt: todayEnd, ...(toDate ? { $lte: toDate } : {}) };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...agentLeadCond,
          { followUpDate: futureFollowUp },
        ],
      };
      projFilter = { followUp: futureFollowUp };
    }

    const orgIdObj = typeof user.orgId === "string" ? new mongoose.Types.ObjectId(user.orgId) : user.orgId;

    const [result] = await Lead.aggregate([
      { $match: leadFilter },
      { $addFields: { _type: "lead" } },
      { $unionWith: {
        coll: "projectleads",
        pipeline: [
          { $match: projFilter },
          { $lookup: { from: "projects", localField: "project", foreignField: "_id", as: "_proj" } },
          // Enforce org scope — only project leads belonging to this org's projects
          { $match: { "_proj.0.orgId": orgIdObj } },
          { $addFields: {
            _type: "project",
            projectName: { $arrayElemAt: ["$_proj.name", 0] },
            projectId:   { $arrayElemAt: ["$_proj._id", 0] },
            followUpDate: { $ifNull: ["$followUp", "$createdAt"] },
            status: { $ifNull: ["$remark", ""] },
            assignedToName: "",
          }},
          { $project: { _proj: 0 } },
        ],
      }},
      { $sort: { followUpDate: 1, createdAt: -1 } },
      { $facet: {
        data:  [{ $skip: skip }, { $limit: parseInt(limit) }],
        count: [{ $count: "total" }],
      }},
    ]);

    const leads = result?.data || [];
    const total = result?.count?.[0]?.total || 0;
    return { leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
  },
};

module.exports = followupService;
