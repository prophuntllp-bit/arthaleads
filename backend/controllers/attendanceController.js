// controllers/attendanceController.js
const Attendance = require("../models/Attendance");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");
const { uploadAttendanceSelfie } = require("../utils/upload");

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Fetch org attendance settings with sensible defaults
async function getOrgSettings(orgId) {
  const org = await Organization.findById(orgId).select("attendanceSettings").lean();
  const s = org?.attendanceSettings || {};
  return {
    shiftStartTime: s.shiftStartTime || "09:30",
    shiftEndTime:   s.shiftEndTime   || "19:00",
    bufferMinutes:  s.bufferMinutes  ?? 15,
    halfDayMinutes: s.halfDayMinutes ?? 240,
    fullDayMinutes: s.fullDayMinutes ?? 480,
    requireSelfie:  s.requireSelfie  ?? true,
  };
}

// Compute early leave flag from clock-out time vs expected end time
function computeEarlyLeave(clockOutDate, settings) {
  if (!clockOutDate) return { isEarlyLeave: false, earlyLeaveByMinutes: null };
  const clockOutMins = clockOutDate.getHours() * 60 + clockOutDate.getMinutes();
  const endMins = parseHHMM(settings.shiftEndTime);
  const isEarlyLeave = clockOutMins < endMins;
  return {
    isEarlyLeave,
    earlyLeaveByMinutes: isEarlyLeave ? endMins - clockOutMins : null,
  };
}

// Parse "HH:MM" → total minutes since midnight
function parseHHMM(str) {
  const [h, m] = (str || "09:30").split(":").map(Number);
  return h * 60 + m;
}

// Compute day type from total worked minutes
function computeDayType(totalMins, settings) {
  if (totalMins >= settings.fullDayMinutes) return "full";
  if (totalMins >= settings.halfDayMinutes) return "half";
  return "short";
}

const attendanceController = {
  // GET /api/attendance/status - today's record for the current user
  async status(req, res, next) {
    try {
      const [record, settings] = await Promise.all([
        Attendance.findOne({ userId: req.user._id, date: todayStr() }),
        getOrgSettings(req.user.orgId),
      ]);
      res.json({ success: true, data: record || null, requireSelfie: settings.requireSelfie });
    } catch (err) { next(err); }
  },

  // POST /api/attendance/clockin
  async clockIn(req, res, next) {
    try {
      const date = todayStr();
      let record = await Attendance.findOne({ userId: req.user._id, date });

      if (record && record.clockIn) {
        return next(new AppError("Already clocked in today.", 400));
      }

      // Compute late status against org shift settings
      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();
      const clockInMins = now.getHours() * 60 + now.getMinutes();
      const lateThreshold = parseHHMM(settings.shiftStartTime) + settings.bufferMinutes;
      const isLate = clockInMins > lateThreshold;
      const lateByMinutes = isLate ? clockInMins - lateThreshold : null;

      // Handle selfie upload and geo fields
      let { selfie, lat, lng } = req.body;
      let clockInSelfie = "";
      if (selfie && selfie.startsWith("data:")) {
        try {
          clockInSelfie = await uploadAttendanceSelfie(selfie, String(req.user._id), date, "in");
        } catch (e) {
          console.error("[attendance] selfie upload failed:", e.message);
        }
      }
      const clockInLat = lat != null ? Number(lat) : null;
      const clockInLng = lng != null ? Number(lng) : null;

      if (!record) {
        record = await Attendance.create({
          userId: req.user._id,
          orgId: req.user.orgId,
          date,
          clockIn: now,
          isLate,
          lateByMinutes,
          clockInSelfie,
          clockInLat,
          clockInLng,
        });
      } else {
        record.clockIn = now;
        record.clockOut = null;
        record.totalMinutes = null;
        record.dayType = null;
        record.isLate = isLate;
        record.lateByMinutes = lateByMinutes;
        record.clockInSelfie = clockInSelfie;
        record.clockInLat = clockInLat;
        record.clockInLng = clockInLng;
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

      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();
      record.clockOut = now;
      record.totalMinutes = Math.round((now - record.clockIn) / 60000);
      record.dayType = computeDayType(record.totalMinutes, settings);
      const { isEarlyLeave, earlyLeaveByMinutes } = computeEarlyLeave(now, settings);
      record.isEarlyLeave = isEarlyLeave;
      record.earlyLeaveByMinutes = earlyLeaveByMinutes;
      if (req.body.note) record.note = req.body.note;

      // Handle selfie upload and geo fields
      let { selfie, lat, lng } = req.body;
      let clockOutSelfie = "";
      if (selfie && selfie.startsWith("data:")) {
        try {
          clockOutSelfie = await uploadAttendanceSelfie(selfie, String(req.user._id), record.date, "out");
        } catch (e) {
          console.error("[attendance] selfie upload failed:", e.message);
        }
      }
      record.clockOutSelfie = clockOutSelfie;
      record.clockOutLat = lat != null ? Number(lat) : null;
      record.clockOutLng = lng != null ? Number(lng) : null;

      await record.save();

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // GET /api/attendance - list records
  // Admin/Manager: all team records; Agent: own only
  // Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=xxx&page=1&limit=50
  async list(req, res, next) {
    try {
      const { from, to, userId, page = 1, limit = 60 } = req.query;
      const safePage = Math.max(1, parseInt(page) || 1);
      const skip = (safePage - 1) * parseInt(limit);

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
        page: safePage,
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) { next(err); }
  },

  // GET /api/attendance/export - download CSV (admin/manager only)
  // Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=xxx
  async exportCsv(req, res, next) {
    try {
      if (req.user.role === "agent") {
        return next(new AppError("Not authorized.", 403));
      }

      const { from, to, userId } = req.query;
      const filter = { orgId: req.user.orgId };
      if (userId) filter.userId = userId;
      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = from;
        if (to)   filter.date.$lte = to;
      }

      const records = await Attendance.find(filter)
        .sort({ date: 1, clockIn: 1 })
        .populate("userId", "name email role")
        .lean();

      // Build CSV
      const fmtTime = (d) => {
        if (!d) return "";
        const dt = new Date(d);
        const h = dt.getHours(), m = dt.getMinutes();
        const ampm = h >= 12 ? "PM" : "AM";
        return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
      };
      const fmtDur = (mins) => {
        if (mins == null) return "";
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      };

      const header = ["Date", "Name", "Email", "Role", "Clock In", "Clock Out", "Duration", "Day Type", "Late", "Late By", "Early Leave", "Early Leave By", "Note"];
      const rows = records.map((r) => [
        r.date,
        r.userId?.name || "",
        r.userId?.email || "",
        r.userId?.role || "",
        fmtTime(r.clockIn),
        fmtTime(r.clockOut),
        fmtDur(r.totalMinutes),
        r.dayType || "",
        r.isLate ? "Yes" : "No",
        r.lateByMinutes ? fmtDur(r.lateByMinutes) : "",
        r.isEarlyLeave ? "Yes" : "No",
        r.earlyLeaveByMinutes ? fmtDur(r.earlyLeaveByMinutes) : "",
        r.note || "",
      ]);

      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");

      const label = from && to ? `${from}_to_${to}` : "all";
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="attendance_${label}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  },

  // POST /api/attendance/admin-entry - admin manually adds/edits a record (admin only)
  // Body: { userId, date, clockIn, clockOut, note }
  async adminEntry(req, res, next) {
    try {
      if (!["admin", "manager"].includes(req.user.role)) {
        return next(new AppError("Not authorized.", 403));
      }

      const { userId, date, clockIn, clockOut, note } = req.body;
      if (!userId || !date) return next(new AppError("userId and date are required.", 400));

      // Ensure the target user actually belongs to the caller's org. Without this,
      // an upsert would fabricate an attendance record for any arbitrary userId
      // (e.g. a super_admin or a user in another org) scoped to the caller's org.
      const targetUser = await User.findOne({ _id: userId, orgId: req.user.orgId }).select("_id");
      if (!targetUser) return next(new AppError("User not found in your organisation.", 404));

      const clockInDate  = clockIn  ? new Date(clockIn)  : null;
      const clockOutDate = clockOut ? new Date(clockOut) : null;

      if (clockInDate && isNaN(clockInDate)) return next(new AppError("Invalid clockIn time.", 400));
      if (clockOutDate && isNaN(clockOutDate)) return next(new AppError("Invalid clockOut time.", 400));
      if (clockInDate && clockOutDate && clockOutDate <= clockInDate) {
        return next(new AppError("Clock-out must be after clock-in.", 400));
      }

      const settings = await getOrgSettings(req.user.orgId);
      const totalMinutes = (clockInDate && clockOutDate)
        ? Math.round((clockOutDate - clockInDate) / 60000)
        : null;

      // Compute late status from the clock-in time
      let isLate = false, lateByMinutes = null;
      if (clockInDate) {
        const clockInMins = clockInDate.getHours() * 60 + clockInDate.getMinutes();
        const lateThreshold = parseHHMM(settings.shiftStartTime) + settings.bufferMinutes;
        isLate = clockInMins > lateThreshold;
        lateByMinutes = isLate ? clockInMins - lateThreshold : null;
      }
      const dayType = totalMinutes != null ? computeDayType(totalMinutes, settings) : null;
      const { isEarlyLeave, earlyLeaveByMinutes } = computeEarlyLeave(clockOutDate, settings);

      const record = await Attendance.findOneAndUpdate(
        { userId, orgId: req.user.orgId, date },
        { $set: { clockIn: clockInDate, clockOut: clockOutDate, totalMinutes, isLate, lateByMinutes, isEarlyLeave, earlyLeaveByMinutes, dayType, note: note || "" } },
        { upsert: true, new: true, runValidators: false }
      ).populate("userId", "name email role");

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // GET /api/attendance/team-today - all members' status for today (admin/manager)
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
