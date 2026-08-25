/**
 * Fails if the price the website displays is not the price the server charges.
 *
 * frontend/src/utils/plan.js drives every figure a customer sees;
 * backend/constants/planPricing.js drives every rupee actually billed. They are
 * separate files because one is ESM in the browser bundle and the other is
 * CommonJS on the server — which makes silent drift possible, and a mismatch
 * between the quoted and charged price is the worst kind of bug to ship.
 *
 * Run: node backend/scripts/check-price-parity.js
 */
const fs = require("fs");
const path = require("path");
const { PLAN_PRICING: SERVER } = require("../constants/planPricing");

const FRONTEND = path.join(__dirname, "..", "..", "frontend", "src", "utils", "plan.js");

function parseFrontendPricing(src) {
  const block = src.match(/export const PLAN_PRICING\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("Could not find PLAN_PRICING in frontend/src/utils/plan.js");

  const out = {};
  const row = /(\w+)\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = row.exec(block[1]))) {
    const [, id, body] = m;
    const num = (key) => {
      const hit = body.match(new RegExp(`${key}\\s*:\\s*(-?\\d+)`));
      return hit ? Number(hit[1]) : null;
    };
    out[id] = {
      monthly:  num("monthly"),
      annual:   num("annual"),
      minSeats: num("minSeats"),
      maxSeats: num("maxSeats"),
    };
  }
  return out;
}

const web = parseFrontendPricing(fs.readFileSync(FRONTEND, "utf8"));
const FIELDS = ["monthly", "annual", "minSeats", "maxSeats"];
const problems = [];

for (const id of Object.keys(SERVER)) {
  const a = SERVER[id];
  const b = web[id];
  if (!b) { problems.push(`${id}: present on the server but missing from the website`); continue; }
  for (const f of FIELDS) {
    if (a[f] !== b[f]) problems.push(`${id}.${f}: server ${a[f]} vs website ${b[f]}`);
  }
}

const head = "plan".padEnd(12) + FIELDS.map((f) => f.padEnd(11)).join("") + "status";
console.log(head);
console.log("-".repeat(head.length));
for (const id of Object.keys(SERVER)) {
  const a = SERVER[id];
  const ok = web[id] && FIELDS.every((f) => a[f] === web[id][f]);
  console.log(id.padEnd(12) + FIELDS.map((f) => String(a[f]).padEnd(11)).join("") + (ok ? "match" : "MISMATCH"));
}

if (problems.length) {
  console.error("\nprice parity FAILED:");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("\nprice parity OK — the website quotes what the server charges.");
