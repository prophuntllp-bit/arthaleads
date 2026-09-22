const RoutingRule = require("../models/RoutingRule");

// Finds the active routing rule (if any) that matches this lead's attribution
// data for the given source. `candidates` is a plain object of
// { matchField: value } — any entry with an empty/falsy value is dropped
// before querying, same as the Facebook webhook did inline before this was
// extracted. A rule saved before `source` existed has no `source` field, so
// it's treated as "facebook" ($or with { source: "facebook" } / { source: { $exists: false } }).
async function matchRoutingRule(orgId, source, candidates) {
  const clauses = Object.entries(candidates || {})
    .filter(([, value]) => !!value)
    .map(([matchField, value]) => ({ matchField, matchValue: String(value) }));

  if (!clauses.length) return null;

  const sourceClause = source === "facebook"
    ? { $or: [{ source: "facebook" }, { source: { $exists: false } }] }
    : { source };

  return RoutingRule.findOne({
    orgId,
    isActive: true,
    ...sourceClause,
    $or: clauses,
  });
}

// Website rule matching needs one extra behavior beyond an exact-value match:
// "page_path" rules match when the lead's page URL *contains* the saved
// value (e.g. matchValue "/joyville-hinjewadi" should match
// "https://site.com/projects/joyville-hinjewadi?utm=fb"), not just when it's
// identical. Handled as a separate step so matchRoutingRule stays a simple
// exact-match lookup for every other source.
async function matchWebsiteRoutingRule(orgId, { domain, pageUrl }) {
  const exact = await matchRoutingRule(orgId, "website", { domain });
  if (exact) return exact;
  if (!pageUrl) return null;

  const pathRules = await RoutingRule.find({
    orgId,
    isActive: true,
    source: "website",
    matchField: "page_path",
  }).lean();

  return pathRules.find((r) => r.matchValue && pageUrl.includes(r.matchValue)) || null;
}

module.exports = { matchRoutingRule, matchWebsiteRoutingRule };
