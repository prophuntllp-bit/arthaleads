/**
 * Round-robin lead assignment among the fixed sales team.
 * Rotation is determined by counting the last assigned lead to each agent
 * so it persists across server restarts.
 */

const mongoose = require("mongoose");

// Fixed sales team — update these IDs if the team changes
const SALES_TEAM_IDS = [
  "69d4ea3a01817aba627ef9b9", // Saurabh Sir
  "69d4ea9601817aba627ef9c6", // Sandeep Sir
  "69d35698556a7da63c6ca61f", // Sheetal Powar
];

/**
 * Returns { _id, name } of the next agent in the rotation.
 * Picks the agent who has received the fewest leads so far;
 * ties broken by the order defined in SALES_TEAM_IDS.
 */
async function getNextAssignee() {
  // Lazy-load Lead to avoid circular dependency at module load time
  const Lead = require("../models/Lead");

  const counts = await Lead.aggregate([
    { $match: { assignedTo: { $in: SALES_TEAM_IDS.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  // Pick the agent with the fewest leads (preserve order for tie-breaking)
  let chosen = SALES_TEAM_IDS[0];
  let minCount = countMap[SALES_TEAM_IDS[0]] ?? 0;
  for (const id of SALES_TEAM_IDS) {
    const c = countMap[id] ?? 0;
    if (c < minCount) { minCount = c; chosen = id; }
  }

  // Fetch the agent's name
  const User = require("../models/User");
  const agent = await User.findById(chosen).select("_id name");
  return agent || { _id: chosen, name: "Unassigned" };
}

module.exports = { getNextAssignee, SALES_TEAM_IDS };
