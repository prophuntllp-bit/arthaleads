// Proves the copilot's write actions now inherit the service layer's
// permission rules.
//
// Only exercises REFUSAL paths plus one no-op write: every assertion below
// expects a throw, and the services check permission before they mutate, so
// nothing in the database changes when this runs.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

async function expectThrow(name, fn, wantStatus) {
  try {
    await fn();
    check(name, false, "did NOT throw — the gate is open");
  } catch (err) {
    const got = err.statusCode || err.status;
    check(name, got === wantStatus, `${got} ${err.message}`);
  }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const leadService = require("../services/leadService");
  const Lead = require("../models/Lead");
  const User = require("../models/User");

  // A lead that is assigned to somebody, so "not mine" is meaningful.
  const lead = await Lead.findOne({ assignedTo: { $ne: null }, isDeleted: { $ne: true } }).lean();
  if (!lead) { console.log("no assigned lead available to test against"); process.exit(0); }

  const admin = await User.findOne({ orgId: lead.orgId, role: { $in: ["admin", "manager"] } }).lean();
  const other = await User.findOne({ orgId: lead.orgId, _id: { $ne: lead.assignedTo } }).lean();
  if (!admin || !other) { console.log("need an admin and a second user in the same org"); process.exit(0); }

  // An agent who is NOT the assignee — the exact case that used to slip through.
  const agent = { _id: other._id, orgId: lead.orgId, role: "agent", name: "Gate Test" };

  console.log(`target lead: ${lead.name}  (org ${lead.orgId}, assigned to ${lead.assignedToName})\n`);

  console.log("=== an agent must NOT be able to reassign (REST requires admin/manager) ===");
  await expectThrow("leadService.assign refuses an agent",
    () => leadService.assign(String(lead._id), String(admin._id), agent), 403);

  console.log("\n=== an agent must NOT be able to edit a lead that is not theirs ===");
  await expectThrow("leadService.update refuses a non-owner agent",
    () => leadService.update(String(lead._id), { status: "Contacted" }, agent), 403);
  await expectThrow("leadService.addNote refuses a non-owner agent",
    () => leadService.addNote(String(lead._id), "gate test", agent), 403);

  console.log("\n=== cross-tenant is still refused ===");
  const foreign = { _id: other._id, orgId: new mongoose.Types.ObjectId(), role: "admin", name: "Other Org" };
  await expectThrow("another org cannot touch this lead",
    () => leadService.update(String(lead._id), { status: "Contacted" }, foreign), 404);

  console.log("\n=== an admin is still allowed (no-op: same status, so nothing changes) ===");
  try {
    await leadService.update(String(lead._id), { status: lead.status }, admin);
    check("admin update succeeds", true, `status left at "${lead.status}"`);
  } catch (err) {
    check("admin update succeeds", false, err.message);
  }

  console.log("\n=== the service writes an audit trail the old copilot skipped ===");
  const src = require("fs").readFileSync(require("path").join(__dirname, "../services/leadService.js"), "utf8");
  check("update() calls logActivity", /async update\([\s\S]{0,1400}?logActivity/.test(src));
  check("assign() calls logActivity", /async assign\([\s\S]{0,900}?logActivity/.test(src));
  check("addNote() calls logActivity", /async addNote\([\s\S]{0,700}?logActivity/.test(src));

  const after = await Lead.findById(lead._id).lean();
  console.log("\n=== nothing was mutated by this test ===");
  check("status unchanged", after.status === lead.status, after.status);
  check("assignee unchanged", String(after.assignedTo) === String(lead.assignedTo));
  check("note count unchanged", (after.notes || []).length === (lead.notes || []).length);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exitCode = fail ? 1 : 0;
})();
