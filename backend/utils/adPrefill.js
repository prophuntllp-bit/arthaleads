// Which ad a WhatsApp chat came from, read from its first message when Meta
// sent no ad details (23 Oct 2026: a Khopoli ad click arrived with no ad id,
// its message "Hi, I'd like details of Shapoorji Pallonji's new plots near
// Khopoli." named a project two agents share, and the lead went to the
// general assistant with every field blank). Each ad pre-fills its own fixed
// text, so the text identifies the ad, and the ad identifies the agent.
const AdPrefill = require("../models/AdPrefill");
const WaAgent = require("../models/WaAgent");

// Lowercase words, apostrophes dropped ("Pallonji's" = "pallonjis"), Latin
// and Devanagari kept, everything else a space.
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .trim();
}

// Too short to identify anything ("hi", "price?").
const MIN_WORDS = 4;
// A learned text counts once two separate ad clicks opened with it, so a
// one-off typed message ("Hello bhaiya ji") never becomes an ad's text.
const MIN_CLICKS = 2;
const STRICT_MIN_WORDS = 6;

/** Records the first message of an ad click against its ad. */
async function learn(orgId, adId, text) {
  const norm = normalize(text);
  if (!orgId || !adId || norm.split(" ").length < MIN_WORDS) return;
  await AdPrefill.updateOne(
    { orgId, adId: String(adId), norm },
    { $inc: { count: 1 }, $set: { lastSeenAt: new Date(), sample: String(text).trim().slice(0, 300) } },
    { upsert: true }
  ).catch((err) => { if (err?.code !== 11000) throw err; });
}

/** A text typed in the agent editor as this ad's pre-filled message. */
async function addManual(orgId, adId, text) {
  const norm = normalize(text);
  if (norm.split(" ").length < MIN_WORDS) {
    const e = new Error("That message is too short to recognise. Paste the ad's whole pre-filled message.");
    e.status = 400; throw e;
  }
  return AdPrefill.findOneAndUpdate(
    { orgId, adId: String(adId), norm },
    { $set: { manual: true, hidden: false, sample: String(text).trim().slice(0, 300) } },
    { upsert: true, new: true }
  ).lean();
}

// How much of the ad's text this message contains, 0..1. Customers add a word
// ("... floor plan details. Location"), mistype one, or the keyboard glues a
// stray letter on ("MmHi, I'd like ..."), so a near match counts too, but only
// when the message isn't much longer than the ad's text: a long question that
// happens to share the words is not an ad click.
function similarity(msgNorm, prefillNorm) {
  if (msgNorm === prefillNorm) return 1;
  const m = msgNorm.split(" "), p = prefillNorm.split(" ");
  if (m.length > p.length + 6) return 0;
  const have = new Set(m);
  return p.filter((w) => have.has(w)).length / p.length;
}
const NEAR = 0.8;

/**
 * The one active agent whose ad pre-fills this text, or null.
 * Returns { agent, adId, sample }. Ambiguous (two agents' ads say it) is null.
 * `strict` (moving a chat that already has an agent): only the ad's exact
 * text, and only a text long enough to be an ad's own, never a short common
 * question like "What is the payment plan?" that a customer may simply ask.
 */
async function matchAgent(orgId, text, { strict = false } = {}) {
  const norm = normalize(text);
  if (!orgId || norm.split(" ").length < (strict ? STRICT_MIN_WORDS : MIN_WORDS)) return null;
  const rows = await AdPrefill.find({ orgId, hidden: { $ne: true }, $or: [{ manual: true }, { count: { $gte: MIN_CLICKS } }] })
    .select("adId norm sample count").lean();
  let best = 0;
  const scored = [];
  for (const r of rows) {
    const s = strict ? (norm === r.norm ? 1 : 0) : similarity(norm, r.norm);
    if (s >= NEAR) { scored.push({ ...r, s }); best = Math.max(best, s); }
  }
  const top = scored.filter((r) => r.s === best);
  if (!top.length) return null;
  const agents = await WaAgent.find({ orgId, status: "active", adIds: { $in: top.map((r) => r.adId) } })
    .select("_id adIds projectIds").lean();
  if (agents.length !== 1) return null;
  const mine = top.filter((r) => agents[0].adIds.includes(r.adId)).sort((a, b) => b.count - a.count)[0];
  return { agent: agents[0], adId: mine.adId, sample: mine.sample };
}

/**
 * True when the text is (close to) one of the company's ad pre-filled
 * messages, whichever agent the ad belongs to: words the ad wrote, not the
 * customer (the AI lead score must not read them as intent).
 */
async function isAdText(orgId, text, rows = null) {
  const norm = normalize(text);
  if (!orgId || norm.split(" ").length < MIN_WORDS) return false;
  const list = rows || await AdPrefill.find({ orgId, hidden: { $ne: true }, $or: [{ manual: true }, { count: { $gte: MIN_CLICKS } }] }).select("norm").lean();
  return list.some((r) => similarity(norm, r.norm) >= NEAR);
}

module.exports = { normalize, learn, addManual, matchAgent, isAdText, similarity, MIN_CLICKS };
