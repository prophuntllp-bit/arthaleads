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

test("a reply past the free 1,000 is charged even though Meta reports it free", async () => {
  const org = await company();
  const held = await credits.reserve(org, { category: "service" });
  assert.equal(held, 15);
  const r = await credits.settle(org, { reservedPaise: held, category: "service", waMsgId: "wamid.reply1",
    metaPricing: { billable: false, pricing_model: "PMP", category: "service", type: "free_customer_service" } });
  assert.equal(r.debitedPaise, 15);
  const b = await credits.getBalance(org);
  assert.equal(b.balancePaise, -15);
  assert.equal(b.reservedPaise, 0);
});

test("a reply inside the free 1,000 costs nothing", async () => {
  const org = await company({ freeUsed: 10 });
  const held = await credits.reserve(org, { category: "service" });
  const r = await credits.settle(org, { reservedPaise: held, category: "service", waMsgId: "wamid.reply2", freeTierApplied: true,
    metaPricing: { billable: false, category: "service" } });
  assert.equal(r.debitedPaise, 0);
  assert.equal((await credits.getBalance(org)).balancePaise, 0);
});

test("a template Meta does not bill (e.g. utility inside the window) still costs nothing", async () => {
  const org = await company();
  const held = await credits.reserve(org, { category: "utility" });
  const r = await credits.settle(org, { reservedPaise: held, category: "utility", waMsgId: "wamid.util1",
    metaPricing: { billable: false, category: "utility" } });
  assert.equal(r.skipped, "not-billable");
  const b = await credits.getBalance(org);
  assert.equal(b.balancePaise, 0);
  assert.equal(b.reservedPaise, 0);
});

test("a marketing message Meta bills is charged at our marketing rate", async () => {
  const org = await company();
  const held = await credits.reserve(org, { category: "marketing" });
  await credits.settle(org, { reservedPaise: held, category: "marketing", waMsgId: "wamid.mkt1",
    metaPricing: { billable: true, category: "marketing" } });
  assert.equal((await credits.getBalance(org)).balancePaise, -112);
});

test("a company given 500 free replies pays from the 501st", async () => {
  const _id = oid();
  await Organization.collection.insertOne({ _id, name: "Reseller Co", slug: `r-${_id}`,
    credits: { balancePaise: 0, reservedPaise: 0, freeServicePerMonth: 500, freeService: { yyyymm: month(), used: 499 } } });
  assert.equal(await credits.reserve(_id, { category: "service" }), 0, "the 500th reply is free");
  assert.equal(await credits.reserve(_id, { category: "service" }), 15, "the 501st costs the reply rate");
  assert.equal((await credits.quote(_id, "service", 1)).freeCount, 0);
});

test("on the 1st the free replies come back, but the debt stays until a top-up", async () => {
  const _id = oid();
  // Ended last month owing ₹53.02 with every free reply used.
  await Organization.collection.insertOne({ _id, name: "Carry Co", slug: `c-${_id}`,
    credits: { balancePaise: -5302, reservedPaise: 0, freeService: { yyyymm: "202609", used: 1000 } } });
  const held = await credits.reserve(_id, { category: "service" });
  assert.equal(held, 0, "the new month's first reply is free");
  const b = await credits.getBalance(_id);
  assert.equal(b.balancePaise, -5302, "free replies do not pay off what is owed");
  assert.equal(b.owedPaise, 5302);
  const org = await Organization.findById(_id).lean();
  assert.equal(org.credits.freeService.yyyymm, month());
  assert.equal(org.credits.freeService.used, 1);
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
