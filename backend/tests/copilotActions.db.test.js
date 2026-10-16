// Artha Phase 2 against a real database: changes are signed "(via Artha)",
// bulk changes leave history, the new one-card actions apply and undo
// cleanly, and pilot-only abilities stay pilot-only.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let failures = 0;
const check = (ok, msg, d = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`);
  if (!ok) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["projects", "projectleads", "leads", "tasks", "users"]) await mongoose.connection.createCollection(c).catch(() => {});
  const Lead = require("../models/Lead");
  const User = require("../models/User");
  const leadService = require("../services/leadService");
  const { runWith } = require("../utils/requestContext");
  const actions = require("../actions");
  const { toolsFor, runTool } = require("../copilot/tools");
  const oid = () => new mongoose.Types.ObjectId();
  console.log("\nArtha Phase 2 actions\n");

  const org = oid();
  const A = { _id: oid(), orgId: org, role: "agent", name: "Soniya" };
  const B = { _id: oid(), orgId: org, role: "agent", name: "Arjun" };
  const M = { _id: oid(), orgId: org, role: "manager", name: "Anil" };
  await User.collection.insertMany([A, B, M].map((u) => ({ ...u, email: `${u.name}@example.com`, isActive: true })));
  const base = () => ({ _id: oid(), orgId: org, isArchived: false, isDeleted: false, createdAt: new Date(), updatedAt: new Date(), status: "Contacted", source: "Facebook", activities: [], notes: [] });
  const rahul = { ...base(), name: "Rahul Verma", phone: "919800001111", assignedTo: A._id, createdBy: A._id, bhk: "N/A" };
  const k1 = { ...base(), name: "Kavya", phone: "919800002222", assignedTo: A._id, createdBy: A._id };
  const k2 = { ...base(), name: "Neha", phone: "919800003333", assignedTo: A._id, createdBy: A._id };
  const k3 = { ...base(), name: "Isha", phone: "919800004444", assignedTo: B._id, createdBy: B._id };
  await Lead.collection.insertMany([rahul, k1, k2, k3]);
  const last = async (id) => (await Lead.findById(id).lean()).activities.slice(-1)[0];

  // ── attribution ────────────────────────────────────────────────────────────
  await leadService.update(String(rahul._id), { status: "New" }, A);
  check(!(await last(rahul._id)).description.includes("via Artha"), "a person's own edit is not marked");
  await runWith({ via: "artha" }, () => leadService.update(String(rahul._id), { status: "Contacted" }, A));
  const a1 = await last(rahul._id);
  check(a1.description.includes("(via Artha)") && a1.meta?.via === "artha" && String(a1.performedBy) === String(A._id), "an edit made through Artha is signed '(via Artha)' and still credited to the person", JSON.stringify(a1));

  // ── bulk changes now leave history ────────────────────────────────────────
  const r = await leadService.bulkUpdateStatus([String(k1._id), String(k2._id)], "Site Visit", M);
  const hk = await last(k1._id);
  check(r.modified === 2 && hk?.type === "status_changed" && /bulk/.test(hk.description), "bulk status change writes a history entry on each lead", JSON.stringify(hk));
  await leadService.bulkUpdateStatus([String(k1._id)], "Site Visit", M);
  check((await Lead.findById(k1._id).lean()).activities.length === 1, "no duplicate entry when nothing changes");

  // ── log_lead_update: one card, many fields ────────────────────────────────
  const log = actions.byId.get("log_lead_update");
  const params = { leadId: String(rahul._id), note: "Called, wants 2 BHK", status: "Site Visit", bhk: "2BHK", siteVisitDate: new Date("2026-10-17T05:30:00Z"), followUpDate: new Date("2026-10-16T05:30:00Z") };
  const pv = await log.preview({ params, user: A });
  check(pv.subject === "Rahul Verma" && pv.fields.length === 5 && pv.fields.some((f) => f.label === "Site visit" && /17 October 2026/.test(f.to)), "preview shows every change on one card with IST dates", JSON.stringify(pv.fields.map((f) => [f.label, f.to])));
  const before = await log.captureBefore({ params, user: A });
  const res = await runWith({ via: "artha" }, () => log.execute({ params, user: A }));
  let doc = await Lead.findById(rahul._id).lean();
  check(doc.status === "Site Visit" && doc.bhk === "2BHK" && +doc.siteVisitDate === +params.siteVisitDate && doc.notes.length === 1, "execute applies every field and the note");
  check(doc.activities.filter((x) => /via Artha/.test(x.description)).length >= 2, "each change is signed '(via Artha)'");
  await runWith({ via: "artha" }, () => log.undo({ before, result: res, user: A }));
  doc = await Lead.findById(rahul._id).lean();
  check(doc.status === "Contacted" && doc.bhk === "N/A" && !doc.siteVisitDate && doc.notes.length === 0, "undo puts every field back and removes the note", JSON.stringify({ s: doc.status, b: doc.bhk, v: doc.siteVisitDate, n: doc.notes.length }));
  let denied = false;
  try { await log.preview({ params: { ...params, leadId: String(k3._id) }, user: A }); } catch (e) { denied = e.statusCode === 404; }
  check(denied, "a preview of a colleague's lead is refused as 'not found' (no name or values shown)");
  let oldDenied = false;
  try { await actions.byId.get("update_lead_status").preview({ params: { leadId: String(k3._id), status: "New" }, user: A }); } catch (e) { oldDenied = e.statusCode === 404; }
  check(oldDenied, "the same holds for the original actions' previews");
  let execDenied = false;
  try { await log.execute({ params: { leadId: String(k3._id), status: "New" }, user: A }); } catch (e) { execDenied = [403, 404].includes(e.statusCode); }
  check(execDenied, "an agent cannot change a colleague's lead through Artha");

  // ── bulk_assign_leads ─────────────────────────────────────────────────────
  const ba = actions.byId.get("bulk_assign_leads");
  const bp = { leadIds: [String(k1._id), String(k2._id), String(k3._id)], agentId: String(B._id) };
  const bprev = await ba.preview({ params: bp, user: M });
  check(bprev.rows.length === 3 && bprev.rows.filter((x) => x.skip).length === 1 && /2 leads to Arjun/.test(bprev.subject), "batch preview lists every row and marks the one already with Arjun", JSON.stringify(bprev));
  const bbefore = await ba.captureBefore({ params: bp, user: M });
  const bres = await runWith({ via: "artha" }, () => ba.execute({ params: bp, user: M }));
  check(bres.data.count === 2 && String((await Lead.findById(k1._id).lean()).assignedTo) === String(B._id), "bulk assign moves only the leads that need it");
  check(/via Artha/.test((await last(k2._id)).description), "bulk assign leaves a signed history entry");
  await ba.undo({ before: bbefore, user: M });
  check(String((await Lead.findById(k1._id).lean()).assignedTo) === String(A._id) && String((await Lead.findById(k3._id).lean()).assignedTo) === String(B._id), "undo returns each lead to its previous owner");
  check(!actions.availableFor({ role: "admin", page: "/leads" }).some((x) => x.v2Only), "the old helpbot (mobile) never offers the new card types");

  // ── create_lead records the new id, so Undo can remove it ─────────────────
  const cl = actions.byId.get("create_lead");
  const cres = await runWith({ via: "artha" }, () => cl.execute({ params: { name: "Test Abhi", phone: "919800005555", source: "Manual" }, user: A }));
  check(!!cres.data.leadId && !!(await Lead.findById(cres.data.leadId).lean()), "create_lead returns the new lead's id", JSON.stringify(cres));
  await cl.undo({ result: cres, user: A });
  const gone = await Lead.findById(cres.data.leadId).lean();
  check(!gone || gone.isDeleted, "undo of create_lead removes the lead");

  // ── pilot gating and tap-to-choose ────────────────────────────────────────
  const names = (u, o) => toolsFor(u, o).map((t) => t.function.name);
  const pilot = { _id: org, copilot: { beta: true } }, standard = { _id: org, copilot: { beta: false } };
  check(!names(A, standard).includes("log_lead_update") && !names(A, standard).includes("ask_user_to_choose"), "standard companies don't get pilot tools");
  check(names(A, pilot).includes("log_lead_update") && names(A, pilot).includes("ask_user_to_choose") && !names(A, pilot).includes("bulk_assign_leads"), "pilot agents get log-a-call and choose, not bulk assign");
  check(names(M, pilot).includes("bulk_assign_leads"), "pilot managers get bulk assign");
  const ctx = { user: A, org: pilot, proposals: [], choices: [] };
  const ch = await runTool("ask_user_to_choose", { question: "Which Rahul?", lead_ids: [String(rahul._id), String(k1._id), String(k3._id)] }, ctx);
  check(ch.result.status === "shown" && ctx.choices[0].options.length === 2 && !ctx.choices[0].options.some((o) => o.name === "Isha"), "choices only include leads the person can see", JSON.stringify(ctx.choices));
  check(/…1111/.test(ctx.choices[0].options[0].detail), "each choice shows status and the last 4 phone digits");
  const who = await runTool("ask_user_to_choose", { question: "Assign them to?", user_ids: [String(A._id), String(M._id), String(new mongoose.Types.ObjectId())] }, ctx);
  const people = ctx.choices[1]?.options || [];
  check(who.result.status === "shown" && people.length === 2 && people.every((o) => o.kind === "user"), "team members can be offered as buttons (only real, active people)", JSON.stringify(people));
  check(people.some((o) => o.detail === "Manager"), "each person shows their role");
  const one = await runTool("ask_user_to_choose", { question: "Assign them to?", user_ids: [String(A._id)] }, { ...ctx, choices: [] });
  check(!!one.result.error, "one person is not a choice: answer directly");

  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all Artha Phase 2 checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
