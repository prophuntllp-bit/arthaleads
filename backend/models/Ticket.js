// models/Ticket.js
const mongoose = require("mongoose");
const Counter  = require("./Counter");

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

    // File attachments on the initial ticket (base64 data URIs or URLs)
    attachments: [{
      url:  { type: String, required: true }, // base64 data URI or CDN URL
      name: { type: String, default: "attachment" },
      size: { type: Number, default: 0 }, // bytes (original)
    }],

    // Two-way threaded conversation
    replies: [{
      body:        { type: String, required: true, maxlength: 3000 },
      authorId:    { type: mongoose.Schema.Types.ObjectId },
      authorName:  { type: String, required: true },
      isAdmin:     { type: Boolean, default: false },
      attachments: [{
        url:  { type: String, required: true },
        name: { type: String, default: "attachment" },
        size: { type: Number, default: 0 },
      }],
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

// Auto-generate a unique sequential ticket number — atomic $inc prevents duplicates
ticketSchema.pre("save", async function (next) {
  if (this.ticketNumber) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "ticketNumber" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const now = new Date();
    const y  = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d  = String(now.getDate()).padStart(2, "0");
    this.ticketNumber = `TKT-${y}${mo}${d}-${String(counter.seq).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);
