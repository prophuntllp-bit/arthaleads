// Atomic writes to call activities on a Lead or ProjectLead.
//
// EnableX sends several events for one call within the same second (both legs'
// "connected", "bridge_disconnected", "disconnected", "recording_complete").
// Each used to load the lead, edit activities[i].meta and call lead.save(),
// which rewrites the whole activities array guarded by __v. When two events for
// the same call overlapped, the second save failed with Mongoose's VersionError
// ("No matching document found for id ... modifiedPaths activities, ...") and
// its change was dropped: a lost recording URL, or a call stuck on "Initiated".
//
// These helpers change only the named fields of the one matching activity with
// a single updateOne, so concurrent events on the same call all land. Every
// write also bumps __v, so any remaining load-edit-save of the activities array
// elsewhere fails with VersionError (and reloads) instead of overwriting these
// fields with a stale copy.
const mongoose = require("mongoose");

// How to find one activity again without relying on its array index: its _id,
// or for very old entries without one, the call's ownerRef / voiceId.
function activityMatch(activity) {
  if (activity?._id) return { _id: new mongoose.Types.ObjectId(String(activity._id)) };
  if (activity?.meta?.ownerRef) return { "meta.ownerRef": activity.meta.ownerRef };
  if (activity?.meta?.voiceId) return { "meta.voiceId": activity.meta.voiceId };
  return null;
}

const prefixed = (obj, prefix) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [`${prefix}${k}`, v]));

// Applies `set` / `addToSet` / `push` / `pull` (paths relative to the activity,
// e.g. "meta.recordingUrl") to the activity matching `match`, only while it also
// matches `where`. Returns true when this call changed it, so `where` doubles as
// a claim: of two events racing to finalize a call, exactly one gets true.
async function updateCallActivity(Model, leadId, match, { set, addToSet, push, pull, where } = {}) {
  if (!match) return false;
  const cond = { ...match, ...(where || {}) };
  const update = { $inc: { __v: 1 } };
  if (set && Object.keys(set).length) update.$set = prefixed(set, "activities.$[a].");
  if (addToSet) update.$addToSet = prefixed(addToSet, "activities.$[a].");
  if (push) update.$push = prefixed(push, "activities.$[a].");
  if (pull) update.$pull = prefixed(pull, "activities.$[a].");
  const res = await Model.updateOne(
    { _id: leadId, activities: { $elemMatch: cond } },
    update,
    { arrayFilters: [prefixed(cond, "a.")] }
  );
  return res.modifiedCount > 0;
}

// Appends one activity without touching the rest of the array.
async function pushActivity(Model, leadId, entry) {
  const res = await Model.updateOne({ _id: leadId }, { $push: { activities: entry }, $inc: { __v: 1 } });
  return res.modifiedCount > 0;
}

// Moves the lead from `from` to `to` only if it is still at `from`, logging the
// change as an activity in the same write. Returns true if it moved.
async function changeLeadStatus(Model, leadId, from, to, entry) {
  const now = new Date();
  const res = await Model.updateOne(
    { _id: leadId, status: from },
    { $set: { status: to }, $push: { activities: entry }, $inc: { __v: 1 } }
  );
  if (!res.modifiedCount) return false;
  if (to === "Contacted") {
    await Model.updateOne({ _id: leadId, firstContactedAt: null }, { $set: { firstContactedAt: now } });
  }
  return true;
}

module.exports = { activityMatch, updateCallActivity, pushActivity, changeLeadStatus };
