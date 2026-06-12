// server.js - Production-ready CRM entry point (v3)
// Deploy marker: 2026-06-05 — ship onboarding route + auth/signup fixes after
// Railway CLI pin (5.3.0 regression). Touches backend/** so Railway's watch
// path doesn't skip the build.
// ⚠️  Sentry MUST be the very first import - before express, mongoose, everything
require("./instrument");

console.log("[BOOT] server.js starting, node:", process.version);

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message, err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason?.message || String(reason));
  process.exit(1);
});

require("dotenv").config();
console.log("[BOOT] dotenv OK, PORT:", process.env.PORT, "MONGO:", !!process.env.MONGO_URI);
console.log("[BOOT] Loading modules...");
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const logger = require("./config/logger");
const { errorHandler } = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRoutes");
const automationRoutes = require("./routes/automationRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const projectRoutes = require("./routes/projectRoutes");
const orgRoutes = require("./routes/orgRoutes");
const pushRoutes = require("./routes/pushRoutes");
const blogRoutes = require("./routes/blogRoutes");
const blogController = require("./controllers/blogController");
require("./utils/scheduler");

console.log("[BOOT] Modules loaded, creating app...");
const app = express();

// Trust Railway/Vercel proxy - required for express-rate-limit behind a reverse proxy
app.set("trust proxy", 1);

// ── Boot-time security assertion ──────────────────────────────────────────────
// Without FB_APP_SECRET in production, the Facebook webhook cannot verify
// signatures. The webhook itself now rejects requests at runtime, but surface
// the misconfiguration loudly at boot so it's caught before leads start failing.
if (process.env.NODE_ENV === "production" && !process.env.FB_APP_SECRET) {
  console.error("[FATAL] FB_APP_SECRET is not set in production — Facebook webhook signature verification is disabled and the webhook will reject all requests. Set FB_APP_SECRET in the environment.");
  logger.error("FB_APP_SECRET missing in production — Facebook webhook will reject all incoming requests until configured.");
}

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

  // Backfill orgId on ProjectLeads that were imported before the field was added
  try {
    const mongoose = require("mongoose");
    const missing = await mongoose.connection.collection("projectleads")
      .find({ orgId: { $exists: false } }).toArray();
    if (missing.length > 0) {
      console.log(`[MIGRATION] Backfilling orgId on ${missing.length} project lead(s)…`);
      const projectIds = [...new Set(missing.map((l) => l.project?.toString()).filter(Boolean))];
      const projects = await mongoose.connection.collection("projects")
        .find({ _id: { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .toArray();
      const projMap = Object.fromEntries(projects.map((p) => [p._id.toString(), p.orgId]));
      for (const lead of missing) {
        const orgId = projMap[lead.project?.toString()];
        if (orgId) {
          await mongoose.connection.collection("projectleads")
            .updateOne({ _id: lead._id }, { $set: { orgId } });
        }
      }
      console.log(`[MIGRATION] orgId backfill complete`);
    }
  } catch (e) {
    console.error("[MIGRATION] orgId backfill failed:", e.message);
    try { require("./instrument").captureException(e, { tags: { migration: "orgId-backfill" } }); } catch {}
  }
}).catch((e) => {
  console.error("[BOOT] DB connection failed - cannot start:", e.message);
  process.exit(1);
});

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// CORS - allow multiple frontend origins from env
// Auto-expand every entry to include both www. and non-www variants so Samsung
// Android PWA installs always match regardless of which form the app was
// installed from (arthaleads.com vs www.arthaleads.com).
const _rawOrigins = (process.env.CLIENT_URLS || "http://localhost:3000")
  .split(",").map((o) => o.trim());

const allowedOrigins = new Set(_rawOrigins);
for (const o of _rawOrigins) {
  try {
    const { protocol, hostname, port } = new URL(o);
    const p = port ? `:${port}` : "";
    if (hostname.startsWith("www.")) {
      allowedOrigins.add(`${protocol}//${hostname.slice(4)}${p}`);
    } else {
      allowedOrigins.add(`${protocol}//www.${hostname}${p}`);
    }
  } catch {}
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    // Use cb(null, false) — returns a proper 403 with CORS headers so the
    // browser logs a clear CORS error rather than a generic 500 network failure.
    logger.warn(`CORS blocked: ${origin}`);
    cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL) || 200,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH) || 50,
  message: { success: false, message: "Too many login attempts, please wait." },
  skip: (req) => {
    // Only skip rate limit for localhost - never bypass based on email
    const ip = req.ip || "";
    return ip === "::1" || ip === "127.0.0.1";
  },
});

// Strict limiter for public unauthenticated endpoints that trigger external actions
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // max 10 contact form submissions per IP per 15 min
  message: { success: false, message: "Too many submissions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const blogLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 blog reads per minute per IP
  message: { success: false, message: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Webhook BEFORE json parser (needs raw body option) ────────────────────────
app.use("/webhook", webhookRoutes);

// ── Body Parsing + Cookie Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(cookieParser());

// ── Global API hardening headers ──────────────────────────────────────────────
// Applied to every /api/* and /webhook response - not the frontend.
app.use(["/api", "/webhook", "/health"], (req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");     // no search engine indexing
  res.setHeader("X-Content-Type-Options", "nosniff");     // no MIME sniffing
  res.setHeader("Cache-Control", "no-store");             // never cache API responses
  next();
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",  authLimiter, authRoutes);
app.use("/api/org",   orgRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/routing-rules", require("./routes/routingRuleRoutes"));
app.use("/api/projects", projectRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/voice", require("./routes/voiceRoutes"));
app.use("/api/followups",   require("./routes/followupRoutes"));
app.use("/api/tasks",       require("./routes/taskRoutes"));
app.use("/api/attendance",   require("./routes/attendanceRoutes"));
app.use("/api/referrals",    require("./routes/referralRoutes"));
app.use("/api/super-admin", require("./routes/superAdminRoutes"));
app.use("/api/tickets",    require("./routes/ticketRoutes"));
app.use("/api/whatsapp",   require("./routes/whatsappRoutes"));
app.use("/api/blog",        blogLimiter, blogRoutes);
app.use("/api/help",        require("./routes/helpRoutes"));
app.use("/api/developers",  require("./routes/developerRoutes"));
app.use("/api/bookings",    require("./routes/bookingRoutes"));
app.use("/api/invoices",    require("./routes/invoiceRoutes"));
app.use("/api/contact",    contactLimiter, require("./routes/contactRoutes"));
app.use("/api/careers",    contactLimiter, require("./routes/careersRoutes"));
app.use("/api/public",     contactLimiter, require("./routes/publicRoutes"));

// ── Dynamic Sitemap (served at /sitemap.xml) ──────────────────────────────────
app.get("/sitemap.xml", blogController.getSitemap);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Frontend Error Report (ErrorBoundary → Sentry) ───────────────────────────
// Accepts render crashes from the React ErrorBoundary and forwards to Sentry.
// No auth required - the boundary catches pre-auth crashes too.
app.post("/api/error-report", contactLimiter, express.json({ limit: "16kb" }), (req, res) => {
  const { message, stack, componentStack, url } = req.body || {};
  logger.error(`[frontend-error] ${message} | url: ${url}\n${stack}\n${componentStack}`);
  const Sentry = require("./instrument");
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(new Error(`[Frontend] ${message}`), {
      extra: { stack, componentStack, url },
      tags: { source: "ErrorBoundary" },
    });
  }
  res.json({ success: true });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Sentry error handler (must be BEFORE our own errorHandler) ───────────────
const Sentry = require("./instrument");
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
console.log("[BOOT] Calling app.listen on port", PORT);
const server = app.listen(PORT, () => {
  logger.info(`🚀 CRM Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Railway sends SIGTERM before killing the container on deploy/restart.
// Stop accepting new connections, wait for in-flight requests, then exit cleanly.
function shutdown(signal) {
  logger.info(`[${signal}] Graceful shutdown initiated…`);
  server.close(() => {
    logger.info("HTTP server closed - all connections drained");
    const mongoose = require("mongoose");
    mongoose.disconnect().then(() => {
      logger.info("MongoDB disconnected - process exiting");
      process.exit(0);
    });
  });
  // Force-exit after 15 s if connections don't drain
  setTimeout(() => {
    logger.error("Forced exit after 15 s - connections did not drain");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

module.exports = app;
