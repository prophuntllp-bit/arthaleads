// services/authService.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Organization = require("../models/Organization");
const { AppError } = require("../middlewares/errorHandler");

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
    return { token, user, org };
  },

  async login(email, password) {
    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password", 401);
    }
    if (!user.isActive) throw new AppError("Account deactivated. Contact admin.", 403);

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    return { token, user };
  },

  async googleAuth(credential) {
    // Verify the Google ID token using Google's tokeninfo endpoint (no external library needed)
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    const payload = await response.json();

    if (!response.ok || payload.error) {
      throw new AppError("Invalid Google token", 401);
    }
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new AppError("Google token audience mismatch", 401);
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
      // New Google user — create their own org and make them admin
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
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    return { token, user };
  },

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    const org = user.orgId
      ? await Organization.findById(user.orgId).select("name slug logo plan isActive").lean()
      : null;
    return { user, org };
  },

  async getAllAgents(orgId) {
    return User.find({ orgId, isActive: true, role: "agent" }).select("name email role phone avatar");
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
    return User.find({ orgId }).select("-password").sort({ createdAt: -1 });
  },

  async createUser(payload, orgId) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) throw new AppError("Email already registered", 409);

    return User.create({ ...payload, orgId });
  },

  async updateUser(targetId, updates, adminId) {
    const user = await User.findById(targetId).select("+password");
    if (!user) throw new AppError("User not found", 404);
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

  async deleteUser(targetId, adminId) {
    if (targetId === adminId.toString()) {
      throw new AppError("You cannot delete yourself", 400);
    }

    const user = await User.findById(targetId);
    if (!user) throw new AppError("User not found", 404);

    await user.deleteOne();
    return true;
  },

  async toggleUserActive(targetId, adminId) {
    if (targetId === adminId.toString()) throw new AppError("Cannot deactivate yourself", 400);
    const user = await User.findById(targetId);
    if (!user) throw new AppError("User not found", 404);
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    return user;
  },

  async getPerformance(actor) {
    const memberMatch = actor.role === "manager"
      ? { orgId: actor.orgId, role: { $in: ["manager", "agent"] } }
      : { orgId: actor.orgId, role: { $in: ["admin", "manager", "agent"] } };

    const users = await User.find(memberMatch).select("name email role avatar isActive");
    const userIds = users.map((user) => user._id);

    const orgId = actor.orgId;
    const [assignedCounts, closedWonCounts, siteVisitCounts, newCounts] = await Promise.all([
      Lead.aggregate([
        { $match: { orgId, assignedTo: { $in: userIds }, isArchived: false } },
        { $group: { _id: "$assignedTo", totalAssigned: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { orgId, assignedTo: { $in: userIds }, isArchived: false, status: "Closed Won" } },
        { $group: { _id: "$assignedTo", closedWon: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { orgId, assignedTo: { $in: userIds }, isArchived: false, status: "Site Visit" } },
        { $group: { _id: "$assignedTo", siteVisits: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { orgId, assignedTo: { $in: userIds }, isArchived: false, status: "New" } },
        { $group: { _id: "$assignedTo", newLeads: { $sum: 1 } } },
      ]),
    ]);

    const mapFrom = (items, field) =>
      items.reduce((acc, item) => {
        acc[item._id.toString()] = item[field];
        return acc;
      }, {});

    const assignedMap = mapFrom(assignedCounts, "totalAssigned");
    const wonMap = mapFrom(closedWonCounts, "closedWon");
    const visitMap = mapFrom(siteVisitCounts, "siteVisits");
    const newMap = mapFrom(newCounts, "newLeads");

    return users.map((user) => {
      const id = user._id.toString();
      const totalAssigned = assignedMap[id] || 0;
      const closedWon = wonMap[id] || 0;
      const siteVisits = visitMap[id] || 0;
      const newLeads = newMap[id] || 0;

      return {
        ...user.toJSON(),
        totalAssigned,
        closedWon,
        siteVisits,
        newLeads,
        conversionRate: totalAssigned ? Number(((closedWon / totalAssigned) * 100).toFixed(1)) : 0,
      };
    });
  },
};

module.exports = authService;
