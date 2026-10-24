// 24 Oct 2026 APK security recheck: what the phone app's audit found open on
// the server. Agents' /auth/me (which the app keeps on the phone) carries no
// bank or tax details; a Facebook/Google connect result goes only to the
// person who started it; the app's connect link uses a 60-second ticket that
// is not a login.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

const oid = () => new mongoose.Types.ObjectId();
let base, server, db;
const U = {};

const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function call(method, path, auth, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

test("/auth/me: agents get no bank, tax or sign-up details; admins still do", async () => {
  const agent = (await call("GET", "/api/auth/me", tokenFor(U.agent))).json;
  for (const k of ["bankAccountNo", "bankIfsc", "pan", "gstNo", "cin"]) assert.equal(agent.org[k], undefined, k);
  assert.equal(agent.org.plan, "growth", "what the app needs is still there");
  const admin = (await call("GET", "/api/auth/me", tokenFor(U.admin))).json;
  assert.equal(admin.org.bankAccountNo, "000111222");
  assert.equal(admin.org.pan, "ABCDE1234F");
});

test("connect result: only the person who started the connect can read it", async () => {
  const svc = require("../services/automationService");
  await svc.storeOAuthResult("sess-a", { type: "success", freshToken: "fb-secret" }, String(U.admin));
  const other = await call("GET", "/api/automations/facebook/result?session=sess-a", tokenFor(U.otherAdmin));
  assert.equal(other.status, 404, "another company's admin gets nothing");
  const mine = await call("GET", "/api/automations/facebook/result?session=sess-a", tokenFor(U.admin));
  assert.equal(mine.status, 200);
  assert.equal(mine.json.freshToken, "fb-secret");
  assert.equal((await call("GET", "/api/automations/facebook/result?session=sess-a", tokenFor(U.admin))).status, 404, "one-time");
});

test("connect ticket: admins get one; it is not a login", async () => {
  const r = await call("POST", "/api/automations/popup-ticket", tokenFor(U.admin));
  assert.equal(r.status, 200);
  const ticket = r.json.ticket;
  const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
  assert.ok(decoded.exp - decoded.iat <= 60, "lasts a minute");
  assert.equal((await call("GET", "/api/auth/me", ticket)).status, 401, "can't be used as a login");
  const user = await require("../services/automationService").verifyPopupToken(ticket);
  assert.equal(String(user._id), String(U.admin), "but opens the connect page");
  assert.equal((await call("POST", "/api/automations/popup-ticket", tokenFor(U.agent))).status, 403, "agents can't connect pages");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
  for (const m of ["User", "Organization", "OAuthSession"]) await require(`../models/${m}`).init().catch(() => {});
  const org = oid(), org2 = oid();
  await db.collection("organizations").insertMany([
    { _id: org, name: "QA Growth", slug: `qa-g-${org}`, plan: "growth", isActive: true, approvalStatus: "approved", bankAccountNo: "000111222", bankIfsc: "HDFC0001", pan: "ABCDE1234F", gstNo: "27ABC", cin: "U1" },
    { _id: org2, name: "QA Other", slug: `qa-o-${org2}`, plan: "growth", isActive: true, approvalStatus: "approved" },
  ]);
  for (const [k, role, o] of [["admin", "admin", org], ["agent", "agent", org], ["otherAdmin", "admin", org2]]) {
    U[k] = oid();
    await db.collection("users").insertOne({ _id: U[k], name: k, email: `${k}@example.com`, role, orgId: o, isActive: true });
  }
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/automations", require("../routes/automationRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("APK security recheck: agent profile, connect results, connect ticket");
})();
