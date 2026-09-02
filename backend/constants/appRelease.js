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
    build: 24,
    // Human-readable, shown in the update prompt.
    version: "1.0.1",
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
    url: "https://github.com/prophuntllp-bit/arthaleads/releases/download/mobile-v1.0.1-24/arthaleads-1.0.1%2B24-arm64.apk",
    // Optional short "what's new" line, shown in that prompt.
    notes: "The Calls screen is fixed: the daily volume chart no longer fills the whole screen, and call rows no longer overlap the duration with the call count.",

    // ── The public download page (new installs) ──────────────────────────────
    // Ahead of the block above by design. Anyone arriving at /download-app has
    // no app yet, so serving them the newest signed build costs nothing and
    // saves them an update on day one — while the field stays on `build`.
    download: {
      version: "1.0.3",
      // The plain build number, not Android's versionCode — the APK is stamped
      // 2028 and the app reports it back as 28 (% 1000). mobile/pubspec.yaml
      // explains why the two differ; the short version is that every install
      // in the field is on versionCode 2024 and cannot be given a lower one.
      build: 29,
      // Universal APK, not the arm64 split: this link is public, we cannot see
      // whose phone is on the other end, and a 32-bit device meeting an arm64
      // APK fails with a bare "App not installed" that the user cannot fix.
      // Bigger file, but it installs everywhere the page claims it will.
      url: "https://github.com/prophuntllp-bit/arthaleads/releases/download/mobile-v1.0.3-29/arthaleads-1.0.3-29.apk",
      // Bytes, so the page can format it. 0 hides the figure rather than
      // showing a wrong one.
      sizeBytes: 77739349,
      // Minimum Android version, for the requirements line on that page. This
      // is the human-readable form of minSdk in mobile/android/app/build.gradle.kts
      // — keep the two in step.
      minAndroid: "7.0",
      notes: "Artha answers with your live numbers now instead of directions: it knows which screen you opened it from, and when it can make the change itself it offers to, rather than explaining where the button is. Marking a lead Not Interested no longer moves it to Dump — it stays in your list with the status you gave it. Notes can be edited and deleted. Plus the assistant shows typing dots while it is thinking.",
    },
  },
};
