const express = require("express");
const router = express.Router();
const { getForm, submitLead } = require("../controllers/publicController");
const OPTS = require("../constants/leadOptions");
const APP_RELEASE = require("../constants/appRelease");
const { answerMarketingQuestion } = require("../utils/openai");

router.get("/form/:token", getForm);
router.post("/form/:token", submitLead);

// ── Marketing site chatbot ───────────────────────────────────────────────────
// POST /api/public/chat — Body: { question, history? }
// No auth, no access to any customer data — pre-sales Q&A only. Inherits the
// contactLimiter rate limit already applied to this whole router in server.js
// (10 req / 15 min / IP), which is the abuse guard for this AI-cost-incurring
// endpoint since it's reachable by anyone.
router.post("/chat", async (req, res, next) => {
  try {
    const question = (req.body.question || "").toString().trim().slice(0, 500);
    const history  = Array.isArray(req.body.history)
      ? req.body.history.slice(-6).map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: String(m.text || "").slice(0, 800),
        }))
      : [];

    if (!question) return res.status(400).json({ success: false, message: "Please type a question." });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "Chat isn't available right now — email contact@arthaleads.com or WhatsApp +91 80801 97945.",
      });
    }

    const result = await answerMarketingQuestion(question, history);
    res.json({ success: true, answer: result.answer, cta: result.cta });
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(503).json({ success: false, message: "Chat isn't available right now." });
    }
    next(err);
  }
});

// ── Lead option lists ────────────────────────────────────────────────────────
// Serves the same constants the model and validators use, so a client can never
// offer a value the API rejects. This matters most for the Android app: APKs are
// distributed privately and can be months old, but they still pick up new
// options from here without a reinstall.
//
// Public because these are non-sensitive UI constants and the app may load them
// before login. Cached for an hour — they change only on deploy.
router.get("/options", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({
    success: true,
    options: {
      status:       OPTS.STATUS,
      priority:     OPTS.PRIORITY,
      source:       OPTS.SOURCE,
      booking:      OPTS.BOOKING,
      propertyType: OPTS.PROPERTY_TYPE,
      bhk:          OPTS.BHK,
      purpose:      OPTS.PURPOSE,
    },
  });
});

// ── App version check (Android APK is distributed privately, not via Play Store) ──
// Sideloaded builds get no automatic updates, so the app asks here on launch
// whether a newer APK exists. Public on purpose: it exposes nothing but the
// current release info, and the app must be able to check before login.
//
// The current release lives in constants/appRelease.js, so publishing an update
// is part of the same commit that bumps mobile/pubspec.yaml — no separate
// dashboard step to forget. Each field can still be overridden by an env var
// for a hotfix that cannot wait for a deploy (e.g. a broken download link):
//   ANDROID_LATEST_BUILD, ANDROID_LATEST_VERSION, ANDROID_MIN_BUILD,
//   ANDROID_APK_URL, ANDROID_RELEASE_NOTES
// and, for the public download page's separate build:
//   ANDROID_DOWNLOAD_BUILD, ANDROID_DOWNLOAD_VERSION, ANDROID_DOWNLOAD_URL,
//   ANDROID_DOWNLOAD_NOTES, ANDROID_APK_SIZE, ANDROID_MIN_OS
//
// Safe default: with no URL configured the app never prompts and never blocks.
router.get("/app-version", (req, res) => {
  const platform = String(req.query.platform || "android").toLowerCase();
  if (platform !== "android") {
    return res.json({ success: true, platform, latestBuild: 0, minBuild: 0 });
  }

  const rel = APP_RELEASE.android || {};
  const int = (v, fallback = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const latestBuild = int(process.env.ANDROID_LATEST_BUILD, int(rel.build, 0));
  // Never let a misconfigured minBuild exceed latestBuild — that would lock
  // every user out of the app with an update they cannot actually obtain.
  const minBuild = Math.min(
    int(process.env.ANDROID_MIN_BUILD, int(rel.minBuild, 0)),
    latestBuild
  );

  res.set("Cache-Control", "public, max-age=300"); // 5 min — cheap, still prompt

  // What /download-app serves. Deliberately a separate build from the one above:
  // that one decides who gets nagged to update, this one decides what a fresh
  // install receives, and shipping to new users should not wake the whole fleet.
  //
  // Falls back to the update block field by field, so a half-filled download
  // block (a build cut but not yet uploaded, say) still leaves the page with a
  // working link rather than a dead button.
  const dl = rel.download || {};
  const dlUrl = process.env.ANDROID_DOWNLOAD_URL || dl.url || "";
  const minAndroid = process.env.ANDROID_MIN_OS || dl.minAndroid || "";

  // All or nothing. A download block whose APK has not been uploaded yet must
  // not lend its version number to the older link — that would put "v1.0.2,
  // build 25" on the page above a button handing over the 1.0.1 file. With no
  // URL of its own it steps aside completely and the page advertises the
  // update build, which is at least true.
  const download = dlUrl
    ? {
        build:        int(process.env.ANDROID_DOWNLOAD_BUILD, int(dl.build, latestBuild)),
        version:      process.env.ANDROID_DOWNLOAD_VERSION || dl.version || "",
        url:          dlUrl,
        sizeBytes:    int(process.env.ANDROID_APK_SIZE, int(dl.sizeBytes, 0)),
        minAndroid,
        releaseNotes: process.env.ANDROID_DOWNLOAD_NOTES || dl.notes || "",
      }
    : {
        build:        latestBuild,
        version:      process.env.ANDROID_LATEST_VERSION || rel.version || "",
        url:          process.env.ANDROID_APK_URL || rel.url || "",
        sizeBytes:    0,
        minAndroid,
        releaseNotes: process.env.ANDROID_RELEASE_NOTES || rel.notes || "",
      };

  res.json({
    success:       true,
    platform:      "android",
    latestBuild,
    latestVersion: process.env.ANDROID_LATEST_VERSION || rel.version || "",
    minBuild,
    downloadUrl:   process.env.ANDROID_APK_URL       || rel.url     || "",
    releaseNotes:  process.env.ANDROID_RELEASE_NOTES || rel.notes   || "",
    // For the public download page only — the app reads the flat fields above
    // and ignores this. Served from the same endpoint so the page and the
    // in-app updater cannot drift apart on where the APK actually lives.
    download,
  });
});

module.exports = router;
