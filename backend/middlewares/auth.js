// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AppError } = require("./errorHandler");

// ── Protect: verify JWT and attach user to req ────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Accept token from Authorization header OR cookie
    if (req.headers.authorization?.startsWith("Bearer ")) {
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
    req.orgId = user.orgId; // every protected route gets org scope automatically
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

module.exports = { protect, authorize };
