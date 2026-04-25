const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const mongoose = require("mongoose");

const followupService = {
  async get(user, { section, from, to, page = 1, limit = 50 }) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const baseLeadFilter = { orgId: user.orgId, isArchived: false, isDeleted: { $ne: true } };
    if (user.role === "agent") baseLeadFilter.$or = [{ assignedTo: user._id }, { createdBy: user._id }];

    let leadFilter = { ...baseLeadFilter };
    let projFilter = {};

    if (section === "past") {
      const pastFilter = { $lt: todayStart };
      leadFilter = {
        ...baseLeadFilter,
        status: { $nin: ["Closed Won", "Closed Lost"] },
        $or: [
          { followUpDate: pastFilter },
          { followUpDate: null, createdAt: pastFilter, status: "New" },
        ],
      };
      projFilter = {
        booking: { $nin: ["Not Interested", "Booked"] },
        $or: [
          { followUp: pastFilter },
          { followUp: null, createdAt: pastFilter, remark: { $in: ["", null] } },
        ],
      };
      if (user.role === "agent") projFilter.importedBy = user._id;
    } else if (section === "present") {
      leadFilter = { ...baseLeadFilter, createdAt: { $gte: todayStart, $lte: todayEnd } };
      projFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };
      if (user.role === "agent") projFilter.importedBy = user._id;
    } else if (section === "future") {
      const fromDate = from ? new Date(from) : new Date(todayEnd.getTime() + 1000);
      const toDate   = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : null;
      leadFilter = {
        ...baseLeadFilter,
        followUpDate: { $gt: todayEnd, ...(toDate ? { $lte: toDate } : {}) },
      };
      projFilter = {
        followUp: { $gt: todayEnd, ...(toDate ? { $lte: toDate } : {}) },
      };
      if (user.role === "agent") projFilter.importedBy = user._id;
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
