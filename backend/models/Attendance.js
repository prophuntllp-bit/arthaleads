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
    overtimeMinutes: { type: Number, default: null },
    // Clocked in after the shift had already ended: not "late", just outside hours.
    outsideShift:    { type: Boolean, default: false },
    // Geo + selfie proof (captured when org requires it). Selfies are media URLs, see utils/storage.js.
    clockInSelfie:   { type: String, default: "" },
    clockInLat:      { type: Number, default: null },
    clockInLng:      { type: Number, default: null },
    clockInAccuracy: { type: Number, default: null },  // metres
    clockOutSelfie:  { type: String, default: "" },
    clockOutLat:     { type: Number, default: null },
    clockOutLng:     { type: Number, default: null },
    clockOutAccuracy: { type: Number, default: null },
    // The workspace asked for a photo but the person went ahead without one
    // ("camera unavailable"), so the gap is visible instead of silent.
    clockInProofSkipped:  { type: Boolean, default: false },
    clockOutProofSkipped: { type: Boolean, default: false },
    // Nobody clocked out: the server closed the session at the shift's end
    // (owner, 28 Oct 2026). An admin can correct the time.
    autoClosed:        { type: Boolean, default: false },
    clockOutRemindedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
// The auto-close sweep looks for open sessions.
attendanceSchema.index({ clockOut: 1, clockIn: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
