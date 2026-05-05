// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { AppError } = require("./errorHandler");

// ── In-memory org cache (60 s TTL) ───────────────────────────────────────────
// Avoids a DB round-trip on every authenticated request.
// Invalidated automatically by TTL; worst-case a deactivated org stays cached 60 s.
const _orgCache = new Map();
const ORG_CACHE_TTL = 60_000; // 60 seconds

function _getCachedOrg(orgId) {
  const entry = _orgCache.get(String(orgId));
  if (entry && entry.expiresAt > Date.now()) return entry.org;
  _orgCache.delete(String(orgId));
  return null;
}
function _setCachedOrg(orgId, org) {
  _orgCache.set(String(orgId), { org, expiresAt: Date.now() + ORG_CACHE_TTL });
}
// Call this from orgRoutes / superAdminController when org is updated/deactivated
function invalidateOrgCache(orgId) {
  _orgCache.delete(String(orgId));
}

// ── Protect: verify JWT and attach user to req ────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Prefer httpOnly cookie (browser clients — XSS-safe)
    if (req.cookies?.crm_token) {
      token = req.cookies.crm_token;
    // 2. Fall back to Authorization header (API clients, mobile, Postman)
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Not authenticated. Please log in.", 401));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return next(new AppError("User no longer exists.", 401));
    if (!user.isActive) return next(new AppError("Your account has been deactivated.", 403));

    req.user  = user;
    req.orgId = user.orgId;

    // ── Org-level access guard (skip for super_admin — platform-wide access) ──
    if (user.role !== "super_admin" && user.orgId) {
      let org = _getCachedOrg(user.orgId);
      if (!org) {
        org = await Organization.findById(user.orgId).select("isActive plan trialEndsAt").lean();
        if (org) _setCachedOrg(user.orgId, org);
      }
      if (!org || !org.isActive) {
        return next(new AppError("ORGANISATION_INACTIVE", 403));
      }
      // Trial expiry check — only for orgs still on the trial plan
      if (org.plan === "trial" && org.trialEndsAt && new Date() > new Date(org.trialEndsAt)) {
        return next(new AppError("TRIAL_EXPIRED", 403));
      }
      req.org = org;
    }

    next();
  } catch (err) {
    next(err);
  }
};

// ── Authorize: restrict to specific roles ─────────────────────────────────────
// Usage: authorize("admin", "manager")
// super_admin bypasses all role gates (platform-level access)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === "super_admin" || roles.includes(req.user.role)) {
      return next();
    }
    return next(
      new AppError(`Access denied. Required role: ${roles.join(" or ")}`, 403)
    );
  };
};

module.exports = { protect, authorize, invalidateOrgCache };
