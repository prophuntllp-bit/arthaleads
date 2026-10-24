// The lead score comes from the conversation (owner, 23 Oct 2026): what the
// customer answered in the button flow, what the AI found in what they wrote,
// and what the team recorded. Sending a message, being new, the source and
// the default "New" / "Medium" are worth nothing. utils/leadScorer.js.
const { test, run, assert } = require("./helpers/harness");
const { scoreLead, scoreParts, scoreLabel } = require("../utils/leadScorer");

const NOW = Date.now(), MIN = 60000, DAY = 86400000;
const base = (extra = {}) => ({
  status: "New", priority: "Medium", source: "WhatsApp", createdAt: new Date(NOW - 10 * MIN),
  activities: [{}, {}, {}, {}, {}, {}], notes: [{}], lastCustomerSignalAt: new Date(NOW - 5 * MIN), ...extra,
});
const ai = (intent, points, extra = {}) => ({ aiScore: { v: 3, intent, points, reason: "r", signalAt: new Date(NOW - 5 * MIN), ...extra } });

test("a lead that only says 'hi' (new, WhatsApp, just wrote) scores 0", () => {
  assert.equal(scoreLead(base()), 0);
});

test("the voice-note lead: messages that say nothing are worth nothing", () => {
  assert.equal(scoreLead(base(ai("neutral", 0))), 0);
});

test("answered all three questions, within 30 days, and asked the price: about 50", () => {
  const l = base({ status: "Contacted", engagement: { flow: { budget: true, purpose: true, timeline: "Within 30 Days" } }, ...ai("strong", 25) });
  const p = scoreParts(l);
  assert.equal(p.flow, 24);
  assert.equal(scoreLead(l), 54);
});

test("and then booked a site visit: Hot", () => {
  const l = base({ status: "Site Visit", engagement: { flow: { budget: true, purpose: true, timeline: "Within 30 Days" }, closing: "site_visit" }, ...ai("strong", 25) });
  assert.equal(scoreLead(l), 84);
  assert.equal(scoreLabel(scoreLead(l)), "Hot");
});

test("timelines: 1-3 months +8, 3-6 months +4, just exploring 0", () => {
  const t = (timeline) => scoreParts(base({ engagement: { flow: { timeline } } })).flow;
  assert.equal(t("1-3 Months"), 8);
  assert.equal(t("3 - 6 Months"), 4);
  assert.equal(t("Just Exploring"), 0);
});

test("'Not now' and 'not interested' take points off, never below 0", () => {
  assert.equal(scoreParts(base({ engagement: { closing: "declined" } })).closing, -10);
  assert.equal(scoreLead(base({ engagement: { flow: { budget: true }, closing: "declined" }, ...ai("not_interested", -30) })), 0);
});

test("a webinar registration +10, asking for the advisor +15", () => {
  assert.equal(scoreLead(base({ engagement: { closing: "register" } })), 10);
  assert.equal(scoreLead(base({ engagement: { closing: "handoff" } })), 15);
});

test("gone quiet: what they said counts x0.7 after a week, x0.4 after two", () => {
  const said = { engagement: { flow: { budget: true, timeline: "Within 30 Days" } } }; // 20
  assert.equal(scoreLead(base({ ...said, lastCustomerSignalAt: new Date(NOW - 10 * DAY) })), 14);
  assert.equal(scoreLead(base({ ...said, lastCustomerSignalAt: new Date(NOW - 20 * DAY) })), 8);
});

test("the team's stages still count: Negotiation, site visit done, booked, follow-up today", () => {
  assert.equal(scoreLead(base({ status: "Negotiation" })), 20);
  assert.equal(scoreLead(base({ status: "Site Visit", siteVisitDone: true, booking: "Booked" })), 45);
  assert.equal(scoreLead(base({ followUpDate: new Date(NOW - 60 * MIN) })), 10);
});

test("an AI read from before this change (v1, activity-based) adds nothing", () => {
  assert.equal(scoreLead(base({ aiScore: { level: "warm", adjust: 3, reason: "old", signalAt: new Date(NOW - 5 * MIN) } })), 0);
});

test("Closed Lost is 0 whatever was said", () => {
  assert.equal(scoreLead(base({ status: "Closed Lost", engagement: { closing: "site_visit" }, ...ai("strong", 30) })), 0);
});

run("Lead score: from the conversation, not from activity");
