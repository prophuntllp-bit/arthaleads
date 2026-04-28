// services/projectService.js
const Project = require("../models/Project");
const ProjectLead = require("../models/ProjectLead");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

const projectService = {
  async create(data, user) {
    const project = await Project.create({ ...data, createdBy: user._id, orgId: user.orgId });
    return project;
  },

  async getAll(user) {
    const filter = { isArchived: false, orgId: user.orgId };

    // Agents can only see projects assigned to them (or unassigned)
    if (user.role === "agent") {
      filter.$or = [
        { assignedTo: { $size: 0 } },
        { assignedTo: { $exists: false } },
        { assignedTo: user._id },
      ];
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

    // Agents can only access projects assigned to them (or unassigned)
    if (user.role === "agent") {
      filter.$or = [
        { assignedTo: { $size: 0 } },
        { assignedTo: { $exists: false } },
        { assignedTo: user._id },
      ];
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

    const valid = rows.filter((r) => r.name && r.phone);
    if (!valid.length) throw new AppError("No valid rows found. Each row needs at least name and phone.", 400);

    const docs = valid.map((r) => ({
      project: projectId,
      name: r.name,
      phone: r.phone,
      email: r.email || "",
      source: r.source || "Facebook",
      remarkNote: r.remarkNote || "",  // preserve custom Facebook form answers
      importedBy: user._id,
      orgId: user.orgId,  // propagate tenant id for direct filtering
    }));

    const inserted = await ProjectLead.insertMany(docs, { ordered: false });
    return { inserted: inserted.length, skipped: rows.length - valid.length };
  },

  async getLeads(projectId, { page = 1, limit = 50, search = "", bookingIn = null }, user) {
    // Verify the project belongs to the requesting user's org
    const project = await Project.findOne({ _id: projectId, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);
    const filter = { project: projectId };
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }
    // bookingIn = comma-separated values e.g. "Interested,Site Visit Booked"
    if (bookingIn) {
      filter.booking = { $in: bookingIn.split(",").map((v) => v.trim()) };
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
    const lead = await ProjectLead.findById(leadId).populate("project", "orgId");
    if (!lead) throw new AppError("Lead not found", 404);
    if (String(lead.project?.orgId) !== String(user.orgId)) throw new AppError("Access denied", 403);

    // Only update fields that exist in the ProjectLead schema
    const allowed = ["name", "phone", "email", "source", "remark", "remarkNote", "remark1", "remark2", "followUp", "followUp2", "booking"];
    allowed.forEach((f) => { if (f in data) lead[f] = data[f]; });

    await lead.save();
    return lead;
  },

  async deleteLead(leadId, user) {
    const lead = await ProjectLead.findById(leadId).populate("project", "orgId");
    if (!lead) throw new AppError("Lead not found", 404);
    if (String(lead.project?.orgId) !== String(user.orgId)) throw new AppError("Access denied", 403);
    await lead.deleteOne();
  },

  async bulkDeleteLeads(projectId, ids, user) {
    // Verify the project belongs to the requesting user's org before mass-delete
    const project = await Project.findOne({ _id: projectId, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);
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
        name: lead.name, phone: lead.phone, email: lead.email || "",
        source: source || lead.source || "Manual",
        createdBy: user._id, orgId: user.orgId,
        remark1: lead.remark1 || "", remark2: lead.remark2 || "",
      });
      await ProjectLead.findByIdAndDelete(leadId);
      return { data: newLead, message: "Transferred to main pipeline" };
    }

    throw new AppError("Specify toProjectId or toLeads=true", 400);
  },
};

module.exports = projectService;
