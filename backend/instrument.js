// instrument.js — Sentry must be initialised before anything else loads
// This file is require()'d as the very first line of server.js
const Sentry = require("@sentry/node");

if (!process.env.SENTRY_DSN) {
  console.warn("[sentry] SENTRY_DSN not set — error monitoring disabled");
} else {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Capture 100% of errors in production, 0% in dev (no noise while coding)
    enabled: process.env.NODE_ENV === "production",

    // Performance tracing — 10% of requests sampled (enough for insights)
    tracesSampleRate: 0.1,

    // Don't send boring/expected errors to Sentry
    ignoreErrors: [
      "Not authenticated",
      "ORGANISATION_INACTIVE",
      "TRIAL_EXPIRED",
      "Invalid email or password",
      "Too many failed attempts",
      "Too many requests",
      "Reset link is invalid or has expired",
    ],

    // Don't send user IP / email to Sentry (privacy)
    sendDefaultPii: false,

    // Tag every event with environment
    environment: process.env.NODE_ENV || "development",
  });

  console.log("[sentry] ✅ Error monitoring active");
}

module.exports = Sentry;
