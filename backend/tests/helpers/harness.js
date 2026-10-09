// Minimal sequential test runner in the style of the existing suites
// (plain node scripts, no framework): prints ok/FAIL per case and exits
// non-zero if any failed.
const assert = require("node:assert/strict");

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

async function run(title) {
  console.log(`\n${title}\n`);
  let failures = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`  ok    ${name}`);
    } catch (err) {
      failures++;
      console.log(`  FAIL  ${name}\n        ${String(err.message).split("\n").join("\n        ")}`);
    }
  }
  console.log(failures ? `\n  ${failures} of ${cases.length} FAILED\n` : `\n  all ${cases.length} checks passed\n`);
  process.exit(failures ? 1 : 0);
}

module.exports = { test, run, assert };
