// WhatsApp credits (17 Oct 2026): a company that runs out keeps sending into a
// negative balance down to its overdraft limit (default ₹500), then stops; what
// it owes shows as a negative balance and the next top-up pays it off first.
// Also pins the guarantees the wallet already had: free replies first, holds,
// one debit per message, no overspend under concurrency.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
const { test, run, assert } = require("./helpers/harness");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod, credits, Organization, CreditLedger;
const oid = () => new mongoose.Types.ObjectId();
const month = () => { const d = new Date(); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

// A company with no free replies left this month, at the standard ₹0.15 reply rate.
async function company({ balancePaise = 0, overdraftLimitPaise, freeUsed = 1000 } = {}) {
  const _id = oid();
  await Organization.collection.insertOne({
    _id, name: "Test Co", slug: `t-${_id}`,
    credits: {
      balancePaise, reservedPaise: 0,
      ...(overdraftLimitPaise !== undefined ? { overdraftLimitPaise } : {}),
      freeService: { yyyymm: month(), used: freeUsed },
    },
  });
  return _id;
}
let msgN = 0;
async function sendReply(orgId) {
  const held = await credits.reserve(orgId, { category: "service" });
  await credits.settle(orgId, { reservedPaise: held, category: "service", waMsgId: `wamid.${++msgN}` });
  return held;
}

test("at ₹0 with free replies used up, a reply still goes out and the balance goes negative", async () => {
  const org = await company();
  await sendReply(org);
  const b = await credits.getBalance(org);
  assert.equal(b.balancePaise, -15);
  assert.equal(b.availablePaise, -15);
  assert.equal(b.owedPaise, 15);
  assert.equal(b.overdraftLimitPaise, 50000);
  assert.equal(b.spendablePaise, 50000 - 15);
  const row = await CreditLedger.findOne({ orgId: org, type: "debit" }).lean();
  assert.equal(row.balanceAfterPaise, -15, "the statement shows the negative running balance");
});

test("sending stops exactly at the overdraft limit", async () => {
  const org = await company({ balancePaise: -49_990 });          // ₹499.90 owed
  await assert.rejects(() => sendReply(org), (e) => e.name === "InsufficientCreditsError" && e.statusCode === 402);
  const org2 = await company({ balancePaise: -49_985 });         // exactly one reply of room
  await sendReply(org2);
  assert.equal((await credits.getBalance(org2)).balancePaise, -50_000);
  await assert.rejects(() => sendReply(org2), /Not enough WhatsApp credits/);
  assert.equal((await credits.getBalance(org2)).balancePaise, -50_000, "a refused send costs nothing");
});

test("free replies are still used before any money, even when in debt", async () => {
  const org = await company({ balancePaise: -10_000, freeUsed: 990 });
  const held = await credits.reserve(org, { category: "service" });
  assert.equal(held, 0);
  assert.equal((await credits.getBalance(org)).balancePaise, -10_000);
});

test("a company can be made strictly prepaid (limit 0) or given a bigger limit", async () => {
  const strict = await company({ overdraftLimitPaise: 0 });
  await assert.rejects(() => sendReply(strict), /Not enough WhatsApp credits/);
  const big = await company({ balancePaise: -60_000, overdraftLimitPaise: 100_000 });
  await sendReply(big);
  assert.equal((await credits.getBalance(big)).balancePaise, -60_015);
});

test("a top-up pays off what is owed first", async () => {
  const org = await company({ balancePaise: -30_000 });
  const after = await credits.topUp(org, { amountPaise: 100_000, note: "test" });
  assert.equal(after, 70_000);
  const b = await credits.getBalance(org);
  assert.equal(b.owedPaise, 0);
  assert.equal(b.spendablePaise, 70_000 + 50_000);
});

test("many sends at once never take a company past its limit", async () => {
  const org = await company({ balancePaise: -49_850 });          // room for exactly 10 replies
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => credits.reserve(org, { category: "service" })));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 10, `${ok} holds granted`);
  const b = await credits.getBalance(org);
  assert.equal(b.reservedPaise, 150);
  assert.equal(b.spendablePaise, 0);
});

test("a repeated Meta status webhook still debits once", async () => {
  const org = await company();
  const held = await credits.reserve(org, { category: "service" });
  await credits.settle(org, { reservedPaise: held, category: "service", waMsgId: "wamid.dup" });
  const again = await credits.settle(org, { reservedPaise: held, category: "service", waMsgId: "wamid.dup" });
  assert.equal(again.skipped, "duplicate");
  assert.equal((await credits.getBalance(org)).balancePaise, -15);
});

test("a failed send hands its hold back", async () => {
  const org = await company();
  const held = await credits.reserve(org, { category: "service" });
  await credits.release(org, held);
  const b = await credits.getBalance(org);
  assert.equal(b.reservedPaise, 0);
  assert.equal(b.balancePaise, 0);
});

test("rebuilding the balance from the statement keeps a negative balance", async () => {
  const org = await company();
  await sendReply(org); await sendReply(org);
  await Organization.updateOne({ _id: org }, { $set: { "credits.balancePaise": 0 } });
  const total = await credits.recomputeBalance(org);
  assert.equal(total, -30);
  assert.equal((await credits.getBalance(org)).balancePaise, -30);
});

test("a campaign that would pass the limit is refused up front; one that fits is allowed", async () => {
  const org = await company({ balancePaise: -49_000 });
  const tooBig = await credits.canAfford(org, "marketing", 10);  // 10 x ₹1.12 = ₹11.20 > ₹10 room
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.spendablePaise, 1_000);
  const fits = await credits.canAfford(org, "marketing", 8);     // ₹8.96
  assert.equal(fits.ok, true);
});

(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Organization = require("../models/Organization");
  CreditLedger = require("../models/CreditLedger");
  await CreditLedger.init();
  credits = require("../services/creditService");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("WhatsApp credits: overdraft down to a limit, then stop");
})();
