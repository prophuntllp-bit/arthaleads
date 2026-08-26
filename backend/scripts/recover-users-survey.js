// Read-only survey of what user identity can be reconstructed after the
// users collection was wiped. Writes nothing.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log("collections:", cols.join(", "), "\n");

  const counts = {};
  for (const c of cols) counts[c] = await db.collection(c).countDocuments();
  console.log("non-empty collections:");
  Object.entries(counts).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log("   " + c.padEnd(22) + n));

  // ── user ids + names referenced by surviving documents ────────────────────
  const found = new Map(); // id -> { name, org, sources:Set }
  const note = (id, name, org, src) => {
    if (!id) return;
    const k = String(id);
    if (!found.has(k)) found.set(k, { name: null, org: null, sources: new Set() });
    const e = found.get(k);
    if (name && !e.name) e.name = name;
    if (org && !e.org) e.org = String(org);
    e.sources.add(src);
  };

  if (counts.auditlogs) {
    for (const a of await db.collection("auditlogs").find({}).toArray()) {
      note(a.performedBy, a.performedByName, a.targetOrg, "auditlog.performedBy");
      note(a.targetUser, a.targetUserName, a.targetOrg, "auditlog.targetUser");
    }
  }
  if (counts.projectleads) {
    for (const l of await db.collection("projectleads").find({}, {
      projection: { assignedTo: 1, assignedToName: 1, createdBy: 1, orgId: 1, remarkUpdatedBy: 1 },
    }).toArray()) {
      note(l.assignedTo, l.assignedToName, l.orgId, "projectlead.assignedTo");
      note(l.createdBy, null, l.orgId, "projectlead.createdBy");
      note(l.remarkUpdatedBy, null, l.orgId, "projectlead.remarkUpdatedBy");
    }
  }
  if (counts.projects) {
    for (const p of await db.collection("projects").find({}).toArray()) {
      (p.assignedTo || []).forEach((u) => note(u, null, p.orgId, "project.assignedTo"));
      note(p.createdBy, null, p.orgId, "project.createdBy");
    }
  }
  if (counts.payments) {
    for (const p of await db.collection("payments").find({}).toArray()) {
      note(p.createdBy, null, p.orgId, "payment.createdBy");
    }
  }

  console.log("\ndistinct user ids referenced by surviving data:", found.size);
  let named = 0, orged = 0;
  for (const v of found.values()) { if (v.name) named++; if (v.org) orged++; }
  console.log("  with a recoverable name:", named);
  console.log("  with a recoverable orgId:", orged);

  // ── emails: the field that actually matters for logging in ────────────────
  const emails = new Set();
  if (counts.auditlogs) {
    for (const a of await db.collection("auditlogs").find({}).toArray()) {
      const d = JSON.stringify(a.details || {});
      (d.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach((e) => emails.add(e.toLowerCase()));
    }
  }
  for (const c of ["signupotps", "organizations"]) {
    if (!counts[c]) continue;
    for (const d of await db.collection(c).find({}).toArray()) {
      const s = JSON.stringify(d);
      (s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach((e) => emails.add(e.toLowerCase()));
    }
  }
  console.log("\nemail addresses recoverable from surviving data:", emails.size);
  [...emails].sort().forEach((e) => console.log("   " + e));

  await mongoose.disconnect();
})();
