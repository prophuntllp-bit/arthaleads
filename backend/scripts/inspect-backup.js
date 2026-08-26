// Read-only inspection of a nightly backup dump. Writes nothing.
const fs = require("fs");
const zlib = require("zlib");

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/inspect-backup.js <path-to.json.gz>"); process.exit(1); }

const raw = zlib.gunzipSync(fs.readFileSync(file));
console.log("file:", file);
console.log("gz size:", fs.statSync(file).size, "bytes -> raw", raw.length, "bytes\n");

const data = JSON.parse(raw);
console.log("_meta:", JSON.stringify(data._meta), "\n");

for (const [k, v] of Object.entries(data)) {
  if (k === "_meta") continue;
  console.log("  " + k.padEnd(20) + (Array.isArray(v) ? v.length + " docs" : typeof v));
}

const users = data.users || [];
console.log("\n=== users ===");
console.log("count:", users.length);
console.log("with password hash:", users.filter(u => u.password).length);
console.log("with googleId only:", users.filter(u => !u.password && u.googleId).length);
const byRole = {};
users.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
console.log("roles:", JSON.stringify(byRole));
console.log("\nfirst 20:");
users.slice(0, 20).forEach(u =>
  console.log("  " + String(u.email).padEnd(34) + String(u.role).padEnd(12) +
    "org=" + String(u.orgId || "NONE").padEnd(26) + (u.password ? "pwd" : "no-pwd")));

console.log("\n=== leads ===", (data.leads || []).length, "docs");
console.log("=== organizations ===", (data.organizations || []).length, "docs");
console.log("=== projectleads ===", (data.projectleads || []).length, "docs");
