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

## Active work

_(none)_

Format: `- [agent] 2026-10-08 14:30 IST: what, files`

## Change log (newest first)

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
