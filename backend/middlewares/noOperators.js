// middlewares/noOperators.js - strip MongoDB operators from request input.
//
// Mongo treats an object like { "$regex": "^a" } or { "$gt": "" } inside a
// query filter as an operator, not a value. Express parses JSON bodies and
// "?token[$gt]=" query strings into exactly such objects, so any route that
// puts a request value straight into a filter (a webhook looking a company up
// by its token, for instance) could be made to match records it was never
// meant to: guessing a secret one character at a time, or matching "any".
// Found in the 16 Oct 2026 audit (docs/AUDIT_2026-10-16.md, P0-2 and P0-3).
//
// No client of ours ever sends a key that starts with "$" (web, mobile and the
// WordPress plugin were checked), so removing them changes nothing for real
// traffic. Applied globally in server.js and after every route-level body
// parser that runs before the global one (webhooks).
const logger = require("../config/logger");

const MAX_DEPTH = 20;

function strip(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > MAX_DEPTH) return 0;
  let removed = 0;
  for (const key of Object.keys(value)) {
    if (key.startsWith("$")) {
      delete value[key];
      removed += 1;
    } else {
      removed += strip(value[key], depth + 1);
    }
  }
  return removed;
}

function noOperators(req, res, next) {
  const removed = strip(req.body) + strip(req.query) + strip(req.params);
  if (removed) logger.warn(`[security] removed ${removed} "$" key(s) from ${req.method} ${req.originalUrl.split("?")[0]} (ip ${req.ip})`);
  next();
}

module.exports = { noOperators, strip };
