// controllers/projectController.js
const projectService = require("../services/projectService");
const { AppError } = require("../middlewares/errorHandler");

const projectController = {
  async create(req, res, next) {
    try {
      const project = await projectService.create(req.body, req.user);
      res.status(201).json({ success: true, data: project });
    } catch (err) { next(err); }
  },

  async getAll(req, res, next) {
    try {
      const forTransfer = req.query.forTransfer === "true";
      const projects = await projectService.getAll(req.user, { forTransfer });
      res.json({ success: true, data: projects });
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const project = await projectService.getById(req.params.id, req.user);
      res.json({ success: true, data: project });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const project = await projectService.update(req.params.id, req.body, req.user);
      res.json({ success: true, data: project });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await projectService.remove(req.params.id, req.user);
      res.json({ success: true, message: "Project archived" });
    } catch (err) { next(err); }
  },

  async importLeads(req, res, next) {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || !rows.length) {
        return next(new AppError("rows array is required", 400));
      }
      if (rows.length > 5000) {
        return next(new AppError("Maximum 5000 rows per import. Split your file and retry.", 400));
      }
      // Basic field sanitization - strip any attempt to set isDeleted / orgId via import
      const sanitized = rows.map(({ isDeleted, orgId, _id, createdBy, ...rest }) => rest);
      const result = await projectService.importLeads(req.params.id, sanitized, req.user);
      res.status(201).json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getLeads(req, res, next) {
    try {
      const { page, limit, search, bookingIn, bookingNotIn, isProspective, followUpFrom, followUpTo } = req.query;
      const result = await projectService.getLeads(req.params.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        search: search || "",
        bookingIn: bookingIn || null,
        bookingNotIn: bookingNotIn || null,
        isProspective: isProspective || false,
        followUpFrom: followUpFrom || null,
        followUpTo: followUpTo || null,
      }, req.user);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async updateRemark(req, res, next) {
    try {
      const { remark = "", remarkNote } = req.body;
      const lead = await projectService.updateRemark(
        req.params.leadId,
        { remark, remarkNote },
        req.user
      );
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async updateLeadFields(req, res, next) {
    try {
      const lead = await projectService.updateLeadFields(req.params.leadId, req.body, req.user);
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async deleteLead(req, res, next) {
    try {
      await projectService.deleteLead(req.params.leadId, req.user);
      res.json({ success: true, message: "Lead deleted" });
    } catch (err) { next(err); }
  },

  async bulkDeleteLeads(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "ids array is required" });
      }
      const count = await projectService.bulkDeleteLeads(req.params.id, ids, req.user);
      res.json({ success: true, message: `${count} lead(s) deleted` });
    } catch (err) { next(err); }
  },

  async bulkUpdateStatus(req, res, next) {
    try {
      const { ids, booking } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "ids array is required" });
      }
      if (!booking) {
        return res.status(400).json({ success: false, message: "booking value is required" });
      }
      const count = await projectService.bulkUpdateStatus(req.params.id, ids, booking, req.user);
      res.json({ success: true, message: `${count} lead(s) updated`, count });
    } catch (err) { next(err); }
  },

  async transferLead(req, res, next) {
    try {
      const { toProjectId, toLeads, source } = req.body;
      const result = await projectService.transferLead(
        req.params.leadId, req.params.id, { toProjectId, toLeads, source }, req.user
      );
      res.json({ success: true, data: result.data, message: result.message });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
