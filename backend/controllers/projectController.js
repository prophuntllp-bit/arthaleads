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
      const projects = await projectService.getAll();
      res.json({ success: true, data: projects });
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const project = await projectService.getById(req.params.id);
      res.json({ success: true, data: project });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const project = await projectService.update(req.params.id, req.body);
      res.json({ success: true, data: project });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await projectService.remove(req.params.id);
      res.json({ success: true, message: "Project archived" });
    } catch (err) { next(err); }
  },

  async importLeads(req, res, next) {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || !rows.length) {
        return next(new AppError("rows array is required", 400));
      }
      const result = await projectService.importLeads(req.params.id, rows, req.user);
      res.status(201).json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getLeads(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const result = await projectService.getLeads(req.params.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        search: search || "",
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async updateRemark(req, res, next) {
    try {
      const { remark, remarkNote } = req.body;
      if (!remark) return next(new AppError("remark is required", 400));
      const lead = await projectService.updateRemark(
        req.params.leadId,
        { remark, remarkNote },
        req.user
      );
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
