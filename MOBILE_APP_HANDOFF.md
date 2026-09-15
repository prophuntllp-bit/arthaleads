# Arthaleads Mobile App — Handoff

Single source of truth for the Flutter app at `mobile/`, written for a fresh
session with zero prior context that will continue this work. Verified against
the actual code/config on **14 Sep 2026** (not copied from an older doc without
checking) — `flutter analyze` is clean, `git status` on `mobile/` is clean, no
uncommitted work is sitting anywhere.

Two older docs still exist in the repo root — `MOBILE_PARITY_AUDIT.md` (a
feature-by-feature web-vs-native ledger, last updated 17 Jul 2026) and the
previous version of this file. Both are **stale in places** — e.g. the old
handoff claimed "no signup screen" as an open gap; that shipped weeks ago
(`mobile/lib/screens/signup_screen.dart` exists and works). This file
supersedes both for anything they disagree on. The parity audit is still
useful as a granular per-feature ledger but **needs a fresh pass** — ~25
commits have landed since it was last touched (full list in §8).

---

## 1. The one thing to get right before anything else: build numbers

**Right now: the repo/newest-build number is 29. The team's installed phones
are only prompted to update as far as build 24.** That gap is real and
deliberate, not a bug — read this section before touching `pubspec.yaml` or
`appRelease.js`, because guessing the "obvious" next number ships an APK that
fails to install on every phone already in the field with a bare
**"App not installed"** and no explanation.

### Why there are two numbers

`backend/constants/appRelease.js` carries two build values that move
independently on purpose:

| Field | Meaning | Current value |
|---|---|---|
| `android.build` | What **existing installs** are prompted to update to (raising it wakes every phone in the field) | **24** (`version: "1.0.1"`) |
| `android.download.build` | What `/download-app` serves to a **brand-new install** | **29** (`version: "1.0.3"`) |

So a finished build can reach new downloads immediately while the existing
fleet stays on a known-good version until someone deliberately decides to push
the update prompt. To make the whole fleet follow, copy the `download` block's
`build`/`version`/`url`/`notes` up into the top-level `android.build` fields.

`minBuild: 19` forces a blocking (non-dismissible) update below that version —
build 19 is the first one whose update-check logic actually works (see the ABI
offset bug below). Only raise `minBuild` for something a stale install
genuinely cannot be allowed to miss; every build since 19 has shipped as a
normal dismissible "Update available" prompt.

### The versionCode offset — this is the footgun

`mobile/pubspec.yaml`'s `version:` line is `<name>+<buildNumber>`, and that
build number becomes Android's `versionCode` — which must **strictly
increase** on every release or Android refuses the install.

Builds up to 24 were stamped `versionCode = 2000 + N` by an ABI-split offset
the toolchain applied at the time. That offset is **gone** from the toolchain
now (confirmed with `aapt2 dump badging` on a real build), but **every phone
already in the field is on `versionCode 2024`**, and Android will never
install a lower versionCode over a higher one that's already there. So a
naive `1.0.4+25` in `pubspec.yaml` produces `versionCode 25` — lower than
2024 — and fails on every existing phone.

**The fix that's in place:** keep manually adding the `2000` offset in
`pubspec.yaml` forever, even though the toolchain no longer does it
automatically:

```
1.0.3+2029   ->   versionCode 2029   ->   app & backend report it as build "29"
```

The app recovers the real number with `% 1000`
(`trueBuildNumber` in `mobile/lib/core/update_service.dart`), and that's what
both the in-app "About" screen and `appRelease.js` talk about. **Always use
the plain, un-offset number (29, not 2029) in `appRelease.js` and in any
release notes/commit messages** — only `pubspec.yaml`'s `version:` line gets
the `+2000` treatment.

**Current state right now**: `mobile/pubspec.yaml` → `version: 1.0.3+2029`.
Next build must be `1.0.4+2030` at minimum (never below).

### The signing key — the other footgun

Two different keystores exist and only one of them has ever shipped:

- **The real one**: `mobile/android/release.keystore` (local file on this
  machine, gitignored, present right now alongside `mobile/android/key.properties`)
  — `CN=Arthaleads, OU=PropHunt LLP, O=PropHunt LLP, L=Mumbai`, SHA-256
  `2d9ac02f…`. This signed build 24 and every build that has ever landed on a
  real phone.
- **The GitHub Actions secret** `MOBILE_KEYSTORE_BASE64` holds a **different**
  key (`CN=Arthaleads, OU=Arthaleads, O=Prophunt LLP, L=Pune`, SHA-256
  `03912baf…`) that has **never shipped**. A CI-built signed release APK
  cannot install over any existing install — `INSTALL_FAILED_UPDATE_INCOMPATIBLE`,
  "signatures do not match" — only a full uninstall (which wipes app data)
  gets past it.

**Consequence: public/team releases must be built locally with the real
keystore until that GitHub secret is replaced with the matching key.** CI
(`.github/workflows/mobile-flutter-ci.yml`) still runs `flutter analyze` +
debug build on every push to `main` touching `mobile/**` — that part is fine
and safe to rely on — but don't trust its signed-release artifact for an
actual release until the secret is fixed. This also decides the permanent
Play Store upload key if that's ever pursued, so getting it wrong there is a
Google support ticket, not a rebuild.

**If this work moves to a different machine/environment**: `release.keystore`
and `key.properties` are both gitignored and exist **only on this local
machine** (`E:\PROPHUNT CRM\mobile\android\`). Copy them over explicitly, or
every future build is unable to update anyone's existing install. Losing this
file is the single worst thing that could happen to this project's
distribution story — there is no way to recover it, only start over with a
new key that nobody's phone will accept an update from.

### How to cut a new release, step by step

1. Bump `version:` in `mobile/pubspec.yaml` — remember the `+2000` offset
   (e.g. `1.0.3+2029` → `1.0.4+2030`).
2. Build locally with the real keystore (see §6 for the full command).
3. Attach the resulting signed APK to a new GitHub Release.
4. Update `backend/constants/appRelease.js`:
   - Always update the `download` block (plain build number, e.g. `30`; new
     installs should always get the newest build).
   - Only copy those same values up into the top-level `android.build`/`version`/
     `url`/`notes` fields when the **existing fleet** should be pushed to
     update too — that's a separate decision from "a new build exists."
5. Commit both files together, push to `main` (no feature branches — see §12).
6. If reaching the field is the goal, raising the top-level `build` field is
   what actually does it — a bumped `pubspec.yaml` alone does nothing for
   anyone with the app already installed.

Every field in `appRelease.js` can be overridden by an env var on Railway for
an emergency fix (e.g. a broken download URL) that can't wait for a deploy —
check the top of that file for the exact var names before assuming you need a
full redeploy for a one-line fix.

---

## 2. Why this app exists

Arthaleads is a real-estate CRM (web app at `frontend/` + `backend/`, live at
arthaleads.com). Field agents were using an older, laggy, crash-prone
web-based mobile experience. This native Flutter app (`mobile/`) replaces
that with something fast and native, at full feature parity with the web app.

Two phases: **Phase 1 — feature parity** (every screen does what the web app
does), then **Phase 2 — visual parity** (the web's actual design system
ported into Flutter). Both are largely done; ongoing work since has been
individual bug fixes, new features (mobile signup, an on-device AI assistant
with screen awareness, call-recording changes), and release management.

---

## 3. Tech stack

- **Framework**: Flutter (Dart), native Android target
  (`applicationId = "com.arthaleads.crm"`, `namespace = "com.arthaleads.arthaleads_mobile"`).
  No iOS build has been set up or tested.
- **State**: `provider` — a single `ChangeNotifierProvider<AuthState>` at the
  app root (`main.dart`); screens otherwise manage their own local state.
- **HTTP**: `dio`, wrapped in a singleton `ApiClient`.
- **Auth**: JWT bearer token in `flutter_secure_storage` (Android
  Keystore-backed via `encryptedSharedPreferences`).
- **Push**: `firebase_core` + `firebase_messaging` + `flutter_local_notifications`
  (`lib/core/push_service.dart`). Requires `google-services.json` — injected
  from the `GOOGLE_SERVICES_JSON` GitHub secret in CI; needed locally too for
  push/Google Sign-In to work in a local build (see §6).
- **Other key packages**: `google_sign_in`, `geolocator` + `image_picker`
  (attendance selfie+GPS), `just_audio` (call recording playback), `pdf` +
  `printing` (invoice PDFs), `csv` + `file_picker` + `excel` (leads
  import/export), `share_plus`, `intl`, `url_launcher`, `camera`,
  `flutter_web_auth_2`, `package_info_plus`, `shared_preferences`.
- **Backend**: shared 1:1 with the web app (`backend/`, Node/Express +
  MongoDB) — the mobile app is just another REST client, base URL
  `https://api.arthaleads.com/api` in production.
- **minSdk**: `flutter.minSdkVersion` (currently resolves to Android 7.0 /
  API 24 per the public download page's stated requirement — keep
  `frontend/src/pages/DownloadApp.jsx`'s `minAndroid` line and
  `appRelease.js`'s `download.minAndroid` in step with whatever
  `mobile/android/app/build.gradle.kts` actually declares if that ever
  changes).

---

## 4. Directory structure

```
mobile/
├── android/                # native project; local.properties has SDK paths (see §6)
│   ├── key.properties       # LOCAL ONLY, gitignored — real release signing config
│   └── release.keystore     # LOCAL ONLY, gitignored — real release signing key
├── assets/
│   ├── fonts/               # Inter TTF 400/500/600/700, bundled locally (offline-safe)
│   ├── icon/                # launcher icon + adaptive icon layers + splash marks
│   │                        #   (build-time input for flutter_launcher_icons/
│   │                        #    flutter_native_splash — NOT bundled into the APK)
│   └── images/               # runtime assets, e.g. the Artha AI avatar
├── lib/
│   ├── main.dart             # entry point, MaterialApp, auth gate, org-blocked screen
│   ├── core/
│   │   ├── api_client.dart    # Dio singleton — base URL, auth header, 401/403 handling
│   │   ├── auth_state.dart    # ChangeNotifier — login/logout/session restore
│   │   ├── constants.dart     # option lists mirrored from frontend/src/utils/constants.js
│   │   ├── push_service.dart  # FCM wiring, deep-link routing on notification tap
│   │   ├── update_service.dart# in-app update check — trueBuildNumber (% 1000) lives here
│   │   ├── signup_handoff.dart# SHA-256 handoff secret for the in-app signup flow
│   │   ├── copilot_pages.dart # per-screen context fed to the Artha AI assistant
│   │   └── theme.dart         # ★ the whole design system — see §7
│   ├── screens/                # one folder per feature module — see §5
│   └── widgets/                 # shared design-system widgets — see §7
├── pubspec.yaml                  # deps + version/buildNumber (see §1) + fonts/icon/splash config
```

Each screen folder generally has one `..._screen.dart` (list/main view) plus
sibling files for forms, detail sheets, and filters where the feature needs
them.

---

## 5. Feature modules

One folder per module in `mobile/lib/screens/`:

`leads/`, `calls/`, `invoices/`, `attendance/`, `automation/`, `projects/`,
`developers/`, `dashboard/`, `performance/`, `inbox/`, `bookings/`, `dump/`,
`team/`, `settings/`, `referrals/`, `help/`, `tasks/`, `pipeline/`,
`followups/`, plus `login_screen.dart` and `signup_screen.dart` directly
under `screens/`.

Each mirrors a `frontend/src/pages/*.jsx` page 1:1 in data and behavior. For
a granular per-feature "what's actually verified against web" breakdown, see
`MOBILE_PARITY_AUDIT.md` — but treat it as a **17 Jul 2026 snapshot**, not
current truth; several of its "Partial" rows have almost certainly moved
since (see §8's changelog for what's landed since that date).

The navigation shell is `lib/screens/shell.dart` — a `Drawer` mirroring the
web sidebar, with a persistent floating "Artha AI" assistant button
(`_ArthaFab`) opening `help/artha_chat_screen.dart` from any tab.
`main.dart`'s `_AuthGate` decides between `LoginScreen`/`SignupScreen` and
`Shell` based on `AuthState`, and shows a dedicated blocked-screen when the
backend returns `ORGANISATION_INACTIVE` / `TRIAL_EXPIRED`.

---

## 6. Build & run

**This machine's local paths** (confirm/update if running elsewhere):
- Flutter SDK: `E:\dev\flutter` — not on default shell `PATH`; invoke via
  full path `E:\dev\flutter\bin\flutter`, or prepend it to `PATH` for a
  session.
- Android SDK: `E:\dev\android-sdk` — also set in `mobile/android/local.properties`
  (`sdk.dir=E:\\dev\\android-sdk`, `flutter.sdk=E:\\dev\\flutter`).
  `flutter build apk` needs `ANDROID_HOME`/`ANDROID_SDK_ROOT` exported in the
  shell — `flutter analyze` works without it, but silently prints
  "No Android SDK found" **and still exits 0** if you forget, so check the
  output text, not the exit code.
- Physical test device: a realme RMX2156, serial `LBUGKFA6AUMZBILV` — connects
  and disconnects from ADB unpredictably (known flaky-USB issue, not a new
  problem). `adb kill-server && adb start-server` usually recovers it.

```bash
# from mobile/
export ANDROID_HOME="E:\dev\android-sdk"
"/e/dev/flutter/bin/flutter" pub get
"/e/dev/flutter/bin/flutter" analyze          # should print "No issues found!"

# debug build (no signing needed, fine for on-device testing):
"/e/dev/flutter/bin/flutter" build apk --debug

# signed release build (uses android/key.properties + android/release.keystore,
# both already present locally — see §1 before touching either file):
"/e/dev/flutter/bin/flutter" build apk --release
```

`google-services.json` (Firebase push + Google Sign-In config) must exist at
`mobile/android/app/google-services.json` for those features to work in a
local build — it's gitignored; CI injects it from a secret. If it's missing
locally, push notifications and Google Sign-In silently no-op rather than
crashing.

**On-device verification workflow:**

```bash
ADB="/e/dev/android-sdk/platform-tools/adb.exe"
"$ADB" devices -l                             # confirm device connected
"$ADB" install -r build/app/outputs/flutter-apk/app-debug.apk
"$ADB" shell monkey -p com.arthaleads.crm -c android.intent.category.LAUNCHER 1
"$ADB" shell screencap -p //sdcard/s.png && "$ADB" pull //sdcard/s.png screenshot.png
```

**Lessons worth not re-learning:**
- Screenshotting immediately after an install/launch command can capture a
  stale previous screen — wait a couple seconds first.
- `uiautomator dump` **does not work for Flutter's own content** — Flutter
  renders via Skia canvas, so the accessibility tree only exposes host-OS
  chrome, never in-app widget text/bounds. Use screenshot + scaled tap
  coordinates instead (device is natively 1080×2400; downscale for viewing,
  multiply any tap coordinate read off a downscaled image by the same factor
  to get back to real device coordinates).
- `adb shell <cmd> > file` (and `run-as ... cat ... > file`) **corrupts binary
  output** (CRLF translation) — always use `adb exec-out` for anything binary
  (screenshots, pulled PDFs/xlsx).
- Git Bash mangles device-side absolute paths (`/sdcard/...` gets
  reinterpreted as a Windows path) — prefix with an extra slash
  (`//sdcard/...`) to make MSYS skip the conversion for that one argument.
  Don't set `MSYS_NO_PATHCONV=1` globally — that breaks the *local*
  destination path instead.

---

## 7. Design system

The web app has a bespoke design system (glassmorphism, Inter font, gradient
buttons, custom motion); the mobile app was ported to match it in Phase 2.

**The one real engineering constraint**: Flutter's `BackdropFilter` (real
blur) forces a `saveLayer` + blur pass per widget per frame — using it on
every card in a fast-scrolling list would reintroduce exactly the jank this
native app exists to eliminate. Resolved by using real blur
(`GlassSurface` widget) only on static chrome (bottom sheets, dialogs), and a
no-blur "glass look" (translucent fill + hairline border + soft shadow) on
anything that scrolls — achieved with **one line changed in `theme.dart`**
(`cardTheme.color`) rather than touching every `Card()` call site, since the
scaffold background is a flat color and a translucent fill on top of a flat
color already looks like true glass with zero blur cost.

**Design tokens** (`lib/core/theme.dart`): `AppColors` (brand `#FF6B00`/
`#A04100`, light/dark surface variants, status colors), `AppRadii` (16px
input/button, 24px card/modal, 999 pill — matching the web's rem scale),
`AppTheme.of(context)` (brightness-aware token bundle), `AppText` (the web's
type scale as named `TextStyle` helpers). Inter cascades app-wide via
`ThemeData(fontFamily: 'Inter')`, so most raw `TextStyle()` calls picked it
up with zero per-screen changes.

**Shared widgets** (`lib/widgets/`): `glass.dart` (`SoftSurface`,
`GlassSurface`, `glassBarrier()`), `buttons.dart` (`GradientButton`,
`GradientFab`, `SecondaryButton`, `GhostButton`), `cards.dart` (`StatCard`),
`badges.dart` (`Pill`, underpinning `chips.dart`'s `StatusChip`/
`PriorityChip`/`BookingChip`), `empty_state.dart` (`AppEmptyState`),
`motion.dart` (`FadeSlideIn`, `FadeSlidePageRoute`, `AppSpinner`).

Buttons with **dynamic semantic colors** (attendance clock-in/out
green-vs-red, ticket approve/deny) are deliberately left as plain
`ElevatedButton` rather than forced into the brand-gradient `GradientButton`
— intentional, not an oversight, if you see one and are tempted to "fix" it.

**Explicitly not replicated** (scoped out earlier, still true): the web's
decorative-only animations — a spinning conic-gradient border on "Hot Today
AI" cards, a pulsing badge glow, an AI shimmer loading bar. Core motion
(fade/slide entrances, transitions) is done; those specific flourishes are
not, if exact parity there is ever wanted.

Font: Inter TTF weights 400/500/600/700 bundled locally
(`mobile/assets/fonts/`, OFL licensed) rather than the `google_fonts`
package, specifically so the app works fully offline for agents in
low-connectivity areas.

---

## 8. Changelog since the last parity audit (17 Jul 2026 → 14 Sep 2026)

`MOBILE_PARITY_AUDIT.md` was last updated 17 Jul. These are the mobile-facing
changes since then, oldest first, so the next session isn't rediscovering any
of this as "new" information or, worse, as an unexplained current bug:

- Fixed a permanently-blank Support Access log under Settings → Security.
- Gradient adaptive app icon (previously looked flat orange — Android 8+
  renders the adaptive icon, so a gradient baked into the flat source PNG
  never showed), a real launch/splash screen (was a bare system-colored
  rectangle — `LaunchTheme` was setting `android:windowBackground` twice and
  the second declaration silently won), skeleton loading placeholders instead
  of a spinner on first load, narrower drawer.
- Fixed clipped Attendance tabs; moved the floating Artha AI bubble to
  bottom-right (was overlapping other UI).
- Fixed a "Lead not found" error calling project leads via EnableX.
- Renamed the Automation tab to "Integrations" to match the web app.
- Fixed a bug where marking a lead "Not Interested" permanently skip-updated
  and could never prompt again; later fully reworked (see below) so
  "Not Interested" no longer silently moves a lead to Dump — it now stays in
  the list with the status the agent actually gave it, matching how the web
  app already treated that status.
- WhatsApp personal/business number choice + AI-drafted message, matching web.
- A manual "Check for Updates" action.
- Android bundle (AAB) build was broken by ABI splits — fixed.
- Removed the unused microphone permission from the manifest; linked the
  privacy policy from in-app.
- Removed a dead in-app-purchase link; fixed release **bundles** (AAB, not
  just APK) refusing to debug-sign.
- Removed the unused email-OTP login path entirely.
- Fixed signup, OTP login, and the public contact form all rejecting every
  submission (shared root cause across those three).
- Signing in with Google no longer silently creates a duplicate account if
  one already exists under that email.
- Account deletion is now reachable from all four places the web app offers
  it.
- People can flag/report something the Artha AI assistant says.
- **Mobile self-serve signup shipped** — same four steps as the web signup
  flow, sharing one Google mark component with the login screen. (This closes
  the "no signup screen" gap the previous version of this doc listed as open
  — don't rediscover it.)
- A public **Download App** page (`frontend/src/pages/DownloadApp.jsx`,
  `arthaleads.com/download-app`) was added, reading `GET /api/public/app-version`
  and rendering the `download` block from `appRelease.js` — this is the
  "new install" path described in §1, separate from the in-app update prompt.
- The two-build system in `appRelease.js` (field-update `build` vs.
  new-download `download.build` moving independently) was introduced here —
  before this, there was only one build number and no way to ship a finished
  build to new users without also interrupting everyone already on the app.
- Builds 28 and 29 shipped through that system; the versionCode-2000-offset
  requirement (§1) was rediscovered and permanently documented in
  `pubspec.yaml`'s own comment block at this point, specifically so it
  wouldn't need rediscovering a third time.
- **Artha AI assistant became screen-aware** — it now knows which screen the
  user opened it from (`lib/core/copilot_pages.dart` feeds per-screen
  context), and where it can make a change directly, it now offers to do
  so rather than just explaining where the button is. Also stopped
  narrating the steps it's about to take before taking them, and a bug where
  the model proposed actions that weren't actually executable was fixed.
- "Not Interested" reworked as described above — an answer, not a
  disappearance. Notes can now be edited and deleted. The assistant shows
  typing-indicator dots while generating a response.
- Complete call recordings are now stored, and a lead can have multiple
  calls associated with it (Vistrow Voice integration work — backend-shared
  with, but not exclusive to, mobile).

If continuing parity work, treat the audit doc's per-row status as a starting
hypothesis to re-verify on-device, not settled fact — several rows almost
certainly moved given the above.

---

## 8b. Concrete gaps found — 14 Sep 2026, verified against code

`MOBILE_PARITY_AUDIT.md`'s table is too broad to act on directly (its own
remaining-work notes read like "audit everything" for most rows). Rather than
repeat that, this is a **short, specific, code-verified list** — every line
below was confirmed by reading the actual Flutter source and comparing it to
the current backend/web behavior, not inferred from the table. Two of these
exist because the **same web session that rewrote this doc** also shipped
real backend/web changes earlier the same day — so they're not old parity
debt, they're same-day drift, and whoever reads this next should know that
distinction. This is not a full re-audit of the whole app — it's the areas
that mattered enough to check deeply in the time available (Inbox/Conversations
and Leads); Pipeline, Follow Ups, Calls, Attendance, and Tasks were only
sanity-checked by file size (all at or above the web page's own line count,
which is a weak but real signal of maturity — none of them got an actual
field-by-field diff).

**Conversations / Inbox** (`mobile/lib/screens/inbox/`):

1. **The exact stale-name bug the web app had until today, still present on
   mobile.** `inbox_screen.dart` and `conversation_screen.dart` both display
   `c['contactName']` — a snapshot taken when the WhatsApp thread was
   created, which never updates again — instead of preferring the linked
   lead's live, editable name (`c['leadId']['name']`). The web fix (today,
   `frontend/src/pages/Inbox.jsx`'s `displayName()` helper:
   `conv?.leadId?.name || conv?.contactName || conv?.contactPhone`) has not
   been ported. Same root cause as the original bug report that started this:
   a WhatsApp thread showing "Prophunt LLP" while the actual lead was named
   "Sandeep." Fix is small — mirror that one helper function into
   `inbox_screen.dart`'s list-tile builder and into
   `conversation_screen.dart`'s header, same as web did.
2. **No AI Agent management screen exists on mobile at all** — not the old
   single-assistant "Agent Studio," and not today's new multi-agent system
   (`frontend/src/pages/conversations/AgentsPage.jsx` +
   `AgentBuilder.jsx`, backend `WaAgent` model). Confirmed via `grep` across
   `mobile/lib/` for `botName`/`botEnabled`/`Agent Studio`/anything
   `whatsapp/agents`-shaped — zero hits. This was already a gap before today
   (Agent Studio never had a mobile screen either); today's web changes just
   made the gap bigger by adding a whole CRUD surface (create/pause/delete/
   test multiple named assistants) that has no mobile equivalent whatsoever.
   Whether this needs a mobile screen is a product call, not a bug — flagging
   it as a known gap either way.
3. **No search box** in the mobile Inbox list. Mobile already does proper
   server-side pagination (`page`/`limit`, infinite scroll — actually a more
   correct pattern than web's original flat `limit=50` "load more," which
   was itself only fixed today) but there's no way to search conversations by
   name/phone at all. Backend already supports `?search=` (extended today to
   match the linked lead's live name too, not just the stale `contactName` —
   same fix as #1, server-side). Wiring a search field into
   `inbox_screen.dart`'s existing filter-tab row is straightforward — the API
   contract is already there.
4. No assignment/ownership shown per conversation (web added an "Assign to
   me" control today; mobile shows nothing about who owns a thread).

**Leads** (`mobile/lib/screens/leads/`):

5. **No WhatsApp marketing-consent field anywhere** — not on
   `lead_detail_sheet.dart`, not on `lead_form.dart`. This is the
   `whatsappConsent` status (`granted`/`denied`/`unknown`) shipped on web
   today, including a bulk "Set WhatsApp consent" action on the Leads page
   toolbar (`PATCH /leads/bulk-consent`, admin/manager only). Mobile's own
   bulk-action set (`_bulkAssign`/`_bulkStatus`/`_bulkTransfer` in
   `leads_screen.dart`) has no consent equivalent, and there's nowhere to
   view or set a single lead's consent status either. Same-day gap, not old
   debt — this feature didn't exist on web until earlier today.
6. **No saved filters** — confirmed absent from `lead_filters.dart`; matches
   what the audit table already flagged, just narrowing "audit saved
   filters" down to "this doesn't exist, build it if wanted."
7. Search, bulk assign/status/transfer, and source-aware filtering **do**
   already exist and look solid on a code read — the audit table's blanket
   "Partial" for Leads undersells how much of it is actually done. Worth a
   real on-device pass before assuming anything else here is broken; I did
   not find anything else wrong by reading the code.

**Not checked at this depth** (file-size parity only, no field diff):
Pipeline (575 vs. web's 292 lines), Follow Ups (548 vs. 620), Calls (855+873
vs. 921), Attendance (453+1404 vs. 926), Tasks (958 vs. 596). All are at or
above the web page's own size, which weakly suggests reasonable completeness,
but none of that was verified line-by-line the way Inbox and Leads were. If
there's a specific bug report for any of these, chase that directly rather
than re-deriving it from a diff — it'll be faster and more reliable.

---

## 9. Demo / test data

A demo org was seeded through the real web UI (CSV import, real form
submissions — never raw API calls, since this is shared production
infrastructure) to prove every screen renders real data: "Arthaleads Demo"
org, 3 team members, 23 leads across every source/status/priority, 3 projects
with 15 project-leads, 4 tasks, 2 developer profiles, 2 bookings, 2 invoices.
This is a **real org in the production database**, not an isolated sandbox —
treat its data accordingly. Ask the repo/project owner for current demo
credentials rather than assuming any specific account still has the same
password.

---

## 10. Known gaps / open items

1. **CI's signing key doesn't match what's ever shipped** (§1) — releases
   must be built locally until `MOBILE_KEYSTORE_BASE64` is replaced with the
   real key. This is the single highest-leverage fix available if mobile CI
   is meant to become the actual release pipeline.
2. **The team is on build 24; the repo/download page is on build 29** — five
   builds' worth of fixes exist that nobody with the app already installed
   has been prompted to take. Whether to push that now is a product decision,
   not a technical blocker — the mechanism (§1's "raise the top-level
   `build` field") is ready whenever that's wanted.
3. **No iOS build** has been attempted or tested — Android only.
4. **Decorative-only web animations** not replicated (spinning conic-gradient
   border, pulsing badge glow, AI shimmer bar) — see §7, scoped out
   deliberately, not forgotten.
5. `MOBILE_PARITY_AUDIT.md`'s per-feature ledger is a 17 Jul snapshot and
   needs a fresh on-device pass before being trusted row-by-row (§8 lists
   what's changed since, but that's a changelog, not a re-audit). **§8b has a
   short, code-verified list of specific gaps for Inbox and Leads** — start
   there instead of the audit table if you want something immediately
   actionable rather than another broad re-audit.
6. Mobile Inbox shows the stale `contactName` snapshot instead of the linked
   lead's live name — same bug the web app had until today (§8b #1). Small,
   well-understood fix.
7. No AI Agent management on mobile at all, old single-assistant or new
   multi-agent — a real gap, but possibly a deliberate one (agent config is
   plausibly an admin/desktop task); needs a product call, not just a build
   (§8b #2).
8. No WhatsApp consent field/bulk-action on mobile Leads — shipped on web
   the same day this doc was last touched, so mobile was never going to have
   it yet (§8b #5).
9. `flutter pub outdated` currently reports 90 packages with newer versions
   available than the pinned constraints allow — none are blocking anything
   today (`flutter analyze` is clean), but worth a deliberate look before it
   becomes a security-patch backlog.

Nothing above is a currently-broken build: `flutter analyze` returns
**"No issues found!"** and `git status` on `mobile/` is clean as of this
writing — whatever's next is new work, not unfinished/half-committed work.

---

## 11. Backend bugs found via mobile/demo-data work (already fixed, noted so they aren't rediscovered)

1. A misconfigured `RECAPTCHA_SECRET_KEY` (or Railway being unable to reach
   Google's siteverify endpoint) was rejecting every production login and
   signup at one point — mitigated in `backend/controllers/authController.js`.
   Confirm current Railway config is still correct before assuming this is
   permanently closed; it was a config issue, not a code issue, so it can
   silently regress if the env var changes.
2. Google-only accounts had no way to ever set a password (`backend/services/authService.js`,
   `updateProfile`) — the change-password flow demanded a `currentPassword`
   a Google-signup account can never have. Fixed by treating "no password
   yet" as "set" rather than "change."

---

## 12. Git workflow reminder

Per `CLAUDE.md` at the repo root: **always commit and push directly to
`main`** — no feature branches unless explicitly asked. Railway (backend) and
Vercel (frontend) auto-deploy on push to `main`. The mobile app has **no
auto-deploy** — CI builds and analyzes on every push touching `mobile/**`,
but shipping a real release is the manual local-build-and-GitHub-Release
process in §1, not something that happens automatically on push.
