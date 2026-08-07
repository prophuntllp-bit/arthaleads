const express = require("express");
const router = express.Router();
const { getForm, submitLead } = require("../controllers/publicController");
const OPTS = require("../constants/leadOptions");
const APP_RELEASE = require("../constants/appRelease");

router.get("/form/:token", getForm);
router.post("/form/:token", submitLead);

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

  res.json({
    success:       true,
    platform:      "android",
    latestBuild,
    latestVersion: process.env.ANDROID_LATEST_VERSION || rel.version || "",
    minBuild,
    downloadUrl:   process.env.ANDROID_APK_URL       || rel.url     || "",
    releaseNotes:  process.env.ANDROID_RELEASE_NOTES || rel.notes   || "",
  });
});

module.exports = router;
