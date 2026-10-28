// Attendance (owner, 28 Oct 2026): forgotten clock-outs are closed at the
// shift's end, night shifts clock out the next morning, clocking in after the
// shift is "outside shift" rather than hours late, a skipped photo is recorded,
// totals cover the whole range, and manual entries can't be left half done.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
let base, server, db, ORG, ADMIN, AGENT, AGENT2;
const pushes = [];
require("../utils/push").sendPushToUser = async (id, msg) => { pushes.push({ id: String(id), ...msg }); };

const ctrl = require("../controllers/attendanceController");
const { computeLate, shiftDateFor, addDaysStr } = ctrl._test;
const DAY = { shiftStartTime: "10:00", shiftEndTime: "19:00", bufferMinutes: 15 };
const NIGHT = { shiftStartTime: "21:00", shiftEndTime: "06:00", bufferMinutes: 15 };
const ist = (s) => new Date(`${s}+05:30`);
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function api(method, path, userId, body) {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(userId)}` }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const rec = (fields) => db.collection("attendances").insertOne({ orgId: ORG, clockOut: null, totalMinutes: null, isLate: false, autoClosed: false, ...fields });

test("late is counted from start + grace, only while the shift is on", () => {
  assert.deepEqual(computeLate(ist("2026-10-28T10:20:00"), "2026-10-28", DAY), { isLate: true, lateByMinutes: 5, outsideShift: false });
  assert.equal(computeLate(ist("2026-10-28T10:10:00"), "2026-10-28", DAY).isLate, false, "inside the grace period");
  assert.deepEqual(computeLate(ist("2026-10-28T19:30:00"), "2026-10-28", DAY), { isLate: false, lateByMinutes: null, outsideShift: true });
});

test("night shift: 01:30 belongs to the shift that began the evening before, and is late", () => {
  assert.equal(shiftDateFor(ist("2026-10-29T01:30:00"), NIGHT), "2026-10-28");
  assert.equal(shiftDateFor(ist("2026-10-29T20:50:00"), NIGHT), "2026-10-29");
  assert.equal(shiftDateFor(ist("2026-10-29T01:30:00"), DAY), "2026-10-29", "a day shift keeps the calendar day");
  const l = computeLate(ist("2026-10-29T01:30:00"), "2026-10-28", NIGHT);
  assert.equal(l.isLate, true);
  assert.equal(l.lateByMinutes, 4 * 60 + 30 - 15);
  assert.equal(computeLate(ist("2026-10-29T06:30:00"), "2026-10-28", NIGHT).outsideShift, true);
});

test("clock in without a photo when one is required: allowed, and the record says the photo was skipped", async () => {
  const r = await api("POST", "/api/attendance/clockin", AGENT, { proofUnavailable: true, lat: 19.07, lng: 72.87, accuracy: 18 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.clockInProofSkipped, true);
  assert.equal(r.json.data.clockInAccuracy, 18);
  const none = await api("POST", "/api/attendance/clockin", AGENT2, {});
  assert.equal(none.status, 400, "no photo and nothing declared");
});

test("clocking in twice: told you are still clocked in", async () => {
  const r = await api("POST", "/api/attendance/clockin", AGENT, { proofUnavailable: true });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /still clocked in/);
});

test("a session started yesterday (night shift) can be clocked out today, and status shows it", async () => {
  const yday = addDaysStr(istToday(), -1);
  await rec({ userId: AGENT2, date: yday, clockIn: new Date(Date.now() - 9 * 3600e3) });
  const s = await api("GET", "/api/attendance/status", AGENT2);
  assert.equal(s.json.data.date, yday, "status returns the running session");
  const r = await api("POST", "/api/attendance/clockout", AGENT2, { proofUnavailable: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.date, yday);
  assert.ok(Math.abs(r.json.data.totalMinutes - 540) <= 1);
  assert.equal(r.json.data.clockOutProofSkipped, true);
  const again = await api("POST", "/api/attendance/clockout", AGENT2, { proofUnavailable: true });
  assert.equal(again.status, 400);
});

test("a clock-in older than a day is not 'still running': no clock-out against it", async () => {
  const u = oid();
  await db.collection("users").insertOne({ _id: u, name: "Old Open", email: "old@example.com", role: "agent", orgId: ORG, isActive: true });
  await rec({ userId: u, date: addDaysStr(istToday(), -10), clockIn: new Date(Date.now() - 10 * 86400e3) });
  const r = await api("POST", "/api/attendance/clockout", u, { proofUnavailable: true });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /haven't clocked in/);
});

test("sweep: reminds after the shift, closes at the shift's end 4 hours later, leaves old records alone", async () => {
  const now = ist("2026-11-05T20:30:00");
  const u1 = oid(), u2 = oid(), u3 = oid(), u4 = oid();
  await rec({ userId: u1, date: "2026-11-05", clockIn: ist("2026-11-05T10:00:00") });     // shift ended 1.5 h ago
  await rec({ userId: u2, date: "2026-11-04", clockIn: ist("2026-11-04T10:05:00") });     // yesterday, never closed
  await rec({ userId: u3, date: "2026-11-04", clockIn: ist("2026-11-04T20:10:00") });     // came in after the shift
  await rec({ userId: u4, date: "2026-10-30", clockIn: ist("2026-10-30T10:00:00") });     // older than 3 days
  pushes.length = 0;
  const r = await ctrl.sweepOpenSessions(now);
  assert.deepEqual(r, { closed: 2, reminded: 1 });
  const get = (u) => db.collection("attendances").findOne({ userId: u });
  const a1 = await get(u1), a2 = await get(u2), a3 = await get(u3), a4 = await get(u4);
  assert.equal(a1.clockOut, null);
  assert.ok(a1.clockOutRemindedAt);
  assert.equal(a2.autoClosed, true);
  assert.equal(a2.clockOut.toISOString(), ist("2026-11-04T19:00:00").toISOString(), "closed at the shift's end");
  assert.equal(a2.totalMinutes, 535);
  assert.equal(a2.dayType, "full");
  assert.equal(a3.autoClosed, true);
  assert.equal(a3.totalMinutes, 0, "real end unknown");
  assert.equal(a4.clockOut, null, "old records wait for an admin");
  assert.deepEqual(pushes.map((p) => p.type).sort(), ["attendance_auto_closed", "attendance_auto_closed", "attendance_clockout_reminder"]);
  const again = await ctrl.sweepOpenSessions(now);
  assert.deepEqual(again, { closed: 0, reminded: 0 }, "one reminder only");
});

test("totals cover the whole range, not just the page shown", async () => {
  const r = await api("GET", "/api/attendance?limit=1&from=2026-01-01&to=2026-12-31", ADMIN);
  assert.equal(r.json.data.length, 1);
  assert.ok(r.json.total > 1);
  assert.equal(r.json.summary.daysPresent, r.json.total);
  assert.ok(r.json.summary.autoClosed >= 2);
  assert.ok(r.json.summary.notClockedOut >= 1);
});

test("manual entry: no future dates, no clock-out without clock-in, no open past days", async () => {
  const today = istToday();
  const future = addDaysStr(today, 2);
  const bad1 = await api("POST", "/api/attendance/admin-entry", ADMIN, { userId: String(AGENT), date: future, clockIn: `${future}T04:30:00Z`, clockOut: `${future}T13:30:00Z` });
  assert.equal(bad1.status, 400);
  const past = addDaysStr(today, -5);
  const bad2 = await api("POST", "/api/attendance/admin-entry", ADMIN, { userId: String(AGENT), date: past, clockOut: `${past}T13:30:00Z` });
  assert.equal(bad2.status, 400);
  const bad3 = await api("POST", "/api/attendance/admin-entry", ADMIN, { userId: String(AGENT), date: past, clockIn: `${past}T04:30:00Z` });
  assert.equal(bad3.status, 400);
  assert.match(bad3.json.message, /clock-out/);
});

test("editing an entry's date moves it instead of making a second one; a clash is refused; delete removes it", async () => {
  const d1 = addDaysStr(istToday(), -6), d2 = addDaysStr(istToday(), -7), d3 = addDaysStr(istToday(), -8);
  const made = await api("POST", "/api/attendance/admin-entry", ADMIN, { userId: String(AGENT2), date: d1, clockIn: `${d1}T04:30:00Z`, clockOut: `${d1}T13:30:00Z` });
  assert.equal(made.status, 200, JSON.stringify(made.json));
  assert.equal(made.json.data.totalMinutes, 540);
  const id = made.json.data._id;
  const moved = await api("POST", "/api/attendance/admin-entry", ADMIN, { id, userId: String(AGENT2), date: d2, clockIn: `${d2}T04:30:00Z`, clockOut: `${d2}T12:30:00Z` });
  assert.equal(moved.status, 200);
  assert.equal(await db.collection("attendances").countDocuments({ userId: AGENT2, date: { $in: [d1, d2] } }), 1);
  await api("POST", "/api/attendance/admin-entry", ADMIN, { userId: String(AGENT2), date: d3, clockIn: `${d3}T04:30:00Z`, clockOut: `${d3}T12:30:00Z` });
  const clash = await api("POST", "/api/attendance/admin-entry", ADMIN, { id, userId: String(AGENT2), date: d3, clockIn: `${d3}T04:30:00Z`, clockOut: `${d3}T12:30:00Z` });
  assert.equal(clash.status, 409);
  const agentTry = await api("DELETE", `/api/attendance/${id}`, AGENT);
  assert.equal(agentTry.status, 403);
  const del = await api("DELETE", `/api/attendance/${id}`, ADMIN);
  assert.equal(del.status, 200);
  assert.equal(await db.collection("attendances").countDocuments({ _id: new mongoose.Types.ObjectId(id) }), 0);
});

test("shift settings: a half day longer than a full day, or a bad time, is refused", async () => {
  const a = await api("PATCH", "/api/org/me/attendance-settings", ADMIN, { halfDayMinutes: 600, fullDayMinutes: 480 });
  assert.equal(a.status, 400);
  const b = await api("PATCH", "/api/org/me/attendance-settings", ADMIN, { shiftStartTime: "25:00" });
  assert.equal(b.status, 400);
  const c = await api("PATCH", "/api/org/me/attendance-settings", ADMIN, { bufferMinutes: "abc" });
  assert.equal(c.status, 400);
  const ok = await api("PATCH", "/api/org/me/attendance-settings", ADMIN, { shiftStartTime: "10:00", shiftEndTime: "19:00", bufferMinutes: 15, halfDayMinutes: 240, fullDayMinutes: 480 });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const m of ["User", "Organization", "Attendance"]) await require(`../models/${m}`).init().catch(() => {});
  ORG = oid(); ADMIN = oid(); AGENT = oid(); AGENT2 = oid();
  await db.collection("organizations").insertOne({
    _id: ORG, name: "Prophunt LLP", slug: `prophunt-${ORG}`, plan: "enterprise", isActive: true, approvalStatus: "approved",
    attendanceSettings: { shiftStartTime: "10:00", shiftEndTime: "19:00", bufferMinutes: 15, halfDayMinutes: 240, fullDayMinutes: 480, requireSelfie: true },
  });
  await db.collection("users").insertMany([
    { _id: ADMIN, name: "Admin", email: "admin@example.com", role: "admin", orgId: ORG, isActive: true },
    { _id: AGENT, name: "Sheetal Powar", email: "sheetal@example.com", role: "agent", orgId: ORG, isActive: true },
    { _id: AGENT2, name: "Ravi Shinde", email: "ravi@example.com", role: "agent", orgId: ORG, isActive: true },
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", require("../routes/attendanceRoutes"));
  app.use("/api/org", require("../routes/orgRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  console.warn = () => {}; console.info = () => {};
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Attendance");
})();
