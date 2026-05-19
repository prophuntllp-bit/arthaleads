const leadService = require("../services/leadService");
const { sendPushToAll } = require("../utils/push");
const { AppError } = require("../middlewares/errorHandler");

const leadController = {
  async create(req, res, next) {
    try {
      const lead = await leadService.create(req.body, req.user);
      res.status(201).json({ success: true, data: lead });
      // Send push notification for new manual lead — scoped to this org
      sendPushToAll({
        type: "new_lead",
        title: `New Lead: ${lead.name}`,
        body: `${lead.source} lead added by ${req.user.name}`,
        data: { source: lead.source },
      }, req.user.orgId).catch(() => {});
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

  async getAllUnified(req, res, next) {
    try {
      const result = await leadService.getAllUnified(req.query, req.user);
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
      // Single notification for bulk import — scoped to this org
      if (imported.length > 0) {
        sendPushToAll({
          type: "bulk_import",
          title: `${imported.length} New Leads Added`,
          body: `${req.user.name} just imported ${imported.length} leads. Check now!`,
          data: { count: imported.length },
        }, req.user.orgId).catch(() => {});
      }
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
      const count = await leadService.bulkDelete(ids, req.user);
      res.json({ success: true, message: `${count} lead(s) deleted` });
    } catch (err) {
      next(err);
    }
  },

  async restore(req, res, next) {
    try {
      const lead = await leadService.restore(req.params.id, req.orgId);
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  },

  async permanentDelete(req, res, next) {
    try {
      await leadService.permanentDelete(req.params.id, req.orgId);
      res.json({ success: true });
    } catch (err) { next(err); }
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
      const { page = 1, limit = 50 } = req.query;
      const result = await leadService.getDump(req.user, { page, limit });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getAlerts(req, res, next) {
    try {
      const leads = await leadService.getAlerts(req.user);
      res.json({ success: true, data: leads });
    } catch (err) {
      next(err);
    }
  },

  async transferLead(req, res, next) {
    try {
      const { toProjectId } = req.body;
      if (!toProjectId) return next(new AppError("toProjectId required", 400));
      const result = await leadService.transferToProject(req.params.id, toProjectId, req.user);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async exportLeads(req, res, next) {
    try {
      const { format = "csv", ids } = req.query;
      let sourceLeads;

      const EXPORT_LIMIT = 5000;
      let truncated = false;

      if (ids) {
        // Export specific IDs (selected leads)
        const idList = ids.split(",").filter(Boolean);
        const { leads } = await leadService.getAllUnified({ limit: EXPORT_LIMIT, page: 1 }, req.user);
        sourceLeads = leads.filter((l) => idList.includes(String(l._id)));
      } else {
        const query = { ...req.query, limit: EXPORT_LIMIT + 1, page: 1 };
        delete query.format;
        const { leads } = await leadService.getAllUnified(query, req.user);
        if (leads.length > EXPORT_LIMIT) {
          truncated = true;
          sourceLeads = leads.slice(0, EXPORT_LIMIT);
        } else {
          sourceLeads = leads;
        }
      }

      const rows = sourceLeads.map((lead) => ({
        Name: lead.name || "",
        Phone: lead.phone || "",
        Email: lead.email || "",
        Source: lead.source || "",
        Status: lead.status || "",
        Priority: lead.priority || "",
        PropertyType: lead.propertyType || "",
        BHK: lead.bhk || "",
        Purpose: lead.purpose || "",
        BudgetMin: lead.budget?.min || "",
        BudgetMax: lead.budget?.max || "",
        FollowUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : "",
        FollowUpNote: lead.followUpNote || "",
        Remark1: lead.remark1 || "",
        Remark2: lead.remark2 || "",
        ContactStatus: lead.remark || "",
        Booking: lead.booking || "",
        AssignedTo: lead.assignedToName || "",
        Project: lead.projectName || "",
        CreatedAt: lead.createdAt ? new Date(lead.createdAt).toISOString().slice(0, 10) : "",
      }));

      const date = new Date().toISOString().slice(0, 10);

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="leads-${date}.json"`);
        return res.send(JSON.stringify(rows, null, 2));
      }

      // CSV (default)
      if (!rows.length) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="leads-${date}.csv"`);
        return res.send("﻿" + "Name,Phone,Email,Source,Status,Priority,CreatedAt\r\n");
      }
      const headers = Object.keys(rows[0]);
      // Escape double-quotes and strip newlines so each row stays on one line
      const escape = (v) => {
        let s = String(v ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ");
        // Neutralize CSV formula injection (=, +, -, @, tab, carriage return at start)
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s}"`;
      };
      const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leads-${date}.csv"`);
      if (truncated) res.setHeader("X-Truncated", "true");
      res.send("\uFEFF" + csv);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = leadController;
