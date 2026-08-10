// ── Current Android release ───────────────────────────────────────────────────
// What the app compares itself against on launch (GET /api/public/app-version).
// The APK is distributed privately, so nothing updates it automatically — this
// file is how you tell existing installs that a newer build exists.
//
// TO PUBLISH AN UPDATE:
//   1. bump `version:` in mobile/pubspec.yaml   (e.g. 1.0.1+2 -> 1.0.2+3)
//   2. bump `build` + `version` below to match  (build MUST equal the +N part)
//   3. commit — the backend redeploys itself and starts advertising it
//
// Keeping this in the repo rather than in Railway env vars means the release is
// version-controlled, reviewable, and moves in the same commit as the version
// bump, instead of being a separate dashboard step that is easy to forget —
// and forgetting it means nobody is ever prompted to update.
//
// Every field can still be overridden by an env var (see below) for a hotfix
// that cannot wait for a deploy, e.g. correcting a broken download link.

module.exports = {
  android: {
    // Must match the "+N" build number in mobile/pubspec.yaml.
    build: 7,
    // Human-readable, shown in the update prompt.
    version: "1.0.1",
    // Installs older than this are FORCED to update (blocking dialog).
    // 0 disables forcing. Never set above `build`.
    minBuild: 0,
    // Where users download the APK. Until this is set, the app never prompts —
    // an update you cannot deliver is worse than no prompt at all.
    // Hosted as a GitHub Release asset — see .github/workflows/mobile-flutter-ci.yml
    // for how future signed builds get produced (needs the MOBILE_KEYSTORE_BASE64
    // secret set; not yet configured — see mobile/android/key.properties, kept
    // local/untracked).
    url: "https://github.com/prophuntllp-bit/arthaleads/releases/download/mobile-v1.0.1-7/arthaleads-1.0.1%2B7-arm64.apk",
    // Optional short "what's new" line.
    notes: "Call now offers EnableX or your phone's dialer, matching the web app.",
  },
};
