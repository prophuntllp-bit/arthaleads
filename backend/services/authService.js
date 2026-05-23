// services/authService.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Lead        = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const Project     = require("../models/Project");
const Organization = require("../models/Organization");
const { AppError } = require("../middlewares/errorHandler");
const { sendPasswordResetEmail, sendWelcomeEmail, sendTeamInviteEmail } = require("../utils/email");
const logger = require("../config/logger");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS          = 15 * 60 * 1000; // 15 minutes

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });

const authService = {
  async signup(data) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError("Email already registered", 409);

    // Create organization first
    const orgName = data.orgName || `${data.name}'s Workspace`;
    let slug = Organization.generateSlug(orgName);
    // Ensure slug uniqueness
    const slugExists = await Organization.findOne({ slug });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const org = await Organization.create({ name: orgName, slug });

    const user = await User.create({ ...data, orgId: org._id, role: "admin" });
    const token = signToken(user._id);

    // Fire-and-forget welcome email - don't block the signup response
    sendWelcomeEmail(user.email, user.name, org.name)
      .then(() => console.log(`[signup] ✅ welcome email sent to ${user.email}`))
      .catch((err) => console.error(`[signup] ❌ welcome email failed:`, err.message));

    return { token, user, org };
  },

  async login(identifier, password, ip = "unknown") {
    // Support login with either email OR phone number
    const isPhone = /^\+?[0-9]{7,15}$/.test((identifier || "").replace(/\s/g, ""));
    let userQuery;
    if (isPhone) {
      // Normalise: strip country code prefix so we match any stored format
      const raw  = identifier.replace(/\s/g, "");
      const norm = raw.replace(/^\+?91/, "").replace(/^0/, "").slice(-10);
      userQuery = { phone: { $in: [norm, `+91${norm}`, `91${norm}`, `0${norm}`, raw] } };
    } else {
      userQuery = { email: identifier.toLowerCase().trim() };
    }

    // Select lockout fields alongside password
    const user = await User.findOne(userQuery)
      .select("+password +loginAttempts +lockoutUntil");

    // ── Brute-force lockout check ─────────────────────────────────────────────
    if (user?.lockoutUntil && user.lockoutUntil > Date.now()) {
      const minsLeft = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
      logger.warn(`[login] locked account attempt - identifier: ${identifier}, ip: ${ip}`);
      throw new AppError(`Too many failed attempts. Try again in ${minsLeft} minute(s).`, 429);
    }

    const validPassword = user && await user.comparePassword(password);

    if (!user || !validPassword) {
      // Log and increment attempt counter
      logger.warn(`[login] failed attempt - identifier: ${identifier}, ip: ${ip}`);
      if (user) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockoutUntil  = new Date(Date.now() + LOCKOUT_MS);
          user.loginAttempts = 0;
          await user.save({ validateBeforeSave: false });
          logger.warn(`[login] account locked - identifier: ${identifier}, ip: ${ip}, locked for 15 min`);
          throw new AppError("Too many failed attempts. Account locked for 15 minutes.", 429);
        }
        await user.save({ validateBeforeSave: false });
      }
      throw new AppError("Invalid email/phone or password", 401);
    }

    if (!user.isActive) throw new AppError("Account deactivated. Contact admin.", 403);

    // ── Successful login - reset lockout fields ───────────────────────────────
    user.loginAttempts = 0;
    user.lockoutUntil  = null;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    const org = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive brandColor trialEndsAt autoAssign").lean()
      : null;
    return { token, user, org };
  },

  async googleAuth(credential) {
    // credential is an OAuth2 access_token (from useGoogleLogin implicit flow).
    // Verify it by calling Google's userinfo endpoint - no client-secret needed.
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${credential}` } }
    );
    const payload = await response.json();

    if (!response.ok || payload.error) {
      console.error("[googleAuth] userinfo failed:", payload);
      throw new AppError("Google sign-in failed. Please try again.", 401);
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) throw new AppError("Google account has no email", 400);

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select("+googleId");

    if (user) {
      // If found by email but no googleId yet, link the Google account
      if (!user.googleId) {
        user.googleId = googleId;
        if (picture && !user.avatar) user.avatar = picture;
        await user.save({ validateBeforeSave: false });
      }
      if (!user.isActive) throw new AppError("Account deactivated. Contact admin.", 403);
    } else {
      // New Google user - create their own org and make them admin
      const orgName = `${name}'s Workspace`;
      let slug = Organization.generateSlug(orgName);
      const slugExists = await Organization.findOne({ slug });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
      const org = await Organization.create({ name: orgName, slug });

      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture || "",
        role: "admin",
        orgId: org._id,
      });

      // Fire-and-forget welcome email for new Google signups
      sendWelcomeEmail(user.email, user.name, org.name)
        .then(() => console.log(`[googleAuth] ✅ welcome email sent to ${user.email}`))
        .catch((err) => console.error(`[googleAuth] ❌ welcome email failed:`, err.message));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    const org = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive brandColor trialEndsAt autoAssign").lean()
      : null;
    return { token, user, org };
  },

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    const org = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive brandColor trialEndsAt autoAssign").lean()
      : null;
    return { user, org };
  },

  async getAllAgents(orgId) {
    // Return all active team members (agents + managers + admins) so any of them
    // can be assigned to a project. Excludes super_admin (system-level role).
    return User.find({ orgId, isActive: true, role: { $in: ["agent", "manager", "admin"] } })
      .select("name email role phone avatar")
      .sort({ name: 1 })
      .lean();
  },

  async updateProfile(userId, updates, actor) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    const allowed = ["name", "phone", "avatar"];
    allowed.forEach((key) => {
      if (updates[key] !== undefined) user[key] = updates[key];
    });

    if (updates.role !== undefined) {
      if (actor.role !== "admin") {
        throw new AppError("Only admins can change roles", 403);
      }
      user.role = updates.role;
    }

    if (updates.newPassword) {
      if (!updates.currentPassword) {
        throw new AppError("Current password is required to change password", 400);
      }

      const isValidPassword = await user.comparePassword(updates.currentPassword);
      if (!isValidPassword) {
        throw new AppError("Current password is incorrect", 400);
      }

      user.password = updates.newPassword;
    }

    await user.save();
    return user;
  },

  // Admin only
  async getAllUsers(orgId) {
    return User.find({ orgId }).select("-password").sort({ createdAt: -1 }).lean();
  },

  async createUser(payload, orgId, addedByName) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) throw new AppError("Email already registered", 409);

    const user = await User.create({ ...payload, orgId });

    // Look up org name for the invite email
    Organization.findById(orgId).select("name").lean()
      .then((org) => sendTeamInviteEmail(user.email, user.name, org?.name || "your workspace", addedByName))
      .then(() => console.log(`[createUser] ✅ invite email sent to ${user.email}`))
      .catch((err) => console.error(`[createUser] ❌ invite email failed:`, err.message));

    return user;
  },

  async updateUser(targetId, updates, adminId, adminOrgId) {
    const user = await User.findById(targetId).select("+password");
    if (!user) throw new AppError("User not found", 404);
    if (adminOrgId && user.orgId?.toString() !== adminOrgId.toString()) {
      throw new AppError("Access denied", 403);
    }
    if (targetId === adminId.toString() && updates.isActive === false) {
      throw new AppError("You cannot deactivate yourself", 400);
    }

    ["name", "email", "phone", "role", "avatar", "isActive"].forEach((key) => {
      if (updates[key] !== undefined) user[key] = updates[key];
    });

    if (updates.password) {
      user.password = updates.password;
    }

    await user.save();
    return user;
  },

  async deleteUser(targetId, adminId, adminOrgId) {
    if (targetId === adminId.toString()) {
      throw new AppError("You cannot delete yourself", 400);
    }

    const user = await User.findById(targetId);
    if (!user) throw new AppError("User not found", 404);
    if (adminOrgId && user.orgId?.toString() !== adminOrgId.toString()) {
      throw new AppError("Access denied", 403);
    }

    await user.deleteOne();
    return true;
  },

  async toggleUserActive(targetId, adminId, adminOrgId) {
    if (targetId === adminId.toString()) throw new AppError("Cannot deactivate yourself", 400);
    const user = await User.findById(targetId);
    if (!user) throw new AppError("User not found", 404);
    if (adminOrgId && user.orgId?.toString() !== adminOrgId.toString()) {
      throw new AppError("Access denied", 403);
    }
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    return user;
  },

  // ── Forgot password - generate token + send email ─────────────────────────
  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordResetToken +passwordResetExpires");

    // Always respond with success to prevent email enumeration attacks
    if (!user) return;

    // Google-only accounts have no password - block reset
    const hasPassword = await User.findById(user._id).select("+password");
    if (!hasPassword?.password) {
      throw new AppError(
        "This account uses Google Sign-In. Please sign in with Google instead.",
        400
      );
    }

    // Generate a 32-byte random token, store the SHA-256 hash in DB
    const rawToken   = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.passwordResetToken   = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl    = `${frontendUrl}/reset-password/${rawToken}`;

    // Fire-and-forget - respond immediately, email sends in background
    sendPasswordResetEmail(user.email, user.name, resetUrl)
      .then(() => console.log(`[forgotPassword] ✅ email sent to ${user.email}`))
      .catch((err) => console.error(`[forgotPassword] ❌ email failed for ${user.email}:`, err.message, err.code));
    // Return immediately - user sees success, email delivers in background
  },

  // ── Reset password - verify token + set new password ─────────────────────
  async resetPassword(rawToken, newPassword) {
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) throw new AppError("Reset link is invalid or has expired.", 400);

    user.password             = newPassword;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = signToken(user._id);
    const org   = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive brandColor trialEndsAt autoAssign").lean()
      : null;
    return { token, user, org };
  },

  // ── MSG91 OTP login ───────────────────────────────────────────────────────────
  // Called after MSG91 has already verified the OTP. We just look up the user.
  async loginByPhone(phone) {
    const normalise = (p) => String(p).replace(/\D/g, "").replace(/^91(\d{10})$/, "$1").replace(/^0(\d{10})$/, "$1");
    const norm = normalise(phone);
    const variants = [norm, `+91${norm}`, `91${norm}`, `0${norm}`];

    const user = await User.findOne({ phone: { $in: variants } });
    if (!user) {
      throw new AppError(
        "No account found with this phone number. Please sign up first or ask your admin to add your number.",
        404
      );
    }
    if (!user.isActive) throw new AppError("Account deactivated. Contact admin.", 403);

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    const org = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive brandColor trialEndsAt autoAssign").lean()
      : null;
    return { token, user, org };
  },

  async getPerformance(actor) {
    const memberMatch = actor.role === "manager"
      ? { orgId: actor.orgId, role: { $in: ["manager", "agent"] } }
      : { orgId: actor.orgId, role: { $in: ["admin", "manager", "agent"] } };

    const users   = await User.find(memberMatch).select("name email role avatar isActive");
    const userIds = users.map((u) => u._id);
    const orgId   = actor.orgId;

    const mapFrom = (items, field) =>
      (items || []).reduce((acc, item) => {
        acc[item._id.toString()] = item[field];
        return acc;
      }, {});

    // ── Main pipeline (Lead model, keyed by assignedTo) ──────────────────────
    const [pipelineFacet] = await Lead.aggregate([
      { $match: { orgId, assignedTo: { $in: userIds }, isArchived: false } },
      { $facet: {
        assigned:   [{ $group: { _id: "$assignedTo", count: { $sum: 1 } } }],
        closedWon:  [{ $match: { status: "Closed Won"  } }, { $group: { _id: "$assignedTo", count: { $sum: 1 } } }],
        siteVisits: [{ $match: { status: "Site Visit"  } }, { $group: { _id: "$assignedTo", count: { $sum: 1 } } }],
        newLeads:   [{ $match: { status: "New"         } }, { $group: { _id: "$assignedTo", count: { $sum: 1 } } }],
      }},
    ]);

    const pl_assigned   = mapFrom(pipelineFacet?.assigned,   "count");
    const pl_won        = mapFrom(pipelineFacet?.closedWon,  "count");
    const pl_visits     = mapFrom(pipelineFacet?.siteVisits, "count");
    const pl_new        = mapFrom(pipelineFacet?.newLeads,   "count");

    // ── Project pipeline - keyed by Project.assignedTo ───────────────────────
    // The project's assignedTo array tells us which agents are responsible for
    // working those leads. We $lookup the parent project, $unwind assignedTo,
    // then group by the assigned user - regardless of who imported the leads.
    const [projectFacet] = await ProjectLead.aggregate([
      { $match: { orgId } },
      { $lookup: {
          from: "projects",
          localField: "project",
          foreignField: "_id",
          as: "proj",
      }},
      { $unwind: "$proj" },
      // One row per (lead × assigned user)
      { $unwind: "$proj.assignedTo" },
      // Only count for users in our visible team
      { $match: { "proj.assignedTo": { $in: userIds } } },
      { $facet: {
        assigned:        [{ $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        booked:          [{ $match: { booking: "Booked"           } }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        siteVisitBooked: [{ $match: { booking: "Site Visit Booked"} }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        interested:      [{ $match: { booking: "Interested"       } }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        callBack:        [{ $match: { booking: "Call Back"        } }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        notInterested:   [{ $match: { booking: "Not Interested"   } }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
        notReachable:    [{ $match: { booking: "Not Reachable"    } }, { $group: { _id: "$proj.assignedTo", count: { $sum: 1 } } }],
      }},
    ]);

    const pr_assigned        = mapFrom(projectFacet?.assigned,        "count");
    const pr_booked          = mapFrom(projectFacet?.booked,          "count");
    const pr_siteVisitBooked = mapFrom(projectFacet?.siteVisitBooked, "count");
    const pr_interested      = mapFrom(projectFacet?.interested,      "count");
    const pr_callBack        = mapFrom(projectFacet?.callBack,        "count");
    const pr_notInterested   = mapFrom(projectFacet?.notInterested,   "count");
    const pr_notReachable    = mapFrom(projectFacet?.notReachable,    "count");

    return users.map((user) => {
      const id = user._id.toString();

      // Pipeline stats
      const pipeline = {
        totalAssigned:  pl_assigned[id] || 0,
        newLeads:       pl_new[id]       || 0,
        siteVisits:     pl_visits[id]    || 0,
        closedWon:      pl_won[id]       || 0,
      };
      pipeline.conversionRate = pipeline.totalAssigned
        ? Number(((pipeline.closedWon / pipeline.totalAssigned) * 100).toFixed(1)) : 0;

      // Project pipeline stats
      const project = {
        totalAssigned:    pr_assigned[id]        || 0,
        interested:       pr_interested[id]      || 0,
        siteVisitBooked:  pr_siteVisitBooked[id] || 0,
        booked:           pr_booked[id]          || 0,
        callBack:         pr_callBack[id]        || 0,
        notInterested:    pr_notInterested[id]   || 0,
        notReachable:     pr_notReachable[id]    || 0,
      };
      project.conversionRate = project.totalAssigned
        ? Number(((project.booked / project.totalAssigned) * 100).toFixed(1)) : 0;

      return {
        ...user.toJSON(),
        // top-level totals (combined) for summary cards
        totalAssigned: pipeline.totalAssigned + project.totalAssigned,
        siteVisits:    pipeline.siteVisits    + project.siteVisitBooked,
        closedWon:     pipeline.closedWon     + project.booked,
        newLeads:      pipeline.newLeads,
        // per-pipeline breakdown
        pipeline,
        project,
      };
    });
  },
};

module.exports = authService;
