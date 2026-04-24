// services/projectService.js
const Project = require("../models/Project");
const ProjectLead = require("../models/ProjectLead");
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

  async update(id, data) {
    const project = await Project.findOneAndUpdate(
      { _id: id, isArchived: false },
      data,
      { new: true, runValidators: true }
    );
    if (!project) throw new AppError("Project not found", 404);
    return project;
  },

  async remove(id) {
    const project = await Project.findOneAndUpdate(
      { _id: id, isArchived: false },
      { isArchived: true },
      { new: true }
    );
    if (!project) throw new AppError("Project not found", 404);
    return project;
  },

  async importLeads(projectId, rows, user) {
    // Verify project exists
    const project = await Project.findOne({ _id: projectId, isArchived: false });
    if (!project) throw new AppError("Project not found", 404);

    const valid = rows.filter((r) => r.name && r.phone);
    if (!valid.length) throw new AppError("No valid rows found. Each row needs at least name and phone.", 400);

    const docs = valid.map((r) => ({
      project: projectId,
      name: r.name,
      phone: r.phone,
      email: r.email || "",
      source: r.source || "Facebook",
      importedBy: user._id,
    }));

    const inserted = await ProjectLead.insertMany(docs, { ordered: false });
    return { inserted: inserted.length, skipped: rows.length - valid.length };
  },

  async getLeads(projectId, { page = 1, limit = 50, search = "" }) {
    const filter = { project: projectId };
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
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

  async updateLeadFields(leadId, data) {
    const lead = await ProjectLead.findById(leadId);
    if (!lead) throw new AppError("Lead not found", 404);

    // Only update fields that exist in the ProjectLead schema
    const allowed = ["name", "phone", "email", "source", "remark", "remarkNote", "remark1", "remark2", "followUp", "followUp2", "booking"];
    allowed.forEach((f) => { if (f in data) lead[f] = data[f]; });

    await lead.save();
    return lead;
  },

  async deleteLead(leadId) {
    const lead = await ProjectLead.findByIdAndDelete(leadId);
    if (!lead) throw new AppError("Lead not found", 404);
  },

  async bulkDeleteLeads(projectId, ids) {
    const result = await ProjectLead.deleteMany({ _id: { $in: ids }, project: projectId });
    return result.deletedCount;
  },
};

module.exports = projectService;
