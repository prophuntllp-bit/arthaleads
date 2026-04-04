// server.js — Production-ready CRM entry point
console.log("[BOOT] server.js starting, node:", process.version);

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
  process.exit(1);
});

require("dotenv").config();
console.log("[BOOT] dotenv OK, PORT:", process.env.PORT, "MONGO:", !!process.env.MONGO_URI);
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
require("./utils/scheduler");

const app = express();

// Trust Railway/Vercel proxy — required for express-rate-limit behind a reverse proxy
app.set("trust proxy", 1);

// ── Connect Database ──────────────────────────────────────────────────────────
connectDB();

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
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",  authLimiter, authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/automations", automationRoutes);

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
app.listen(PORT, () => {
  logger.info(`🚀 CRM Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

module.exports = app;
