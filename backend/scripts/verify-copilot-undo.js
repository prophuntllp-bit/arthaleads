// Phase 5 verification: undo receipts really restore, and the kill switch is
// wired.
//
// The round-trip below genuinely writes: it changes a lead's status, asserts
// the change, undoes it, and asserts the original value is back. It ends where
// it started, and if the undo fails it restores the lead directly and says so
// loudly rather than leaving it changed.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); ok ? pass++ : fail++; };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const actions = require("../actions");
  const Lead = require("../models/Lead");
  const User = require("../models/User");
  const { STATUS } = require("../constants/leadOptions");

  console.log("=== every mutating action declares a receipt and an inverse ===");
  const NO_UNDO = ["add_lead_note"]; // no service exists to remove a note
  for (const a of actions.ENTRIES) {
    if (NO_UNDO.includes(a.id)) {
      check(`${a.id} is knowingly not undoable`, typeof a.undo !== "function");
      continue;
    }
    check(`${a.id} has captureBefore + undo`,
      typeof a.captureBefore === "function" && typeof a.undo === "function");
  }

  console.log("\n=== the kill switch is real ===");
  const orgSrc = fs.readFileSync(path.join(__dirname, "../models/Organization.js"), "utf8");
  const routeSrc = fs.readFileSync(path.join(__dirname, "../routes/helpRoutes.js"), "utf8");
  const saSrc = fs.readFileSync(path.join(__dirname, "../controllers/superAdminController.js"), "utf8");
  check("Organization has copilotWritesDisabled", orgSrc.includes("copilotWritesDisabled"));
  check("the action route checks it", /copilotWritesDisabled[\s\S]{0,300}?403/.test(routeSrc));
  check("a super admin can toggle it", saSrc.includes('"copilotWritesDisabled"'));
  check("undo has a 24h window", routeSrc.includes("UNDO_WINDOW_MS"));
  check("undo is claimed before running", /undoneAt: null[\s\S]{0,200}?\$set: \{ undoneAt/.test(routeSrc));

  console.log("\n=== round trip: change a lead, then put it back ===");
  const lead = await Lead.findOne({ isDeleted: { $ne: true }, status: { $in: STATUS } }).lean();
  const admin = await User.findOne({ orgId: lead.orgId, role: { $in: ["admin", "manager"] } }).lean();
  if (!lead || !admin) { console.log("  (no suitable lead/admin found — skipping)"); }
  else {
    const user = { _id: admin._id, orgId: lead.orgId, role: admin.role, name: admin.name };
    const original = lead.status;
    const target = STATUS.find((s) => s !== original);
    const action = actions.byId.get("update_lead_status");
    console.log(`  lead "${lead.name}"  ${original} -> ${target} -> ${original}`);

    let before = null;
    try {
      before = await action.captureBefore({ params: { leadId: String(lead._id) }, user });
      check("receipt captured the original value", before.status === original, JSON.stringify(before));

      await action.execute({ params: { leadId: String(lead._id), status: target }, user });
      const mid = await Lead.findById(lead._id).select("status").lean();
      check("the change actually applied", mid.status === target, mid.status);

      await action.undo({ before, user });
      const after = await Lead.findById(lead._id).select("status").lean();
      check("undo restored the original value", after.status === original, after.status);
    } catch (err) {
      check("round trip completed", false, err.message);
    } finally {
      const final = await Lead.findById(lead._id).select("status").lean();
      if (final && final.status !== original) {
        console.log(`\n  !! lead left as "${final.status}" — restoring directly to "${original}"`);
        await Lead.updateOne({ _id: lead._id }, { $set: { status: original } });
        const rechecked = await Lead.findById(lead._id).select("status").lean();
        check("lead restored after a failed round trip", rechecked.status === original, rechecked.status);
      } else {
        check("lead ends exactly where it started", true, original);
      }
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exitCode = fail ? 1 : 0;
})();
