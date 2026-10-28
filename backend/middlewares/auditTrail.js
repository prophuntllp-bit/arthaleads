// middlewares/auditTrail.js
//
// Durable activity log for the DPDP Rules 2025 (owner, 28 Oct 2026): a data
// fiduciary or processor keeps logs of personal-data processing for at least a
// year, and must be able to work out who did what during a breach. Railway's
// logs are short-lived and logs/combined.log is local to one container, so
// neither counts. Rows go to the AuditLog collection (see models/AuditLog.js
// for retention and what a row may hold).
//
// Mounted once on /api in server.js, ahead of the routers. It does nothing on
// the way in except remember the start; the row is written on the response's
// "finish" event, after the person already has their answer, and the insert
// is fire-and-forget: a failed write is logged (at most once a minute) and
// never surfaces to the request.
//
// What is recorded:
//   * sign-in (password, super admin, Google) success and failure, signup
//     code checks, sign-out, password reset request and reset, password
//     change, "Switch account", switching back, and super admin support access;
//   * data exports and bulk/permanent deletions, as named actions;
//   * every other authenticated POST/PUT/PATCH/DELETE as "api_request".
// GETs other than exports are not recorded: reading is the bulk of traffic and
// the exports are where data leaves the system.
//
// Never recorded: the request body, the query string values, passwords,
// tokens, OTPs, API keys, or a lead's phone number or email. A failed sign-in
// keeps only a short one-way hash of the identifier typed, so repeated tries
// against one account can be grouped without storing the address.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AuditLog = require("../models/AuditLog");
const logger = require("../config/logger");
const { COOKIE_NAME } = require("../utils/authCookie");

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// Named events: [method, path, action on success, action on failure, details,
// public]. "public" events are recorded even with no signed-in user (sign-in
// itself, for one). The rest need a session, like every other row.
const EVENTS = [
  ["POST",   /^\/api\/auth\/login$/,                 "login_success", "login_failed", { method: "password" }, true],
  ["POST",   /^\/api\/auth\/admin-login$/,           "login_success", "login_failed", { method: "super_admin_password" }, true],
  ["POST",   /^\/api\/auth\/google$/,                "login_success", "login_failed", { method: "google" }, true],
  ["POST",   /^\/api\/auth\/signup\/verify-otp$/,    "otp_verified", "otp_failed", { purpose: "signup" }, true],
  ["POST",   /^\/api\/auth\/logout$/,                "logout", "logout", null, true],
  ["POST",   /^\/api\/auth\/forgot-password$/,       "password_reset_requested", "password_reset_requested", null, true],
  ["POST",   /^\/api\/auth\/reset-password\/[^/]+$/, "password_reset", "password_reset_failed", null, true],
  ["POST",   /^\/api\/auth\/restore-admin-session$/, "session_restored", "session_restored", null, true],
  ["POST",   /^\/api\/auth\/switch-user\/[^/]+$/,    "switch_user", "switch_user_failed"],
  ["POST",   /^\/api\/super-admin\/orgs\/[^/]+\/impersonate$/, "support_access", "support_access"],
  ["POST",   /^\/api\/auth\/account\/deletion$/,     "account_deletion_requested", "account_deletion_requested"],
  ["GET",    /^\/api\/leads\/export$/,               "data_export", "data_export", { what: "leads" }],
  ["POST",   /^\/api\/leads\/export-sheet$/,         "data_export", "data_export", { what: "leads_google_sheet" }],
  ["GET",    /^\/api\/attendance\/export$/,          "data_export", "data_export", { what: "attendance" }],
  ["DELETE", /^\/api\/leads\/bulk$/,                 "bulk_delete", "bulk_delete", { what: "leads" }],
  ["DELETE", /^\/api\/projects\/[^/]+\/leads\/bulk$/, "bulk_delete", "bulk_delete", { what: "project_leads" }],
  ["DELETE", /^\/api\/leads\/[^/]+\/permanent$/,     "permanent_delete", "permanent_delete", { what: "lead" }],
];

/**
 * The request path with anything that could identify a person or unlock
 * something taken out. Record ids become ":id" and are returned separately;
 * emails, runs of 7+ digits (phone numbers) and token-like strings become
 * placeholders. The query string is dropped entirely.
 */
function sanitizePath(url) {
  const targetIds = [];
  const raw = String(url || "").split("?")[0].split("#")[0];
  const parts = raw.split("/").map((seg) => {
    if (!seg) return seg;
    let s = seg;
    try { s = decodeURIComponent(seg); } catch { /* keep as sent */ }
    if (OBJECT_ID.test(s)) { if (targetIds.length < 5) targetIds.push(s.toLowerCase()); return ":id"; }
    if (s.includes("@")) return ":email";
    if (/\d{7,}/.test(s)) return ":number";
    if (s.length > 40 || (s.length >= 16 && /\d/.test(s) && /[a-z]/i.test(s))) return ":token";
    return s;
  });
  let path = parts.join("/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return { path: path.slice(0, 200), targetIds };
}

const hashIdentifier = (v) =>
  crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex").slice(0, 16);

// Sign-out is a public route (the cookie must clear even when the session has
// expired), so nobody is attached to the request. Read the token only to name
// who signed out; an invalid one just leaves the row anonymous.
function userFromToken(req) {
  try {
    const token = req.cookies?.[COOKIE_NAME]
      || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);
    if (!token) return null;
    const d = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    return d?.id ? { _id: d.id, actBy: d.actBy, sa: d.sa } : null;
  } catch { return null; }
}

let lastWriteError = 0;
function write(doc) {
  AuditLog.create(doc).catch((err) => {
    if (Date.now() - lastWriteError > 60_000) {
      lastWriteError = Date.now();
      logger.error(`[audit] could not write activity row (${doc.action} ${doc.path}): ${err.message}`);
    }
  });
}

/** Builds the row for a finished request, or null when nothing is recorded. */
function buildEntry(req, res) {
  const method = req.method;
  const { path, targetIds } = sanitizePath(req.originalUrl || req.url);
  const rawPath = String(req.originalUrl || req.url || "").split("?")[0].replace(/\/$/, "");
  const status = res.statusCode;
  const failed = status >= 400;

  const event = EVENTS.find(([m, re]) => m === method && re.test(rawPath));
  let action = event ? (failed ? event[3] : event[2]) : null;
  const details = event?.[4] ? { ...event[4] } : {};

  // A profile save that changes the password is its own event.
  if (!action && method === "PUT" && rawPath === "/api/auth/me" && req.body?.newPassword) action = "password_changed";

  // Who did it.
  let user = req.user || null;
  let performedBy, targetUser, via, role, orgId;
  if (user) {
    role = user.role;
    orgId = req.orgId || user.orgId;
    if (req.switchedBy) { performedBy = req.switchedBy; targetUser = user._id; via = "switch_user"; }
    else if (req.supportBy) { performedBy = req.supportBy; targetUser = user._id; via = "support_access"; }
    else performedBy = user._id;
  } else if (res.locals?.auditUser) {               // sign-in that just succeeded
    user = res.locals.auditUser;
    performedBy = user._id; role = user.role; orgId = user.orgId;
  } else if (action === "logout") {
    const t = userFromToken(req);
    if (t) {
      if (t.actBy || t.sa) { performedBy = t.actBy || t.sa; targetUser = t._id; via = t.actBy ? "switch_user" : "support_access"; }
      else performedBy = t._id;
    }
  } else if (req.orgId && req.org) {                // a per-org API key
    orgId = req.orgId; via = "api_key";
  }

  const signedIn = Boolean(performedBy || via === "api_key");
  if (!action) {
    if (!MUTATING.has(method) || !signedIn) return null;
    action = "api_request";
  } else if (!event?.[5] && !signedIn) {
    return null;                                    // a named event that needs a session, refused before one existed
  }

  // Support access is recorded against the organisation being entered, so it
  // shows up in that organisation's own log.
  if (action === "support_access" && targetIds[0]) orgId = targetIds[0];

  if (action === "login_failed" && (req.body?.email || req.body?.identifier)) {
    details.identifierHash = hashIdentifier(req.body.email || req.body.identifier);
  }
  if ((action === "bulk_delete") && Array.isArray(req.body?.ids)) details.count = req.body.ids.length;
  if (action === "data_export") {
    const keys = Object.keys(req.query || {}).filter((k) => k !== "token");
    if (keys.length) details.filters = keys.slice(0, 20);
  }

  return {
    at: new Date(),
    requestId: req.requestId,
    action,
    method,
    path,
    status,
    performedBy,
    targetUser,
    targetOrg: orgId || undefined,
    role,
    via,
    targetIds: targetIds.length ? targetIds : undefined,
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200) || undefined,
    details: Object.keys(details).length ? details : undefined,
  };
}

function auditTrail(req, res, next) {
  res.on("finish", () => {
    try {
      const entry = buildEntry(req, res);
      if (entry) write(entry);
    } catch (err) {
      logger.error(`[audit] could not build activity row: ${err.message}`);
    }
  });
  next();
}

module.exports = { auditTrail, sanitizePath, buildEntry, hashIdentifier };
