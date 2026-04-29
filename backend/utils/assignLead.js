/**
 * Round-robin lead assignment among active users in an org.
 * Picks the agent with the fewest leads assigned so far (persists across restarts).
 */
const mongoose = require("mongoose");

async function getNextAssignee(orgId) {
  const User = require("../models/User");
  const Lead = require("../models/Lead");

  if (!orgId) throw new Error("orgId is required for lead assignment");

  // Round-robin among active agents only.
  // Falls back to managers, then admins, only if no agents exist.
  let agents = await User.find({ orgId, isActive: true, role: "agent" }).select("_id name").lean();
  if (!agents.length) {
    agents = await User.find({ orgId, isActive: true, role: { $in: ["manager", "admin"] } }).select("_id name").lean();
  }

  if (!agents.length) throw new Error(`No active users found in org ${orgId}`);

  const agentIds = agents.map((a) => new mongoose.Types.ObjectId(a._id));

  const counts = await Lead.aggregate([
    { $match: { orgId: new mongoose.Types.ObjectId(orgId), assignedTo: { $in: agentIds } } },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  let chosen = agents[0];
  let minCount = countMap[agents[0]._id.toString()] ?? 0;
  for (const agent of agents) {
    const c = countMap[agent._id.toString()] ?? 0;
    if (c < minCount) { minCount = c; chosen = agent; }
  }

  return chosen; // { _id, name }
}

module.exports = { getNextAssignee };
