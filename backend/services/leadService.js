// services/leadService.js
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");
const { sendPushToUser } = require("../utils/push");

const getDateRangeFilter = (dateRange, from, to) => {
  const now = new Date();

  if (from || to) {
    const createdAt = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      createdAt.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    return Object.keys(createdAt).length ? createdAt : null;
  }

  if (!dateRange) return null;

  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (dateRange) {
    case "today":
      start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "yesterday":
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      return { $gte: start, $lte: end };
    case "todayYesterday":
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "last7days":
      start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "last14days":
      start.setDate(start.getDate() - 13); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "last28days":
      start.setDate(start.getDate() - 27); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "last30days":
      start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "thisweek":
      start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "lastweek": {
      const ls = new Date(now);
      ls.setDate(ls.getDate() - ls.getDay() - 7); ls.setHours(0, 0, 0, 0);
      const le = new Date(ls); le.setDate(le.getDate() + 6); le.setHours(23, 59, 59, 999);
      return { $gte: ls, $lte: le };
    }
    case "thismonth":
      start.setDate(1); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    case "lastmonth": {
      const lms = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0); lme.setHours(23, 59, 59, 999);
      return { $gte: lms, $lte: lme };
    }
    case "thisyear":
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
      return { $gte: start, $lte: end };
    default:
      return null;
  }
};

// Helper: log an activity on a lead (call before saving)
const logActivity = (lead, type, description, user, meta = {}) => {
  lead.activities.push({
    type,
    description,
    performedBy: user._id,
    performedByName: user.name,
    meta,
  });
};

const leadService = {
  // ── Create ─────────────────────────────────────────────────────────────────
  async create(data, user) {
    let assignedToName = "";

    if (data.assignedTo) {
      const agent = await User.findById(data.assignedTo);
      if (!agent) throw new AppError("Assigned agent not found", 404);
      assignedToName = agent.name;
    }

    const lead = new Lead({
      ...data,
      createdBy: user._id,
      assignedToName,
    });

    logActivity(lead, "created", `Lead created by ${user.name}`, user);

    if (data.assignedTo) {
      logActivity(lead, "assigned", `Assigned to ${assignedToName}`, user, {
        agentId: data.assignedTo,
        agentName: assignedToName,
      });
    }

    await lead.save();
    return lead;
  },

  // ── List with filters + pagination ─────────────────────────────────────────
  async getAll(query, user) {
    const {
      status, source, priority, assignedTo,
      search, page = 1, limit = 20,
      sortBy = "createdAt", order = "desc",
      dateRange, from, to,
    } = query;

    const filter = { isArchived: false, isDeleted: { $ne: true }, booking: { $ne: "Not Interested" } };
    const andConditions = [];

    // Agents can only see their own leads
    if (user.role === "agent") {
      andConditions.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
    }

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    const createdAtFilter = getDateRangeFilter(dateRange, from, to);
    if (createdAtFilter) filter.createdAt = createdAtFilter;

    if (search) {
      andConditions.push({ $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { preferredLocation: { $regex: search, $options: "i" } },
      ] });
    }

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "name email")
        .populate("assignedTo", "name email"),
      Lead.countDocuments(filter),
    ]);

    return {
      leads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    };
  },

  // ── Get single ─────────────────────────────────────────────────────────────
  async getById(id, user) {
    const lead = await Lead.findById(id)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name")
      .populate("activities.performedBy", "name");

    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only view leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.createdBy?._id.toString() !== user._id.toString() &&
      lead.assignedTo?._id?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    return lead;
  },

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id, updates, user) {
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);

    // Track status change
    if (updates.status && updates.status !== lead.status) {
      logActivity(
        lead,
        "status_changed",
        `Status changed from "${lead.status}" to "${updates.status}"`,
        user,
        { from: lead.status, to: updates.status }
      );
    }

    // Handle assignment change
    if ("assignedTo" in updates) {
      if (updates.assignedTo) {
        if (updates.assignedTo !== lead.assignedTo?.toString()) {
          const agent = await User.findById(updates.assignedTo);
          if (!agent) throw new AppError("Agent not found", 404);
          updates.assignedToName = agent.name;
          logActivity(lead, "assigned", `Assigned to ${agent.name}`, user, { agentId: agent._id, agentName: agent.name });
          sendPushToUser(agent._id, {
            type: "lead_assigned",
            title: "New Lead Assigned",
            body: `${user.name} has assigned a lead to you — ${lead.name}`,
            data: { leadId: lead._id },
          }).catch(() => {});
        }
      } else {
        // Unassign — clear the name too
        updates.assignedTo = null;
        updates.assignedToName = "";
        logActivity(lead, "assigned", "Unassigned", user, {});
      }
    }

    if (updates.followUpDate) {
      logActivity(lead, "follow_up_set", `Follow-up set for ${new Date(updates.followUpDate).toDateString()}`, user);
    }

    Object.assign(lead, updates);
    await lead.save();
    // Return a fresh read so the response always reflects what's in the DB
    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Delete (soft) ─────────────────────────────────────────────────────────
  async delete(id, user) {
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);
    if (user.role === "agent") throw new AppError("Agents cannot delete leads", 403);
    lead.isDeleted = true;
    lead.deletedAt = new Date();
    await lead.save({ validateBeforeSave: false });
  },

  // ── Bulk Delete (soft) ────────────────────────────────────────────────────
  async bulkDelete(ids) {
    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return result.modifiedCount;
  },

  // ── Add Note ───────────────────────────────────────────────────────────────
  async addNote(id, text, user) {
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);

    lead.notes.push({ text, addedBy: user._id, addedByName: user.name });
    logActivity(lead, "note_added", `Note added by ${user.name}`, user);
    await lead.save();
    return lead;
  },

  // ── Assign Lead ────────────────────────────────────────────────────────────
  async assign(id, agentId, user) {
    if (user.role === "agent") throw new AppError("Agents cannot reassign leads", 403);

    const [lead, agent] = await Promise.all([
      Lead.findById(id),
      User.findById(agentId),
    ]);
    if (!lead) throw new AppError("Lead not found", 404);
    if (!agent) throw new AppError("Agent not found", 404);

    lead.assignedTo = agent._id;
    lead.assignedToName = agent.name;
    logActivity(lead, "assigned", `Assigned to ${agent.name} by ${user.name}`, user, {
      agentId: agent._id,
      agentName: agent.name,
    });
    await lead.save();

    sendPushToUser(agent._id, {
      type: "lead_assigned",
      title: "New Lead Assigned",
      body: `${user.name} has assigned a lead to you — ${lead.name}`,
      data: { leadId: lead._id },
    }).catch(() => {});

    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  async bulkImport(leads, user) {
    const imported = [];

    for (const item of leads) {
      let assignedToName = "";

      if (item.assignedTo) {
        const agent = await User.findById(item.assignedTo);
        if (!agent) throw new AppError(`Assigned agent not found for ${item.name}`, 404);
        assignedToName = agent.name;
      }

      const lead = new Lead({
        ...item,
        budget: {
          min: item.budget?.min || 0,
          max: item.budget?.max || 0,
          currency: item.budget?.currency || "INR",
        },
        createdBy: user._id,
        assignedToName,
      });

      logActivity(lead, "created", `Lead imported by ${user.name}`, user);

      if (item.assignedTo) {
        logActivity(lead, "assigned", `Assigned to ${assignedToName}`, user, {
          agentId: item.assignedTo,
          agentName: assignedToName,
        });
      }

      await lead.save();
      imported.push(lead);
    }

    return imported;
  },

  async getAllUnified(query, user) {
    const { search, status, source, priority, page = 1, limit = 50, dateRange, from, to, followUpToday } = query;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const leadFilter = { isArchived: false, isDeleted: { $ne: true }, booking: { $ne: "Not Interested" } };
    if (user.role === "agent") leadFilter.$or = [{ assignedTo: user._id }, { createdBy: user._id }];
    if (status) leadFilter.status = status;
    if (source) leadFilter.source = source;
    if (priority) leadFilter.priority = priority;
    if (followUpToday === "true" || followUpToday === true) {
      leadFilter.followUpDate = { $gte: todayStart, $lte: todayEnd };
    }
    const createdAtFilter = getDateRangeFilter(dateRange, from, to);
    if (createdAtFilter) leadFilter.createdAt = createdAtFilter;
    if (search) {
      const rx = { $regex: search, $options: "i" };
      leadFilter.$and = [{ $or: [{ name: rx }, { phone: rx }, { email: rx }] }];
    }

    // Project leads: pre-$addFields filter (fields that exist in the raw doc)
    const projFilter = { booking: { $ne: "Not Interested" } };
    if (source) projFilter.source = source;
    if (followUpToday === "true" || followUpToday === true) {
      projFilter.followUp = { $gte: todayStart, $lte: todayEnd };
    }
    if (search) {
      const rx = { $regex: search, $options: "i" };
      projFilter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }
    if (user.role === "agent") projFilter.importedBy = user._id;

    // Post-$addFields filter: status/priority need defaults applied first
    const projPostFilter = {};
    if (status) projPostFilter.status = status;
    if (priority) projPostFilter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [result] = await Lead.aggregate([
      { $match: leadFilter },
      { $addFields: { _type: "lead" } },
      { $unionWith: {
        coll: "projectleads",
        pipeline: [
          { $match: projFilter },
          { $lookup: { from: "projects", localField: "project", foreignField: "_id", as: "_proj" } },
          { $addFields: {
            _type: "project",
            projectName: { $arrayElemAt: ["$_proj.name", 0] },
            projectId: { $arrayElemAt: ["$_proj._id", 0] },
            status: { $ifNull: ["$status", "New"] },
            priority: { $ifNull: ["$priority", "Medium"] },
            assignedToName: { $ifNull: ["$assignedToName", ""] },
            followUpDate: { $ifNull: ["$followUp", null] },
          }},
          { $project: { _proj: 0 } },
          ...(Object.keys(projPostFilter).length ? [{ $match: projPostFilter }] : []),
        ],
      }},
      { $sort: { createdAt: -1 } },
      { $facet: {
        data: [{ $skip: skip }, { $limit: parseInt(limit) }],
        count: [{ $count: "total" }],
      }},
    ]);

    const leads = result?.data || [];
    const total = result?.count?.[0]?.total || 0;
    return { leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
  },

  async getAnalytics(user, query = {}) {
    const baseMatch = { isArchived: false, isDeleted: { $ne: true } };
    if (user.role === "agent") {
      baseMatch.$or = [{ assignedTo: user._id }, { createdBy: user._id }];
    }
    const createdAtFilter = getDateRangeFilter(query.dateRange, query.from, query.to);
    if (createdAtFilter) baseMatch.createdAt = createdAtFilter;

    // ProjectLead base filter (no isDeleted/isArchived, exclude Not Interested)
    const projMatch = { booking: { $ne: "Not Interested" } };
    if (user.role === "agent") projMatch.importedBy = user._id;
    if (createdAtFilter) projMatch.createdAt = createdAtFilter;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const followUpMatch    = { ...baseMatch,  followUpDate: { $ne: null } };
    const projFollowUpMatch = { ...projMatch, followUp:     { $ne: null } };
    delete followUpMatch.createdAt;
    delete projFollowUpMatch.createdAt;

    const [
      leadTotal, projTotal,
      byStatus, bySource, projBySource,
      byPriority, byAgent, recentLeads,
      todayFollowUps, projTodayFollowUps,
      totalFollowUps, projTotalFollowUps,
    ] = await Promise.all([
      Lead.countDocuments(baseMatch),
      ProjectLead.countDocuments(projMatch),
      Lead.aggregate([{ $match: baseMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: baseMatch }, { $group: { _id: "$source", count: { $sum: 1 } } }]),
      ProjectLead.aggregate([{ $match: projMatch }, { $group: { _id: "$source", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: baseMatch }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
      Lead.aggregate([
        { $match: { ...baseMatch, assignedTo: { $ne: null } } },
        { $group: { _id: "$assignedTo", name: { $first: "$assignedToName" }, count: { $sum: 1 } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $match: { "user.0": { $exists: true }, "user.0.isActive": { $ne: false } } },
        { $sort: { count: -1 } }, { $limit: 10 },
        { $project: { _id: 1, name: 1, count: 1 } },
      ]),
      Lead.find(baseMatch).sort({ createdAt: -1 }).limit(5)
        .select("name source status priority createdAt assignedToName"),
      Lead.countDocuments({ ...followUpMatch,     followUpDate: { $gte: todayStart, $lte: todayEnd } }),
      ProjectLead.countDocuments({ ...projFollowUpMatch, followUp: { $gte: todayStart, $lte: todayEnd } }),
      Lead.countDocuments(followUpMatch),
      ProjectLead.countDocuments(projFollowUpMatch),
    ]);

    const toMap = (arr) => arr.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});

    // Merge source counts from both collections
    const mergedSourceMap = {};
    [...bySource, ...projBySource].forEach(({ _id, count }) => {
      mergedSourceMap[_id] = (mergedSourceMap[_id] || 0) + count;
    });

    return {
      totalLeads: leadTotal + projTotal,
      byStatus: toMap(byStatus),
      bySource: mergedSourceMap,
      byPriority: toMap(byPriority),
      sourceHighlights: {
        facebook: mergedSourceMap.Facebook || 0,
        google:   mergedSourceMap.Google   || 0,
        whatsapp: mergedSourceMap.WhatsApp || 0,
      },
      byAgent,
      recentLeads,
      todayFollowUps:  todayFollowUps  + projTodayFollowUps,
      totalFollowUps:  totalFollowUps  + projTotalFollowUps,
    };
  },

  // ── Restore (undo soft delete) ────────────────────────────────────────────
  async restore(id) {
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);
    lead.isDeleted = false;
    lead.deletedAt = null;
    await lead.save({ validateBeforeSave: false });
    return lead;
  },

  // ── Permanent delete ──────────────────────────────────────────────────────
  async permanentDelete(id) {
    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) throw new AppError("Lead not found", 404);
  },

  // ── Automation Alerts — recent leads from all sources ────────────────────
  async getAlerts(user) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filter = { isDeleted: { $ne: true }, isArchived: false, createdAt: { $gte: since } };
    if (user.role === "agent") {
      filter.$or = [{ assignedTo: user._id }, { createdBy: user._id }];
    }
    return Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("name phone source status createdAt assignedToName");
  },

  async getDump(user) {
    const leadFilter = {
      $or: [
        { isDeleted: true },
        { booking: "Not Interested" },
        { status: "Closed Lost" },
      ],
    };
    if (user.role === "agent") {
      leadFilter.$and = [{ $or: [{ assignedTo: user._id }, { createdBy: user._id }] }];
    }

    const projFilter = { booking: "Not Interested" };
    if (user.role === "agent") projFilter.importedBy = user._id;

    const [regularLeads, projectLeads] = await Promise.all([
      Lead.find(leadFilter)
        .sort({ updatedAt: -1 })
        .limit(1000)
        .populate("assignedTo", "name email")
        .select("name phone email source status priority booking assignedToName assignedTo remark1 remark2 remark followUpDate followUp2 createdAt updatedAt isDeleted deletedAt"),
      ProjectLead.find(projFilter)
        .sort({ updatedAt: -1 })
        .limit(500)
        .populate("project", "name _id")
        .select("name phone email source booking remark remark1 remark2 createdAt updatedAt project importedBy"),
    ]);

    const projFormatted = projectLeads.map((l) => {
      const obj = l.toObject();
      return {
        ...obj,
        _type: "project",
        projectName: obj.project?.name,
        projectId: obj.project?._id,
        isDeleted: false,
      };
    });

    const regularFormatted = regularLeads.map((l) => ({ ...l.toObject(), _type: "lead" }));

    return [...regularFormatted, ...projFormatted].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  },
};

module.exports = leadService;
