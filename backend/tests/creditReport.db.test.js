// WhatsApp credits report and statement follow the shared date picker
// (?dateRange=preset or ?from&to, IST days), the Android app's older
// ?range=7|30|month keeps working, and "Credits spent" counts adjustments.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");

const oid = () => new mongoose.Types.ObjectId();
let mongod, server, base, auth, ORG;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${base}${path}`, { agent: false, headers: auth }, (res) => {
      const chunks = []; res.on("data", (c) => chunks.push(c));
      res.on("end", () => { let json = null; try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* not json */ } resolve({ status: res.statusCode, json }); });
    }).on("error", reject);
  });
}
// IST noon on a date, so it sits well inside that IST day.
const ist = (d) => new Date(`${d}T12:00:00+05:30`);

test("a custom range counts only that range's messages and charges", async () => {
  const r = await get("/api/credits/utilization?from=2026-09-01&to=2026-09-30");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.totals.messages, 3, "the three September messages");
  assert.equal(r.json.totals.spentPaise, 112 + 15, "September's two charges");
  assert.equal(r.json.days.length, 30, "one bar per day of September");
});

test("credits spent includes adjustment lines (back-billing)", async () => {
  const r = await get("/api/credits/utilization?from=2026-10-01&to=2026-10-31");
  assert.equal(r.json.totals.spentPaise, 15 + 15 + 112, "two replies and the ₹1.12 adjustment");
});

test("a preset from the picker works, and 'all' covers everything", async () => {
  const all = await get("/api/credits/utilization?dateRange=all");
  assert.equal(all.status, 200);
  assert.equal(all.json.totals.messages, 6);
  assert.equal(all.json.totals.spentPaise, 112 + 15 + 15 + 15 + 112);
  const lastYear = await get("/api/credits/utilization?dateRange=lastyear");
  assert.equal(lastYear.status, 200);
  assert.equal(lastYear.json.totals.messages, 0);
});

test("the Android app's ?range=30 still works", async () => {
  const r = await get("/api/credits/utilization?range=30");
  assert.equal(r.status, 200);
  assert.equal(r.json.range, "30");
});

test("the statement (and so the CSV download) follows the chosen dates", async () => {
  const sep = await get("/api/credits/ledger?from=2026-09-01&to=2026-09-30&limit=200");
  assert.equal(sep.json.total, 2);
  assert.ok(sep.json.rows.every((x) => new Date(x.createdAt) >= ist("2026-09-01") && new Date(x.createdAt) <= new Date("2026-10-01T00:00:00+05:30")));
  const oneDay = await get("/api/credits/ledger?from=2026-10-05&to=2026-10-05");
  assert.equal(oneDay.json.total, 1, "a single IST day");
  const all = await get("/api/credits/ledger?dateRange=all&limit=200");
  assert.equal(all.json.total, 6);
  const noFilter = await get("/api/credits/ledger?limit=200");
  assert.equal(noFilter.json.total, 6, "no dates = everything, as before");
});

test("a day is an IST day: a charge at 00:30 IST on 6 Oct is not in 5 Oct", async () => {
  const r = await get("/api/credits/ledger?from=2026-10-06&to=2026-10-06");
  assert.equal(r.json.total, 1);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const db = mongoose.connection;
  ORG = oid();
  const admin = { _id: oid(), orgId: ORG, role: "admin", name: "Admin", email: "admin@example.com", isActive: true };
  await db.collection("organizations").insertOne({ _id: ORG, name: "Report Co", slug: `r-${ORG}`, isActive: true, plan: "enterprise", credits: { balancePaise: -269, reservedPaise: 0 } });
  await db.collection("users").insertOne(admin);
  const msg = (d, c) => ({ _id: oid(), orgId: ORG, conversationId: oid(), direction: "outbound", sender: "bot", status: "delivered", creditCategory: c, timestamp: ist(d), createdAt: ist(d) });
  await db.collection("wamessages").insertMany([
    msg("2026-09-10", "marketing"), msg("2026-09-20", "service"), msg("2026-09-25", "service"),
    msg("2026-10-05", "service"), msg("2026-10-06", "service"), msg("2026-10-09", "marketing"),
  ]);
  const row = (when, type, amount, category) => ({ _id: oid(), orgId: ORG, type, amountPaise: amount, balanceAfterPaise: 0, category, createdAt: when, updatedAt: when });
  await db.collection("creditledgers").insertMany([
    row(ist("2026-09-10"), "debit", -112, "marketing"),
    row(ist("2026-09-20"), "debit", -15, "service"),
    row(ist("2026-10-05"), "debit", -15, "service"),
    row(new Date("2026-10-06T00:30:00+05:30"), "debit", -15, "service"),
    row(ist("2026-10-09"), "debit", 0, "marketing"),
    row(ist("2026-10-09"), "adjustment", -112, "marketing"),
  ]);
  const app = express(); app.use(express.json());
  app.use("/api/credits", require("../routes/creditRoutes"));
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  auth = { authorization: `Bearer ${jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}` };
  const origExit = process.exit;
  process.exit = async (code) => { server.closeAllConnections?.(); server.close(); await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp credits report and statement by date range");
})();
