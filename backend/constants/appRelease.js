// ── Current Android release ───────────────────────────────────────────────────
// What the app compares itself against on launch (GET /api/public/app-version).
// The APK is distributed privately, so nothing updates it automatically — this
// file is how you tell existing installs that a newer build exists.
//
// There are TWO builds in here, and they move independently on purpose:
//
//   `android.build`          — what EXISTING installs are prompted to update to.
//                              Raising this wakes every phone in the field.
//   `android.download.build` — what /download-app serves to a NEW install.
//                              Raising this reaches nobody who already has the
//                              app; it only changes what a fresh download gets.
//
// So a build can ship to new users while the fleet stays put, which is the
// normal case for a release that is finished but not yet worth interrupting
// everyone over. When you do want the fleet on it, copy the download block's
// build/version/url/notes up into the fields above.
//
// TO CUT A NEW BUILD:
//   1. bump `version:` in mobile/pubspec.yaml — READ THE COMMENT THERE FIRST,
//      the build number is offset by 2000 (1.0.1+24 -> 1.0.2+2028) and the
//      obvious value builds an APK that will not install over what is already
//      on people's phones
//   2. push — Flutter Mobile CI builds a signed release APK (the keystore
//      secrets ARE configured; see .github/workflows/mobile-flutter-ci.yml)
//   3. attach that APK to a GitHub Release and point `download.url` at it
//   4. only when the fleet should follow: raise `build`/`version`/`url` too
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
    // ── The update prompt (existing installs) ────────────────────────────────
    // Must match the "+N" build number of the APK at `url` below.
    //
    // 14 Sep -> 17 Sep 2026: raised straight from 24 to 30, skipping the
    // intermediate download-only builds (28/29) entirely — an Android update
    // is never incremental, so a build-24 phone updating to 30 gets every
    // change in between in one install, same as anyone who updated along the
    // way. Also the first build the field receives through the new in-app
    // installer (see update_gate.dart) rather than a browser download; a
    // build-24 phone still uses the old browser flow for THIS one update
    // (it doesn't have the new code yet), then gets in-app installs after.
    //
    // 18 Sep 2026: 31 fixes the random forced-logout bug reported this week —
    // flutter_secure_storage's Jetpack-Crypto-backed AndroidOptions could
    // lose its key across a background process restart on some devices,
    // sending someone to the login screen despite a still-valid session.
    // Not marked mandatory (minBuild unchanged) — it's an annoyance, not
    // data loss or a blocked workflow, so a normal dismissible prompt is
    // enough.
    //
    // 29 Sep 2026: 35 fixes a SECOND, different cause of the same symptom —
    // 31/32 fixed the storage layer losing its key; this one is
    // AuthState._restore() giving up after a single failed /auth/me call
    // (a Railway cold start or a network blip), which left the token intact
    // but showed the login screen anyway. Now retries up to 3x with backoff
    // before giving up. Also ships the new Plan & Billing screen (native
    // Razorpay checkout), an admin self-role editor, CTWA test-lock
    // warnings, a manual "Start qualification flow" recovery button,
    // numbered project lead lists, Template Builder advisory warnings +
    // CRM-field labels, and a Campaigns "Record consent" shortcut.
    //
    // 5 Oct 2026: 36 brings the app level with the web dashboard and
    // Integrations: the dashboard charts and Lead Sources Health, status tabs
    // and a multi-source filter on Leads, a "where this lead came from" line
    // on every lead card and in the detail, a WhatsApp chat header that always
    // fits the name and number, and Integrations with grouped connections,
    // real logos, pause/resume and Lead Routing Rules. Not marked mandatory
    // (minBuild unchanged). Verified on a real phone as an in-place upgrade
    // from 35 (same signing key, versionCode 2036 over 2035).
    //
    // 8 Oct 2026: 37 brings the app level with the rest of the web: copy name
    // and number, per-project Dump Leads, the WhatsApp Chat tab, WhatsApp ad and
    // Facebook form filters, storage meter and plan locks, routing rule editing,
    // and layouts that fit every screen size and font size. Not marked
    // mandatory (minBuild unchanged). Verified on two real phones; the install
    // over 36 kept the login (same signing key, versionCode 2037 over 2036).
    //
    // 8 Oct 2026: 38 adds the WhatsApp Chat tab to leads inside a project (the
    // chat is found through fromLeadId or the phone number, see
    // routes/projectRoutes.js). Not marked mandatory (minBuild unchanged).
    // Same signing key, versionCode 2038 over 2037.
    build: 38,
    // Human-readable, shown in the update prompt.
    version: "1.0.12",
    // Installs older than this are FORCED to update (blocking dialog).
    // 0 disables forcing. Never set above `build`.
    //
    // Held at 19: that is the build whose version check actually works (the
    // ABI-offset bug before it meant no install could ever detect an update,
    // so anything older still needs one manual install). Nothing shipped
    // since has been delivery-critical, so later builds arrive as a normal
    // dismissible "Update available" prompt rather than a blocking one.
    // Only raise this for something a stale install genuinely must not miss.
    minBuild: 19,
    // Where the update prompt sends people. Until this is set, the app never
    // prompts — an update you cannot deliver is worse than no prompt at all.
    //
    // Universal APK, not an arm64 split, unlike build 24's link below it in
    // history — this is going out to the whole existing fleet in one push and
    // we cannot see who is on a 32-bit device; the download block's own
    // comment already documents why an ABI split is the wrong call for an
    // audience we don't control. Bigger file, installs everywhere.
    url: "https://github.com/prophuntllp-bit/arthaleads/releases/download/mobile-v1.0.12-38/arthaleads-1.0.12-38.apk",
    // Optional short "what's new" line, shown in that prompt.
    notes: "The WhatsApp chat now shows on leads inside a project, including ones a routing rule filed in. Includes copy name and number, Dump Leads in every project, WhatsApp ad and Facebook form filters, storage meter and plan locks, editable routing rules, a cleaner Dashboard, and layouts that fit every phone size.",

    // ── The public download page (new installs) ──────────────────────────────
    // Ahead of the block above by design. Anyone arriving at /download-app has
    // no app yet, so serving them the newest signed build costs nothing and
    // saves them an update on day one — while the field stays on `build`.
    //
    // 29 Sep 2026: matches the fleet block above — 35 is going out to
    // everyone in this same push, so download and fleet stay in step rather
    // than one leading the other.
    // 5 Oct 2026: same again for 36, in step with the fleet block above.
    // 8 Oct 2026: same again for 37, in step with the fleet block above.
    // 8 Oct 2026: same again for 38.
    download: {
      version: "1.0.12",
      // The plain build number, not Android's versionCode — the APK is stamped
      // 2035 and the app reports it back as 35 (% 1000). mobile/pubspec.yaml
      // explains why the two differ; the short version is that every install
      // in the field is on versionCode 2024 and cannot be given a lower one.
      build: 38,
      // Universal APK, not the arm64 split: this link is public, we cannot see
      // whose phone is on the other end, and a 32-bit device meeting an arm64
      // APK fails with a bare "App not installed" that the user cannot fix.
      // Bigger file, but it installs everywhere the page claims it will.
      url: "https://github.com/prophuntllp-bit/arthaleads/releases/download/mobile-v1.0.12-38/arthaleads-1.0.12-38.apk",
      // Bytes, so the page can format it. 0 hides the figure rather than
      // showing a wrong one.
      sizeBytes: 82630891,
      // Minimum Android version, for the requirements line on that page. This
      // is the human-readable form of minSdk in mobile/android/app/build.gradle.kts
      // — keep the two in step.
      minAndroid: "7.0",
      notes: "The WhatsApp chat now shows on leads inside a project, including ones a routing rule filed in. Includes copy name and number, Dump Leads in every project, WhatsApp ad and Facebook form filters, storage meter and plan locks, editable routing rules, a cleaner Dashboard, and layouts that fit every phone size.",
    },
  },
};
