const express = require("express");
const router = express.Router();
const { getForm, submitLead } = require("../controllers/publicController");

router.get("/form/:token", getForm);
router.post("/form/:token", submitLead);

// ── App version check (Android APK is distributed privately, not via Play Store) ──
// Sideloaded builds get no automatic updates, so the app asks here on launch
// whether a newer APK exists. Public on purpose: it exposes nothing but the
// current release info, and the app must be able to check before login.
//
// Driven entirely by env vars so publishing an update is a config change, not a
// code deploy:
//   ANDROID_LATEST_BUILD    e.g. "7"   – versionCode of the newest APK
//   ANDROID_LATEST_VERSION  e.g. "1.2.0"
//   ANDROID_MIN_BUILD       e.g. "5"   – anything older is FORCED to update
//   ANDROID_APK_URL         download link handed to the user
//   ANDROID_RELEASE_NOTES   optional short "what's new" text
//
// Safe default: with nothing configured latestBuild is 0, so the app never
// prompts and never blocks.
router.get("/app-version", (req, res) => {
  const platform = String(req.query.platform || "android").toLowerCase();
  if (platform !== "android") {
    return res.json({ success: true, platform, latestBuild: 0, minBuild: 0 });
  }

  const int = (v, fallback = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const latestBuild = int(process.env.ANDROID_LATEST_BUILD, 0);
  // Never let a misconfigured minBuild exceed latestBuild — that would lock
  // every user out of the app with an update they cannot actually obtain.
  const minBuild = Math.min(int(process.env.ANDROID_MIN_BUILD, 0), latestBuild);

  res.set("Cache-Control", "public, max-age=300"); // 5 min — cheap, still prompt

  res.json({
    success:       true,
    platform:      "android",
    latestBuild,
    latestVersion: process.env.ANDROID_LATEST_VERSION || "",
    minBuild,
    downloadUrl:   process.env.ANDROID_APK_URL || "",
    releaseNotes:  process.env.ANDROID_RELEASE_NOTES || "",
  });
});

module.exports = router;
