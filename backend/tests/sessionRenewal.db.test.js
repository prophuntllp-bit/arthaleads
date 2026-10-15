// Sliding sessions: a day-old normal session is renewed while in use; fresh
// sessions, "Switch account" and "Login as" sessions are not.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_EXPIRES_IN = "7d";
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["users", "organizations"]) await mongoose.connection.createCollection(c).catch(() => {});
  const User = require("../models/User");
  const Organization = require("../models/Organization");
  const { protect } = require("../middlewares/auth");
  console.log("\nSliding sessions\n");

  const org = new mongoose.Types.ObjectId();
  await Organization.collection.insertOne({ _id: org, name: "T", isActive: true, plan: "growth", approvalStatus: "approved" });
  const u = { _id: new mongoose.Types.ObjectId(), orgId: org, role: "admin", name: "A", email: "a@example.com", isActive: true };
  await User.collection.insertOne(u);

  const now = Math.floor(Date.now() / 1000);
  const sign = (payload, iat, life) => jwt.sign({ ...payload, iat, exp: iat + life }, process.env.JWT_SECRET);
  const run = (token, viaCookie = false) => new Promise((resolve) => {
    const headers = {}; const cookies = {};
    const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, getHeader: (k) => headers[k.toLowerCase()], cookie: (n, v) => { cookies[n] = v; } };
    const req = { headers: viaCookie ? { origin: undefined } : { authorization: `Bearer ${token}` }, cookies: viaCookie ? { crm_token: token } : {}, originalUrl: "/api/leads", method: "GET" };
    protect(req, res, (err) => resolve({ err, headers, cookies }));
  });
  const DAY = 86400, WEEK = 7 * DAY;

  let r = await run(sign({ id: u._id }, now - 60, WEEK));
  check(!r.err && !r.headers["x-renewed-token"], "a fresh session is not renewed");
  r = await run(sign({ id: u._id }, now - 2 * DAY, WEEK));
  const t = r.headers["x-renewed-token"];
  check(!r.err && t && jwt.verify(t, process.env.JWT_SECRET).exp - now >= WEEK - 5, "a 2-day-old session gets a new 7-day one", JSON.stringify(r.headers));
  check(/X-Renewed-Token/.test(r.headers["access-control-expose-headers"] || ""), "the browser is allowed to read the new token");
  r = await run(sign({ id: u._id }, now - 2 * DAY, WEEK), true);
  check(!!r.cookies.crm_token, "a cookie session gets a new cookie");
  r = await run(sign({ id: u._id, actBy: new mongoose.Types.ObjectId() }, now - 3600, 2 * 3600));
  check(!r.err && !r.headers["x-renewed-token"], "a 'Switch account' session is never extended");
  r = await run(sign({ id: u._id }, now - 3600, 2 * 3600));
  check(!r.err && !r.headers["x-renewed-token"], "a super admin 'Login as' session is never extended");
  r = await run(sign({ id: u._id }, now - WEEK - 60, WEEK));
  check(r.err && r.err.name === "TokenExpiredError" && !r.headers["x-renewed-token"], "an expired session still ends");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all session checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
