# Arthaleads Mobile App — Project Handoff

This document is a complete history and reference for the Flutter mobile app at `mobile/`, written for an agent or developer picking this project up with zero prior context. It covers why the app exists, how it was built (plan → production), its full structure, the design system, known issues, and exactly how to build/run/verify it.

---

## 1. Why this app exists

Arthaleads is a real-estate CRM (web app at `frontend/` + `backend/`, live at arthaleads.com). The organization's field agents were using an older, laggy, crash-prone web-based mobile experience. This native Flutter app (`mobile/`) was built from scratch to **replace that old system** with something fast and native, while reaching **full feature parity** with the web app — same data, same workflows, eventually the same visual design.

The work happened in two large phases, across many sessions:

1. **Phase 1 — Feature parity** (Tasks #1–15 below): build every screen so the mobile app does everything the web app does.
2. **Phase 2 — Visual parity** (Tasks #25–33 below): port the web app's actual design system (glassmorphism, Inter typography, gradient buttons, motion) into Flutter, once functional parity was done and proven with seeded demo data.

Everything was implemented screen-by-screen, verified on a real physical Android device after each change (not just `flutter analyze`), and committed/pushed straight to `main` per this repo's standing git policy (see `CLAUDE.md` at repo root — **no feature branches**, commit and push directly to `main`).

---

## 2. Tech stack

- **Framework**: Flutter (Dart), native Android target (`com.arthaleads.crm`). No iOS build has been set up/tested.
- **State**: `provider` package — a single `ChangeNotifierProvider<AuthState>` at the app root (`main.dart`); screens otherwise manage their own local state (no global state management library).
- **HTTP**: `dio`, wrapped in a singleton `ApiClient` (see §5).
- **Auth**: JWT bearer token in `flutter_secure_storage` (Android Keystore-backed via `encryptedSharedPreferences`).
- **Push notifications**: `firebase_core` + `firebase_messaging` + `flutter_local_notifications` (see `lib/core/push_service.dart`).
- **Other key packages**: `google_sign_in` (Google OAuth login), `geolocator` + `image_picker` (attendance selfie+GPS), `just_audio` (call recording playback), `pdf` + `printing` (invoice PDF generation/share), `csv` + `file_picker` (leads import/export), `share_plus` (native share sheet), `intl` (date formatting), `url_launcher` (tel:/wa.me/ links).
- **Backend**: Node/Express (`backend/`) + MongoDB, shared 1:1 with the web app — the mobile app is just another client of the same REST API (`https://api.arthaleads.com/api` in production).

---

## 3. Directory structure

```
mobile/
├── android/                      # native Android project (local.properties has SDK paths — see §9)
├── assets/
│   ├── fonts/                    # Inter TTF weights 400/500/600/700, bundled locally (offline-safe)
│   ├── icon/                     # app launcher icon
│   └── images/                   # ai_avatar.png (Artha AI chat FAB avatar), etc.
├── lib/
│   ├── main.dart                 # app entry point, MaterialApp, auth gate, org-blocked screen
│   ├── core/
│   │   ├── api_client.dart       # Dio singleton — base URL, auth header injection, 401/403 handling
│   │   ├── auth_state.dart       # ChangeNotifier — login/logout/session restore, user/org/role
│   │   ├── constants.dart        # option lists + color-mapping helpers mirrored from frontend/src/utils/constants.js
│   │   ├── push_service.dart     # Firebase Cloud Messaging wiring, deep-link routing on notification tap
│   │   └── theme.dart            # ★ the whole design system — see §7
│   ├── screens/                  # one folder per feature module — see §6
│   └── widgets/                  # shared design-system widgets — see §7
├── pubspec.yaml                  # dependencies + the `fonts:` block for Inter
```

Each screen folder generally has one `..._screen.dart` (the list/main view) plus sibling files for forms, detail sheets, and filters where the feature needs them (e.g. `leads/` has `leads_screen.dart`, `lead_form.dart`, `lead_detail_sheet.dart`, `lead_filters.dart`).

---

## 4. Navigation shell

`lib/screens/shell.dart` — a `Drawer`-based navigation shell mirroring the web sidebar. Holds the list of nav items (`_NavItem`, with an `adminOnly` flag for role-gated screens), and a persistent floating "Artha AI" chat assistant button (`_ArthaFab`) that opens `help/artha_chat_screen.dart` from any tab.

`main.dart` → `_AuthGate` decides between `LoginScreen` and `Shell` based on `AuthState`, and shows a dedicated "trial expired / org inactive" screen when the backend returns those specific 403 reasons.

---

## 5. API client & auth (`lib/core/api_client.dart`, `lib/core/auth_state.dart`)

- **Base URL**: `https://api.arthaleads.com/api` by default, overridable via `--dart-define=API_BASE_URL=...` at build time.
- **Every request** carries `X-Mobile-App-Secret` (a fixed shared secret matching the backend's `MOBILE_APP_SECRET` env var) — this lets the backend recognize genuine mobile-app traffic and **skip the browser-only reCAPTCHA check** on login, since a native app can't run Google's reCAPTCHA widget.
- **Timeouts**: 45s connect/receive — Railway cold starts can take 20-30s, matched to the web app's own retry budget.
- **401 handling**: clears the stored token and fires `onSessionExpired` — except on auth endpoints themselves (login/signup/otp-verify/google/phone-login), to avoid an infinite loop during login failures.
- **403 handling**: `ORGANISATION_INACTIVE` / `TRIAL_EXPIRED` messages are surfaced as a typed `onOrgBlocked` callback, driving the dedicated blocked-screen in `main.dart`.
- Login supports: email/password, Google Sign-In (`google_sign_in` package → backend `/auth/google`), and OTP-based phone login.

**Known gap, not yet closed**: the mobile app itself has **no signup screen** — accounts are created via the web app only. Discovered during this session's demo-data work; see §11.

---

## 6. Feature modules (Phase 1 — built in this priority order)

Each module mirrors a `frontend/src/pages/*.jsx` page 1:1 in data and behavior. Built and verified on-device in this order:

1. **Leads** (`screens/leads/`) — unified list (plain + project leads via `/leads/unified`), infinite scroll, search, filters (bottom sheet), bulk select (assign/status/transfer/delete-to-dump), inline detail sheet with notes/AI-drafted WhatsApp message/call history/status picker, full add/edit form.
2. **Calls** (`screens/calls/`) — call history per lead, AI call summary, recording playback (`just_audio`), notes, follow-up scheduling, EnableX bridge-call initiation.
3. **Invoices** (`screens/invoices/`) — list with stats/status filter, branded PDF generation (`invoice_pdf.dart`) and native share.
4. **Attendance** (`screens/attendance/`) — clock in/out with camera selfie + GPS capture (org-configurable requirement), shift settings (admin), team-today view, history/export.
5. **Automation** (`screens/automation/`) — lead-source connections (Google/WhatsApp/Website/Custom — Facebook still requires the browser OAuth round-trip on web), Facebook token health, campaign routing rules (`routing_rules_screen.dart`).
6. **Projects** (`screens/projects/`) — project CRUD, Info tab, project-scoped Leads tab (with its own CSV import), Prospective tab (auto-populated by "Interested"/"Site Visit Booked" status).
7. **Dashboard / Performance** (`screens/dashboard/`, `screens/performance/`) — stat cards, status/source breakdown bars, hot-leads and follow-ups-due panels, admin-only monthly goal + team leaderboard + activity feed; Performance screen adds date-range/member filters and a dual Main-Pipeline/Project-Pipeline breakdown per agent.
8. **Inbox / Conversations** (`screens/inbox/`) — WhatsApp conversation list (live-polled), bot toggle, resolve/reopen, message thread with read receipts.
9. **Bookings** (`screens/bookings/`) — full brokerage calculation form (adjustment, FOS/EOI incentives, manual override, GST split) with live preview, invoice generation.
10. **Dump Leads** (`screens/dump/`) — archived/lost leads, bulk select, CSV export/import, restore/permanent-delete (branches on plain-lead vs. project-lead endpoints).
11. **Team / Settings** (`screens/team/`, `screens/settings/`) — team member CRUD (admin-only, strictly `role === "admin"` not manager), avatar upload, org billing/GST/bank details, auto-assignment toggle, security/support-access log.
12. **Referrals** (`screens/referrals/`) — client-derived referral code/link, native share.
13. **Help & Support** (`screens/help/`) — Getting Started guide, FAQs, support tickets with attachments (≤600KB, ≤3 files), plus the "Artha AI" chat assistant (`artha_chat_screen.dart`).
14. **Tasks** (`screens/tasks/`) — clickable summary cards (All/Today/Upcoming/Overdue/Completed), lead/project linking (debounced lead search + project dropdown), completion notes.
15. **Pipeline** (`screens/pipeline/`) — horizontal kanban by status, tap-to-move-stage bottom sheet, live 30s polling.

Followups (`screens/followups/`) also exists as its own lightweight screen.

---

## 7. Design system (Phase 2 — the visual parity work)

### Why

Once every screen worked, the ask was to make the mobile app **look** like the web app too — the web app has a bespoke design system (glassmorphism, Inter font, gradient buttons, custom motion) that the mobile app didn't have (it was using stock Material defaults: Roboto font, flat opaque cards, plain `ElevatedButton`, zero animation).

### The one real constraint: BackdropFilter performance

The web's glassmorphism uses real CSS `backdrop-filter: blur(...)`. Flutter's equivalent (`BackdropFilter` + `ImageFilter.blur`) forces a `saveLayer` + blur pass **per widget per frame** — applying it to every card in a fast-scrolling `ListView` (Leads, Tasks, etc.) would very plausibly reintroduce the exact jank this native app was built to eliminate. This was surfaced to the user explicitly and they chose the performance-safe option:

- **Real blur** (`GlassSurface` widget) — only on static, non-scrolling chrome: bottom sheets, dialogs.
- **"Glass look" without blur** (`SoftSurface` widget, and — the higher-leverage move — the global `CardThemeData.color`) — translucent fill + hairline border + soft shadow, used everywhere that scrolls.

**Key insight that saved a huge amount of per-screen work**: the mobile scaffold background is a flat single color (unlike the web's radial-gradient canvas), so a *translucent* `Card` fill rendered on top of it just looks like a tinted solid — visually equivalent to true glass, with zero blur cost. So instead of manually swapping `Card()` → `SoftSurface()` across ~20 files, **one line changed in `theme.dart`** (`cardTheme.color: t.surfaceHigh` instead of `t.surfaceSolid`) gave every `Card()` in the entire app the glass look for free. The same trick was applied to `bottomSheetTheme`/`dialogTheme`/`popupMenuTheme` so every existing `showModalBottomSheet`/`showDialog` call site also picked up the right shape/radius/color with no per-call-site changes.

### Design tokens (`lib/core/theme.dart`)

Colors, radii, and shadows were transcribed **literally** from the web's `frontend/src/styles.css` / `tailwind.config.js` (both light and dark mode):

- `AppColors` — brand (`primary` `#FF6B00`, `primaryDeep` `#A04100`), light/dark surface variants (`surface`, `surfaceSolid`, `surfaceLow`, `surfaceHigh`), text/border tokens, status colors.
- `AppRadii` — `input`/`button` 16px, `card` 24px, `modal` 24px, `modalLarge` 32px, `pill` 999 — matching the web's rem-based scale exactly.
- `AppTheme` — a per-brightness bundle (`AppTheme.of(context)`) so widgets read `.surfaceHigh`/`.border`/`.shadow` etc. without branching on `Brightness` everywhere.
- `AppText` — the web's ad-hoc type scale (kicker labels, stat values, table headers) as named `TextStyle` helpers.
- `buildTheme(Brightness)` — wires all of the above into `ThemeData`: **Inter font cascades app-wide** via `ThemeData(fontFamily: 'Inter')` + `Typography(...).apply(fontFamily: 'Inter')`, so most existing raw `TextStyle()` calls across the app picked up Inter automatically with zero per-screen touch (Flutter merges an unset `fontFamily` from the ambient `DefaultTextStyle`).
- One Flutter SDK limitation hit and worked around: `BoxShadow` on this SDK version has no `inset` parameter, so the web's subtle inner top-highlight (the second shadow in `--app-shadow`) was dropped rather than faked.

### Shared widget library (`lib/widgets/`)

| File | Contents |
|---|---|
| `glass.dart` | `SoftSurface` (no-blur glass-look), `GlassSurface` (real `BackdropFilter` blur, for bottom sheets/dialogs), `glassBarrier()` (frosted modal backdrop helper) |
| `buttons.dart` | `GradientButton` (primary CTA — gradient fill, glossy top highlight, colored glow shadow, press-scale feedback), `GradientFab` (same gradient treatment for FABs, icon-only or extended-with-label), `SecondaryButton`, `GhostButton` |
| `cards.dart` | `StatCard` (icon chip + big value + label — replaced every screen's private `_stat`/`_statTile` builder) |
| `badges.dart` | `Pill` (single reusable colored badge — underpins `chips.dart`'s `StatusChip`/`PriorityChip`/`BookingChip`) |
| `empty_state.dart` | `AppEmptyState` ("No X yet" icon+title+subtitle+action pattern) |
| `motion.dart` | `FadeSlideIn` (staggered entrance wrapper — opacity+translateY, mirrors the web's `fadeSlideIn` keyframe), `FadeSlidePageRoute` (custom nav transition), `AppSpinner` (loading indicator) |

`chips.dart` (pre-existing) was refactored to delegate to the new `Pill` widget instead of its own private `_pill()` helper — no call sites elsewhere needed to change.

### Font

Inter TTF weights 400/500/600/700 were downloaded from the official `rsms/inter` GitHub release and bundled as local assets (`mobile/assets/fonts/`, `Inter-LICENSE.txt` included — OFL licensed) — **not** the `google_fonts` package, specifically to keep the app fully offline-capable (no first-launch download dependency for agents in low-connectivity areas).

### Rollout

Applied screen-by-screen in the same priority order as Phase 1, in 5 batches, each batch: implement → `flutter analyze` (clean) → `flutter build apk --debug` (succeeds) → commit → push to `main`:

1. Foundation (theme + widget library) + Dashboard/Performance + Leads/Pipeline
2. Calls/Invoices/Attendance
3. Automation/Projects/Inbox
4. Bookings/Dump Leads/Team/Settings
5. Referrals/Help/Tasks

Per-screen pattern applied (not literally every line, but consistently): swap primary `ElevatedButton` → `GradientButton`/`GradientFab`, swap ad-hoc loading `CircularProgressIndicator` → `AppSpinner`, wrap list-builder items in `FadeSlideIn` with a small staggered `Duration` per index (capped via `i % 12` so long lists don't get absurd tail delays). Buttons with **dynamic semantic colors** (e.g. attendance clock-in/out green-vs-red, ticket approve/deny) were deliberately **left as plain `ElevatedButton`** rather than forced into the brand-gradient `GradientButton` — that distinction is intentional, not an oversight.

Verified visually on a real device at the end (see screenshots discussion in session — Dashboard, Leads list, Tasks + colored summary cards, Task form's `GradientButton`) — all confirmed rendering correctly: Inter font, glass-look cards, colored pills, gradient buttons with glossy highlight and glow shadow.

---

## 8. Bugs found and fixed along the way (backend, not mobile-specific, but discovered via mobile/demo-data work)

These are already committed and pushed — noted here so a new agent doesn't rediscover them as "current problems":

1. **Login reCAPTCHA outage** (`backend/controllers/authController.js`) — a misconfigured `RECAPTCHA_SECRET_KEY` (or Railway's inability to reach Google's siteverify endpoint) was rejecting every production login. Mitigated at the time by adjusting the reCAPTCHA check in the `login` handler. ⚠️ **Follow-up needed**: confirm the current `RECAPTCHA_SECRET_KEY` config on Railway is correct and that the auth-hardening check on this endpoint is in its intended state before treating this as closed — coordinate with the team/repo owner on current status rather than assuming from this doc alone.
2. **Signup reCAPTCHA outage** — same root cause, same fix pattern, applied to the `signup` handler too (discovered when trying to sign up a fresh demo org and hitting the identical "Verification failed" error). Same follow-up applies.
3. **Google-only accounts had no way to ever set a password** (`backend/services/authService.js`, `updateProfile`) — the change-password flow always demanded a `currentPassword`, which a Google-signup account can never have (`comparePassword` always returns false when there's no password hash). Fixed by skipping the current-password check when the account has no password yet — i.e. treating it as "set" rather than "change." This is what unblocked logging into the demo org with a real password for testing.

---

## 9. Build & run

**Flutter SDK location** (this machine): `E:\dev\flutter` — not on the default shell `PATH` in a fresh terminal; either add it to `PATH` or always invoke via the full path `E:\dev\flutter\bin\flutter`.
**Android SDK location**: `E:\dev\android-sdk` (also confirmed via `mobile/android/local.properties`, which has `sdk.dir=E:\\dev\\android-sdk` and `flutter.sdk=E:\\dev\\flutter` already set). Building an APK requires `ANDROID_HOME`/`ANDROID_SDK_ROOT` set in the shell environment — `flutter analyze` works without it, but `flutter build apk` does not.

```bash
# from mobile/
"/e/dev/flutter/bin/flutter" pub get
"/e/dev/flutter/bin/flutter" analyze
export ANDROID_HOME="E:\dev\android-sdk"
"/e/dev/flutter/bin/flutter" build apk --debug
```

**On-device verification workflow** (used throughout both phases):

```bash
"/e/dev/android-sdk/platform-tools/adb.exe" devices                     # confirm device connected
"/e/dev/android-sdk/platform-tools/adb.exe" install -r build/app/outputs/flutter-apk/app-debug.apk
"/e/dev/android-sdk/platform-tools/adb.exe" shell monkey -p com.arthaleads.crm -c android.intent.category.LAUNCHER 1
"/e/dev/android-sdk/platform-tools/adb.exe" exec-out screencap -p > screenshot.png   # visual check
"/e/dev/android-sdk/platform-tools/adb.exe" shell uiautomator dump //sdcard/ui.xml  # then adb pull, for exact tap coordinates
```

**Lessons learned, worth repeating to save time**:
- Screenshotting immediately after issuing a background `adb install`/app-launch command can capture a **stale** previous build/screen — wait a couple of seconds (or for an explicit completion signal) before capturing.
- Screenshot-based pixel-coordinate guessing for taps is unreliable; `uiautomator dump` + grep for `content-desc`/`bounds` → compute center coordinate is far more reliable.
- If `adb devices` shows the device as `offline`/`unauthorized`, try `adb kill-server && adb start-server`; if that doesn't help, the physical device needs the "Allow USB debugging" prompt re-confirmed (ask the user to check/replug).
- Note the `//sdcard/...` (double-slash) path escaping needed for `adb shell`/`adb pull` from this Git-Bash environment — a single `/sdcard/...` gets mistranslated to a Windows path by Git Bash's path-conversion.

---

## 10. Demo / test data

A demo org was seeded (through the actual web UI — CSV import for leads/project-leads, real form submissions for everything else — **never raw API calls**, since the backend is shared live infrastructure) to prove every screen renders real data:

- **Org**: "Arthaleads Demo" (actually the org owner's own pre-existing personal org, not a separate brand-new signup — originally Google-only login, a password was set via the bugfix in §8.3. Ask the repo/project owner for current demo credentials rather than assuming any specific account.)
- 3 team members (1 admin + 2 agents), 23 leads across every source/status/priority, 3 projects with 15 project-leads, 4 tasks (today/overdue/completed states), 2 developer profiles, 2 bookings, 2 invoices (different statuses).
- This data is **real** in the sense that it lives in the production database — it's a legitimate org, just filled with placeholder names/numbers for demo purposes. Treat it accordingly (don't assume it's disposable/isolated from other production data the way a true sandbox would be).

---

## 11. Known gaps / outstanding follow-ups for the next agent

1. **Verify the login/signup auth-hardening (reCAPTCHA) config** on Railway (see §8.1) — confirm current status with the team before assuming either endpoint is fully hardened.
2. **Mobile app has no signup screen** — only login. If self-serve mobile signup is ever wanted, it needs building from scratch (web's signup form + the same reCAPTCHA/mobile-secret considerations as login).
3. **Design system rollout used "core motion only"** — the web's bespoke decorative animations (a spinning conic-gradient border on "Hot Today AI" cards, a pulsing badge glow, an AI shimmer loading bar) were explicitly **not** replicated, per an earlier scoping decision with the user. If exact visual parity down to those specific effects is wanted later, that's unbuilt.
4. **No iOS build** has been attempted/tested — Android only so far.
5. Minor pre-existing lint infos remain (unrelated to any of this work, never addressed): `attendance_screen.dart:182` (`use_null_aware_elements`), `project_detail_screen.dart:144,148` (`unnecessary_underscores`), `project_form.dart:34` (`prefer_final_fields`).

---

## 12. Git workflow reminder

Per `CLAUDE.md` at the repo root: **always commit and push directly to `main`** — no feature branches unless explicitly asked. Railway (backend) and Vercel (frontend) auto-deploy on push to `main`. The mobile app has no auto-deploy (it's a local APK build + manual install for now, not published to Play Store).
