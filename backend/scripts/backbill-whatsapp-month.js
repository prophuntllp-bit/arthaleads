// scripts/backbill-whatsapp-month.js - charge a company for this month's WhatsApp
// messages that the wallet let through without charging.
//
// Written 17 Oct 2026 for Prophunt LLP: until that day it was on direct Meta
// billing (rates ₹0), and replies were never charged even on normal billing
// (settle() released every hold Meta marked free). The owner moved it onto
// standard rates and asked for the whole month to count, not just from the
// switch.
//
//   node scripts/backbill-whatsapp-month.js <orgId>           preview only
//   node scripts/backbill-whatsapp-month.js <orgId> --apply   charge
//
// What is charged, for the current billing month (Meta's UTC calendar month):
//  - replies after the org's free replies for the month, at its reply rate;
//  - marketing / utility / authentication messages at its rates.
// Each charge is a normal statement line keyed to the message's WhatsApp id
// and dated when the message went out. A message that already has a line for
// its full price is skipped; one recorded at ₹0 (direct billing) gets an
// "adjustment" line for the difference. Failed messages are never charged.
// Running it again charges nothing twice.
require("dotenv").config();
const mongoose = require("mongoose");

const orgArg = process.argv[2];
const apply = process.argv.includes("--apply");
const IST = { timeZone: "Asia/Kolkata", day: "numeric", month: "short" };

(async () => {
  if (!orgArg || !mongoose.Types.ObjectId.isValid(orgArg)) {
    console.log("Usage: node scripts/backbill-whatsapp-month.js <orgId> [--apply]");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const credits = require("../services/creditService");
  const Organization = require("../models/Organization");
  const CreditLedger = require("../models/CreditLedger");
  const WaMessage = require("../models/WaMessage");
  const orgId = new mongoose.Types.ObjectId(orgArg);

  const org = await Organization.findById(orgId).select("name credits").lean();
  if (!org) throw new Error("org not found");
  const now = new Date();
  const today = now.toLocaleDateString("en-IN", IST);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const allowance = credits.freeAllowanceFor(org);

  const msgs = await WaMessage.find({ orgId, direction: "outbound", status: { $ne: "failed" }, timestamp: { $gte: monthStart } })
    .sort({ timestamp: 1 }).select("waMsgId creditCategory timestamp conversationId campaignId").lean();
  const ids = msgs.map((m) => m.waMsgId).filter(Boolean);
  const existing = await CreditLedger.find({ orgId, waMsgId: { $in: ids } }).select("waMsgId type amountPaise").lean();
  const chargedFor = new Map(); // waMsgId -> paise already charged
  for (const r of existing) chargedFor.set(r.waMsgId, (chargedFor.get(r.waMsgId) || 0) + Math.max(0, -r.amountPaise));
  // Adjustments carry the message id in their note (waMsgId is unique per debit).
  const adjusted = await CreditLedger.find({ orgId, type: "adjustment", note: { $regex: "^Back-billed" } }).select("note amountPaise").lean();
  for (const a of adjusted) {
    const id = (a.note.match(/\[(wamid\.[^\]]+)\]/) || [])[1];
    if (id) chargedFor.set(id, (chargedFor.get(id) || 0) + Math.max(0, -a.amountPaise));
  }
  const hasDebit = new Set(existing.filter((r) => r.type === "debit").map((r) => r.waMsgId));

  let freeLeft = allowance;
  const lines = [];
  for (const m of msgs) {
    const category = m.creditCategory || "service";
    if (category === "service" && freeLeft > 0) { freeLeft--; continue; }
    if (!m.waMsgId) continue;
    const rate = credits.rateFor(org, category);
    const owed = rate - (chargedFor.get(m.waMsgId) || 0);
    if (owed <= 0) continue;
    lines.push({ m, category, rate, owed, type: hasDebit.has(m.waMsgId) ? "adjustment" : "debit" });
  }
  const total = lines.reduce((s, l) => s + l.owed, 0);
  const byCat = lines.reduce((o, l) => ((o[l.category] = (o[l.category] || 0) + 1), o), {});
  const bal0 = org.credits?.balancePaise || 0;
  console.log(`${org.name}: ${msgs.length} messages since ${monthStart.toISOString().slice(0, 10)}, ${allowance - freeLeft} of ${allowance} free replies used.`);
  console.log(`To charge: ${lines.length} messages ${JSON.stringify(byCat)} = ₹${(total / 100).toFixed(2)}. Balance ₹${(bal0 / 100).toFixed(2)} -> ₹${((bal0 - total) / 100).toFixed(2)}.`);
  if (!apply || !lines.length) {
    if (!apply) console.log("Preview only. Add --apply to charge.");
    await mongoose.disconnect();
    return;
  }

  let running = bal0, inserted = 0, insertedPaise = 0;
  for (const l of lines) {
    const doc = {
      orgId, type: l.type, amountPaise: -l.owed, balanceAfterPaise: running - l.owed,
      category: l.category, rateAppliedPaise: l.rate, freeTierApplied: false,
      waMsgId: l.type === "debit" ? l.m.waMsgId : null,
      conversationId: l.m.conversationId || null, campaignId: l.m.campaignId || null,
      metaPricing: null, razorpayPaymentId: null, gstPaise: 0,
      note: l.type === "debit"
        ? `Billed ${today}`
        : `Back-billed ${today}: ${l.category} message sent ${l.m.timestamp.toLocaleDateString("en-IN", IST)}, recorded at ₹0 under direct Meta billing [${l.m.waMsgId}]`,
      createdAt: l.m.timestamp, updatedAt: now, __v: 0,
    };
    try {
      await CreditLedger.collection.insertOne(doc);
      running -= l.owed; inserted++; insertedPaise += l.owed;
    } catch (err) {
      if (err.code !== 11000) throw err; // charged meanwhile by a live status webhook: skip
    }
  }
  await Organization.updateOne({ _id: orgId }, { $inc: { "credits.balancePaise": -insertedPaise } });
  const after = await credits.getBalance(orgId);
  console.log(`Charged ${inserted} messages, ₹${(insertedPaise / 100).toFixed(2)}. Balance now ₹${(after.balancePaise / 100).toFixed(2)}; owes ₹${(after.owedPaise / 100).toFixed(2)}; ₹${(after.spendablePaise / 100).toFixed(2)} left before messages pause.`);
  await mongoose.disconnect();
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
