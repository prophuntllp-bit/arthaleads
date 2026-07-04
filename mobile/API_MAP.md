# Arthaleads Mobile — API Contract Map

Base URL: `https://api.arthaleads.com/api` (override at build time with `--dart-define=API_BASE_URL=...`)
Auth: `Authorization: Bearer <token>` header. Token from `POST /auth/login` → `{ success, token, user, org }`.
All list endpoints return `{ success, leads|data, total, page, pages }` unless noted.

## Auth
- `POST /auth/login` `{ email, password }` — email or phone accepted in `email` field → `{ token, user, org }`
- `GET  /auth/me` → `{ user, org }` (session restore)
- `POST /auth/logout`
- `POST /auth/forgot-password` `{ email }`
- `POST /auth/reset-password/:token` `{ password }`
- `GET  /auth/agents` → `{ agents }` (admin/manager)
- `GET  /auth/users` → `{ users }` (admin/manager)
- `PUT  /auth/me` — profile update

## Leads (flagship)
- `GET  /leads/unified` params: search, status, source, priority, booking, projectId, assignedTo, myOnly, dateRange, from, to, followUpToday, siteFilter, page, limit
  - rows tagged `_type: "lead" | "project"`; project rows carry projectId, projectName, assignedToName
- `GET  /leads/:id`
- `POST /leads` / `PUT /leads/:id` / `PATCH /leads/:id` (followUpDate, remark1, remark2, booking, remarkNote, followUp2)
- `DELETE /leads/:id` (→ dump), `PATCH /leads/:id/restore`, `DELETE /leads/:id/permanent`
- `POST /leads/bulk-assign` `{ ids, agentId }` (admin/manager)
- `PATCH /leads/bulk-status` `{ ids, status }` (admin/manager)
- `POST /leads/bulk-transfer` `{ ids, toProjectId }` (admin/manager) — handles both plain + project leads
- `DELETE /leads/bulk` `{ ids }`
- `POST /leads/:id/transfer` `{ toProjectId }`
- `POST /leads/:id/notes` `{ text }`
- `POST /leads/:id/assign` `{ agentId }`
- `GET  /leads/analytics` — dashboard facets
- `GET  /leads/hot`, `GET /leads/stale`, `GET /leads/followups-due`, `GET /leads/alerts`
- `GET  /leads/dump` — deleted/lost leads
- `GET  /leads/export?format=csv|xlsx&ids=...`
- `POST /leads/import` `{ leads: [...] }`
- `POST /leads/:id/draft-message` — AI WhatsApp draft

## Follow-ups
- `GET  /followups?date=...&agent=...` etc.
- `PATCH /leads/:id` or `PATCH /projects/:pid/leads/:lid` to edit

## Projects
- `GET  /projects`, `GET /projects/stats`, `GET /projects/:id`
- `DELETE /projects/:id`
- `GET  /projects/:id/leads?page&limit&search`
- `POST /projects/:id/leads/import`
- `PATCH /projects/:pid/leads/:lid` (remarks, followUp, booking, status)
- `PATCH /projects/:pid/leads/:lid/remark`
- `DELETE /projects/:id/leads/:lid`, `DELETE /projects/:id/leads/bulk`
- `PATCH /projects/:id/leads/bulk-status`
- `POST /projects/:pid/leads/:lid/transfer` `{ toProjectId }` or `{ toLeads: true, source }`

## Tasks
- `GET /tasks?params`, `POST /tasks`, `PATCH /tasks/:id`, `PATCH /tasks/:id/complete`, `DELETE /tasks/:id`

## Calls
- `GET /calls?params`, `GET /calls/stats`, `GET /calls/analytics`
- `GET /calls/lead/:leadId`
- `POST /calls/initiate` (EnableX bridge call)
- `PATCH /calls/:leadId/:activityId/notes`
- `POST /calls/:leadId/:activityId/summarize` (AI)
- `POST /calls/:leadId/followup`

## Attendance
- `GET /attendance/status`, `POST /attendance/clockin`, `POST /attendance/clockout`
- `GET /attendance?params`, `GET /attendance/team-today`, `GET /attendance/export?params`
- `POST /attendance/admin-entry`
- `GET/PATCH /org/me/attendance-settings`

## WhatsApp Inbox
- `GET /whatsapp/conversations`, `GET /whatsapp/conversations/:id/messages`
- `POST /whatsapp/send`, `PATCH /whatsapp/conversations/:id`
- `GET /whatsapp/settings`

## Bookings & Invoices
- `GET/POST /bookings`, `PUT /bookings/:id`, `DELETE /bookings/:id`
- `GET /developers`
- `GET /invoices`, `POST /invoices`, `PATCH /invoices/:id/status`, `PATCH /invoices/:id/number`

## Team & Performance
- `GET /auth/users`, `POST /auth/users`, `PATCH /auth/users/:id`, `PATCH /auth/users/:id/toggle`, `DELETE /auth/users/:id`
- `GET /auth/performance`

## Automation
- `GET/POST /automations`, `PATCH/DELETE /automations/:id`
- `GET /automations/website/token`, `POST /automations/website/create`
- `POST /automations/facebook/refresh-tokens`
- `GET /routing-rules`, `PATCH /routing-rules/:id`, `DELETE /routing-rules/:id`

## Org / Settings
- `PATCH /org/me/goal`, `/org/me/auto-assign`, `/org/me/billing`, `/org/me/logo`
- `GET /org/support-access`, `POST /org/support-access/:id/respond`, `POST /org/support-access/end-session`

## Misc
- `GET /referrals/mine`
- `GET /tickets?page&limit`, `GET /tickets/:id`, `POST /tickets`, `POST /tickets/:id/reply`
- `POST /help/ask` (AI helpbot)

## Error contract
- Errors: `{ success: false, message }`. 401 = session expired (clear token → login). 403 with message `ORGANISATION_INACTIVE` or `TRIAL_EXPIRED` = org-level block screens.

## Theme (from frontend/src/styles.css)
- Primary: `#ff6b00`, deep `#a04100`
- Dark: bg `#111113`, surface `#1e1d20`, text `#ededed`, softText `#969696`, border `rgba(255,255,255,0.10)`
- Light: bg `#f0ede8`, surface `#ffffff`, text `#18181b`, softText `#5f5f66`
- Radius: cards/inputs 16px (rounded-2xl), buttons 12px (rounded-xl)
