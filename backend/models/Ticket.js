// models/Ticket.js
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName:  { type: String, required: true },
    userEmail: { type: String, required: true },
    orgName:   { type: String, required: true },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject too long"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [3000, "Description too long"],
    },
    category: {
      type: String,
      enum: ["billing", "technical", "feature-request", "bug", "general"],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
    },
    // Super admin internal notes visible only to super admins
    adminNotes: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true }
);

// Auto-generate a unique sequential ticket number before first save
ticketSchema.pre("save", async function (next) {
  if (this.ticketNumber) return next(); // already set
  try {
    // Count ALL existing tickets to get a global sequential ID
    const count = await this.constructor.countDocuments();
    const now   = new Date();
    const y  = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d  = String(now.getDate()).padStart(2, "0");
    this.ticketNumber = `TKT-${y}${mo}${d}-${String(count + 1).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);
