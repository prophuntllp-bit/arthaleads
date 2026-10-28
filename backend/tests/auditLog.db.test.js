// Activity log for the DPDP Rules 2025 (owner, 28 Oct 2026): mutating requests,
// sign-ins and exports are written to AuditLog without bodies or secrets, the
// rows expire after ~400 days (never under a year), and GET /api/audit-log
// shows an organisation only its own rows.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
let base, server, AuditLog, ORG_A, ORG_B, ADMIN_A, AGENT_A, ADMIN_B, SUPER;

const tokenFor = (id, extra = {}) => jwt.sign({ id: String(id), ...extra }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function api(method, path, userId, body, extra) {
  const headers = { "Content-Type": "application/json", "User-Agent": "audit-test/1.0" };
  if (userId) headers.Authorization = `Bearer ${tokenFor(userId, extra)}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// Rows are written after the response, fire-and-forget: wait for them.
async function rowsFor(filter, atLeast = 1) {
  for (let i = 0; i < 50; i++) {
    const rows = await AuditLog.find(filter).lean();
    if (rows.length >= atLeast) return rows;
    await new Promise((r) => setTimeout(r, 40));
  }
  return AuditLog.find(filter).lean();
}

test("a mutating request is logged with method, path, status and who, but no body", async () => {
  const r = await api("POST", "/api/auth/me/checklist-dismissed", AGENT_A, { leadPhone: "9876543210", leadEmail: "buyer@example.com", password: "hunter2-secret" });
  assert.equal(r.status, 200);
  const [row] = await rowsFor({ action: "api_request", path: "/api/auth/me/checklist-dismissed" });
  assert.ok(row, "row written");
  assert.equal(row.method, "POST");
  assert.equal(row.status, 200);
  assert.equal(String(row.performedBy), String(AGENT_A));
  assert.equal(String(row.targetOrg), String(ORG_A));
  assert.equal(row.role, "agent");
  assert.equal(row.userAgent, "audit-test/1.0");
  assert.ok(row.at instanceof Date);
  const all = JSON.stringify(row);
  for (const secret of ["9876543210", "buyer@example.com", "hunter2-secret", "leadPhone"]) assert.ok(!all.includes(secret), `row must not hold ${secret}`);
});

test("record ids in the path become :id and are kept as targetIds; query strings are dropped", async () => {
  const target = String(AGENT_A);
  await api("PATCH", `/api/auth/users/${target}/toggle?phone=9876543210&token=abc`, ADMIN_A);
  const [row] = await rowsFor({ path: "/api/auth/users/:id/toggle" });
  assert.ok(row, "row written");
  assert.deepEqual(row.targetIds, [target]);
  assert.ok(!JSON.stringify(row).includes("9876543210"));
  // put the agent back
  await mongoose.connection.db.collection("users").updateOne({ _id: AGENT_A }, { $set: { isActive: true } });
});

test("path sanitiser: emails, phone numbers and tokens never reach the row", () => {
  const { sanitizePath } = require("../middlewares/auditTrail");
  assert.equal(sanitizePath("/api/auth/reset-password/3f9a1c0e7b2d4a6f8c1e3b5d7f9a2c4e6b8d0f1a3c5e7b9d").path, "/api/auth/reset-password/:token");
  assert.equal(sanitizePath("/api/x/buyer%40example.com/9876543210?q=1").path, "/api/x/:email/:number");
  assert.equal(sanitizePath("/api/auth/restore-admin-session").path, "/api/auth/restore-admin-session");
});

test("GET requests other than exports are not logged", async () => {
  const before = await AuditLog.countDocuments({ method: "GET" });
  await api("GET", "/api/auth/agents", ADMIN_A);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await AuditLog.countDocuments({ method: "GET" }), before);
});

test("a failed login is logged with a hashed identifier, not the address or password", async () => {
  const r = await api("POST", "/api/auth/login", null, { email: "nobody@example.com", password: "wrong-pass-123" });
  assert.equal(r.status, 401);
  const [row] = await rowsFor({ action: "login_failed" });
  assert.ok(row, "login_failed row");
  assert.equal(row.status, 401);
  assert.equal(row.details.method, "password");
  assert.match(row.details.identifierHash, /^[0-9a-f]{16}$/);
  const all = JSON.stringify(row);
  assert.ok(!all.includes("nobody@example.com") && !all.includes("wrong-pass-123"));
});

test("a successful login is logged against the person who signed in", async () => {
  const r = await api("POST", "/api/auth/login", null, { email: "admin.a@example.com", password: "Correct-Horse-9" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [row] = await rowsFor({ action: "login_success" });
  assert.equal(String(row.performedBy), String(ADMIN_A));
  assert.equal(String(row.targetOrg), String(ORG_A));
  assert.ok(!JSON.stringify(row).includes("Correct-Horse-9"));
});

test("logout is logged with who signed out", async () => {
  await api("POST", "/api/auth/logout", AGENT_A);
  const [row] = await rowsFor({ action: "logout" });
  assert.equal(String(row.performedBy), String(AGENT_A));
});

test("exports are logged as data_export, with filter names but not their values", async () => {
  const r = await api("GET", "/api/attendance/export?from=2026-10-01&to=2026-10-28&q=9876543210", ADMIN_A);
  assert.equal(r.status, 200);
  const l = await api("GET", "/api/leads/export?format=csv&search=Rahul", ADMIN_A);
  assert.equal(l.status, 200);
  const rows = await rowsFor({ action: "data_export" }, 2);
  const att = rows.find((x) => x.details?.what === "attendance");
  const leads = rows.find((x) => x.details?.what === "leads");
  assert.ok(att && leads, JSON.stringify(rows));
  assert.equal(att.path, "/api/attendance/export");
  assert.deepEqual(att.details.filters, ["from", "to", "q"]);
  assert.equal(String(att.performedBy), String(ADMIN_A));
  assert.ok(!JSON.stringify(rows).includes("9876543210") && !JSON.stringify(rows).includes("Rahul"));
});

test("support access: impersonation sessions are recorded as the super admin, in the customer's log", async () => {
  await api("POST", "/api/auth/me/tour-offer-dismissed", ADMIN_A, {}, { sa: String(SUPER) });
  const [row] = await rowsFor({ path: "/api/auth/me/tour-offer-dismissed" });
  assert.equal(row.via, "support_access");
  assert.equal(String(row.performedBy), String(SUPER));
  assert.equal(String(row.targetUser), String(ADMIN_A));
  assert.equal(String(row.targetOrg), String(ORG_A));
});

test("TTL index on `at` keeps rows at least a year (about 400 days)", async () => {
  await AuditLog.init();
  const idx = (await AuditLog.collection.indexes()).find((i) => i.key && i.key.at === 1 && Object.keys(i.key).length === 1);
  assert.ok(idx, "TTL index on at");
  const days = idx.expireAfterSeconds / 86400;
  assert.ok(days >= 366 && days <= 420, `expires after ${days} days`);
});

test("GET /api/audit-log: an org admin sees only their own organisation", async () => {
  await AuditLog.create({ at: new Date(), action: "api_request", method: "POST", path: "/api/leads", status: 201, performedBy: ADMIN_B, targetOrg: ORG_B });
  const a = await api("GET", "/api/audit-log?limit=200", ADMIN_A);
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.ok(a.json.entries.length > 0);
  assert.ok(a.json.entries.every((e) => String(e.targetOrg) === String(ORG_A)), "only org A rows");
  assert.ok(a.json.entries.every((e) => typeof e.atIST === "string" && e.atIST.length > 0));

  const sneaky = await api("GET", `/api/audit-log?orgId=${ORG_B}`, ADMIN_A);
  assert.ok(sneaky.json.entries.every((e) => String(e.targetOrg) === String(ORG_A)), "orgId is ignored for org admins");

  const b = await api("GET", "/api/audit-log", ADMIN_B);
  assert.ok(b.json.entries.length >= 1 && b.json.entries.every((e) => String(e.targetOrg) === String(ORG_B)));
});

test("GET /api/audit-log: agents are refused; super admin sees all and can filter", async () => {
  assert.equal((await api("GET", "/api/audit-log", AGENT_A)).status, 403);
  const all = await api("GET", "/api/audit-log?limit=200", SUPER);
  const orgs = new Set(all.json.entries.map((e) => String(e.targetOrg)));
  assert.ok(orgs.has(String(ORG_A)) && orgs.has(String(ORG_B)));
  const onlyB = await api("GET", `/api/audit-log?orgId=${ORG_B}`, SUPER);
  assert.ok(onlyB.json.entries.every((e) => String(e.targetOrg) === String(ORG_B)));

  const fails = await api("GET", "/api/audit-log?action=data_export", ADMIN_A);
  assert.ok(fails.json.entries.length >= 2 && fails.json.entries.every((e) => e.action === "data_export"));
  const byUser = await api("GET", `/api/audit-log?userId=${AGENT_A}`, ADMIN_A);
  assert.ok(byUser.json.entries.length >= 1 && byUser.json.entries.every((e) => String(e.performedBy) === String(AGENT_A) || String(e.targetUser) === String(AGENT_A)));
  const future = await api("GET", "/api/audit-log?from=2099-01-01", ADMIN_A);
  assert.equal(future.json.total, 0);
});

test("storage: an api_request row is a few hundred bytes", async () => {
  const rows = await AuditLog.find({ action: "api_request" }).lean();
  const { calculateObjectSize } = mongoose.mongo.BSON;
  const avg = rows.reduce((s, r) => s + calculateObjectSize(r), 0) / rows.length;
  console.log(`        avg api_request row: ${Math.round(avg)} bytes (~${Math.round(avg)} KB per 1,000 requests before indexes)`);
  assert.ok(avg < 1024);
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const db = mongoose.connection.db;
  for (const m of ["User", "Organization", "Attendance", "AuditLog"]) await require(`../models/${m}`).init().catch(() => {});
  AuditLog = require("../models/AuditLog");
  ORG_A = oid(); ORG_B = oid(); ADMIN_A = oid(); AGENT_A = oid(); ADMIN_B = oid(); SUPER = oid();
  await db.collection("organizations").insertMany([
    { _id: ORG_A, name: "Acme Realty", slug: `acme-${ORG_A}`, plan: "enterprise", isActive: true, approvalStatus: "approved" },
    { _id: ORG_B, name: "Beta Homes", slug: `beta-${ORG_B}`, plan: "enterprise", isActive: true, approvalStatus: "approved" },
  ]);
  await db.collection("users").insertMany([
    { _id: AGENT_A, name: "Sheetal Powar", email: "sheetal@example.com", role: "agent", orgId: ORG_A, isActive: true },
    { _id: ADMIN_B, name: "Beta Admin", email: "admin.b@example.com", role: "admin", orgId: ORG_B, isActive: true },
    { _id: SUPER, name: "Platform", email: "super@example.com", role: "super_admin", isActive: true },
  ]);
  const User = require("../models/User");
  await User.create({ _id: ADMIN_A, name: "Acme Admin", email: "admin.a@example.com", password: "Correct-Horse-9", role: "admin", orgId: ORG_A, isActive: true });

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", require("../middlewares/auditTrail").auditTrail);
  app.use("/api/audit-log", require("../routes/auditRoutes"));
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/leads", require("../routes/leadRoutes"));
  app.use("/api/attendance", require("../routes/attendanceRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  console.warn = () => {}; console.info = () => {};
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Activity log (DPDP)");
})();
