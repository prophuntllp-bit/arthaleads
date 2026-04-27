// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const attendanceController = {
  // GET /api/attendance/status — today's record for the current user
  async status(req, res, next) {
    try {
      const record = await Attendance.findOne({
        userId: req.user._id,
        date: todayStr(),
      });
      res.json({ success: true, data: record || null });
    } catch (err) { next(err); }
  },

  // POST /api/attendance/clockin
  async clockIn(req, res, next) {
    try {
      const date = todayStr();
      // Upsert: create if not exists, only set clockIn if it's still null
      let record = await Attendance.findOne({ userId: req.user._id, date });

      if (record && record.clockIn) {
        return next(new AppError("Already clocked in today.", 400));
      }

      if (!record) {
        record = await Attendance.create({
          userId: req.user._id,
          orgId: req.user.orgId,
          date,
          clockIn: new Date(),
        });
      } else {
        record.clockIn = new Date();
        record.clockOut = null;
        record.totalMinutes = null;
        await record.save();
      }

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // POST /api/attendance/clockout
  async clockOut(req, res, next) {
    try {
      const record = await Attendance.findOne({
        userId: req.user._id,
        date: todayStr(),
      });

      if (!record || !record.clockIn) {
        return next(new AppError("You haven't clocked in yet.", 400));
      }
      if (record.clockOut) {
        return next(new AppError("Already clocked out.", 400));
      }

      const now = new Date();
      record.clockOut = now;
      record.totalMinutes = Math.round((now - record.clockIn) / 60000);
      if (req.body.note) record.note = req.body.note;
      await record.save();

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // GET /api/attendance — list records
  // Admin/Manager: all team records; Agent: own only
  // Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=xxx&page=1&limit=50
  async list(req, res, next) {
    try {
      const { from, to, userId, page = 1, limit = 60 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const filter = { orgId: req.user.orgId };

      // Agents can only see their own
      if (req.user.role === "agent") {
        filter.userId = req.user._id;
      } else if (userId) {
        filter.userId = userId;
      }

      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = from;
        if (to)   filter.date.$lte = to;
      }

      const [records, total] = await Promise.all([
        Attendance.find(filter)
          .sort({ date: -1, clockIn: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "name email role"),
        Attendance.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: records,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) { next(err); }
  },

  // GET /api/attendance/team-today — all members' status for today (admin/manager)
  async teamToday(req, res, next) {
    try {
      if (req.user.role === "agent") {
        return next(new AppError("Not authorized.", 403));
      }

      const today = todayStr();

      // Get all active org users
      const users = await User.find({ orgId: req.user.orgId, isActive: { $ne: false } })
        .select("name email role");

      // Get today's attendance records for org
      const records = await Attendance.find({ orgId: req.user.orgId, date: today });
      const recordMap = {};
      records.forEach(r => { recordMap[String(r.userId)] = r; });

      const team = users.map(u => ({
        user: u,
        attendance: recordMap[String(u._id)] || null,
      }));

      res.json({ success: true, data: team });
    } catch (err) { next(err); }
  },
};

module.exports = attendanceController;
