const mongoose = require("mongoose");

const automationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    platform: {
      type: String,
      enum: ["Facebook", "Google", "WhatsApp", "Website Form", "Custom"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["webhook", "api", "form", "spreadsheet"],
      default: "api",
    },
    status: {
      type: String,
      enum: ["draft", "connected", "paused"],
      default: "draft",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    leadSourceLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    externalSourceId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    pageId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    formId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    externalSourceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    webhookPath: {
      type: String,
      trim: true,
      default: "",
    },
    verifyToken: {
      type: String,
      trim: true,
      default: "",
    },
    accessToken: {
      type: String,
      trim: true,
      default: "",
    },
    mappingNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    siteUrl: {
      type: String,
      trim: true,
      default: "",
    },
    siteName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    connectedForms: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

automationSchema.index({ platform: 1, status: 1 });
automationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Automation", automationSchema);
