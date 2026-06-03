// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    date: {
      type: String, // "YYYY-MM-DD" - easy to query by day
      required: true,
      index: true,
    },
    clockIn:  { type: Date, default: null },
    clockOut: { type: Date, default: null },
    // Calculated on clockOut (minutes)
    totalMinutes:  { type: Number, default: null },
    note:          { type: String, trim: true, default: "" },
    // HRM fields — computed on clock-in / clock-out against org shift settings
    isLate:           { type: Boolean, default: false },
    lateByMinutes:    { type: Number, default: null },
    isEarlyLeave:     { type: Boolean, default: false },
    earlyLeaveByMinutes: { type: Number, default: null },
    dayType: {
      type: String,
      enum: ["full", "half", "short", null],
      default: null,
    },
  },
  { timestamps: true }
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
