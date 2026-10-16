# Artha on mobile (Phase 4): handover for the APK session

Written 16 Oct 2026 by the session that built Artha v2 on the web. Plan of record:
https://claude.ai/artifact/8nQwUJxjEVqC3PG5mYNwHB (sections 5, 6 and 9).
Read `MOBILE_APP_HANDOFF.md` and `AGENT_BRIDGE.md` first, as always. Staging first
(`docs/STAGING.md`): build against `api-staging.arthaleads.com`.

## Where things stand

| Phase | What | Status |
|---|---|---|
| 0 | Safe foundation: one visibility module, IST helpers, provider layer (OpenAI gpt-5-mini), usage metering, switches | Done, live |
| 1 | Artha looks things up: streamed chat with steps, record links, saved chats, starters | Done, live (web) |
| 2 | Artha does the work: preview cards, edit in place, Undo, "log a call" in one card, bulk assign, tap-to-choose, voice | Done, live (web, pilot companies) |
| 3 | Works before you ask: morning brief, risk alerts, WhatsApp reply drafts, lead details read from chats, suggestion card | Done, live (web, pilot companies) |
| **4** | **Mobile: all of the above in the Flutter app** | **Not started: this handover** |

Pilot companies: `Organization.copilot.beta = true` (only Prophunt LLP today; toggled in Super Admin).
Every Phase 2 and 3 ability is pilot-only. Ask the server what is on (`GET /api/copilot/features`)
instead of hard-coding it.

## What the app does today (mobile/lib/screens/help/artha_chat_screen.dart)

The old helpbot: `POST /api/help/ask` (one answer, no lookups) and `POST /api/help/action`
(applied with no preview card and no Undo). The server deliberately hides every newer
("v2Only") action from `/help/ask`, so the app never offers something it can't show
properly. Keep that path working until the new screen ships; then the old one can go.

## The server side is done: what the app needs to call

All under `/api`, Bearer token as everywhere else.

### 1. Chat (streamed): `POST /copilot/chat`
Body: `{ question, page, threadId?, focus? }`
- `page`: the web path of the current screen (`/leads`, `/followups`, `/dashboard`,
  `/conversations`...). `mobile/lib/core/copilot_pages.dart` already maps screens; reuse it.
- `focus`: `{ id, kind: "lead" | "projectLead", name }` when a lead is open, so "summarise
  this" and "log a call" know which lead.
- `threadId`: from the `start` event, to continue the same chat.

Response is **server-sent events** (`text/event-stream`), one JSON object per
`data: ...` line, in this order:

| `type` | Fields | Show it as |
|---|---|---|
| `start` | `threadId` | keep it for the next message |
| `step` | `id, label, status: running/done/error, count?` | a small step line ("Checking your follow-ups… 9 found"), folded when done |
| `text` | `delta` | append to the answer as it arrives |
| `proposal` | `proposal: { type, params }` | a change card (see 2) |
| `choice` | `choice: { question, options: [{ id, kind, name, detail }] }` | tap-to-choose buttons; tapping sends `"<name> (<detail>)"` as the next question |
| `records` | `records: [{ id, kind: lead/projectLead/task, name }]` | turn those names in the answer into links |
| `done` | `threadId, turnId, text, records, proposals` | final state; enable rating |
| `error` | `message` | show it, keep the partial answer |

Errors before the stream starts are ordinary JSON: 403 (Artha off), 429 `code: "ALLOWANCE"`
(monthly allowance used up: show the message), 503 (no AI key).
Dart: `http.Client().send(request)` and read `response.stream` line by line; no extra package
needed. Cancelling the request stops the answer (the server aborts the model call).
Web reference: `frontend/src/services/arthaStream.js`, `frontend/src/components/HelpBot.jsx`.

Other chat endpoints: `GET /copilot/threads`, `GET /copilot/threads/:id`,
`DELETE /copilot/threads/:id`, `POST /copilot/threads/:id/turns/:turnId/rating { rating: "up" | "down" | null }`,
`GET /copilot/starters?page=` (instant buttons, no AI call), `GET /copilot/actions?limit=30`
(changes Artha made).

### 2. Change cards (preview, apply, undo): unchanged `/help` endpoints
For each `proposal`:
1. `POST /help/preview { type, params, page, scopeConfirmed: true }` returns
   `{ subject, fields: [{ label, param, from, to, editor? }], rows? }`. Show every field
   From to To. `rows` (bulk assign) is a list with tick boxes; unticked ids are removed from
   `params.leadIds`. Fields with an `editor` can be edited in place (dates are IST datetimes).
2. Apply: `POST /help/action { type, params, page, scopeConfirmed: true, idempotencyKey, prompt, source: "artha", threadId }`.
   `idempotencyKey` must be stable per card (a retry must not apply twice). Response
   `{ message, undoable, undoKey }`.
3. Undo: `POST /help/undo { undoKey }`.
After apply or undo, refresh whatever screen shows that lead.

### 3. Morning brief and risk alerts: `GET /copilot/brief`
`{ brief: null }` means "don't show it". Otherwise:
`{ date, counts: { visits, chats, overdue, today, fresh }, risks: { total, counts, list: [...] }, items: [...], more, team }`.
- `items`: who to call first, each `{ id, kind, name, phone, reason, tag: visit/chat/overdue/new/today, projectId?, projectName?, conversationId? }`.
- `risks.list`: "Needs attention", each `{ id, kind (lead/chat/summary), name, phone, owner?, type, reason, conversationId? }`.
  Types: `chat_closing, unassigned_waiting, visit_missed, hot_cold, visit_silent, new_waiting`.
  `kind: "summary"` (unassigned leads) opens the Leads list.
- `team`: managers only, per person `{ name, atRisk, overdue, fresh, today, visits }`.
No AI call, instant. Web: `frontend/src/components/dashboard/MorningBrief.jsx`.
Suggested place: top of the Dashboard tab, plus one push at 9:00 IST only if the owner wants it
(today the 9 AM follow-up and task reminders already go out; ask before adding another).

### 4. WhatsApp reply draft: `POST /copilot/draft-reply { conversationId }`
Returns `{ text }` for the message box; the person edits and presses Send. Never sends by
itself. Show the button only when `features.drafts`, the 24-hour window is open and the box
is empty. 422 = nothing to reply to yet.

### 5. Suggestion card (lead details the customer stated on WhatsApp)
Leads now carry `arthaSuggest: { fields: { preferredLocation?, bhk?, budget?, propertyType?, purpose? }, at }`
(present on `GET /leads/:id`, the leads list and Inbox conversations' `leadId`).
Show "Artha found in the WhatsApp chat: Location: Kharghar → Wakad" with tick boxes, then
`POST /copilot/suggestions/:leadId { action: "save" | "dismiss", fields: [...] }`.
Save writes a note on the lead, signed "(via Artha)". Show only when `features.suggestions`.
Web: `frontend/src/components/ArthaSuggestCard.jsx`.

### 6. Opening a linked record
`kind: "lead"`: `GET /leads/:id`. `kind: "projectLead"`: `GET /projects/lead/:id` (new; returns
the project lead with `projectId`, `projectName`). `kind: "task"`: the Tasks tab.

## One fix the app needs even without Phase 4: staying signed in

Since 15 Oct the server renews a session once it is a day old: responses then carry an
`X-Renewed-Token` header with a fresh token. The web app stores it; **the mobile app ignores
it, so phones are still signed out exactly 7 days after signing in.** Fix: in the HTTP client,
when a response has `X-Renewed-Token`, replace the stored token with it.
Server side: `backend/middlewares/auth.js` (`renewSession`).

## Screen design (from the plan, section 5 and 6)

- A bottom sheet in three heights (peek, half, full), opened from the app bar and from the lead
  screen; replaces the floating button that covers call buttons.
- Hold-to-talk mic, English/Hindi/Hinglish, transcript editable before sending.
- Steps shown while working; answer streams in; names are tappable links.
- Change cards: every field From to To, edit in place, Apply / Cancel, then Undo.
- Dates always shown in full, in IST ("Thu 15 Oct, 5:00 pm"). No em dashes in any text.
- Lead screen buttons: Summarise, Next step, Log a call (each sends a question with `focus`).

## Rules that apply

- Only pilot companies see Phase 2 and 3 features; read `GET /copilot/features`.
- Agents only see their own leads: the server enforces it, the app must not try to work around it.
- Nothing customer-facing is ever sent automatically (drafts land in the box).
- Staging first; the staging demo company has every feature on (`scripts/staging-artha-demo.js`,
  run from the Railway staging console). Its OpenAI key is real but low-limit.
- Server code (`backend/`) is done and owned by the web session; if mobile needs a server change,
  register it in `AGENT_BRIDGE.md` and say so.
