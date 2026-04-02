// services/authService.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { AppError } = require("../middlewares/errorHandler");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const authService = {
  async signup(data) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError("Email already registered", 409);

    const user = await User.create(data);
    const token = signToken(user._id);
    return { token, user };
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

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  async getAllAgents() {
    return User.find({ isActive: true }).select("name email role phone avatar");
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
  async getAllUsers() {
    return User.find().select("-password").sort({ createdAt: -1 });
  },

  async createUser(payload) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) throw new AppError("Email already registered", 409);

    return User.create(payload);
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
      ? { role: { $in: ["manager", "agent"] } }
      : { role: { $in: ["admin", "manager", "agent"] } };

    const users = await User.find(memberMatch).select("name email role avatar isActive");
    const userIds = users.map((user) => user._id);

    const [assignedCounts, closedWonCounts, siteVisitCounts, newCounts] = await Promise.all([
      Lead.aggregate([
        { $match: { assignedTo: { $in: userIds }, isArchived: false } },
        { $group: { _id: "$assignedTo", totalAssigned: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { assignedTo: { $in: userIds }, isArchived: false, status: "Closed Won" } },
        { $group: { _id: "$assignedTo", closedWon: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { assignedTo: { $in: userIds }, isArchived: false, status: "Site Visit" } },
        { $group: { _id: "$assignedTo", siteVisits: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { assignedTo: { $in: userIds }, isArchived: false, status: "New" } },
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
