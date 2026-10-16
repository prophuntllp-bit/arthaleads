// Audit P1 security regressions (docs/AUDIT_2026-10-16.md): each fix is proven
// against the real code and a throwaway database.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";
delete process.env.GOOGLE_SIGNIN_CLIENT_IDS;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");

let failures = 0;
const check = (ok, msg, d = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}${!ok && d ? "  <- " + d : ""}`); if (!ok) failures++; };
const oid = () => new mongoose.Types.ObjectId();

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  for (const c of ["projects", "projectleads", "leads", "users", "organizations", "automations", "waconversations", "wamessages", "aiusages", "storageobjects"]) await mongoose.connection.createCollection(c).catch(() => {});
  const storage = require("../utils/storage");
  const removed = [];
  storage.remove = async (key) => { removed.push(key); };
  storage.isConfigured = () => true;
  const Project = require("../models/Project"), Lead = require("../models/Lead"), User = require("../models/User");
  const Organization = require("../models/Organization"), Automation = require("../models/Automation"), WaConversation = require("../models/WaConversation");
  console.log("\nAudit P1 security regressions\n");

  const orgA = oid(), orgB = oid();
  await Organization.collection.insertMany([
    { _id: orgA, name: "Acme", isActive: true, plan: "growth", approvalStatus: "approved", whatsapp: { enabled: true, apiKey: "k", phoneNumberId: "PN-A" } },
    { _id: orgB, name: "Bolt", isActive: true, plan: "growth", approvalStatus: "approved", whatsapp: { enabled: true, apiKey: "k2", phoneNumberId: "PN-B" } },
  ]);
  const adminA = { _id: oid(), orgId: orgA, role: "admin", name: "Admin A", email: "a@example.com", isActive: true };
  const managerA = { _id: oid(), orgId: orgA, role: "manager", name: "Manager A", email: "m@example.com", isActive: true };
  const agent1 = { _id: oid(), orgId: orgA, role: "agent", name: "Soniya", email: "s@example.com", isActive: true };
  const agent2 = { _id: oid(), orgId: orgA, role: "agent", name: "Arjun", email: "j@example.com", isActive: true };
  const superInA = { _id: oid(), orgId: orgA, role: "super_admin", name: "Platform", email: "p@example.com", isActive: true };
  await User.collection.insertMany([adminA, managerA, agent1, agent2, superInA]);

  // 1. Project save ignores system fields; deletes stay inside the project.
  const projectService = require("../services/projectService");
  const proj = await Project.collection.insertOne({ name: "Heights", orgId: orgA, createdBy: managerA._id, isArchived: false, images: [] });
  const pid = String(proj.insertedId);
  await projectService.update(pid, { name: "Heights 2", orgId: String(orgB), qrToken: "stolen", createdBy: String(adminA._id) }, managerA);
  const p1 = await Project.findById(pid).lean();
  check(String(p1.orgId) === String(orgA) && p1.name === "Heights 2" && !p1.qrToken && String(p1.createdBy) === String(managerA._id), "project save ignores orgId, qrToken and createdBy", JSON.stringify({ org: String(p1.orgId), q: p1.qrToken }));
  const otherFile = "https://api.arthaleads.com/api/media/arthaleads/projects/OTHERPROJECT/abc.jpg";
  const ownFile = `https://api.arthaleads.com/api/media/arthaleads/projects/${pid}/own.jpg`;
  await Project.updateOne({ _id: pid }, { $set: { images: [otherFile, ownFile] } });
  await projectService.update(pid, { images: [] }, managerA);
  await new Promise((r) => setTimeout(r, 50));
  check(removed.includes(`arthaleads/projects/${pid}/own.jpg`) && !removed.some((k) => k.includes("OTHERPROJECT")), "removing photos deletes only files inside this project's folder", JSON.stringify(removed));

  // 2. Uploads must be images; media serves anything else as a sandboxed download.
  const { imageOnly } = require("../utils/upload");
  let rejected = false;
  try { imageOnly("data:text/html;base64,PHNjcmlwdD4="); } catch (e) { rejected = e.statusCode === 400; }
  check(rejected, "an HTML file disguised as a photo is refused");
  check(!!imageOnly("data:image/jpeg;base64,/9j/4A=="), "a JPEG is accepted");
  const { Readable } = require("stream");
  storage.getObject = async (key) => ({ body: Readable.from([Buffer.from("x")]), contentType: key.endsWith(".html") ? "text/html" : "image/png", contentLength: 1 });
  const mapp = express(); mapp.use("/api/media", require("../routes/mediaRoutes"));
  const ms = mapp.listen(0); const mbase = `http://127.0.0.1:${ms.address().port}`;
  const h = await fetch(`${mbase}/api/media/arthaleads/attendance/x.html`);
  const i = await fetch(`${mbase}/api/media/arthaleads/logos/x.png`);
  check(/attachment/.test(h.headers.get("content-disposition") || "") && /sandbox/.test(h.headers.get("content-security-policy") || ""), "a stored HTML file downloads, sandboxed, and can't run");
  check(!i.headers.get("content-disposition"), "images still display normally");
  ms.close();

  // 3. Super admin accounts: a company admin can't change or delete them.
  const authService = require("../services/authService");
  let denied = 0;
  try { await authService.updateUser(String(superInA._id), { email: "x@example.com" }, adminA._id, orgA); } catch (e) { if (e.statusCode === 403) denied++; }
  try { await authService.deleteUser(String(superInA._id), adminA._id, orgA); } catch (e) { if (e.statusCode === 403) denied++; }
  const still = await User.findById(superInA._id).lean();
  check(denied === 2 && still && still.email === "p@example.com", "a company admin can't edit or delete the super admin account");
  const upd = await authService.updateUser(String(agent2._id), { name: "Arjun M" }, adminA._id, orgA);
  check(upd && (upd.name === "Arjun M" || upd.user?.name === "Arjun M"), "a company admin can still edit their own team");

  // 4. A Facebook page or intake key can belong to one company only.
  const automationService = require("../services/automationService");
  await Automation.collection.insertOne({ orgId: orgB, platform: "Facebook", name: "B page", pageId: "PAGE-B", isActive: true, verifyToken: "tokB", createdBy: oid(), updatedBy: oid() });
  let fb = 0;
  try { await automationService.create({ platform: "Facebook", name: "steal", pageId: "PAGE-B" }, adminA); } catch (e) { fb = e.statusCode; }
  check(fb === 409, "connecting another company's Facebook page is refused", String(fb));
  let tk = 0;
  try { await automationService.create({ platform: "Custom", name: "dupe key", verifyToken: "tokB" }, adminA); } catch (e) { tk = e.statusCode; }
  check(tk === 409, "reusing another company's intake key is refused", String(tk));

  // 5. Routes: agent visibility, conversations, WhatsApp number claiming.
  const leadOfAgent2 = { _id: oid(), orgId: orgA, name: "Kavya", phone: "919800001111", assignedTo: agent2._id, createdBy: agent2._id, status: "Contacted", isDeleted: false, isArchived: false, notes: [], activities: [] };
  const leadOfAgent1 = { _id: oid(), orgId: orgA, name: "Rahul", phone: "919800002222", assignedTo: agent1._id, createdBy: agent1._id, status: "Contacted", isDeleted: false, isArchived: false, notes: [], activities: [] };
  await Lead.collection.insertMany([leadOfAgent2, leadOfAgent1]);
  await WaConversation.collection.insertOne({ _id: oid(), orgId: orgA, contactPhone: "919800003333", assignedTo: agent2._id, status: "open", lastMessageAt: new Date() });
  const app = express(); app.use(express.json());
  app.use("/api/leads", require("../routes/leadRoutes"));
  app.use("/api/whatsapp", require("../routes/whatsappRoutes"));
  app.use("/api/help", require("../routes/helpRoutes"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message })); // eslint-disable-line no-unused-vars
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  const as = (u) => ({ authorization: `Bearer ${jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}`, "content-type": "application/json" });
  const post = (u, path, body) => fetch(`${base}${path}`, { method: "POST", headers: as(u), body: JSON.stringify(body || {}) }).then((r) => r.status);
  const patch = (u, path, body) => fetch(`${base}${path}`, { method: "PATCH", headers: as(u), body: JSON.stringify(body || {}) }).then((r) => r.status);

  check(await post(agent1, `/api/leads/${leadOfAgent2._id}/retry-facebook`) === 404, "an agent can't retry a colleague's Facebook lead");
  check(await post(agent1, `/api/leads/${leadOfAgent2._id}/draft-message`) === 404, "an agent can't draft a message from a colleague's lead");
  check(await post(agent1, "/api/whatsapp/conversations/start", { leadId: String(leadOfAgent2._id) }) === 404, "an agent can't start a chat on a colleague's lead");
  check(await post(agent1, "/api/whatsapp/conversations/start", { phone: "919800003333" }) === 409, "an agent isn't handed a colleague's existing chat");
  check(await patch(adminA, "/api/whatsapp/settings", { phoneNumberId: "PN-B" }) === 409, "claiming another company's WhatsApp number is refused");
  check(await patch(adminA, "/api/whatsapp/settings", { phoneNumberId: "PN-A2" }) === 200, "changing to a free number still works");

  // 6. Old helpbot context: an agent only gets their own leads.
  const { fetchPageContext } = require("../utils/copilotContext");
  await Lead.updateOne({ _id: leadOfAgent2._id }, { $set: { followUpDate: new Date(Date.now() - 2 * 864e5) } });
  await Lead.updateOne({ _id: leadOfAgent1._id }, { $set: { followUpDate: new Date(Date.now() - 2 * 864e5) } });
  const ctxAgent = await fetchPageContext("/followups", agent1._id, orgA, null, agent1);
  const ctxMgr = await fetchPageContext("/followups", managerA._id, orgA, null, managerA);
  check(/Rahul/.test(ctxAgent) && !/Kavya/.test(ctxAgent), "help context shows an agent only their own overdue leads", ctxAgent.slice(-200));
  check(/Rahul/.test(ctxMgr) && /Kavya/.test(ctxMgr), "a manager still sees the whole team");

  // 7. Typed search is matched literally (no regex errors or patterns).
  const followupService = require("../services/followupService");
  let threw = false;
  try { await followupService.get(agent1, { section: "past", search: "(((a+)+)+" }); } catch { threw = true; }
  check(!threw, "a search with regex symbols doesn't error");

  // 8. Google sign-in: records the app; refuses others once IDs are set.
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).includes("userinfo")) return { ok: true, json: async () => ({ sub: "1", email: "g@example.com", email_verified: true, name: "G" }) };
    if (String(url).includes("tokeninfo")) return { ok: true, json: async () => ({ azp: "evil-app.apps.googleusercontent.com" }) };
    return realFetch(url, opts);
  };
  let okUnset = true;
  try { await authService.googleProfile("tok"); } catch { okUnset = false; }
  process.env.GOOGLE_SIGNIN_CLIENT_IDS = "web.apps.googleusercontent.com,android.apps.googleusercontent.com";
  let refused = false;
  try { await authService.googleProfile("tok"); } catch (e) { refused = e.statusCode === 401; }
  global.fetch = realFetch; delete process.env.GOOGLE_SIGNIN_CLIENT_IDS;
  check(okUnset, "Google sign-in keeps working while the allowed apps aren't configured");
  check(refused, "once configured, a token from another Google app is refused");

  srv.close();
  console.log(failures ? `\n  ${failures} FAILED\n` : "\n  all audit P1 security checks passed\n");
  await mongoose.disconnect(); await mongod.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
