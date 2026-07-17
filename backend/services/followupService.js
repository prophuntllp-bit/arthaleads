const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const mongoose = require("mongoose");

const followupService = {
  async get(user, { section, from, to, page = 1, limit = 50, sort, myOnly = false, search = "" }) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Agents always see only their own leads.
    // myOnly=true lets admin/manager opt-in to the same per-user scope.
    // Project leads have no individual owner — excluded entirely when scopedToSelf.
    const scopedToSelf = user.role === "agent" || myOnly;
    // "My Leads" means ownership/assignment, not "records I happened to
    // create". Admins commonly import or create leads for the whole team, so
    // including createdBy made the toggle appear to do nothing for them.
    const selfCond = scopedToSelf
      ? [{ assignedTo: user._id }]
      : [];

    const searchCond = search
      ? [{ $or: [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }] }]
      : [];

    const baseLeadFilter = {
      orgId: user.orgId,
      isArchived: { $ne: true },
      isDeleted: { $ne: true },
    };

    let leadFilter = {};
    let projFilter = {};

    if (section === "past") {
      const pastFilter = { $lt: todayStart };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...selfCond,
          ...searchCond,
          { $or: [
            { followUpDate: pastFilter },
            { followUpDate: null, createdAt: pastFilter, status: "New" },
          ]},
        ],
      };
      projFilter = {
        $and: [
          ...searchCond,
          { $or: [
            { followUp:  pastFilter },
            { followUp2: pastFilter },
            { followUp: null, followUp2: null, createdAt: pastFilter, remark: { $in: ["", null] } },
          ]},
        ],
      };
    } else if (section === "present") {
      const todayRange = { $gte: todayStart, $lte: todayEnd };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...selfCond,
          ...searchCond,
          { followUpDate: todayRange },
        ],
      };
      projFilter = {
        $and: [
          ...searchCond,
          { $or: [
            { followUp:  todayRange },
            { followUp2: todayRange },
          ]},
        ],
      };
    } else if (section === "future") {
      const fromDate = from ? new Date(from) : new Date(todayEnd.getTime() + 1000);
      const toDate   = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : null;
      const futureFollowUp = { $gt: todayEnd, ...(toDate ? { $lte: toDate } : {}) };
      leadFilter = {
        $and: [
          baseLeadFilter,
          ...selfCond,
          ...searchCond,
          { followUpDate: futureFollowUp },
        ],
      };
      projFilter = {
        $and: [
          ...searchCond,
          { $or: [
            { followUp:  futureFollowUp },
            { followUp2: futureFollowUp },
          ]},
        ],
      };
    }

    const orgIdObj = typeof user.orgId === "string" ? new mongoose.Types.ObjectId(user.orgId) : user.orgId;

    // Build the project-leads $unionWith stage.
    // Agents see project leads where they set the follow-up (followUpSetBy).
    // Admins/managers see all project leads scoped to their org.
    const scopeConds = scopedToSelf ? [{ followUpSetBy: user._id }, { orgId: orgIdObj }] : [{ orgId: orgIdObj }];
    const effectiveProjFilter = { $and: [...scopeConds, ...projFilter.$and] };

    const projUnionStage = [
      { $unionWith: {
        coll: "projectleads",
        pipeline: [
          { $match: effectiveProjFilter },
          { $lookup: { from: "projects", localField: "project", foreignField: "_id", as: "_proj" } },
          // Enforce org scope - only project leads belonging to this org's projects
          { $match: { "_proj.0.orgId": orgIdObj } },
          { $addFields: {
            _type: "project",
            projectName: { $arrayElemAt: ["$_proj.name", 0] },
            projectId:   { $arrayElemAt: ["$_proj._id", 0] },
            // Use whichever follow-up date is latest (followUp2 supersedes followUp when set)
            followUpDate: {
              $cond: [
                { $and: [
                  { $ne: ["$followUp2", null] },
                  { $or: [
                    { $eq: ["$followUp", null] },
                    { $gte: ["$followUp2", "$followUp"] },
                  ]},
                ]},
                "$followUp2",
                { $ifNull: ["$followUp", "$createdAt"] },
              ],
            },
            status: { $ifNull: ["$remark", ""] },
            assignedToName: { $ifNull: ["$followUpSetByName", ""] },
          }},
          { $project: { _proj: 0 } },
        ],
      }},
    ];

    const [result] = await Lead.aggregate([
      { $match: leadFilter },
      { $addFields: { _type: "lead" } },
      ...projUnionStage,
      // Smart default: past → latest missed first (desc); future/present → soonest first (asc)
      { $sort: {
        followUpDate: sort === "asc" ? 1 : sort === "desc" ? -1 : (section === "past" ? -1 : 1),
        createdAt: -1,
      }},
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
