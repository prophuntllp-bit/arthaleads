// server.js — Production-ready CRM entry point
console.log("[BOOT] server.js starting, node:", process.version);

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason?.message || String(reason));
});

require("dotenv").config();
console.log("[BOOT] dotenv OK, PORT:", process.env.PORT, "MONGO:", !!process.env.MONGO_URI);
console.log("[BOOT] Loading modules...");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const logger = require("./config/logger");
const { errorHandler } = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRoutes");
const automationRoutes = require("./routes/automationRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const projectRoutes = require("./routes/projectRoutes");
const pushRoutes = require("./routes/pushRoutes");
require("./utils/scheduler");

console.log("[BOOT] Modules loaded, creating app...");
const app = express();

// Trust Railway/Vercel proxy — required for express-rate-limit behind a reverse proxy
app.set("trust proxy", 1);

// ── Connect Database ──────────────────────────────────────────────────────────
console.log("[BOOT] Connecting to DB...");
connectDB().then(async () => {
  console.log("[BOOT] DB connected");
  // One-time migration: clear auto-defaulted "Not Contacted" remarks (never manually set)
  try {
    const mongoose = require("mongoose");
    const r = await mongoose.connection.collection("projectleads").updateMany(
      { remark: "Not Contacted", remarkUpdatedBy: null },
      { $set: { remark: "" } }
    );
    if (r.modifiedCount > 0) console.log(`[MIGRATION] Cleared ${r.modifiedCount} default 'Not Contacted' remarks`);
  } catch (e) { console.error("[MIGRATION] remark clear failed:", e.message); }
}).catch((e) => console.error("[BOOT] DB error:", e.message));

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// CORS — allow multiple frontend origins from env
const allowedOrigins = (process.env.CLIENT_URLS || "http://localhost:3000")
  .split(",").map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL) || 200,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH) || 20,
  message: { success: false, message: "Too many login attempts, please wait." },
});

app.use(generalLimiter);

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Webhook BEFORE json parser (needs raw body option) ────────────────────────
app.use("/webhook", webhookRoutes);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",  authLimiter, authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/voice", require("./routes/voiceRoutes"));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
console.log("[BOOT] Calling app.listen on port", PORT);
app.listen(PORT, () => {
  logger.info(`🚀 CRM Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

module.exports = app;
