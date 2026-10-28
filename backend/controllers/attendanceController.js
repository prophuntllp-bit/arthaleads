// controllers/attendanceController.js
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");
const { uploadAttendanceSelfie } = require("../utils/upload");

// All time-of-day comparisons must use IST (UTC+5:30) because the server
// runs in UTC. .getHours() returns UTC hours, which is wrong for India.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// A clock-in older than this is never "still running": clock-out and the
// status look no further back (owner, 28 Oct 2026).
const OPEN_WINDOW_MS = 24 * HOUR;

function toIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

// Minutes since midnight in IST — use this everywhere instead of getHours()*60+getMinutes()
function istMins(date) {
  const ist = toIST(date);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

// "YYYY-MM-DD" of a moment, in IST
function istDateStr(date) {
  return toIST(date).toISOString().slice(0, 10);
}

// Today's date string in IST (safe even at UTC midnight)
function todayStr() {
  return istDateStr(new Date());
}

function addDaysStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

// Parse "HH:MM" → total minutes since midnight
function parseHHMM(str) {
  const [h, m] = (str || "09:30").split(":").map(Number);
  return h * 60 + m;
}

// A shift that ends before it starts (a night shift) ends the next calendar day.
const isNightShift = (settings) => parseHHMM(settings.shiftEndTime) <= parseHHMM(settings.shiftStartTime);

// When the shift starts and ends, for the shift that begins on dateStr (IST).
function shiftStartAt(dateStr, settings) {
  return new Date(`${dateStr}T${settings.shiftStartTime || "09:30"}:00+05:30`);
}
function shiftEndAt(dateStr, settings) {
  const end = new Date(`${dateStr}T${settings.shiftEndTime || "19:00"}:00+05:30`);
  if (isNightShift(settings)) end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

// The day a clock-in belongs to. On a night shift (22:00-06:00), 01:30 is still
// the shift that began the evening before.
function shiftDateFor(now, settings) {
  const day = istDateStr(now);
  if (isNightShift(settings) && istMins(now) < parseHHMM(settings.shiftEndTime)) return addDaysStr(day, -1);
  return day;
}

// Late: in after start + grace, but only while the shift is on. Clocking in
// after the shift has ended is "outside shift", not "8 hours late".
function computeLate(clockInDate, dateStr, settings) {
  const none = { isLate: false, lateByMinutes: null, outsideShift: false };
  if (!clockInDate) return none;
  if (clockInDate >= shiftEndAt(dateStr, settings)) return { ...none, outsideShift: true };
  const after = Math.floor((clockInDate - shiftStartAt(dateStr, settings)) / 60000) - settings.bufferMinutes;
  return after >= 0 ? { ...none, isLate: true, lateByMinutes: after } : none;
}

// Early leave: left before the shift's end, comparing whole date-times so a
// clock-out after midnight is not mistaken for 1 AM "before" a 7 PM shift end.
function computeEarlyLeave(clockOutDate, settings, dateStr) {
  if (!clockOutDate) return { isEarlyLeave: false, earlyLeaveByMinutes: null };
  const diff = Math.round((shiftEndAt(dateStr, settings) - clockOutDate) / 60000);
  return { isEarlyLeave: diff > 0, earlyLeaveByMinutes: diff > 0 ? diff : null };
}

// Overtime = any time worked past shift end (Option A: time-after-shift)
function computeOvertime(clockOutDate, settings, dateStr) {
  if (!clockOutDate) return { overtimeMinutes: null };
  const diff = Math.round((clockOutDate - shiftEndAt(dateStr, settings)) / 60000);
  return { overtimeMinutes: diff > 0 ? diff : null };
}

// Compute day type from total worked minutes
function computeDayType(totalMins, settings) {
  if (totalMins >= settings.fullDayMinutes) return "full";
  if (totalMins >= settings.halfDayMinutes) return "half";
  return "short";
}

// The person's session that is still running: clocked in within the last day
// and not clocked out, whatever its date (a night shift, or yesterday's).
function findOpenSession(userId, now = new Date()) {
  return Attendance.findOne({ userId, clockOut: null, clockIn: { $ne: null, $gte: new Date(now - OPEN_WINDOW_MS) } }).sort({ clockIn: -1 });
}

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const hasPhoto = (selfie) => typeof selfie === "string" && selfie.startsWith("data:");
const istTime = (d) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

async function savePhoto(selfie, userId, date, leg, orgId) {
  if (!hasPhoto(selfie)) return "";
  try {
    return await uploadAttendanceSelfie(selfie, String(userId), date, leg, orgId);
  } catch (e) {
    if (e.code === "STORAGE_FULL") { console.warn(`[attendance] storage full, clock-${leg} photo not saved`); return ""; }
    console.error("[attendance] selfie upload failed:", e.message);
    throw new AppError("Your photo could not be saved. Please try again.", 502);
  }
}

const ADMIN_ROLES = ["admin", "manager", "super_admin"];

const attendanceController = {
  // GET /api/attendance/status - the current user's running session, else today's record
  async status(req, res, next) {
    try {
      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();
      const record = (await findOpenSession(req.user._id, now))
        || (await Attendance.findOne({ userId: req.user._id, date: shiftDateFor(now, settings) }));
      res.json({ success: true, data: record || null, requireSelfie: settings.requireSelfie });
    } catch (err) { next(err); }
  },

  // POST /api/attendance/clockin
  async clockIn(req, res, next) {
    try {
      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();

      const open = await findOpenSession(req.user._id, now);
      if (open) return next(new AppError(`You are still clocked in since ${istTime(open.clockIn)}. Clock out first.`, 400));

      const date = shiftDateFor(now, settings);
      let record = await Attendance.findOne({ userId: req.user._id, date });
      if (record && record.clockIn) return next(new AppError("Already clocked in today.", 400));

      // When the workspace requires a photo, one has to come with the request. A
      // person whose camera is unavailable can say so (proofUnavailable), and the
      // record shows it; a photo that was sent but could not be saved is an error.
      const { selfie, lat, lng, accuracy } = req.body;
      if (settings.requireSelfie && !hasPhoto(selfie) && !req.body.proofUnavailable) {
        return next(new AppError("A selfie is required to clock in.", 400));
      }
      const fields = {
        clockIn: now,
        clockOut: null, totalMinutes: null, dayType: null,
        isEarlyLeave: false, earlyLeaveByMinutes: null, overtimeMinutes: null, autoClosed: false,
        ...computeLate(now, date, settings),
        clockInSelfie: await savePhoto(selfie, req.user._id, date, "in", req.user.orgId),
        clockInLat: num(lat), clockInLng: num(lng), clockInAccuracy: num(accuracy),
        clockInProofSkipped: settings.requireSelfie && !hasPhoto(selfie),
      };

      try {
        if (!record) record = await Attendance.create({ userId: req.user._id, orgId: req.user.orgId, date, ...fields });
        else { record.set(fields); await record.save(); }
      } catch (e) {
        // A double tap: the first request already made today's record.
        if (e.code === 11000) return next(new AppError("Already clocked in today.", 400));
        throw e;
      }
      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // POST /api/attendance/clockout - closes the running session, even one that
  // began yesterday (a night shift).
  async clockOut(req, res, next) {
    try {
      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();
      const record = await findOpenSession(req.user._id, now);
      if (!record) {
        const today = await Attendance.findOne({ userId: req.user._id, date: shiftDateFor(now, settings) }).select("clockOut");
        return next(new AppError(today?.clockOut ? "Already clocked out." : "You haven't clocked in yet.", 400));
      }

      const { selfie, lat, lng, accuracy } = req.body;
      if (settings.requireSelfie && !hasPhoto(selfie) && !req.body.proofUnavailable) {
        return next(new AppError("A selfie is required to clock out.", 400));
      }
      const clockOutSelfie = await savePhoto(selfie, req.user._id, record.date, "out", req.user.orgId);

      record.clockOut = now;
      record.totalMinutes = Math.round((now - record.clockIn) / 60000);
      record.dayType = computeDayType(record.totalMinutes, settings);
      Object.assign(record, computeEarlyLeave(now, settings, record.date), computeOvertime(now, settings, record.date));
      if (req.body.note) record.note = String(req.body.note).slice(0, 500);
      record.clockOutSelfie = clockOutSelfie;
      record.clockOutLat = num(lat);
      record.clockOutLng = num(lng);
      record.clockOutAccuracy = num(accuracy);
      record.clockOutProofSkipped = settings.requireSelfie && !hasPhoto(selfie);
      record.autoClosed = false;
      await record.save();

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // GET /api/attendance - list records, with totals for the whole filtered range
  // Admin/Manager: all team records; Agent: own only
  // Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=xxx&page=1&limit=50
  async list(req, res, next) {
    try {
      const { from, to, userId, page = 1, limit = 60 } = req.query;
      const safePage = Math.max(1, parseInt(page) || 1);
      const safeLimit = Math.min(Math.max(1, parseInt(limit) || 60), 200);
      const skip = (safePage - 1) * safeLimit;

      const filter = { orgId: new mongoose.Types.ObjectId(String(req.user.orgId)) };

      // Agents can only see their own
      if (req.user.role === "agent") {
        filter.userId = req.user._id;
      } else if (userId) {
        if (!mongoose.isValidObjectId(userId)) return next(new AppError("Unknown member.", 400));
        filter.userId = new mongoose.Types.ObjectId(String(userId));
      }

      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = from;
        if (to)   filter.date.$lte = to;
      }

      const sum = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
      const has = (field) => ({ $ne: [{ $ifNull: [field, null] }, null] });
      const [records, total, [agg]] = await Promise.all([
        Attendance.find(filter)
          .sort({ date: -1, clockIn: -1 })
          .skip(skip)
          .limit(safeLimit)
          .populate("userId", "name email role"),
        Attendance.countDocuments(filter),
        // The tiles above the table count the whole range, not just this page.
        Attendance.aggregate([
          { $match: filter },
          { $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ["$totalMinutes", 0] } },
            daysPresent: sum(has("$clockIn")),
            closedDays: sum(has("$totalMinutes")),
            fullDays: sum({ $eq: ["$dayType", "full"] }),
            halfDays: sum({ $eq: ["$dayType", "half"] }),
            shortDays: sum({ $eq: ["$dayType", "short"] }),
            late: sum({ $eq: ["$isLate", true] }),
            outsideShift: sum({ $eq: ["$outsideShift", true] }),
            autoClosed: sum({ $eq: ["$autoClosed", true] }),
            // Clocked in over a day ago and never out (today's running ones aren't counted).
            notClockedOut: sum({ $and: [has("$clockIn"), { $not: [has("$clockOut")] }, { $lt: ["$clockIn", new Date(Date.now() - OPEN_WINDOW_MS)] }] }),
          } },
        ]),
      ]);

      const s = agg || { totalMinutes: 0, daysPresent: 0, closedDays: 0, fullDays: 0, halfDays: 0, shortDays: 0, late: 0, outsideShift: 0, autoClosed: 0, notClockedOut: 0 };
      delete s._id;
      s.avgMinutes = s.closedDays ? Math.round(s.totalMinutes / s.closedDays) : 0;

      res.json({
        success: true,
        data: records,
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit),
        summary: s,
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
        const ist = toIST(new Date(d));
        const h = ist.getUTCHours(), m = ist.getUTCMinutes();
        const ampm = h >= 12 ? "PM" : "AM";
        return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
      };
      const fmtDur = (mins) => {
        if (mins == null) return "";
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      };
      const proof = (selfie, skipped) => (selfie ? "Yes" : skipped ? "Skipped" : "");
      const place = (lat, lng) => (lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : "");

      const header = ["Date", "Name", "Email", "Role", "Clock In", "Clock Out", "Duration", "Day Type", "Late", "Late By", "Outside Shift", "Early Leave", "Early Leave By", "Overtime", "Auto Closed", "Photo In", "Photo Out", "Location In", "Location Out", "Note"];
      const rows = records.map((r) => [
        r.date,
        r.userId?.name || "",
        r.userId?.email || "",
        r.userId?.role || "",
        fmtTime(r.clockIn),
        r.clockOut ? fmtTime(r.clockOut) : r.clockIn ? "Not clocked out" : "",
        fmtDur(r.totalMinutes),
        r.dayType || "",
        r.isLate ? "Yes" : "No",
        r.lateByMinutes ? fmtDur(r.lateByMinutes) : "",
        r.outsideShift ? "Yes" : "No",
        r.isEarlyLeave ? "Yes" : "No",
        r.earlyLeaveByMinutes ? fmtDur(r.earlyLeaveByMinutes) : "",
        r.overtimeMinutes ? fmtDur(r.overtimeMinutes) : "",
        r.autoClosed ? "Yes" : "No",
        proof(r.clockInSelfie, r.clockInProofSkipped),
        proof(r.clockOutSelfie, r.clockOutProofSkipped),
        place(r.clockInLat, r.clockInLng),
        place(r.clockOutLat, r.clockOutLng),
        r.note || "",
      ]);

      // Quote every cell; a cell starting with = + - @ is kept as text so a
      // spreadsheet never runs it as a formula.
      const escape = (v) => `"${String(v).replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
      const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");

      const label = from && to ? `${from}_to_${to}` : "all";
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="attendance_${label}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  },

  // POST /api/attendance/admin-entry - admin manually adds or corrects a record
  // Body: { id?, userId, date, clockIn, clockOut, note }. With id, that record
  // is edited (its date can change); without, the person's record for the date.
  async adminEntry(req, res, next) {
    try {
      if (!ADMIN_ROLES.includes(req.user.role)) {
        return next(new AppError("Not authorized.", 403));
      }

      const { id, userId, date, clockIn, clockOut, note } = req.body;
      if (!userId || !date) return next(new AppError("Choose the member and the date.", 400));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return next(new AppError("Invalid date.", 400));
      if (date > todayStr()) return next(new AppError("Attendance can't be added for a future date.", 400));

      // Ensure the target user actually belongs to the caller's org. Without this,
      // an upsert would fabricate an attendance record for any arbitrary userId
      // (e.g. a super_admin or a user in another org) scoped to the caller's org.
      if (!mongoose.isValidObjectId(userId)) return next(new AppError("User not found in your organisation.", 404));
      const targetUser = await User.findOne({ _id: userId, orgId: req.user.orgId }).select("_id");
      if (!targetUser) return next(new AppError("User not found in your organisation.", 404));

      const clockInDate  = clockIn  ? new Date(clockIn)  : null;
      const clockOutDate = clockOut ? new Date(clockOut) : null;

      if (clockInDate && isNaN(clockInDate)) return next(new AppError("Invalid clock-in time.", 400));
      if (clockOutDate && isNaN(clockOutDate)) return next(new AppError("Invalid clock-out time.", 400));
      if (clockOutDate && !clockInDate) return next(new AppError("Add the clock-in time too.", 400));
      if (clockInDate && clockOutDate && clockOutDate <= clockInDate) {
        return next(new AppError("Clock-out must be after clock-in.", 400));
      }
      if (clockOutDate && clockOutDate - clockInDate > OPEN_WINDOW_MS) return next(new AppError("A shift can't be longer than 24 hours.", 400));
      if (clockInDate && clockInDate > new Date()) return next(new AppError("The clock-in time is still in the future.", 400));
      // A past day with a clock-in and no clock-out would stay "clocked in" for ever.
      if (clockInDate && !clockOutDate && date < addDaysStr(todayStr(), -1)) return next(new AppError("Add the clock-out time for a past day.", 400));

      const settings = await getOrgSettings(req.user.orgId);
      const totalMinutes = (clockInDate && clockOutDate) ? Math.round((clockOutDate - clockInDate) / 60000) : null;
      const fields = {
        userId, date,
        clockIn: clockInDate, clockOut: clockOutDate, totalMinutes,
        ...computeLate(clockInDate, date, settings),
        ...computeEarlyLeave(clockOutDate, settings, date),
        ...computeOvertime(clockOutDate, settings, date),
        dayType: totalMinutes != null ? computeDayType(totalMinutes, settings) : null,
        autoClosed: false,
        note: String(note || "").slice(0, 500),
      };

      let record;
      if (id) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError("Entry not found.", 404));
        record = await Attendance.findOne({ _id: id, orgId: req.user.orgId });
        if (!record) return next(new AppError("Entry not found.", 404));
        const clash = await Attendance.exists({ _id: { $ne: record._id }, userId, date });
        if (clash) return next(new AppError("This person already has an entry on that day. Edit that one instead.", 409));
        record.set(fields);
        await record.save();
        await record.populate("userId", "name email role");
      } else {
        record = await Attendance.findOneAndUpdate(
          { userId, orgId: req.user.orgId, date },
          { $set: fields },
          { upsert: true, new: true, runValidators: false }
        ).populate("userId", "name email role");
      }

      res.json({ success: true, data: record });
    } catch (err) { next(err); }
  },

  // DELETE /api/attendance/:id - remove a wrong entry (admin/manager)
  async remove(req, res, next) {
    try {
      if (!ADMIN_ROLES.includes(req.user.role)) return next(new AppError("Not authorized.", 403));
      if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError("Entry not found.", 404));
      const record = await Attendance.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
      if (!record) return next(new AppError("Entry not found.", 404));
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  // GET /api/attendance/team-today - all members' status for today (admin/manager)
  async teamToday(req, res, next) {
    try {
      if (req.user.role === "agent") {
        return next(new AppError("Not authorized.", 403));
      }

      const settings = await getOrgSettings(req.user.orgId);
      const now = new Date();
      const today = shiftDateFor(now, settings);

      // Get all active org users
      const users = await User.find({ orgId: req.user.orgId, isActive: { $ne: false } })
        .select("name email role");

      // Today's records, plus anyone still clocked in from yesterday.
      const records = await Attendance.find({
        orgId: req.user.orgId,
        $or: [{ date: today }, { clockOut: null, clockIn: { $ne: null, $gte: new Date(now - OPEN_WINDOW_MS) } }],
      }).sort({ clockIn: 1 });
      const recordMap = {};
      records.forEach((r) => {
        const key = String(r.userId);
        const running = r.clockIn && !r.clockOut;
        if (!recordMap[key] || running) recordMap[key] = r;
      });

      const team = users.map(u => ({
        user: u,
        attendance: recordMap[String(u._id)] || null,
      }));

      res.json({ success: true, data: team });
    } catch (err) { next(err); }
  },
};

/**
 * Close sessions nobody clocked out of (scheduler, every 15 minutes). A session
 * is closed at the shift's end once 4 hours have passed after it; one started
 * after the shift ended is closed at its own start 12 hours later, as its real
 * end is unknown. Each is marked autoClosed so it shows, and the person is told.
 * Half an hour after the shift ends, a still-open session gets one reminder.
 * Only the last 3 days are swept: older open records are left for an admin.
 */
async function sweepOpenSessions(now = new Date()) {
  const { sendPushToUser } = require("../utils/push");
  const open = await Attendance.find({ clockOut: null, clockIn: { $ne: null, $gte: new Date(now - 3 * 24 * HOUR) } });
  const settingsByOrg = new Map();
  let closed = 0, reminded = 0;
  for (const r of open) {
    const key = String(r.orgId);
    if (!settingsByOrg.has(key)) settingsByOrg.set(key, await getOrgSettings(r.orgId));
    const settings = settingsByOrg.get(key);
    const end = shiftEndAt(r.date, settings);
    const afterShift = r.clockIn >= end;
    const closeAt = afterShift ? r.clockIn : end;
    const deadline = new Date(closeAt.getTime() + (afterShift ? 12 : 4) * HOUR);

    if (now >= deadline) {
      r.clockOut = closeAt;
      r.totalMinutes = Math.round((closeAt - r.clockIn) / 60000);
      r.dayType = computeDayType(r.totalMinutes, settings);
      r.isEarlyLeave = false; r.earlyLeaveByMinutes = null; r.overtimeMinutes = null;
      r.autoClosed = true;
      await r.save();
      closed++;
      sendPushToUser(r.userId, {
        type: "attendance_auto_closed",
        title: "You didn't clock out",
        body: `Your attendance for ${r.date} was closed at ${istTime(closeAt)}. Ask your admin to correct the time if needed.`,
        data: { url: "/attendance" },
      }).catch(() => {});
    } else if (!afterShift && !r.clockOutRemindedAt && now >= new Date(end.getTime() + 30 * 60000)) {
      r.clockOutRemindedAt = now;
      await r.save();
      reminded++;
      sendPushToUser(r.userId, {
        type: "attendance_clockout_reminder",
        title: "Still clocked in",
        body: `Your shift ended at ${istTime(end)}. Clock out when you leave.`,
        data: { url: "/attendance" },
      }).catch(() => {});
    }
  }
  return { closed, reminded };
}

attendanceController.sweepOpenSessions = sweepOpenSessions;
attendanceController._test = { computeLate, shiftDateFor, shiftEndAt, addDaysStr };
module.exports = attendanceController;
