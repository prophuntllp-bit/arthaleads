# Agent bridge (Claude Code <-> Codex)

Two AI agents work in this repo, plus the owner. This file is how we avoid
overwriting or contradicting each other. It lives in git, so every checkout
(local, Codex cloud) sees the same copy.

## Rules for every agent, every time

1. **Before changing anything**, run `git pull` and read this whole file, then
   `git log --oneline -15`. If an entry under "Active work" touches the same
   files or feature you were about to change, stop and tell the owner instead
   of editing.
2. **Before starting a task that edits files**, add a line under "Active work"
   (agent, date/time IST, what, which files) and push it.
3. **After finishing**, move that line to "Change log" with the commit hash and
   one or two lines on what changed and what to watch for. Push it with your
   work (same commit is fine).
4. Never rewrite or delete another agent's entries. Add a correction below
   theirs.
5. Small commits straight to `main` (see CLAUDE.md). Pull again before pushing;
   if the push is rejected, rebase, re-read this file, and resolve by merging
   both sides' intent, never by discarding the other's work.
6. Do not touch `mobile/` unless the owner says so; another session owns it
   (see `MOBILE_APP_HANDOFF.md`).
7. Dates and times are IST (Asia/Kolkata). No em dashes in customer-facing
   bot text. UI follows CLAUDE.md standards.
8. Production data: read-only scripts are fine. Anything that writes to the
   production database needs the owner's explicit yes in chat first.

## Running the app without secrets (for Codex and any agent without a .env)

Never ask the owner for, and never use, production secrets (MONGO_URI, API
keys, tokens). You do not need them. Run everything in the sandbox:

```
cd backend && npm install && npm run sandbox      # real backend on http://localhost:5000
npm --prefix frontend install && npm --prefix frontend run dev   # frontend; its default API URL is http://localhost:5000/api
```

`npm run sandbox` (`backend/scripts/sandbox.js`) starts an in-memory MongoDB,
overwrites every secret with a fake value, seeds one Enterprise org with an
admin, manager and agent, 2 projects and 12 leads, and boots the real server.
Logins (fake): `sandbox-admin@example.com`, `sandbox-manager@example.com`,
`sandbox-agent@example.com`, all with password `Sandbox#12345`.
Third-party services (WhatsApp, Meta, OpenAI, Razorpay, file storage, email) are
deliberately not connected, so calls to them fail or are skipped. Code that
talks to them must be verified with stubs or tests, not live calls.

Other checks: `npm --prefix frontend run build` must pass. `cd backend && npm
test` has 7 known failing account-deletion coverage assertions that predate
this bridge; do not chase them unless asked. Tests that need a database should
use `mongodb-memory-server` (already a dev dependency), never a real URI.

If you are blocked because a secret or variable is missing: do not stop. Use the
sandbox, stub the external call, and note in your change-log entry what could
only be verified live so Claude Code or the owner can check it on production.

## Active work

- [Codex] 2026-10-08 16:23 IST: Read-only prelaunch dashboard/marketing audit with five parallel agents; publish findings only in docs/audits/2026-10-08-launch-audit.md and log this task in AGENT_BRIDGE.md. No application code or mobile/ changes.




Format: `- [agent] 2026-10-08 14:30 IST: what, files`

## Change log (newest first)

### Claude Code, 2026-10-08 (IST), WhatsApp chat for transferred leads

- A lead moved into a project keeps its WhatsApp conversation on the archived original (`WaConversation.leadId`); the project lead only remembers `fromLeadId`. The Chat tab was hidden for every project lead. New `GET /api/projects/:id/leads/:leadId/whatsapp-messages` (in `backend/routes/projectRoutes.js`, not `leadService.js`) looks the chat up through `fromLeadId`; access is the project's (agents must be assigned to it). `frontend/src/components/LeadDetail.jsx` and the app's lead detail show the Chat tab for WhatsApp project leads that have a `fromLeadId`. **Correction, same day:** a routing rule's project copy has no `fromLeadId` by design (it is an "open copy" tied to the lead in Leads by phone, see `utils/projectCopies.js`), so following `fromLeadId` alone missed exactly those leads. The endpoint now finds the conversation by `fromLeadId` when there is one, otherwise by the lead's WhatsApp number (last ten digits), latest thread first, and the tab shows for every WhatsApp project lead. A lead with no chat shows "No WhatsApp conversation". The app needs the next release to get the tab.

### Claude Code, 2026-10-08 (IST), mobile app (owner asked for it; `mobile/` only)

- `c7a5369` + release commit: Arthaleads Mobile **1.0.11 (build 37)** published to the whole fleet (`backend/constants/appRelease.js` `android.build` 37, GitHub Release `mobile-v1.0.11-37`, universal APK, signed with the real key). The app now has: copy name and number, per-project Dump Leads (`GET /projects/:id/dumped-leads`), WhatsApp Chat tab (`GET /leads/:id/whatsapp-messages`), `ad:`/`form:` Source filter tokens, "Also in project" (`inProjects`), storage meter and 80% popup (`GET /org/storage`), plan locks, routing-rule editing (`PATCH /routing-rules/:id`), Dashboard source pills that sum to the total.
- Layout: shared `AdaptiveGrid` replaces fixed-ratio grids; text scale capped at 1.3x; lead/dump/follow-up/booking/invoice cards rebuilt like the Leads card. Tests in `mobile/test/` (not run by CI).
- Not in the app yet: the web's "Manage storage" modal (buy extra space, free up files, `/api/storage/*`) and the Meta Conversions card. Plan & Billing "Get more" opens Plan & Billing, not a purchase flow.


### Claude Code, 2026-10-08 (IST), evening

- Integrations layout reworked: quick-connect tiles 7 across on wide screens, connection cards 3 across (2 on laptops, aligned heights, footer pinned), Lead Routing and Conversion tracking side by side on wide screens. Conversion tracking inputs opt out of browser autofill (Chrome was filling the saved login into Dataset ID and token).

### Claude Code, 2026-10-08 (IST), later

- **Meta Conversions API (CRM events back to Meta).** Orgs paste a dataset ID and Conversions API token in Integrations > Conversion tracking (`frontend/src/components/MetaConversionsSection.jsx`; settings under `Organization.metaCapi`, token encrypted). `services/metaConversions.js` sends the lead arriving ("Lead"), and the stages the org ticks, for leads with a Meta lead id (`Lead.metaLeadId`, now saved by the Facebook webhook) or a WhatsApp ad click id (`campaignRef.ctwaClid`). `MetaEvent` is the log and dedupe. Hooks: `leadService.update/bulkUpdateStatus`, `utils/projectCopies.js`, Facebook webhook; a 10-minute sweep in `utils/scheduler.js` retries failures and catches other paths. Leads before 2026-10-08 have no `metaLeadId` (backfill from the "Lead ID:" note text needs the owner's yes). Not tested against real Meta; use the Send test event button with a test event code. App Review for ads_management / ads_read / business_management and the MBE allow-list are separate, with the owner.
- App layout: pages now suspend inside the layout (`App.jsx`), so the sidebar and top bar stay while a page's code loads. Dashboard order is Action Required, Performance, Admin Intelligence, Team (Agent Status and Lead Sources Health now sit at the end of Team). Integrations tiles, metric cards and connection cards have capped widths instead of stretching.

### Claude Code, 2026-10-08 (IST)

- Dashboard (`frontend/src/pages/Dashboard.jsx`): every widget's data (follow-ups, hot, stale, projects, team attendance, integrations, WhatsApp status) is fetched by the page and it shows one skeleton until all arrive, so cards no longer pop in one by one.
- **Storage packs and free-up.** Customers buy extra space in 10 GB blocks (price and terms in `STORAGE_ADDON`, `backend/constants/plans.js`): `StorageOrder` model, `services/storageOrderService.js`, `routes/storageRoutes.js` mounted at `/api/storage`, Razorpay webhook dispatch in `billingWebhookRoutes.js`. Bought blocks live in `Organization.storage.packs` with an expiry; `storageLimitBytes` counts only unexpired ones. Admins/managers can list and delete each project's photos, videos, brochure and floor plan (`GET/DELETE /api/storage/project-files`); admins can delete old recordings and attendance photos (`services/storageCleanup.js`). UI: `StorageManageModal.jsx`, opened from the sidebar `StorageCard`, the 80% popup and the Plans page.

### Claude Code, 2026-10-07 (IST), evening

- Lead routing rules can be edited: pencil on each rule in Integrations. `PATCH /api/routing-rules/:id` (`backend/routes/routingRuleRoutes.js`) now also accepts `label`, `assignTo`, `assignToProject` (null clears), org-checked. What a rule matches (source, field, value) stays fixed. Changes apply to leads arriving afterwards only. UI in `LeadRoutingSection` (`frontend/src/pages/Automation.jsx`).
- `09aecb9` New-version banner (`UpdateBanner.jsx`) shows only to signed-in users, not on marketing pages.

### Claude Code, 2026-10-07 (IST), later

- Dashboard header source pills (`frontend/src/pages/Dashboard.jsx`): now every source that is connected or has leads in the period, incl. WhatsApp (via `/whatsapp/status`) and an Other bucket for Manual, Referral, walk-in and portals. Before, only Integrations-connected sources showed.
- Sidebar `StorageCard.jsx`: always shows a compact Storage meter with an Upgrade link for admins; becomes the full card from 80%. Upgrade still goes to /plans. Buying storage packs is NOT built; the pricing and checkout are to be decided with the owner later.

### Codex, 2026-10-07 (IST)

- `136456e` Added breathing room to the landing-page hero in
  `frontend/src/pages/Landing.jsx`: more outer padding, wider desktop spacing,
  clearer copy/CTA/stat separation, and more space before the live ticker.
  Frontend build passed. `graphify update .` could not run because the
  `graphify` command is unavailable in this environment.

### Claude Code, 2026-10-07 (IST)

- `9a5c1ca` Project **Dump Leads** panel. `GET /api/projects/:id/dumped-leads`
  (paged, searchable) and `POST /api/projects/:id/dumped-leads/:leadId/restore`
  in `backend/routes/projectRoutes.js`; UI in
  `frontend/src/components/ProjectDumpLeads.jsx`, button in `ProjectDetail.jsx`.
  Agents see and restore only leads they dumped; admins and managers see all.
  Leads dumped before 2026-10-05 carry no origin project and only show in the
  main Dump Leads page.
- `a5a3378`, `39dae22`, `d3509af`, `6be24d0` WhatsApp leads that name a project
  with no ad are filed into the project the WhatsApp routing rules point at
  (`labelAdlessLead`, `routedProjectFor` in `backend/routes/whatsappRoutes.js`).
  `fileLeadInRoutedProject` (`backend/utils/routingRules.js`) now also pushes a
  "New lead in <project>" notification (`notifyProjectTeam`) and supports
  `keepUnassigned`.
- `0ff47ba`, `44248f7` **Plans and storage.**
  - Plan limits in `backend/constants/plans.js`. Starter: 2 projects, 2 GB,
    recordings 30 days. Growth: 15 GB, 90 days, WhatsApp AI agent, templates,
    campaigns. Enterprise: 100 GB, 1 year, CTWA button flow, Vistrow voice,
    custom webhook/API, Google Ads. Trial: 1 GB.
  - Gating: `planGate` in routes; runtime checks in
    `respondAsBotNow` (bot needs Growth, flow needs Enterprise) and
    `/webhook/lead` (Custom and Vistrow Voice need Enterprise).
  - Storage ledger: `StorageObject` model, `backend/utils/storageLedger.js`
    (record, forget, usage, quota check). Every upload helper in
    `backend/utils/upload.js` takes an `orgId`; pass it for any new upload path
    or the file will not be counted. `storage.put` records, `storage.remove`
    forgets.
  - Quota: blocks only project media and logo uploads at 100%. Recordings and
    selfies are never blocked; recordings expire per plan via
    `backend/services/recordingRetention.js` (daily 3 AM IST).
  - Alerts: `backend/services/storageAlerts.js` pushes and emails admins at 80%
    and 100% (once per level). Frontend: `StorageCard.jsx` (sidebar, from 80%),
    `StorageWarningPopup.jsx` (admins, once a day), storage bar on Plans page.
  - Super Admin: org page has Plan and Limits, a Storage and Usage tab (grant
    extra GB via `PATCH /api/super-admin/orgs/:id/storage`), real WhatsApp
    stats, Files column on the org list.
  - One-time `backend/scripts/backfill-storage-ledger.js` was run in production
    on 2026-10-07 (safe to re-run).
- Earlier this week (see `git log`): Lead and project-lead two-way sync and
  merge on transfer (`backend/utils/projectCopies.js`); CTWA flow gating and bot
  media/persona/agent switching; Leads source tree filter and multi-sheet Excel
  export; Dump Leads origin and restore-to-origin; light/dark switch via View
  Transitions; single copy button in Lead Details; integration pause/play.

## Known state worth knowing

- The CTWA Khopoli project is "CTWA Meta Campaign | SP- Khopoli Plots"; WhatsApp
  routing rules file ad leads there. "Shapoorji Pallonji Khopoli Plots" is the
  assistant's own project, not the routing target.
- Eight Khopoli leads (Nidhi, Sanju Muthal, Rakesh Pal, Shashikant Shah, #kmlp,
  asmabegum75782, Gangadhar mekewad, hemantkumarbhatia2) were deleted from a
  project by the team and later un-archived in Leads by mistake. Decision about
  re-archiving is pending with the owner. Do not add them back to a project.
- `test_ctwa_flow_v3.cjs` (scratch, not in repo) had 4 pre-existing failing
  assertions on baseline.
