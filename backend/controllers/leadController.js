const leadService = require("../services/leadService");

const leadController = {
  async create(req, res, next) {
    try {
      const lead = await leadService.create(req.body, req.user);
      res.status(201).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const result = await leadService.getAll(req.query, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const lead = await leadService.getById(req.params.id, req.user);
      res.json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const lead = await leadService.update(req.params.id, req.body, req.user);
      res.json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await leadService.delete(req.params.id, req.user);
      res.json({ success: true, message: "Lead deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  async addNote(req, res, next) {
    try {
      const lead = await leadService.addNote(req.params.id, req.body.text, req.user);
      res.json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },

  async assign(req, res, next) {
    try {
      const lead = await leadService.assign(req.params.id, req.body.agentId, req.user);
      res.json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },

  async bulkImport(req, res, next) {
    try {
      const imported = await leadService.bulkImport(req.body.leads, req.user);
      res.status(201).json({
        success: true,
        count: imported.length,
        message: `${imported.length} lead(s) imported successfully`,
        data: imported,
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "ids array is required" });
      }
      const count = await leadService.bulkDelete(ids);
      res.json({ success: true, message: `${count} lead(s) deleted` });
    } catch (err) {
      next(err);
    }
  },

  async getAnalytics(req, res, next) {
    try {
      const data = await leadService.getAnalytics(req.user, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getDump(req, res, next) {
    try {
      const leads = await leadService.getDump(req.user);
      res.json({ success: true, data: leads });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = leadController;
