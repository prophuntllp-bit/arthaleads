// services/projectService.js
const Project = require("../models/Project");
const ProjectLead = require("../models/ProjectLead");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

// Escape special regex characters in user-supplied search strings to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const projectService = {
  async create(data, user) {
    const project = await Project.create({ ...data, createdBy: user._id, orgId: user.orgId });
    return project;
  },

  async getAll(user) {
    const filter = { isArchived: false, orgId: user.orgId };

    // Agents can ONLY see projects explicitly assigned to them
    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }

    const projects = await Project.find(filter)
      .populate("createdBy", "name")
      .populate("assignedTo", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    if (!projects.length) return [];

    // Attach lead counts in a single aggregation
    const counts = await ProjectLead.aggregate([
      { $match: { project: { $in: projects.map((p) => p._id) } } },
      { $group: { _id: "$project", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c.count; });

    return projects.map((p) => ({
      ...p,
      leadCount: countMap[String(p._id)] || 0,
    }));
  },

  async getById(id, user) {
    const filter = { _id: id, isArchived: false, orgId: user.orgId };

    // Agents can ONLY access projects explicitly assigned to them
    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }

    const project = await Project.findOne(filter)
      .populate("createdBy", "name")
      .populate("assignedTo", "name avatar");
    if (!project) throw new AppError("Project not found", 404);
    return project;
  },

  async update(id, data, user) {
    const project = await Project.findOneAndUpdate(
      { _id: id, isArchived: false, orgId: user.orgId },
      data,
      { new: true, runValidators: true }
    );
    if (!project) throw new AppError("Project not found", 404);
    return project;
  },

  async remove(id, user) {
    const project = await Project.findOneAndUpdate(
      { _id: id, isArchived: false, orgId: user.orgId },
      { isArchived: true },
      { new: true }
    );
    if (!project) throw new AppError("Project not found", 404);
    return project;
  },

  async importLeads(projectId, rows, user) {
    // Verify project belongs to the same org
    const project = await Project.findOne({ _id: projectId, isArchived: false, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);

    const invalid = rows.length - rows.filter((r) => r.name && r.phone).length;
    const valid = rows.filter((r) => r.name && r.phone);
    if (!valid.length) throw new AppError("No valid rows found. Each row needs at least name and phone.", 400);

    // Normalize phone to digits only so format differences don't create false duplicates
    // e.g. "+91 98765-43210", "9876543210", "098765 43210" all match
    const normalizePhone = (p) => String(p).replace(/\D/g, "").replace(/^91(\d{10})$/, "$1");

    // Fetch every phone already in this project for O(1) lookup
    const existing = await ProjectLead.find({ project: projectId }, "phone").lean();
    const existingSet = new Set(existing.map((l) => normalizePhone(l.phone)));

    // Split: also deduplicate within the file itself (same number appearing twice in the CSV)
    const seenInBatch = new Set();
    const newRows     = [];
    let   duplicates  = 0;

    for (const row of valid) {
      const norm = normalizePhone(row.phone);
      if (existingSet.has(norm) || seenInBatch.has(norm)) {
        duplicates++;
      } else {
        seenInBatch.add(norm);
        newRows.push(row);
      }
    }

    if (!newRows.length) {
      return { inserted: 0, skipped: invalid, duplicates };
    }

    const docs = newRows.map((r) => ({
      project: projectId,
      name: r.name,
      phone: r.phone,
      email: r.email || "",
      source: r.source || "Facebook",
      remarkNote: r.remarkNote || "",  // preserve custom Facebook form answers
      importedBy: user._id,
      orgId: user.orgId,  // propagate tenant id for direct filtering
    }));

    let insertedCount = 0;
    let writeErrors = 0;
    try {
      const result = await ProjectLead.insertMany(docs, { ordered: false });
      insertedCount = result.length;
    } catch (bulkErr) {
      // BulkWriteError — some docs succeeded, some failed validation/uniqueness
      insertedCount = bulkErr.insertedDocs?.length ?? 0;
      writeErrors   = bulkErr.writeErrors?.length  ?? 0;
    }
    return { inserted: insertedCount, skipped: invalid + writeErrors, duplicates };
  },

  async getLeads(projectId, { page = 1, limit = 50, search = "", bookingIn = null, followUpFrom = null, followUpTo = null, isProspective = false }, user) {
    // Verify the project belongs to the requesting user's org
    const project = await Project.findOne({ _id: projectId, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);

    // Agents can only access projects they are assigned to
    if (user.role === "agent" && !project.assignedTo?.map(String).includes(user._id.toString())) {
      throw new AppError("Access denied", 403);
    }

    const filter = { project: projectId };

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }

    if (isProspective === "true" || isProspective === true) {
      // Prospective scope: flag set OR (for existing data) originally Interested/Site Visit Booked
      const prospScope = { $or: [{ isProspective: true }, { booking: { $in: ["Interested", "Site Visit Booked"] } }] };
      if (bookingIn) {
        // Further narrow by specific status within Prospective
        filter.$and = [prospScope, { booking: { $in: bookingIn.split(",").map((v) => v.trim()) } }];
      } else {
        filter.$and = [prospScope];
      }
    } else if (bookingIn) {
      filter.booking = { $in: bookingIn.split(",").map((v) => v.trim()) };
    }

    if (followUpFrom || followUpTo) {
      filter.followUp = {};
      if (followUpFrom) filter.followUp.$gte = new Date(followUpFrom);
      if (followUpTo) {
        const end = new Date(followUpTo);
        end.setUTCHours(23, 59, 59, 999); // include the full end day
        filter.followUp.$lte = end;
      }
    }

    const skip = (page - 1) * limit;
    const [leads, total] = await Promise.all([
      ProjectLead.find(filter)
        .populate("remarkUpdatedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProjectLead.countDocuments(filter),
    ]);

    return { leads, total, page, pages: Math.ceil(total / limit) };
  },

  async updateRemark(leadId, { remark, remarkNote }, user) {
    // Verify org ownership via parent project (works for both old and new leads,
    // regardless of whether orgId is backfilled on the ProjectLead doc yet)
    const check = await ProjectLead.findById(leadId).populate("project", "orgId assignedTo");
    if (!check) throw new AppError("Lead not found", 404);
    if (String(check.project?.orgId) !== String(user.orgId)) throw new AppError("Access denied", 403);
    if (user.role === "agent" && !check.project?.assignedTo?.map(String).includes(user._id.toString())) {
      throw new AppError("Access denied", 403);
    }

    const update = {
      remark,
      remarkNote: remark === "Contacted" ? (remarkNote || "") : "",
      remarkUpdatedBy: user._id,
      remarkUpdatedAt: new Date(),
    };

    const lead = await ProjectLead.findByIdAndUpdate(leadId, update, { new: true })
      .populate("remarkUpdatedBy", "name");
    if (!lead) throw new AppError("Lead not found", 404);
    return lead;
  },

  async updateLeadFields(leadId, data, user) {
    // Scope by orgId: look up via parent project
    const lead = await ProjectLead.findById(leadId).populate("project", "orgId assignedTo");
    if (!lead) throw new AppError("Lead not found", 404);
    if (String(lead.project?.orgId) !== String(user.orgId)) throw new AppError("Access denied", 403);
    if (user.role === "agent" && !lead.project?.assignedTo?.map(String).includes(user._id.toString())) {
      throw new AppError("Access denied", 403);
    }

    // Only update fields that exist in the ProjectLead schema
    const allowed = ["name", "phone", "email", "source", "remark", "remarkNote", "remark1", "remark2", "remark3", "remark4", "followUp", "followUp2", "booking"];
    allowed.forEach((f) => { if (f in data) lead[f] = data[f]; });

    // One-way flag: once Interested or Site Visit Booked, always Prospective
    if (data.booking === "Interested" || data.booking === "Site Visit Booked") {
      lead.isProspective = true;
    }

    // Track who set the follow-up so notifications go to the right person
    if (data.followUp || data.followUp2) {
      lead.followUpSetBy     = user._id;
      lead.followUpSetByName = user.name;
    }

    await lead.save();
    return lead;
  },

  async deleteLead(leadId, user) {
    const lead = await ProjectLead.findById(leadId).populate("project", "orgId name assignedTo");
    if (!lead) throw new AppError("Lead not found", 404);
    if (String(lead.project?.orgId) !== String(user.orgId)) throw new AppError("Access denied", 403);
    if (user.role === "agent" && !lead.project?.assignedTo?.map(String).includes(user._id.toString())) {
      throw new AppError("Access denied", 403);
    }

    if (user.role === "super_admin") {
      // Permanent hard delete — no dump record
      await lead.deleteOne();
    } else {
      // Soft delete — convert to Lead with isDeleted so it appears in Dump Leads
      const validSources = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "Other"];
      const mappedSource = validSources.includes(lead.source) ? lead.source : "Other";
      await Lead.create({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || "",
        source: mappedSource,
        createdBy: user._id,
        orgId: user.orgId,
        isDeleted: true,
        deletedAt: new Date(),
      });
      await lead.deleteOne();
    }
  },

  async bulkDeleteLeads(projectId, ids, user) {
    // Verify the project belongs to the requesting user's org before mass-delete
    const project = await Project.findOne({ _id: projectId, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);

    // Agents can only bulk-delete from projects they are assigned to
    if (user.role === "agent" && !project.assignedTo?.map(String).includes(user._id.toString())) {
      throw new AppError("Access denied", 403);
    }

    if (user.role === "super_admin") {
      // Permanent hard delete — no dump records
      const result = await ProjectLead.deleteMany({ _id: { $in: ids }, project: projectId });
      return result.deletedCount;
    }

    // Soft delete — convert each to a Lead with isDeleted so they appear in Dump Leads
    const projectLeads = await ProjectLead.find({ _id: { $in: ids }, project: projectId });
    const validSources = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "Other"];
    const now = new Date();
    const dumpDocs = projectLeads.map((pl) => ({
      name: pl.name,
      phone: pl.phone,
      email: pl.email || "",
      source: validSources.includes(pl.source) ? pl.source : "Other",
      createdBy: user._id,
      orgId: user.orgId,
      isDeleted: true,
      deletedAt: now,
    }));
    if (dumpDocs.length > 0) await Lead.insertMany(dumpDocs, { ordered: false });
    const result = await ProjectLead.deleteMany({ _id: { $in: ids }, project: projectId });
    return result.deletedCount;
  },

  async transferLead(leadId, fromProjectId, { toProjectId, toLeads, source }, user) {
    // Ensure source project belongs to the user's org
    const fromProject = await Project.findOne({ _id: fromProjectId, orgId: user.orgId });
    if (!fromProject) throw new AppError("Source project not found", 404);
    const lead = await ProjectLead.findOne({ _id: leadId, project: fromProjectId });
    if (!lead) throw new AppError("Lead not found", 404);

    if (toProjectId) {
      const target = await Project.findOne({ _id: toProjectId, isArchived: false, orgId: user.orgId });
      if (!target) throw new AppError("Target project not found", 404);
      lead.project = toProjectId;
      await lead.save();
      return { data: lead, message: `Transferred to ${target.name}` };
    }

    if (toLeads) {
      const newLead = await Lead.create({
        name:    lead.name,
        phone:   lead.phone,
        email:   lead.email || "",
        source:  source || lead.source || "Manual",
        createdBy: user._id,
        orgId:   user.orgId,
        // Preserve all telecaller remark fields
        remark1:      lead.remark1      || "",
        remark2:      lead.remark2      || "",
        remark3:      lead.remark3      || "",
        remark4:      lead.remark4      || "",
        remark:       lead.remarkNote   || "", // ProjectLead.remarkNote → Lead.remark
        followUpDate: lead.followUp     || null,
        followUp2:    lead.followUp2    || null,
        booking:      lead.booking      || "",
        followUpSetBy:      lead.followUpSetBy     || null,
        followUpSetByName:  lead.followUpSetByName || "",
      });
      await ProjectLead.findByIdAndDelete(leadId);
      return { data: newLead, message: "Transferred to main pipeline" };
    }

    throw new AppError("Specify toProjectId or toLeads=true", 400);
  },
};

module.exports = projectService;
