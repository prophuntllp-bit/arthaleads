// services/leadService.js
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Project = require("../models/Project");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { AppError } = require("../middlewares/errorHandler");
const { sendPushToUser } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");

// ── Analytics cache (in-memory, 60-second TTL per org+range) ─────────────────
// Prevents repeated heavy 18-facet aggregations on every dashboard load.
// Agents get their own cache key since their data is scoped to assignedTo.
const _analyticsCache = new Map();
const ANALYTICS_TTL = 60_000; // 60 seconds

function _analyticsKey(user, query) {
  const range = query.dateRange || `${query.from || ""}_${query.to || ""}`;
  const scope = user.role === "agent" ? String(user._id) : String(user.orgId);
  return `${scope}:${range}`;
}

// Call this from lead write paths to bust the cache for the org immediately.
function invalidateAnalyticsCache(orgId) {
  for (const key of _analyticsCache.keys()) {
    if (key.startsWith(String(orgId) + ":") || key.includes(String(orgId))) {
      _analyticsCache.delete(key);
    }
  }
}

// Escape special regex characters in user-supplied search strings to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      // Explicit assignment - validate the agent belongs to this org
      const agent = await User.findOne({ _id: data.assignedTo, orgId: user.orgId });
      if (!agent) throw new AppError("Assigned agent not found", 404);
      assignedToName = agent.name;
    } else {
      // No agent specified - auto-assign via round-robin if org has it enabled
      try {
        const org = await Organization.findById(user.orgId).select("autoAssign").lean();
        if (org?.autoAssign !== false) {
          const assignee = await getNextAssignee(user.orgId);
          data = { ...data, assignedTo: assignee._id };
          assignedToName = assignee.name;
        }
      } catch {
        // No active agents available - leave unassigned
      }
    }

    const lead = new Lead({
      ...data,
      orgId: user.orgId,
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
      status, source, priority, booking, assignedTo,
      search, page = 1, limit = 20,
      sortBy = "createdAt", order = "desc",
      dateRange, from, to,
    } = query;

    const filter = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    const andConditions = [];

    // Agents always see only their own leads; myOnly lets admin/manager opt in to same scope
    if (user.role === "agent" || query.myOnly === "true") {
      andConditions.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
    }

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (booking) filter.booking = booking;
    if (assignedTo) filter.assignedTo = assignedTo;
    const createdAtFilter = getDateRangeFilter(dateRange, from, to);
    if (createdAtFilter) filter.createdAt = createdAtFilter;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      andConditions.push({ $or: [
        { name: { $regex: safeSearch, $options: "i" } },
        { phone: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { preferredLocation: { $regex: safeSearch, $options: "i" } },
      ] });
    }
    if (query.siteFilter) {
      const rx = { $regex: escapeRegex(query.siteFilter), $options: "i" };
      andConditions.push({ $or: [{ leadSourceLabel: rx }, { sourcePage: rx }, { sourceDomain: rx }, { "notes.text": rx }] });
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
        .populate("assignedTo", "name email")
        .lean(),
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
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId })
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name")
      .populate("activities.performedBy", "name")
      .lean();

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
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only modify leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    // Track status change
    if (updates.status && updates.status !== lead.status) {
      logActivity(
        lead,
        "status_changed",
        `Status changed from "${lead.status}" to "${updates.status}"`,
        user,
        { from: lead.status, to: updates.status }
      );
      // Record first time the lead is contacted (for response time tracking)
      if (updates.status === "Contacted" && !lead.firstContactedAt) {
        updates.firstContactedAt = new Date();
      }
    }

    // Handle assignment change
    if ("assignedTo" in updates) {
      if (updates.assignedTo) {
        if (updates.assignedTo !== lead.assignedTo?.toString()) {
          const agent = await User.findOne({ _id: updates.assignedTo, orgId: user.orgId });
          if (!agent) throw new AppError("Agent not found", 404);
          updates.assignedToName = agent.name;
          logActivity(lead, "assigned", `Assigned to ${agent.name}`, user, { agentId: agent._id, agentName: agent.name });
          sendPushToUser(agent._id, {
            type: "lead_assigned",
            title: "New Lead Assigned",
            body: `${user.name} has assigned a lead to you - ${lead.name}`,
            data: { leadId: lead._id },
          }).catch(() => {});
        }
      } else {
        // Unassign - clear the name too
        updates.assignedTo = null;
        updates.assignedToName = "";
        logActivity(lead, "assigned", "Unassigned", user, {});
      }
    }

    if (updates.followUpDate) {
      updates.followUpSetBy     = user._id;
      updates.followUpSetByName = user.name;
      logActivity(lead, "follow_up_set", `Follow-up set for ${new Date(updates.followUpDate).toDateString()}`, user);
    } else if (updates.followUpDate === null) {
      updates.followUpSetBy     = null;
      updates.followUpSetByName = "";
    }

    Object.assign(lead, updates);
    await lead.save();
    // Return a fresh read so the response always reflects what's in the DB
    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  // super_admin → permanent hard delete; everyone else → soft delete (dump)
  async delete(id, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only delete leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }
    if (user.role === "super_admin") {
      await lead.deleteOne();
    } else {
      lead.isDeleted = true;
      lead.deletedAt = new Date();
      await lead.save({ validateBeforeSave: false });
    }
  },

  // ── Bulk Delete ───────────────────────────────────────────────────────────
  // super_admin → permanent hard delete; everyone else → soft delete (dump)
  async bulkDelete(ids, user) {
    // Agents can only delete leads assigned to them
    const ownerFilter = user.role === "agent"
      ? { assignedTo: user._id }
      : {};

    if (user.role === "super_admin") {
      const result = await Lead.deleteMany({ _id: { $in: ids }, orgId: user.orgId });
      return result.deletedCount;
    }
    const result = await Lead.updateMany(
      { _id: { $in: ids }, orgId: user.orgId, ...ownerFilter },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return result.modifiedCount;
  },

  // ── Bulk Assign ───────────────────────────────────────────────────────────
  // Assign multiple leads to a single agent in one operation
  async bulkAssign(ids, agentId, user) {
    // Validate agent belongs to same org
    const agent = await User.findOne({ _id: agentId, orgId: user.orgId });
    if (!agent) throw new AppError("Agent not found", 404);

    const result = await Lead.updateMany(
      { _id: { $in: ids }, orgId: user.orgId },
      { $set: { assignedTo: agent._id, assignedToName: agent.name } }
    );
    return { modifiedCount: result.modifiedCount, agent };
  },

  // ── Add Note ───────────────────────────────────────────────────────────────
  async addNote(id, text, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only add notes to leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    lead.notes.push({ text, addedBy: user._id, addedByName: user.name });
    logActivity(lead, "note_added", `Note added by ${user.name}`, user);
    await lead.save();
    return lead;
  },

  // ── Assign Lead ────────────────────────────────────────────────────────────
  async assign(id, agentId, user) {
    if (user.role === "agent") throw new AppError("Agents cannot reassign leads", 403);

    const [lead, agent] = await Promise.all([
      Lead.findOne({ _id: id, orgId: user.orgId }),
      User.findOne({ _id: agentId, orgId: user.orgId }),
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
      body: `${user.name} has assigned a lead to you - ${lead.name}`,
      data: { leadId: lead._id },
    }).catch(() => {});

    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  async bulkImport(leads, user) {
    // Check if org has auto-assign enabled
    const org = await Organization.findById(user.orgId).select("autoAssign").lean();
    const shouldAutoAssign = org?.autoAssign !== false;

    // Phase 1: validate explicit assignees + pre-fetch auto-assignee if needed
    const assigneeCache = {};
    let autoAssignee = null;

    if (shouldAutoAssign) {
      try { autoAssignee = await getNextAssignee(user.orgId); } catch { /* no agents */ }
    }

    for (const item of leads) {
      if (item.assignedTo && !assigneeCache[item.assignedTo]) {
        const agent = await User.findOne({ _id: item.assignedTo, orgId: user.orgId });
        if (!agent) throw new AppError(`Assigned agent not found: ${item.assignedTo}`, 404);
        assigneeCache[item.assignedTo] = agent.name;
      }
    }

    // Phase 2: build all docs in memory
    const docs = leads.map((item) => {
      // Use explicit assignee if provided, otherwise auto-assign
      const effectiveAssignee = item.assignedTo
        ? { _id: item.assignedTo, name: assigneeCache[item.assignedTo] || "" }
        : autoAssignee || null;

      const assignedToName = effectiveAssignee?.name || "";
      const activities = [
        { type: "created", description: `Lead imported by ${user.name}`, performedBy: user._id, performedByName: user.name },
      ];
      if (effectiveAssignee) {
        activities.push({ type: "assigned", description: `Assigned to ${assignedToName}`, performedBy: user._id, performedByName: user.name, meta: { agentId: effectiveAssignee._id, agentName: assignedToName } });
      }
      return {
        ...item,
        assignedTo: effectiveAssignee?._id || item.assignedTo || null,
        budget: { min: item.budget?.min || 0, max: item.budget?.max || 0, currency: item.budget?.currency || "INR" },
        orgId: user.orgId,
        createdBy: user._id,
        assignedToName,
        activities,
      };
    });

    // Phase 3: insertMany is atomic per batch; if it throws, nothing is persisted
    const inserted = await Lead.insertMany(docs, { ordered: true });
    return inserted;
  },

  async getAllUnified(query, user) {
    const { search, status, source, priority, booking, projectId, page = 1, limit = 50, dateRange, from, to, followUpToday, siteFilter } = query;
    // Accept both names — the Leads page filter sends `assignedTo`, some
    // internal callers still send the older `userId`.
    const agentId  = query.assignedTo || query.userId;
    const limitInt = parseInt(limit);
    const pageInt  = parseInt(page);
    const skip     = (pageInt - 1) * limitInt;
    // Cross-collection merge can't push skip/limit down to the DB, so each
    // side fetches its own top-N (sorted the same way) and we merge-sort in
    // memory. Capped so deep pagination can't force an unbounded scan.
    const fetchCap = Math.min(skip + limitInt, 2000);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const createdAtFilter = getDateRangeFilter(dateRange, from, to);

    // ── Lead filter ────────────────────────────────────────────────────────────
    const leadFilter = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    const andConditions = [];

    if (user.role === "agent" || query.myOnly === "true") {
      andConditions.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
    } else if (agentId && (user.role === "admin" || user.role === "manager")) {
      andConditions.push({ $or: [{ assignedTo: agentId }, { createdBy: agentId }] });
    }
    if (status)   leadFilter.status   = status;
    if (source)   leadFilter.source   = source;
    if (priority) leadFilter.priority = priority;
    if (booking)  leadFilter.booking  = booking;
    if (createdAtFilter) leadFilter.createdAt = createdAtFilter;
    if (followUpToday === "true" || followUpToday === true) {
      leadFilter.followUpDate = { $gte: todayStart, $lte: todayEnd };
    }
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      andConditions.push({ $or: [{ name: rx }, { phone: rx }, { email: rx }] });
    }
    if (siteFilter) {
      const rx = { $regex: escapeRegex(siteFilter), $options: "i" };
      andConditions.push({ $or: [{ leadSourceLabel: rx }, { sourcePage: rx }, { sourceDomain: rx }, { "notes.text": rx }] });
    }
    if (andConditions.length) leadFilter.$and = andConditions;

    // ── Project-lead filter ────────────────────────────────────────────────────
    // ProjectLead has no `priority` field and no source-domain metadata, so it
    // can never match those filters — skip the collection entirely instead of
    // silently contributing zero matches to what looks like "no results".
    // Also skip when browsing "All Projects" (no explicit projectId) — Project
    // Leads have no pipeline fields (requirements/budget/purpose) and were
    // inflating the unfiltered list + hiding real Website-source Leads behind
    // blank rows. They still show up once a specific project is selected.
    const skipProjectLeads = !!priority || !!siteFilter || !projectId;
    let projLeads = [], projTotal = 0;

    if (!skipProjectLeads) {
      const projFilter = { orgId: user.orgId };
      if (status)  projFilter.status  = status;
      if (source)  projFilter.source  = source;
      if (booking) projFilter.booking = booking;
      if (createdAtFilter) projFilter.createdAt = createdAtFilter;
      if (followUpToday === "true" || followUpToday === true) {
        projFilter.$or = [
          { followUp:  { $gte: todayStart, $lte: todayEnd } },
          { followUp2: { $gte: todayStart, $lte: todayEnd } },
        ];
      }
      if (search) {
        const rx = { $regex: escapeRegex(search), $options: "i" };
        projFilter.$and = [{ $or: [{ name: rx }, { phone: rx }, { email: rx }] }];
      }

      // ProjectLead has no per-lead `assignedTo` — assignment lives on the
      // parent Project (Project.assignedTo[]), so scope by project instead.
      let scopedProjectIds = null;
      if (user.role === "agent" || query.myOnly === "true") {
        const scoped = await Project.find({ orgId: user.orgId, assignedTo: user._id }).select("_id").lean();
        scopedProjectIds = scoped.map((p) => String(p._id));
      } else if (agentId && (user.role === "admin" || user.role === "manager")) {
        const scoped = await Project.find({ orgId: user.orgId, assignedTo: agentId }).select("_id").lean();
        scopedProjectIds = scoped.map((p) => String(p._id));
      }

      if (projectId) {
        // Explicit project filter — intersect with any agent-based scoping so
        // "agent X + project Y" correctly returns nothing when X isn't on Y,
        // instead of ignoring one of the two filters.
        projFilter.project = (scopedProjectIds && !scopedProjectIds.includes(String(projectId)))
          ? null // guaranteed no match — ProjectLead.project is a required field, never null
          : projectId;
      } else if (scopedProjectIds) {
        projFilter.project = { $in: scopedProjectIds };
      }

      [projLeads, projTotal] = await Promise.all([
        ProjectLead.find(projFilter)
          .populate({ path: "project", select: "name assignedTo", populate: { path: "assignedTo", select: "name" } })
          .sort({ createdAt: -1 }).limit(fetchCap).lean(),
        ProjectLead.countDocuments(projFilter),
      ]);
    }

    // Lead has no project association at all — a project filter can only
    // ever match ProjectLead documents, so skip the Lead query entirely.
    const [leads, leadTotal] = projectId
      ? [[], 0]
      : await Promise.all([
          Lead.find(leadFilter).sort({ createdAt: -1 }).limit(fetchCap).lean(),
          Lead.countDocuments(leadFilter),
        ]);

    const taggedLeads = leads.map((l) => ({ ...l, _type: "lead" }));
    const taggedProjLeads = projLeads.map((pl) => ({
      _id:          pl._id,
      _type:        "project",
      projectId:    pl.project?._id || pl.project,
      projectName:  pl.project?.name || "",
      // ProjectLead has no per-lead assignee — it's assigned via the parent
      // project's agent(s), so surface those names in the same column the
      // unified list already uses for plain-lead assignment.
      assignedToName: (pl.project?.assignedTo || []).map((u) => u.name).filter(Boolean).join(", "),
      name:         pl.name,
      phone:        pl.phone,
      email:        pl.email,
      source:       pl.source,
      status:       pl.status,
      remark:       pl.remark,
      remark1:      pl.remark1,
      remark2:      pl.remark2,
      followUpDate: pl.followUp,
      followUp2:    pl.followUp2,
      booking:      pl.booking,
      notes:        pl.notes,
      createdAt:    pl.createdAt,
    }));

    const merged = [...taggedLeads, ...taggedProjLeads]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limitInt);

    const total = leadTotal + projTotal;
    return { leads: merged, total, page: pageInt, pages: Math.ceil(total / limitInt) };
  },

  async getAnalytics(user, query = {}) {
    // ── Cache check ───────────────────────────────────────────────────────────
    const cacheKey = _analyticsKey(user, query);
    const cached = _analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // ── Base match (NO date filter - applied per-facet below) ─────────────────
    // Analytics only covers pipeline leads (Lead model).
    // Project leads (ProjectLead) are manually-imported bulk contacts and
    // should not inflate dashboard counts / source charts.
    const baseMatch = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    if (user.role === "agent") {
      baseMatch.assignedTo = user._id;
    }

    // Date range stage - spread into facets that respect the selected period.
    // Follow-up counts intentionally skip this (they cover ALL scheduled follow-ups).
    const createdAtFilter = getDateRangeFilter(query.dateRange, query.from, query.to);
    const dateStage = createdAtFilter ? [{ $match: { createdAt: createdAtFilter } }] : [];

    const todayStart = new Date(); todayStart.setHours(0,  0,  0,   0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0);
    const thisMonthEnd   = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth()+1, 0, 23, 59, 59, 999);
    const lastMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth()-1, 1, 0, 0, 0, 0);
    const lastMonthEnd   = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth(), 0, 23, 59, 59, 999);
    const next48hEnd     = new Date(todayEnd.getTime() + 48 * 60 * 60 * 1000);

    // Single $facet aggregation — allowDiskUse prevents OOM on large orgs
    const [result] = await Lead.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          // All-time totals — never date-filtered, always shows full pipeline
          allTimeTotal: [
            { $count: "count" },
          ],
          allTimeByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],

          // Period totals for the selected date range (trend/chart data)
          totalLeads: [
            ...dateStage,
            { $count: "count" },
          ],

          // Pipeline breakdown - date-range filtered
          byStatus: [
            ...dateStage,
            { $group: { _id: "$status",   count: { $sum: 1 } } },
          ],
          bySource: [
            ...dateStage,
            { $group: { _id: "$source",   count: { $sum: 1 } } },
          ],
          byPriority: [
            ...dateStage,
            { $group: { _id: "$priority", count: { $sum: 1 } } },
          ],

          // Top agents - date-range filtered, joined with users to skip deactivated agents
          byAgent: [
            ...dateStage,
            { $match: { assignedTo: { $ne: null } } },
            { $group: { _id: "$assignedTo", name: { $first: "$assignedToName" }, count: { $sum: 1 } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $match: { "user.0": { $exists: true }, "user.0.isActive": { $ne: false } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 1, name: 1, count: 1 } },
          ],

          // 5 most recent leads - date-range filtered
          recentLeads: [
            ...dateStage,
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $project: { name: 1, source: 1, status: 1, priority: 1, createdAt: 1, assignedToName: 1 } },
          ],

          // Follow-ups intentionally ignore the date-range filter -
          // agents need to see ALL scheduled follow-ups, not just ones
          // created in the last 30 days.
          todayFollowUps: [
            { $match: { followUpDate: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],
          totalFollowUps: [
            { $match: { followUpDate: { $ne: null } } },
            { $count: "count" },
          ],

          // ── New intelligence facets ──────────────────────────────────────
          // Pipeline value: budget.max sum for active (non-closed) leads
          pipelineValue: [
            { $match: { status: { $nin: ["Closed Won", "Closed Lost"] } } },
            { $group: { _id: null, total: { $sum: "$budget.max" }, count: { $sum: 1 } } },
          ],

          // Month-over-month comparisons
          thisMonthLeads: [
            { $match: { createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
            { $count: "count" },
          ],
          lastMonthLeads: [
            { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
            { $count: "count" },
          ],
          thisMonthClosedWon: [
            { $match: { status: "Closed Won", updatedAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
            { $count: "count" },
          ],
          lastMonthClosedWon: [
            { $match: { status: "Closed Won", updatedAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
            { $count: "count" },
          ],

          // Today's new leads and site visits
          todayCreated: [
            { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],
          todaySiteVisits: [
            { $match: { siteVisitDate: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],

          // Upcoming follow-ups and site visits in next 48h (after today)
          upcomingItems: [
            { $match: { $or: [
              { followUpDate: { $gt: todayEnd, $lte: next48hEnd } },
              { siteVisitDate: { $gt: todayEnd, $lte: next48hEnd } },
            ]}},
            { $sort: { followUpDate: 1 } },
            { $limit: 8 },
            { $project: { name: 1, phone: 1, followUpDate: 1, siteVisitDate: 1, status: 1, assignedToName: 1 } },
          ],

          // Daily lead counts for the last 7 days (for weekly trend chart)
          recentDailyLeads: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            { $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
              count: { $sum: 1 },
            }},
            { $sort: { "_id": 1 } },
          ],

          // Recent activity feed — top 10 actions from 50 most recently modified leads
          recentActivity: [
            { $sort: { updatedAt: -1 } },
            { $limit: 50 },
            { $unwind: { path: "$activities", preserveNullAndEmptyArrays: false } },
            { $sort: { "activities.createdAt": -1 } },
            { $limit: 10 },
            { $project: {
              leadName: "$name",
              leadId: "$_id",
              type: "$activities.type",
              description: "$activities.description",
              performedByName: "$activities.performedByName",
              createdAt: "$activities.createdAt",
            }},
          ],

          // Average first response time (all-time)
          avgFirstResponse: [
            { $match: { firstContactedAt: { $ne: null } } },
            { $project: { responseMs: { $subtract: ["$firstContactedAt", "$createdAt"] } } },
            { $group: { _id: null, avgMs: { $avg: "$responseMs" } } },
          ],
        },
      },
    ], { allowDiskUse: true, maxTimeMS: 25000 });

    const orgDoc = await Organization.findById(user.orgId, "monthlyClosingGoal");
    const orgGoal = orgDoc?.monthlyClosingGoal ?? 0;

    const toMap = (arr) => arr.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});
    const sourceMap   = toMap(result.bySource);
    const allTimeStatus = toMap(result.allTimeByStatus);

    const analyticsData = {
      // All-time counts — used for the top stat cards so orgs with older leads don't see 0
      allTimeTotal:       result.allTimeTotal[0]?.count || 0,
      allTimeClosedWon:   allTimeStatus["Closed Won"]   || 0,
      allTimeNew:         allTimeStatus["New"]           || 0,

      // Period counts (date-range filtered) — kept for trend charts / source breakdown
      totalLeads:     result.totalLeads[0]?.count  || 0,
      byStatus:       toMap(result.byStatus),
      bySource:       sourceMap,
      byPriority:     toMap(result.byPriority),
      sourceHighlights: {
        facebook: sourceMap.Facebook || 0,
        google:   sourceMap.Google   || 0,
        whatsapp: sourceMap.WhatsApp || 0,
      },
      byAgent:        result.byAgent,
      recentLeads:    result.recentLeads,
      todayFollowUps: result.todayFollowUps[0]?.count || 0,
      totalFollowUps: result.totalFollowUps[0]?.count || 0,
      pipelineValue:      result.pipelineValue[0]?.total || 0,
      pipelineLeads:      result.pipelineValue[0]?.count || 0,
      thisMonthLeads:     result.thisMonthLeads[0]?.count || 0,
      lastMonthLeads:     result.lastMonthLeads[0]?.count || 0,
      thisMonthClosedWon: result.thisMonthClosedWon[0]?.count || 0,
      lastMonthClosedWon: result.lastMonthClosedWon[0]?.count || 0,
      conversionRate:     result.allTimeTotal[0]?.count
        ? Math.round((allTimeStatus["Closed Won"] || 0) / result.allTimeTotal[0].count * 1000) / 10
        : 0,
      todayCreated:       result.todayCreated[0]?.count || 0,
      todaySiteVisits:    result.todaySiteVisits[0]?.count || 0,
      upcomingItems:      result.upcomingItems || [],
      allTimeByStatus:    allTimeStatus,
      recentActivity:     result.recentActivity || [],
      recentDailyLeads:   result.recentDailyLeads || [],
      avgResponseMs:      result.avgFirstResponse[0]?.avgMs != null
        ? Math.max(0, result.avgFirstResponse[0].avgMs)
        : null,
      monthlyClosingGoal: orgGoal,
    };

    _analyticsCache.set(cacheKey, { data: analyticsData, expiresAt: Date.now() + ANALYTICS_TTL });
    return analyticsData;
  },

  // ── Restore (undo soft delete) ────────────────────────────────────────────
  async restore(id, orgId) {
    const lead = await Lead.findOne({ _id: id, orgId });
    if (!lead) throw new AppError("Lead not found", 404);
    lead.isDeleted = false;
    lead.deletedAt = null;
    await lead.save({ validateBeforeSave: false });
    return lead;
  },

  // ── Permanent delete ──────────────────────────────────────────────────────
  async permanentDelete(id, orgId) {
    const lead = await Lead.findOneAndDelete({ _id: id, orgId });
    if (!lead) throw new AppError("Lead not found", 404);
  },

  // ── Follow-ups due: overdue + today, user-scoped ─────────────────────────
  // Used by the dashboard alert panel. Returns pipeline leads only (no project
  // leads) since those are handled separately in the Follow-ups page.
  // Agents see only their assigned/created leads; admins/managers see all org.
  async getFollowUpsDue(user) {
    const todayStart = new Date(); todayStart.setHours(0,  0,  0,   0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const filter = {
      orgId:      user.orgId,
      isArchived: { $ne: true },
      isDeleted:  { $ne: true },
      status:     { $nin: ["Closed Won", "Closed Lost"] },
      followUpDate: { $ne: null, $lte: todayEnd },
    };

    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }

    const leads = await Lead.find(filter)
      .sort({ followUpDate: 1 })
      .limit(25)
      .select("name phone source status followUpDate assignedToName")
      .lean();

    return leads.map((l) => ({
      _id:            l._id,
      name:           l.name,
      phone:          l.phone,
      source:         l.source,
      status:         l.status,
      followUpDate:   l.followUpDate,
      assignedToName: l.assignedToName,
      urgency:        l.followUpDate < todayStart ? "overdue" : "today",
      daysOverdue:    l.followUpDate < todayStart
        ? Math.ceil((todayStart - new Date(l.followUpDate)) / (1000 * 60 * 60 * 24))
        : 0,
    }));
  },

  // ── Automation Alerts - recent leads from all sources ────────────────────
  async getAlerts(user) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filter = { orgId: user.orgId, isDeleted: { $ne: true }, isArchived: { $ne: true }, createdAt: { $gte: since } };
    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }
    return Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("name phone source status createdAt assignedToName")
      .lean();
  },

  async transferToProject(leadId, toProjectId, user) {
    const lead = await Lead.findOne({ _id: leadId, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);
    const project = await Project.findOne({ _id: toProjectId, isArchived: { $ne: true }, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);
    const pl = await ProjectLead.create({
      project:    toProjectId,
      name:       lead.name,
      phone:      lead.phone,
      email:      lead.email || "",
      source:     lead.source || "Manual",
      importedBy: user._id,
      orgId:      user.orgId,
      // Preserve all telecaller remark fields
      remark1:    lead.remark1   || "",
      remark2:    lead.remark2   || "",
      remark3:    lead.remark3   || "",
      remark4:    lead.remark4   || "",
      remarkNote: lead.remark    || "", // Lead.remark (plain note) → ProjectLead.remarkNote
      followUp:   lead.followUpDate  || null,
      followUp2:  lead.followUp2     || null,
      booking:    lead.booking       || "",
      followUpSetBy:      lead.followUpSetBy     || null,
      followUpSetByName:  lead.followUpSetByName || "",
    });
    lead.isArchived = true;
    await lead.save({ validateBeforeSave: false });
    return pl;
  },

  // ── Bulk Transfer to Project ─────────────────────────────────────────────
  // Moves multiple leads into a project's lead list in one operation.
  // Preserves remarks/follow-ups/booking exactly like the single-lead
  // transfer above — only the container (Lead → ProjectLead) changes.
  async bulkTransferToProject(ids, toProjectId, user) {
    const project = await Project.findOne({ _id: toProjectId, isArchived: { $ne: true }, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);

    // The unified Leads list mixes plain Lead docs with ProjectLead docs
    // (already inside another project) — a bulk selection can contain both,
    // so look them up in parallel rather than assuming everything is a Lead.
    const [leadsToTransfer, projectLeadsToTransfer] = await Promise.all([
      Lead.find({ _id: { $in: ids }, orgId: user.orgId, isArchived: { $ne: true } }),
      ProjectLead.find({ _id: { $in: ids }, orgId: user.orgId }),
    ]);
    if (!leadsToTransfer.length && !projectLeadsToTransfer.length) {
      throw new AppError("No leads found to transfer", 404);
    }

    if (leadsToTransfer.length) {
      const docs = leadsToTransfer.map((lead) => ({
        project:    toProjectId,
        name:       lead.name,
        phone:      lead.phone,
        email:      lead.email || "",
        source:     lead.source || "Manual",
        importedBy: user._id,
        orgId:      user.orgId,
        remark1:    lead.remark1   || "",
        remark2:    lead.remark2   || "",
        remark3:    lead.remark3   || "",
        remark4:    lead.remark4   || "",
        remarkNote: lead.remark    || "",
        followUp:   lead.followUpDate  || null,
        followUp2:  lead.followUp2     || null,
        booking:    lead.booking       || "",
        followUpSetBy:      lead.followUpSetBy     || null,
        followUpSetByName:  lead.followUpSetByName || "",
      }));

      await ProjectLead.insertMany(docs);
      await Lead.updateMany(
        { _id: { $in: leadsToTransfer.map((l) => l._id) } },
        { $set: { isArchived: true } }
      );
    }

    // Already-project leads just move containers — flip `project` in place
    // so remarks/follow-ups/status/notes are untouched, same as the
    // single-lead project→project transfer in projectService.transferLead.
    if (projectLeadsToTransfer.length) {
      await ProjectLead.updateMany(
        { _id: { $in: projectLeadsToTransfer.map((l) => l._id) } },
        { $set: { project: toProjectId } }
      );
    }

    return { count: leadsToTransfer.length + projectLeadsToTransfer.length, project };
  },

  async getDump(user, { page = 1, limit = 50 } = {}) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const lim  = parseInt(limit);

    const leadFilter = {
      orgId: user.orgId,
      $or: [
        { isDeleted: true },
        { status: "Closed Lost" },
      ],
    };
    if (user.role === "agent") {
      leadFilter.assignedTo = user._id;
    }

    const projFilter = { booking: "Not Interested", orgId: user.orgId };
    if (user.role === "agent") projFilter.importedBy = user._id;

    const [regularLeads, projLeads, totalLeads, totalProj] = await Promise.all([
      Lead.find(leadFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("assignedTo", "name email")
        .select("name phone email source status priority booking assignedToName assignedTo remark1 remark2 remark followUpDate followUp2 createdAt updatedAt isDeleted deletedAt")
        .lean(),
      ProjectLead.find(projFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("project", "name _id")
        .select("name phone email source booking remark remark1 remark2 createdAt updatedAt project importedBy")
        .lean(),
      Lead.countDocuments(leadFilter),
      ProjectLead.countDocuments(projFilter),
    ]);

    const projFormatted = projLeads.map((l) => ({
      ...l,
      _type: "project",
      projectName: l.project?.name,
      projectId: l.project?._id,
      isDeleted: false,
    }));

    const regularFormatted = regularLeads.map((l) => ({ ...l, _type: "lead" }));

    const combined = [...regularFormatted, ...projFormatted].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );

    const total = totalLeads + totalProj;
    return {
      leads: combined,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / lim),
    };
  },
};

module.exports = leadService;
module.exports.invalidateAnalyticsCache = invalidateAnalyticsCache;
