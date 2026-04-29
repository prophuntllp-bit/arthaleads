// controllers/superAdminController.js
const Organization = require("../models/Organization");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { AppError } = require("../middlewares/errorHandler");

const superAdminController = {
  // GET /api/super-admin/orgs — list all orgs with live stats
  async listOrgs(req, res, next) {
    try {
      const orgs = await Organization.find().sort({ createdAt: -1 }).lean();

      // Attach user count + lead count per org in two aggregations
      const [userCounts, leadCounts] = await Promise.all([
        User.aggregate([
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
          { $match: { isDeleted: { $ne: true }, isArchived: false } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
      ]);

      const userMap  = Object.fromEntries(userCounts.map((u) => [String(u._id), u.count]));
      const leadMap  = Object.fromEntries(leadCounts.map((l) => [String(l._id), l.count]));

      const enriched = orgs.map((org) => ({
        ...org,
        userCount: userMap[String(org._id)] || 0,
        leadCount: leadMap[String(org._id)] || 0,
      }));

      res.json({ success: true, total: orgs.length, orgs: enriched });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id/logo — upload base64 logo for an org (logo:"" removes it)
  async updateLogo(req, res, next) {
    try {
      const { logo } = req.body;
      if (logo === undefined) return next(new AppError("logo field is required", 400));

      // Accept empty string (remove), base64 data-URI, or plain URL
      if (logo !== "") {
        const isValid =
          logo.startsWith("data:image/") ||
          logo.startsWith("http://") ||
          logo.startsWith("https://");
        if (!isValid) return next(new AppError("logo must be a data-URI or HTTPS URL", 400));
      }

      const org = await Organization.findByIdAndUpdate(
        req.params.id,
        { logo },
        { new: true }
      ).select("name logo");
      if (!org) return next(new AppError("Organization not found", 404));

      res.json({ success: true, org });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id — update plan / isActive
  async updateOrg(req, res, next) {
    try {
      const allowed = ["plan", "isActive", "name", "brandColor"];
      const update  = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

      // Validate brandColor if provided
      if (update.brandColor !== undefined && update.brandColor !== "") {
        if (!/^#[0-9A-Fa-f]{6}$/.test(update.brandColor)) {
          return next(new AppError("brandColor must be a valid 6-digit hex colour (e.g. #2563eb)", 400));
        }
      }

      const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!org) return next(new AppError("Organization not found", 404));

      res.json({ success: true, org });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = superAdminController;
