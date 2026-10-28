// routes/auditRoutes.js
//
// GET /api/audit-log: an organisation's own activity log (DPDP Rules 2025,
// owner, 28 Oct 2026). Rows are written by middlewares/auditTrail.js and kept
// about 400 days (models/AuditLog.js).
//
// Who: an org admin sees only rows whose targetOrg is their organisation
// (support access by ArthaLeads staff included). A super admin sees every
// organisation, or one with ?orgId=. Managers and agents get 403.
//
// Query (all optional):
//   page    1-based, default 1
//   limit   rows per page, default 50, max 200
//   from    "YYYY-MM-DD" (start of that IST day) or an ISO timestamp
//   to      "YYYY-MM-DD" (end of that IST day) or an ISO timestamp
//   userId  rows done by, or done as, this person
//   action  one action ("login_failed") or several, comma separated
//   orgId   super admin only
//
// Response: { success, entries, total, page, pages }. Each entry carries the
// stored fields plus atIST ("28 October 2026, 3:05 pm") and the names of
// performedBy / targetUser where those accounts still exist.
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const { AppError } = require("../middlewares/errorHandler");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { formatISTDateTime, istRangeStart, istRangeEnd } = require("../utils/datetime");

const isId = (v) => mongoose.isValidObjectId(v) && /^[0-9a-f]{24}$/i.test(String(v));
const validDate = (d) => d instanceof Date && !isNaN(d);

router.get("/", protect, authorize("admin"), async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const filter = { at: { $exists: true } };
    if (req.user.role === "super_admin") {
      if (req.query.orgId) {
        if (!isId(req.query.orgId)) return next(new AppError("orgId is not valid", 400));
        filter.targetOrg = new mongoose.Types.ObjectId(String(req.query.orgId));
      }
    } else {
      if (!req.orgId) return next(new AppError("Access denied", 403));
      filter.targetOrg = req.orgId;                 // never from the query
    }

    if (req.query.from || req.query.to) {
      const range = {};
      if (req.query.from) { const d = istRangeStart(String(req.query.from)); if (!validDate(d)) return next(new AppError("from is not a date", 400)); range.$gte = d; }
      if (req.query.to)   { const d = istRangeEnd(String(req.query.to));     if (!validDate(d)) return next(new AppError("to is not a date", 400));   range.$lte = d; }
      filter.at = range;
    }
    if (req.query.userId) {
      if (!isId(req.query.userId)) return next(new AppError("userId is not valid", 400));
      const uid = new mongoose.Types.ObjectId(String(req.query.userId));
      filter.$or = [{ performedBy: uid }, { targetUser: uid }];
    }
    if (req.query.action) {
      const actions = String(req.query.action).split(",").map((a) => a.trim())
        .filter((a) => AuditLog.ACTIVITY_ACTIONS.includes(a));
      if (!actions.length) return next(new AppError("Unknown action", 400));
      filter.action = actions.length === 1 ? actions[0] : { $in: actions };
    }

    const [rows, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit)
        .select("-__v -updatedAt -performedByName -targetUserName -targetOrgName").lean(),
      AuditLog.countDocuments(filter),
    ]);

    const ids = [...new Set(rows.flatMap((r) => [r.performedBy, r.targetUser]).filter(Boolean).map(String))];
    const people = ids.length ? await User.find({ _id: { $in: ids } }).select("name").lean() : [];
    const nameOf = new Map(people.map((p) => [String(p._id), p.name]));

    const entries = rows.map((r) => ({
      ...r,
      atIST: formatISTDateTime(r.at),
      performedByName: r.performedBy ? nameOf.get(String(r.performedBy)) || null : null,
      targetUserName: r.targetUser ? nameOf.get(String(r.targetUser)) || null : null,
    }));

    res.json({ success: true, entries, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
