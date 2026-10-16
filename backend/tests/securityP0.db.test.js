// Audit P0 regressions (docs/AUDIT_2026-10-16.md): a malformed media URL can't
// crash the API, Mongo operators in request input can't match secrets, and the
// template generator is exported. Runs the real routes against a throwaway DB.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };

(async () => {
  let crashed = false;
  process.on("unhandledRejection", () => { crashed = true; });
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["automations", "leads", "organizations", "users"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Automation = require("../models/Automation");
  const Organization = require("../models/Organization");
  const { strip, noOperators } = require("../middlewares/noOperators");
  console.log("\nAudit P0 regressions\n");

  // Unit: operators are removed at any depth; ordinary data is untouched.
  const body = { token: { $regex: "^s" }, nested: { a: [{ $gt: "" }, { b: 1 }] }, name: "Rahul", "e.mail": "x" };
  const n = strip(body);
  check(n === 2 && body.token && Object.keys(body.token).length === 0 && body.name === "Rahul" && body.nested.a[1].b === 1, "operator keys are removed, ordinary fields kept", JSON.stringify(body));

  const orgId = new mongoose.Types.ObjectId();
  await Organization.collection.insertOne({ _id: orgId, name: "Acme", isActive: true, whatsapp: { enabled: true, provider: "aisensy", apiKey: "realKey123" } });
  await Automation.collection.insertOne({ orgId, platform: "Website Form", name: "Site", verifyToken: "secretTok123", isActive: true, status: "connected", createdBy: new mongoose.Types.ObjectId(), updatedBy: new mongoose.Types.ObjectId() });

  const app = express();
  app.use(noOperators);
  app.use("/webhook", require("../routes/webhookRoutes"));
  app.use("/api/media", require("../routes/mediaRoutes"));
  app.use(express.json());
  app.use(noOperators);
  app.use("/api/whatsapp", require("../routes/whatsappRoutes"));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, payload, qs = "") => fetch(`${base}${path}${qs}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

  // P0-1: a malformed media key is a 404 and the process keeps running.
  const m = await fetch(`${base}/api/media/%25E0`);
  await new Promise((r) => setTimeout(r, 100));
  check(m.status === 404 && !crashed, "a malformed media URL returns 404 and nothing crashes", `${m.status} crashed=${crashed}`);

  // P0-2: guessing a token with an operator never matches.
  for (const route of ["/webhook/website", "/webhook/website/register"]) {
    const r = await post(route, { token: { $regex: "^s" }, name: "X", phone: "9876543210" });
    check(r.status === 400 || r.status === 401, `${route}: {"$regex":"^s"} does not match the real token`, String(r.status));
  }
  const q = await post("/webhook/lead", { name: "X", phone: "9876543210" }, "?token[$gt]=");
  check(q.status === 400 || q.status === 401, "/webhook/lead: ?token[$gt]= in the query does not match", String(q.status));
  const ok = await post("/webhook/website", { token: "secretTok123", name: "Real Lead", phone: "9876543210" });
  check(ok.status >= 200 && ok.status < 300, "the real token still works", String(ok.status));

  // P0-3: AiSensy apiKey as an operator matches no company.
  const before = await mongoose.connection.db.collection("leads").countDocuments();
  await post("/api/whatsapp/webhook", { apiKey: { $gt: "" }, data: { message: { phone_number: "919999999999", message_content: { text: "hi" } } } });
  await new Promise((r) => setTimeout(r, 300));
  const after = await mongoose.connection.db.collection("leads").countDocuments();
  check(after === before, "AiSensy webhook: {\"$gt\":\"\"} creates nothing in any company", `${before} -> ${after}`);

  // P0-4: template generator exported.
  check(typeof require("../utils/openai").generateWhatsAppTemplate === "function", "generateWhatsAppTemplate is exported");

  check(!crashed, "no unhandled rejection during the run");
  server.close();
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all audit P0 checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
