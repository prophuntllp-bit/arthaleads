// Proves the idempotency claim logic in POST /api/help/action.
//
// Exercises only the CopilotAction bookkeeping — no lead, task or project is
// touched — and deletes its own rows afterwards.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); ok ? pass++ : fail++; };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const CopilotAction = require("../models/CopilotAction");

  const KEY = "verify-idem-" + process.pid;
  const base = {
    orgId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    userName: "Verify",
    actionId: "add_lead_note",
    params: { note: "x" },
    page: "/leads",
    status: "pending",
  };

  const claim = () => CopilotAction.findOneAndUpdate(
    { idempotencyKey: KEY },
    { $setOnInsert: { idempotencyKey: KEY, ...base } },
    { upsert: true, new: false }
  ).lean();

  try {
    console.log("=== first attempt owns the execution ===");
    const first = await claim();
    check("upsert returns null on insert (we own it)", first === null, String(first));

    console.log("\n=== a concurrent retry while still running is refused ===");
    const second = await claim();
    check("second attempt sees the pending claim", second !== null && second.status === "pending", second && second.status);

    console.log("\n=== once finished, a retry replays instead of re-executing ===");
    await CopilotAction.updateOne({ idempotencyKey: KEY }, { $set: { status: "done", result: { message: "Note added." } } });
    const third = await claim();
    check("third attempt sees done", third && third.status === "done");
    check("stored result is returned to the replay", third?.result?.message === "Note added.", JSON.stringify(third?.result));

    console.log("\n=== exactly one row exists for the key ===");
    check("no duplicate rows", (await CopilotAction.countDocuments({ idempotencyKey: KEY })) === 1);

    console.log("\n=== a failed execute releases the claim so a retry works ===");
    await CopilotAction.deleteOne({ idempotencyKey: KEY });
    const afterRelease = await claim();
    check("retry after release owns it again", afterRelease === null);

    console.log("\n=== the unique index is real, not just application logic ===");
    let dupBlocked = false;
    try {
      await CopilotAction.create({ idempotencyKey: KEY, ...base });
    } catch (err) {
      dupBlocked = err.code === 11000;
    }
    check("duplicate insert rejected by the index", dupBlocked);
  } finally {
    const removed = await CopilotAction.deleteMany({ idempotencyKey: KEY });
    console.log("\n  cleaned up test rows:", removed.deletedCount);
    await mongoose.disconnect();
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
