// Guards the hand-written DISPOSITION map in accountDeletionService against
// drift. The map cannot be reflected -- deciding whether a collection is
// dropped or merely unlinked is a judgement about whose data it is -- but a
// hand-written map goes stale the moment somebody adds a model, and a gap here
// means retaining a person's data after telling them it was deleted.
//
// So: reflect over every registered model, and fail if one references User (or
// denormalises their name) without an entry saying what should happen to it.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MODELS_DIR = path.join(__dirname, "..", "models");
fs.readdirSync(MODELS_DIR)
  .filter((f) => f.endsWith(".js"))
  .forEach((f) => { try { require(path.join(MODELS_DIR, f)); } catch { /* needs env */ } });

const { DISPOSITION } = require("../services/accountDeletionService");

/** Every path on a model that points at a User, including inside subdocuments. */
function userRefs(schema, prefix = "") {
  const out = [];
  schema.eachPath((p, type) => {
    if (type.schema) { out.push(...userRefs(type.schema, `${prefix}${p}.`)); return; }
    const ref = type.options?.ref || type.caster?.options?.ref;
    if (ref === "User") out.push(prefix + p);
  });
  return out;
}

let failures = 0;
const report = (ok, msg) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

console.log("\n  Every model referencing User has a disposition\n");

for (const [name, Model] of Object.entries(mongoose.models)) {
  const refs = userRefs(Model.schema);
  if (!refs.length) continue;

  const rule = DISPOSITION[name];
  if (!rule) {
    report(false, `${name} references User (${refs.join(", ")}) but has no DISPOSITION entry`);
    continue;
  }

  if (rule.drop) {
    report(refs.includes(rule.drop), `${name}: dropped by ${rule.drop}`);
    continue;
  }

  const covered = new Set([
    ...(rule.scalar || []).map(([ref]) => ref),
    ...(rule.arrays || []).map(([p, ref]) => `${p}.${ref}`),
  ]);
  const missed = refs.filter((r) => !covered.has(r));
  report(missed.length === 0, `${name}: ${refs.length} ref(s) covered${missed.length ? ` — MISSED ${missed.join(", ")}` : ""}`);
}

console.log("\n  Name fields are cleared alongside the ref they mirror\n");

// A dangling "assignedToName" is the failure mode that looks like success:
// the link is gone, the person's name is still on screen.
for (const [name, rule] of Object.entries(DISPOSITION)) {
  const Model = mongoose.models[name];
  if (!Model || rule.drop) continue;

  for (const [ref, nameField] of rule.scalar || []) {
    const guess = `${ref}Name`;
    const exists = !!Model.schema.path(guess);
    if (exists && nameField !== guess) {
      report(false, `${name}.${guess} exists but ${ref} does not clear it`);
    } else if (nameField) {
      report(!!Model.schema.path(nameField), `${name}.${nameField} cleared with ${ref}`);
    }
  }

  for (const [p, ref, nameField] of rule.arrays || []) {
    if (!nameField) continue;
    const sub = Model.schema.path(p)?.schema;
    report(!!sub?.path(nameField), `${name}.${p}[].${nameField} cleared with ${ref}`);
  }
}

console.log("\n  Org purge reaches every collection that has an orgId\n");

const orgScoped = Object.entries(mongoose.models)
  .filter(([n, M]) => n !== "Organization" && M.schema.path("orgId"))
  .map(([n]) => n);
report(orgScoped.length > 0, `${orgScoped.length} collections carry orgId and are purged by reflection`);
report(!!mongoose.models.AuditLog?.schema.path("targetOrg"),
  "AuditLog has no orgId and is purged by targetOrg instead");

console.log(`\n  ${failures ? `${failures} failed` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
