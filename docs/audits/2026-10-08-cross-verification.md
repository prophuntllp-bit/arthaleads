# Frontend dashboard audit and independent cross-verification

8 October 2026, IST. Application cutoff **3bef24a**; audit registration **97017fd**. Proposed launch: 15 October. Five agents completed separate scopes: Hilbert (core CRM), Avicenna (operations), Fermat (commercial), Dalton (messaging), Carson (global frontend). Parent independently tested critical findings. This report supersedes current-status conclusions in the earlier audit at 0763d37; that report remains historical evidence.

## Launch assessment

**Dashboard launch sign-off remains blocked.** The latest fixes improve many workflows, but fresh functional testing found **31 distinct failure families: 4 P1, 22 P2, 5 P3**. This is an observed minimum, not a claim that all remaining bugs are known. Repeated public-options findings are counted once. Related failures sharing one mechanism are grouped (commercial list races; Developers/Referrals error handling). Source-only risks below are excluded from the 31.

P1 means launch-blocking availability, protected-data exposure or financial integrity. P2 means a broken workflow or materially misleading result. P3 means a smaller inconsistency or unusable role-specific action. The parent raises project-detail availability and silent manual-brokerage overwrite to P1; individual worker appendices used P2 for those findings.

| Evidence | Result |
|---|---|
| Parallel audit workers | 5 completed, all reports included below |
| Fresh backend sandbox and frontend | Running; seeded logins and real persisted CRUD exercised |
| Frontend production build | PASS, exit 0; bundle-size advisory remains |
| Backend npm test | PASS, exit 0; all four configured suites executed, including Mongo-backed suites |
| Parent targeted API/persistence checks | 39 checks: 38 PASS, 1 FAIL (duplicate invoice creation) |
| Parent invoice race repetitions | Three additional API races each returned 201/201 and persisted two invoices; two real browser sessions also did so |
| Parent independent browser reproductions | Project crash, manual-booking overwrite, password-token continuation, duplicate invoices |
| Additional parent security check | Another agent's conversation metadata/preview returned by start endpoint; direct detail correctly returned 404 |
| Production/provider checks | Not performed; no production secrets or production writes |
| Code/mobile edits | None; audit documentation and own bridge entry only |

The 39-check suite is bounded: its successful synthetic project transfer used supported history entries. The realistic main→project→main browser workflow separately fails on a transferred-history enum. A passing lower-level fixture does not certify the full workflow. The booking pagination assertion originally required a nonexistent `pages` key; it was corrected against the documented `page`, `limit`, `total` contract. API pagination is not flagged as broken.

## Canonical findings

Evidence: **R** real browser plus sandbox; **A** real sandbox API/database; **D** delayed delivery of actual sandbox responses; **M** browser with explicitly mocked responses; **S** current source trace. No label implies live-provider acceptance. File line references are at the application cutoff.

| ID / priority / evidence | Failure and reproduction | Source / required improvement |
|---|---|---|
| FE01 / P1 / R+S | Every Project Detail route displays an application error: `useMemo is not defined`. Confirmed independently as manager and by the core worker. All nested project actions are blocked. | `frontend/src/pages/ProjectDetail.jsx:2,442`. Import the hook, then retest every project tab/action; a build alone missed this runtime error. |
| FE02 / P1 / R+A+D+S | Two sessions click Generate Invoice for one booking. Both return 201 and create separate billable invoices; only one can remain linked from the booking. Parent reproduced three API races and a browser race; worker independently reproduced a browser race. | `backend/routes/invoiceRoutes.js:49,54`, `backend/models/Invoice.js:9,68`; backend uniqueness/idempotency and recoverable booking linkage. Local button disabling is insufficient across sessions. |
| FE03 / P1 / R+A+S | Open a manually priced booking, change nothing, Save. Parent's brokerage ₹12,345 → ₹20,000; bill ₹14,567.10 → ₹23,600. Manual mode becomes false. Worker independently reproduced with FOS incentive. | `frontend/src/pages/Bookings.jsx:116,149`, `backend/routes/bookingRoutes.js:142,149`. Hydrate the saved calculation mode and preserve unchanged negotiated amounts. |
| FE04 / P1 / A+S | In an isolated synthetic connected org, agent B requests agent A's conversation: direct detail 404, but POST start with A's lead ID returns 200, A's assigned contact, lead name and confidential message preview. No outbound message/provider call. | `backend/routes/whatsappRoutes.js:2951,2956,2968`. Enforce lead/conversation ownership before returning or creating a thread. This verifies the messaging worker's source-only suspicion. Full transcript access and cross-tenant disclosure were NOT established. |
| FE05 / P2 / R+S | Editing only an ordinary lead's City truncates an existing timed follow-up to a date and resets it to midnight. | `frontend/src/components/LeadForm.jsx:89,120,210`. Preserve full timestamps on unrelated edits. |
| FE06 / P2 / R+A+S | Move a main lead to a project, then return it to Main or Move to Dump. Both fail 400: `transferred` is not a valid Lead activity enum. Record remains; no deletion observed. | `backend/utils/projectLeadFromLead.js:78`, `backend/utils/leadFromProjectLead.js:64`, `backend/models/Lead.js:22`, `backend/services/projectService.js:408,490`. Align activity schemas/mapping and test actual round trips. |
| FE07 / P2 / R+S | Main-lead Remark 3 editor submits PATCH `{}` and receives 400 No updatable fields. Remark 4 has the same source mismatch but was not separately clicked. Project Remark 3 passes. | `frontend/src/pages/FollowUps.jsx:28,531,534`, `backend/routes/leadRoutes.js:197`. Align exposed fields, mapper and API contract. |
| FE08 / P2 / R+A+S | Save a main lead's second follow-up in the future. Persistence succeeds but Future Events omits it. Project event filters consider both dates. | `backend/services/followupService.js:43,65,88`. Include both reminder dates in main-lead event predicates. |
| FE09 / P2 / R+S | IST browser task created at 21:45 displays 16:15 when editing. Reconfirm Set Time and save: persisted deadline moves 330 minutes earlier. Saving without reconfirming picker preserves the timestamp. | `frontend/src/pages/Tasks.jsx:213,239`, `frontend/src/components/DateTimePicker.jsx:112`. Preserve timezone/local representation through picker hydration. |
| FE10 / P3 / R+A+S | Task due 01:00 tomorrow IST appears in Upcoming rows while cards say Today 1 / Upcoming 0 on the UTC backend. | `backend/controllers/taskController.js:61,69`, `frontend/src/pages/Tasks.jsx:175`. Use consistent day boundaries for counts and filters. |
| FE11 / P2 / R+A+S | Settings password change returns a fresh token but `_at` stays old. Clear/block cookies and reload: old bearer gets 401 and UI returns to Login; fresh returned bearer/new-password login work. Parent independently reproduced. | `frontend/src/pages/Settings.jsx:540,541`, `frontend/src/context/AuthContext.jsx:154,158`. Persist response token before refreshing. Normal cookie-backed continuation passes. |
| FE12 / P2 / R+A+S | Seed an unfinished yesterday attendance row. Today status is null, UI offers Clock In, no Clock Out; clock-out API says not clocked in. | `backend/controllers/attendanceController.js:86,163,169`. Resolve an open shift across calendar boundaries. Fixture boundary tested; no actual overnight wait. Manual overnight arithmetic is fixed. |
| FE13 / P2 / R+A+S | Same attendance filter has 63 records/519h overall. Page 1 shows 60 days/495h; page 2 shows 3 days/24h under Total Hours/Days Present. | `frontend/src/pages/Attendance.jsx:221,226,357,559`. Aggregate the filtered dataset or explicitly label page-only summaries. |
| FE14 / P3 / R+A+S | Performance Refresh updates lead data but not call charts: chart remains 1 after synthetic activity makes API count 2; reload shows 2. | `frontend/src/pages/Performance.jsx:281,295,371`. Refresh all datasets shown by the page. No live telephony involved. |
| FE15 / P2 / R+S | Actual detailed PDF for ₹145.67 says One Hundred Forty Six and `undefined Crore undefined Lakh undefined Thousand Paise`. Download works but monetary wording is malformed. | `frontend/src/pages/Invoices.jsx:47,48,50`. Separate whole rupees and positive paise correctly; helper shared by both templates. Parent executed helper for .25/.50/.67/.99 boundaries. |
| FE16 / P2 / R+D+S | Hold New/Draft list response, select Paid and let Paid finish, then release older response. Paid stays selected but Bookings shows New rows / Invoices shows Draft rows. | `frontend/src/pages/Bookings.jsx:336,346,355`, `frontend/src/pages/Invoices.jsx:485,489,497`. Guard current filter/request generation; pagination accessibility itself passes. |
| FE17 / P2 / R+A+S | Total Bookings says 50 with 83 records and Load more 50 of 83. Loading more changes tile to 83; New filter changes it to 25 while whole-set summary stays 83. | `frontend/src/pages/Bookings.jsx:409`. Use whole-set summary count, consistent with the other money tiles. |
| FE18 / P2 / R+S | Ticket `.txt` attachment stores successfully but clicking its data-URL chip opens a blocked Chromium page. Limited to tested MIME/browser case. | `frontend/src/pages/HelpSupport.jsx:394,411,641`. Provide supported download/blob or stored-file delivery and test MIME/browser matrix. |
| FE19 / P2 / M+S | Inject a 500 into Developers or Referrals: UI claims No developers/referrals and zero counts despite existing data instead of an error/retry. | `frontend/src/pages/Developers.jsx:253`, `frontend/src/pages/Referrals.jsx:83`. Preserve data and distinguish failure from emptiness. This is controlled error-path proof, not a live outage. |
| FE20 / P3 / R+A+S | Support ticket stores workspace snapshot Unknown although org is Sandbox Realty. Identity/org ID correct; downstream support-display impact untested. | `backend/controllers/ticketController.js:38`, `backend/middlewares/auth.js:118,146`. Include/fetch organization name when taking the snapshot. |
| FE21 / P2 / M+S | Select Inbox B while A's response is delayed. B header/phone remain but A messages replace B transcript and reply-window state. | `frontend/src/pages/Inbox.jsx:358,375,409`. Ignore stale thread requests. Browser proof uses mocked connected/list/message responses; no real-provider transport race claimed. |
| FE22 / P2 / R+A+S | Thread has 61 real synthetic messages. Inbox displays 60 with no older-history control; message 001 exists on API page 2 but cannot be reached in UI. Only connection status stubbed. | `frontend/src/pages/Inbox.jsx:358,698`, `backend/routes/whatsappRoutes.js:3001,3005`. Add transcript history paging and preserve scroll position. |
| FE23 / P3 / R+S | Manager/agent direct assistant-builder URL allows form entry/Create; real save returns 403. Backend authorization holds. | `frontend/src/App.jsx:821`, `frontend/src/pages/conversations/AgentBuilder.jsx:347`. Apply admin UI gate consistently with agent list/settings. |
| FE24 / P3 / R+S | Manager Inbox wallet opens top-up modal; valid amount cannot quote because API returns 403, shown as Enter an amount. Credits page correctly hides Add credits. | `frontend/src/pages/Inbox.jsx:544`, `frontend/src/components/CreditTopUpModal.jsx:34`, `backend/routes/creditRoutes.js:233`. Gate action and show authorization failure. No payment attempted. |
| FE25 / P2 / R+S | Ctrl+K Search all, Add Lead or Follow-ups due today ignored when Leads is already mounted; same commands from Dashboard work. | `frontend/src/pages/Leads.jsx:298,390,398`, `frontend/src/hooks/useLeads.js:14`. Consume route-state changes after mount. One shared failure family. |
| FE26 / P2 / R+S | On Calls/Follow Ups, choosing a lead suggestion closes search without opening details. Search-all query navigation works. | `frontend/src/components/CommandMenu.jsx:70`, `frontend/src/pages/Calls.jsx:704,711`, `frontend/src/pages/FollowUps.jsx:200,208`. Consume new openLeadId state and unwrap actual response correctly. |
| FE27 / P2 / R+D+S | Search Lead 1, delay real response, search Lead 2 and finish; releasing old response replaces matches with 12/11/10/1 while input remains Lead 2. | `frontend/src/components/CommandMenu.jsx:60,61,65`. Guard stale search responses, independently of fixed lead-table polling. |
| FE28 / P2 / R+A+S | Project lead found by global search fails to open if absent from current Leads table. Fallback requests main /leads/:id and returns 404. Independent of project-detail crash. | `frontend/src/components/CommandMenu.jsx:71`, `frontend/src/pages/Leads.jsx:423,430`. Retain entity type/project ID when opening results. |
| FE29 / P2 / R+A+S | Admin views another agent's lead, signs out; seeded agent signs in same browser. Recent leads still reveals previous name/phone/status even though agent API read returns 403. Full details/edit not established. | `frontend/src/components/CommandMenu.jsx:8,12,89`, `frontend/src/context/AuthContext.jsx:56`. Scope caches by user/org and clear on logout/switch. |
| FE30 / P2 / R+A+S | Read-only options GETs consume shared ten-request/15min contact/careers submission budget. Ordinary startup/navigation gets Too many submissions with no submissions. Parent independently reproduced. Bundled options remain fallback. | `backend/server.js:269,347,350`, `frontend/src/utils/constants.js:124`. Separate read hydration from external-action submission limiter. Distinct from five agents exhausting admin's normal 1500-request bucket. |
| FE31 / P2 / M+S | Inject completed storage overview 503. Manage storage remains an unexplained spinner with no error/retry. Normal sandbox overview/quotes work. | `frontend/src/components/StorageManageModal.jsx:101,109,192`. Model loading/success/failure states explicitly. Controlled failure only. |

## Menu-by-menu acceptance coverage

The detailed worker appendices preserve reproduction steps, request results, source references and remaining tests. These are bounded passes, not certification of every button or provider permutation.

| Menu/surface | Verified behavior | Attention / blocked / remaining |
|---|---|---|
| Dashboard/layout | Seeded and synthetic logins, data widgets, real notifications opening lead detail, phone drawer/search at 390px without horizontal overflow | Commands/caches FE25–29; full widget/permission/plan matrix remains |
| Leads | Form creation, CSV import 2 valid/1 duplicate/1 invalid, bulk status, selected ordinary CSV and project XLSX, project-field editing through unified table | FE05–06; full filters/5000-row exports/role matrix not certified |
| Pipeline | Stage change persists after reload, all/project pipeline switching | Timing/scale risks source-only; full drag/action matrix untested |
| Projects | List/create form persists; unified-table project edit passes | FE01 blocks every nested project tab, media, QR, dump panel, restore, import/export and detail action |
| Follow Ups | Main/project Note persists, project Remark 3 persists, Mark Done clears both dates, future From bound works | FE07–08; calendar/role/archived project policy still needs testing |
| Calls | Real populated charts and global search-all navigation; authorization checks deny another agent's call history | FE14, FE26; live telephony/recording playback/ingestion not certified |
| Tasks | Required-title validation, create/edit without links, null-link normalization, complete with note, ownership/role gating | FE09–10; no Reopen button is claimed broken, because no supported UI action exists |
| Attendance | Real fallback capture clock-in/out, unavailable-proof declaration, CSV, manager settings hidden, manual overnight arithmetic | FE12–13; successful photo/GPS/upload and selfie-off runtime branch untested |
| Team | UI member create/edit/deactivate/reactivate persists; manager read-only; agent redirect; sole-admin demotion rejected | Purchased-seat limit/concurrent admin transitions/delete user not fully certified |
| Performance | Distinct whole-team lead totals, shared-project drill, role redirect, lead-data refresh | FE14; date races/export/live call metrics remain |
| Settings | Role/tab visibility, backend password revocation and fresh token correctness | FE11; shared org/logo/billing/deletion UI workflows deliberately unmutated/unrun |
| Developers | 0% default retained, RERA/default edit, own developer delete | FE19; logo/provider/invalid-input matrix remaining |
| Bookings | Initial manual calculation, explicit automatic recalculation, developer change before invoice, 50→83 load-more, own linked deletion | FE02–03, FE16–17; invoiced amendment policy unresolved |
| Invoices | Generate/navigation, status→booking sync, custom number, detailed/simple PDFs download, paging and whole-set money totals | FE02, FE15–16; partial-write recovery/number and rounding boundaries need regression |
| Referrals | Real empty endpoint, actual clipboard copy with permission, capped calculator | FE19; actual first payment/reward grant lifecycle not runtime certified |
| Support | Validations, ticket/reply persistence, 10+2 ticket paging, agent forbidden read | FE18–20; populated private-note fixture, attachment matrix, human/email delivery remaining |
| WhatsApp Inbox | Disconnected explanation, real synthetic transcript, role controls | FE04, FE21–22, FE24; actual send/handoff/resolve/provider workflows remaining |
| Templates | Mock-approved template role controls; manager Delete correctly hidden; mocked Starter lock | Provider create/edit/review/delete not accepted live |
| Campaigns | Mocked reviewed payload includes edited name/current settings; mocked Starter lock | Execution/concurrency/consent/recovery/live transport still requires isolated/provider tests |
| AI assistants | Real sandbox create/edit/activate/pause/delete; mocked connection flag and Starter lock | FE23; real AI response/CTWA/default routing not certified by saved active state |
| Credits | Real balance/statement role display; correct main-page top-up visibility | FE24; payment, ledger scale/free-credit races/auto-recharge not certified |
| Integrations/routing | Real rule UI creation; admin/manager page, agent redirect | Edit/toggle/delete/all sources/OAuth/diagnostics still require work |
| Meta conversions | Real missing-config/test-code prerequisites disable actions | Actual save/event transport/retry/dedupe requires dedicated tests/provider acceptance |
| Plans/Storage | Real quote amount/seat/cycle changes, storage pack quantity/duration quotes, unavailable-payment explanation | FE31; full paid proration/fulfillment/cleanup/quota thresholds untested |
| Global search/help/account | Login/logout, account switch+bearer restore, notification opening, help/tour static UI, responsive phone search/drawer | FE25–30; actual AI actions, PWA/push delivery and exhaustive responsive checks remaining |

## What the recent fixes now demonstrate

Fresh tests confirm ownership gates for lead edits/project transfers/call history/tasks, foreign task-assignee rejection, null task links, persistent follow-up Note, future From filtering, project field saving through unified Leads, selected exports, automatic booking recalculation, changing a developer before invoicing, zero default brokerage, list pagination and invoice money aggregates, manual overnight arithmetic, manager settings/template visibility, sole-admin protection, distinct Performance totals and correct account-switch bearer storage. Backend password invalidation works; frontend continuation FE11 remains.

Do not mark all old findings resolved from source alone. C03's simplified transfer passes but realistic history fails FE06; project-detail C04 cannot be signed off while FE01 exists; booking O11 accessibility/money totals pass but count tile FE17 fails. Campaign reviewed-payload and Starter gates were mocked UI tests, not live transport acceptance. Backend account-deletion suites now pass; the first report's Mongo-download/test failures no longer describe this instance.

## Source-only risks and live acceptance still needed

Excluded from the 31 reproduced families: Pipeline stale-response/2000-row cap; prospective project date-filter refresh after edits (currently blocked); project note/attribution mapping; invoice amendment policy after a financial snapshot; clipboard rejection and keyboard reply concurrency; unauthorized direct template/campaign builder URLs; Calls/Follow Ups fallback response-envelope mismatch; checkout verification failures presented as eventual success; project-file load failures presented as empty; complete role/tenant/plan permutations.

Meta signature enforcement remains gated by `WA_WEBHOOK_ENFORCE=true`; the bridge documents unsigned BSP URL decisions. Live Meta/WhatsApp, Google Ads, telephony, Razorpay, storage and email acceptance has not been performed. No production values are needed for continued sandbox/stub regression, and none were requested. AI state activation, checkout quotes and downloaded sample PDFs do not prove real AI replies, successful payments or external message/file delivery.

The earlier 61-feature inventory and 15 Missing/21 Partial marketing counts are **historical**, not refreshed counts at this cutoff. This round audits dashboard functionality. Re-audit current marketing pages after critical flows stabilize; use real, sanitized product screenshots and verified workflow descriptions, especially projects/dump, storage, routing, CTWA/CAPI and billing. Do not advertise blocked actions as launch-ready.

## Seven-day priorities

1. Repair FE01–04 first. For FE01, re-open every project tab/button; for FE02/03, assert exact preserved money plus concurrent single-invoice invariants; for FE04, test two agents and two tenants across start/detail/message/send endpoints.
2. Repair time/reminder workflows FE05–13: unrelated edits, actual transfer histories, secondary reminders, IST boundaries and an open shift spanning midnight.
3. Repair filters/search/message context FE16/21/25–29. Deliberately reorder responses, switch accounts and test records outside the currently loaded table.
4. Repair PDF money wording, aggregate counts, attachment delivery and error/retry states FE15/17–20/30–31; check decimals, more than one page, provider failures and supported browsers.
5. Align remaining role actions and refresh behavior FE14/23–24, then exercise the explicitly unrun action matrix rather than repeating only happy-path renders.
6. Run isolated transport/payment/upload fault tests and owner-operated live-provider acceptance; no production secrets should enter this environment.
7. Retest all repaired cases, resolve the documented product policies, capture approved sanitized screenshots and update marketing coverage. Keep a release sign-off list with failed/skipped/live checks visible.

## Durable parent evidence

Three repeated concurrent API results: `[{statuses:[201,201],persisted:2},{statuses:[201,201],persisted:2},{statuses:[201,201],persisted:2}]`.
Two browser contexts: statuses `[201,201]`, persisted `2`; only request timing was aligned, responses were real.
Manual unchanged edit: `{before:{brokerageManual:true,brokerageAmount:12345,totalBill:14567.1},after:{brokerageManual:false,brokerageAmount:20000,totalBill:23600}}`.
Password form: `{putStatus:200,newTokenReturned:true,storedMatchesReturnedToken:false,urlAfterCookieBlockedReload:"/login"}`.
Conversation access: `{directConversationStatus:404,startStatus:200,returnedOtherAssignedConversation:true,leakedPreview:"Parent synthetic confidential message",leakedLeadName:"Parent private lead"}`. Fixture org/users/lead/conversation removed after test; no provider contacted.
Public options: ten additional GETs after one read returned nine 200s then 429; next read still 429 Too many submissions. No submissions made.

Temporary scripts/results/screenshots live under `/tmp/frontend-*`, `/tmp/corecrm-3bef-*`, `/tmp/ops-3bef-*`, `/tmp/commercial-audit-*`, `/tmp/msg-*`, `/tmp/global-3bef-*`. They are transient; fake authenticated browser-state/context files are deliberately not committed. Essential results and full worker reports are retained here.

### Parent API/persistence check matrix

| Check | Outcome | Evidence |
|---|---|---|
| login admin | PASS | `{"status":200}` |
| login manager | PASS | `{"status":200}` |
| login agent | PASS | `{"status":200}` |
| role gate agent GET /auth/users | PASS | `{"status":403,"expected":403}` |
| role gate manager GET /auth/users | PASS | `{"status":200,"expected":200}` |
| role gate agent POST /tasks | PASS | `{"status":403,"expected":403}` |
| role gate agent POST /projects | PASS | `{"status":403,"expected":403}` |
| role gate manager GET /storage/quote?packs=1&months=1 | PASS | `{"status":403,"expected":403}` |
| role gate agent GET /meta-conversions | PASS | `{"status":403,"expected":403}` |
| role gate manager GET /meta-conversions | PASS | `{"status":403,"expected":403}` |
| public org serialization /org/me | PASS | `{"status":200,"containsDummyCredential":false}` |
| public org serialization /auth/me | PASS | `{"status":200,"containsDummyCredential":false}` |
| lead create persisted | PASS | `{"status":201}` |
| C01 other-agent PATCH denied | PASS | `{"status":403}` |
| owner PATCH persists | PASS | `{"status":200}` |
| lead note persists | PASS | `{"status":200}` |
| C07 ordinary follow-up note persists | PASS | `{"status":200,"remarkNotePersisted":"Follow-up note attempt","remark":""}` |
| C08 future From excludes tomorrow | PASS | `{"status":200,"from":"2026-11-07","tomorrowLeadStillIncluded":false}` |
| task create normalizes links | PASS | `{"status":201}` |
| O03 other-agent task complete denied | PASS | `{"status":404}` |
| O04 empty task links edit succeeds | PASS | `{"status":200}` |
| owned task completes | PASS | `{"status":200,"statusSaved":"completed"}` |
| O02 foreign assignee rejected | PASS | `{"status":400}` |
| I01 foreign-owned call history denied | PASS | `{"status":404}` |
| project creates | PASS | `{"status":201}` |
| project import deduplicates country code | PASS | `{"status":201,"inserted":1,"duplicates":1}` |
| C02 unassigned project transfer denied | PASS | `{"status":403}` |
| C05 exposed project edit fields persist | PASS | `{"status":200,"priority":"High","budget":{"min":1000000,"max":2000000},"followUp":"2026-10-08T16:13:06.637Z"}` |
| C03 project-to-main is lossless | PASS | `{"status":200,"notes":1,"statusSaved":"Contacted","budget":{"min":1000000,"max":2000000,"currency":"INR"},"consent":"unknown","owner":"6ac7c0eb6013854e9ed2a9f8"}` |
| O12 zero default brokerage retained | PASS | `{"status":201,"defaultBrokeragePercent":0}` |
| booking initial financials | PASS | `{"status":201,"brokerage":20000,"totalBill":23600}` |
| O09 automatic booking edit recalculates | PASS | `{"status":200,"brokerage":60000,"totalBill":70800}` |
| O10 booking developer update persists | PASS | `{"developerPersisted":"6ac7c1126013854e9ed2ab0c","expected":"6ac7c1126013854e9ed2ab0c"}` |
| invoice generation links booking | PASS | `{"status":201}` |
| invoice payment status syncs booking | PASS | `{"status":200}` |
| sequential duplicate invoice rejected | PASS | `{"status":409}` |
| concurrent invoice generation unique | FAIL | `{"statuses":[201,201],"created":2}` |
| booking list returns pagination metadata | PASS | `{"returned":20,"total":27,"page":1,"limit":20,"correction":"pages was an invalid test assumption; frontend calculates pages using total/limit"}` |
| cross-tenant lead read denied | PASS | `{"status":404}` |

The organization response checks above only demonstrate the current unconfigured sandbox response; no injected production credential fixture was used. The supported-history transfer check preserves the asserted fields, not every possible history/consent case. Follow-up FE06 records the failing realistic history.

## Worker appendix: Hilbert

### Core CRM frontend functional audit

Application cutoff: `3bef24ac2e551208bb7021bf55ec09f15a6c30e2`. Working HEAD at completion: `97017fd2dc91e2e111f69a08a2cc227a6f1f987a`; `git diff --stat 3bef24a HEAD` lists only AGENT_BRIDGE.md. Scope: Leads, Pipeline, Follow Ups, Projects and project detail. Read CLAUDE.md, AGENTS.md, AGENT_BRIDGE.md fully and GRAPH_REPORT.md before source; consulted the historical launch audit rather than treating its old findings as current failures. Graph built at b52cae10, so source at the current cutoff controls conclusions.

No checkout/mobile edits, pull, commit, push, dependency installation or runtime restart. Parent owns runtime, bridge and build/test verification. This is one assigned reviewer in the parent's parallel audit; this session exposes no agent-spawn tool. All scripts, browser state, downloads and screenshots were written under /tmp. Browser: Playwright, system Chromium, independent context. Real current frontend localhost:3000 and real sandbox backend localhost:5000; no API fixtures or mock responses in the functional results below. External providers not invoked.

Synthetic prefix `CoreCRM3bef`; own project `6ac7c1756013854e9ed2afe7`, moved project lead `6ac7c2b06013854e9ed2d19e`. Initially sandbox-admin, subsequently isolated `corecrm3bef-admin@example.com` (fake password Sandbox#12345). Parent authorized creation of this synthetic User directly in sandbox Mongo port 35281 to avoid the shared administrator's exhausted bucket. Only this own user's phone was set for onboarding. No shared organization settings changed. General sandbox-admin 1500-request 429s are audit concurrency artifacts and excluded from product findings.

#### Reproduced failures

All priorities below are P2 functional defects; project-detail availability is a launch blocker for that menu. None establishes production data loss or unauthorized access.

##### CRM-H1: Every project-detail route crashes before rendering

**Browser + real sandbox.** Create a project from Projects, then click its card; also directly visit `/projects/6ac7c1756013854e9ed2afe7`. Actual: application error page, `useMemo is not defined`. Expected: project detail renders. Parent independently confirmed as manager.

Source: `frontend/src/pages/ProjectDetail.jsx:2` imports only useEffect/useRef/useState; unconditional `useMemo` call at `:442`. It executes even when editingLead is null, before the loading return or any tab. The missing import is in ProjectDetail, not ProjectDumpLeads; the latter's hooks are imported at `frontend/src/components/ProjectDumpLeads.jsx:5`.

Blocked, NOT exercised: project Info/media, Leads and Prospective tabs, their filtering/paging, project CSV/XLSX import/export, project pencil/detail forms, project-detail transfers and row/bulk deletion/status, QR from detail, Dump Leads panel/list/search/restore and project deletion. The separate Projects list and project form work. Project entities can still be edited via unified Leads.

Evidence: `/tmp/corecrm-3bef-project-crash.png`, `/tmp/corecrm-3bef-project.cjs.log.json`, `/tmp/corecrm-3bef-final-checks.cjs.log.json`.

##### CRM-H2: Editing an unrelated lead field overwrites its follow-up time

**Browser + real sandbox.** On Leads, set Main A's first follow-up with the date/time picker to 8 Oct 2026, 3:45 PM. Confirm PUT payload `followUpDate: 2026-10-08T15:45:00.000Z`. Open Edit lead, change only City to Mumbai, Update Lead. Actual second PUT sends `followUpDate: 2026-10-08`; row changes to 12:00 AM. Expected: retain 3:45 PM when editing City.

Source: `frontend/src/components/LeadForm.jsx:89` truncates toISOString to ten characters, `:120` submits that date-only value, `:210` renders the date-only AppDatePicker. This affects the shared form; the reproduced case is ordinary Lead. A project form also sends date-only followUpDate, but no additional timing-loss claim is needed.

Evidence: `/tmp/corecrm-3bef-leads-actions.cjs.log.json` contains both actual PUT payloads and responses; script output records before/after date display. Form saves City successfully, so this is not a rejected form.

##### CRM-H3: A moved lead cannot return to Main Pipeline or move to Dump

**Browser + real sandbox, both operations independently executed.** Create Main A on Leads, use Move to a project and choose CoreCRM3bef Project. The transfer succeeds and the unified API subsequently identifies it as `_type: project`. Then use its unified Leads row's Move to a project -> Main Pipeline -> Transfer. Actual POST `/api/projects/<project>/leads/<lead>/transfer`, body `{toLeads:true,source:"Facebook"}`, returns 400: `` `transferred` is not a valid enum value for path `type`. `` Independently click Delete lead -> Delete (Move to Dump confirmation). DELETE `/api/projects/<project>/leads/<lead>` returns the same 400. The project row remains after both failures; no deletion/loss observed.

Source: `backend/utils/projectLeadFromLead.js:78` appends a transferred activity; `backend/models/ProjectLead.js:21` accepts it. `backend/utils/leadFromProjectLead.js:64` copies every activity verbatim, whereas `backend/models/Lead.js:22` omits transferred. Both `backend/services/projectService.js:490` (back transfer) and `:408` (dump) create a Lead from that history and therefore reject it. The latest history-preservation fix does not pass this common round-trip case. This is a new verified limitation of C03, not repetition of the historical "drops all fields" claim.

Evidence: `/tmp/corecrm-3bef-project-via-leads.cjs.log.json`, `/tmp/corecrm-3bef-final-checks.cjs.log.json`, `/tmp/corecrm-3bef-dump-failure.png`.

##### CRM-H4: Follow Ups exposes unusable Remark 3/4 editors for main leads

**Browser + real sandbox for Remark 3; Remark 4 shares the same source path.** Open Today's Leads for ordinary `CoreCRM3bef Follow D`, click Remark 3, type text and press Enter. Actual request is PATCH `/api/leads/6ac7c2fa6013854e9ed2d639` with `{}`, response 400 `No updatable fields`; editor returns to Remark 3 placeholder and reload has no value. Expected: save the exposed editable field, or do not expose it for this entity.

Source: editors are unconditional at `frontend/src/pages/FollowUps.jsx:531` and `:534`; main-lead mapper at `:28` through `:35` omits both fields. Backend allowable fields at `backend/routes/leadRoutes.js:197` also omit both. Project Remark 3 was independently saved and persisted, so this is specific to ordinary leads.

Evidence: `/tmp/corecrm-3bef-follow-main.cjs.log.json`. Do not claim Remark 4 was separately clicked.

##### CRM-H5: Saved second follow-ups do not appear in main-lead event sections

**Browser + real sandbox.** Follow D has first follow-up 8 Oct 2026 17:30 UTC. In its Follow Ups row set Follow Up 2 to 10 Oct 2026 17:00 (browser timezone UTC). Actual PATCH succeeds and a fresh GET confirms `followUp2: 2026-10-10T17:00:00.000Z`. Click Future Events while keeping the search for Follow D: 0 records, No future events found. Expected: a future second follow-up appears. The analogous project filters already match either date.

Source: main-lead section predicates inspect only followUpDate at `backend/services/followupService.js:43`, `:65`, `:88`; project counterparts OR both dates at `:72` and `:95`. UI actively exposes second-date editing at `frontend/src/pages/FollowUps.jsx:543`, mapper submits it at `:30`, route accepts/persists it at `backend/routes/leadRoutes.js:197`.

Evidence: `/tmp/corecrm-3bef-follow-main.cjs.log.json` (successful second-date mutation), associated script output (empty Future view and fresh persisted dates). This is distinct from the fixed historical From-date lower-bound issue.

##### CRM-H6: Reading options spends the contact-submission quota

**Browser + real sandbox API.** Repeated browser loads displayed `Too many submissions, please try again later.` on ordinary CRM pages because GET `/api/public/options` returned 429. Isolated reproduction used an otherwise unused synthetic proxy IP on localhost (server trusts one proxy): requests 1–10 to options returned 200, request 11 returned 429 with RateLimit-Limit 10 and the submissions error. No form submissions were made in that isolated bucket.

Source: `backend/server.js:269` declares one contactLimiter with max 10 per 15 minutes (`:271`); the same instance wraps contact at `:347`, careers at `:348` and all public routes at `:350`. The frontend hydrates lead options through this GET at `frontend/src/utils/constants.js:124`. Impact established: failed option refresh and an irrelevant submission-limit toast; source shows shared quota with contact/careers, but their submission delivery was not tested here. Fallback option constants kept the exercised forms usable, so do not describe the CRM as entirely unavailable from this limiter.

Evidence: `/tmp/corecrm-3bef-options-limiter.json`, browser mutation logs above. This is separate from the excluded authenticated 1500-request concurrency limit.

#### Per-menu tested actions

| Menu | Actual current checks | Outcome / limits |
|---|---|---|
| Leads | Create Main A via form with budget and follow-up note; CSV import 2 valid contacts, one same-file duplicate and one invalid row; search CoreCRM3bef; bulk Contacted update on B+C; selected ordinary CSV export; selected project XLSX export | PASS. Import modal counts exactly 2 inserted / 1 duplicate / 1 invalid. CSV contains only B and preserves phone as Excel-safe text. XLSX contains only project A with updated budget/project name. No large-scale export test. |
| Leads | Date/time picker; unrelated City edit | Picker saves correctly; edit FAIL H2. |
| Leads | Main-to-project transfer; project edit through unified Leads | PASS eventual persisted transfer/type; project form PATCH is real and budget 11–21 lakh, City Thane and assignee persist. The initial transfer script closed before its response log, so persistence was confirmed in the following fresh API/browser run rather than inventing an observed response. |
| Leads | Project-to-main transfer and project Move to Dump through unified row | FAIL H3, both 400, record retained. |
| Pipeline | Initial populated render; expand B; change Contacted to Negotiation; reload; switch All Pipelines -> Project Pipeline | PASS. Actual PUT 200; fresh unified result confirms Negotiation after reload; project-only board shows A under its project. Did not exercise every member/plan or contact provider. |
| Follow Ups | Today's search; ordinary Note edit/reload; project Note and Remark 3 edit/reload; ordinary second-date edit | Note fix PASS for main lead and project; project Remark 3 PASS; second-date persistence PASS but event visibility FAIL H5. Ordinary Remark 3 FAIL H4. |
| Follow Ups | Mark Done for ordinary Follow D, reload and fresh API | PASS: both dates null and row absent from today's list. Did not certify old untouched-New backlog semantics. |
| Follow Ups | From-bound regression | API + real sandbox PASS: query future/from=2026-11-01/search=CoreCRM3bef returns only own From E dated Nov 10, excluding earlier own follow-up. Calendar From/To click controls not separately exercised. |
| Projects list/form | Populated list; New Project, create own project, click card | Creation/list PASS (201); card navigation FAIL H1. No media uploads/provider requests. |
| Project detail | Open own project route | FAIL H1. All nested workflows remain BLOCKED, not passed. |

#### Latest-fix status

- C03: common transferred-history round trip fails H3; do not reuse old data-loss wording.
- C04: tagging code exists at ProjectDetail:442, but ProjectDetail cannot render; not browser-verified there. Shared LeadForm project routing passes via unified Leads.
- C05: project field handling demonstrated for budget/City and retained assignee via unified LeadForm, not an exhaustive field matrix.
- C06: selected ordinary CSV and project XLSX exports pass; 2,500/5,000-row completeness and truncation not tested.
- C07: ordinary remarkNote persists after reload: PASS.
- C08: real API lower bound passes as described; calendar UI not verified.
- F04: source poll guard exists at `frontend/src/hooks/useLeads.js:63`; no delayed-poll browser regression performed.
- C01/C02 role-negative access, C09 dashboard totals and C10 concurrent restore not certified by this scope; parent/backend reviewers own broader regression. Do not copy historical failures for these.

#### Source-only risks, separate from reproduced failures

1. Prospective date filters are omitted when a row update triggers its refresh. Initial fetch includes followUpFrom/To at `frontend/src/pages/ProjectDetail.jsx:524`; update refresh at `:778` carries search/isProspective/booking only. Reproduction after H1 repair: choose a narrow range, edit a remark, compare returned rows. Blocked by H1 today.
2. Project-to-main/dump mapping writes `pl.remarkNote` into `remark`, not the newly supported `remarkNote`, at `backend/utils/leadFromProjectLead.js:53`. Dump UI displays `l.remark` as Remark note at `frontend/src/components/ProjectDumpLeads.jsx:118`. Preserve contact-status and note semantics on conversion; no successful transferred-lead round-trip proof due H3.
3. Pipeline fetch has no request-generation guard: `frontend/src/pages/LeadPipeline.jsx:77` immediately applies results at `:78` while interval/filter-triggered calls overlap at `:97`. The Leads guard was fixed separately. Delayed real-response timing not tested; this is a risk to reproduce, not a confirmed new race. Board is capped at 2,000 with no paging at `:75`; scale acceptance remains untested.
4. Follow Ups project aggregation replaces true status and assignee with remark/followUpSetByName at `backend/services/followupService.js:136` and `:137`, while UI labels Assigned To at `frontend/src/pages/FollowUps.jsx:553`. In the browser a newly patched project row briefly showed New/actual assignee, then reload showed '-' / original follow-up setter. Decide/verify intended attribution and normalize consistently; not a permissions finding. Archived-project and former-member policy remains an existing open decision.

#### Untested / requires-live

No complete agent/manager/tenant access matrix; no per-role bulk assignment/consent/transfer/delete matrix; no source/domain/campaign/date/priority/outcome filter combinations; no 5,000+ export or deep paging; no repeated/concurrent dump restore; no delayed-poll race run; no narrow-screen/accessibility matrix. Nested project workflows blocked by H1, return/dump operations on moved history blocked by H3. Main lead ordinary delete/restore, project-to-project transfer, project booking/status bulk actions and full note add/edit/delete lifecycle not exercised.

WhatsApp history requires a seeded conversation or provider-backed acceptance; WhatsApp send/templates, phone/telephony, upload/object storage and QR public capture are not certified. Providers unavailable; no secrets requested. Builds, backend suite, health and broader menu audit are parent's responsibility and no pass claim is made here.

#### Evidence handoff

Primary replay scripts: `/tmp/corecrm-3bef-run.cjs` plus `/tmp/corecrm-3bef-{project,leads-actions,import,bulk-transfer,follow-main,project-via-leads,final-checks,inspect}.cjs`. Each writes a corresponding `.log.json` with actual requests, responses and browser exceptions. Some early automation runs had wrong selectors/routes, rate limits or onboarding overlays; those are not counted as product defects. The assertions above use later successful interactions. Browser state file contains fake sandbox authentication and should not be published; exclude it from the parent's report.

Current repository status is clean. Temporary audit fixtures retained for parent reproduction; no backend restart or cleanup that could remove another agent's records.

## Worker appendix: Avicenna

### Operations frontend functional audit

Application cutoff: `3bef24ac2e551208bb7021bf55ec09f15a6c30e2`. Checkout ended at `97017fd`; `git diff --stat 3bef24a HEAD` showed only AGENT_BRIDGE.md, and final working-tree status was clean. Scope: Tasks, Attendance, Team, Performance, Settings. No repository/mobile edits, pull, commit, push, runtime restart, bridge mutation, shared workspace-settings mutation, or external-provider calls.

Read CLAUDE.md, AGENTS.md, AGENT_BRIDGE.md, graphify-out/GRAPH_REPORT.md, and historical docs/audits/2026-10-08-launch-audit.md. Historical findings were treated as hypotheses. This is one Operations worker in the parent multi-agent audit; an attempted additional Codex CLI peer failed to initialize on the read-only filesystem and supplied no findings.

Evidence below was generated against the parent's fresh backend at localhost:5000 and Vite at localhost:3000. Chromium: /usr/bin/chromium, Playwright, independent contexts. Date tests explicitly used `timezoneId: "Asia/Kolkata"`; the backend runs in UTC. No API responses were mocked. Login used the real sandbox handlers. Synthetic records use prefix `OPS3BEF-1791476101768`. Synthetic admin creation and attendance paging fixtures used only the authorized in-memory sandbox database at 127.0.0.1:35281/sandbox. A synthetic called activity was inserted on our own project lead to test analytics refresh; no telephony provider was contacted.

#### Reproduced failures

##### OPS-F01 / P2: Task edit misinterprets timezone and can move the saved due time

**Browser + real sandbox.** In an Asia/Kolkata browser, create a task at 9:45 PM on 8 October. Its persisted dueDate is `2026-10-08T16:15:00.000Z`. Reload; click its Edit button. The picker trigger displays `08-10-2026 4:15 PM` instead of 9:45 PM. Open that picker, press Set Time without changing a selection, and Save Changes. The persisted dueDate becomes `2026-10-08T10:45:00.000Z`: 330 minutes earlier. This is not merely an IST expectation imposed on a UTC browser: the browser itself is explicitly configured for IST, creation uses its local time, and edit removes the stored timezone.

Saving Changes without reopening/reconfirming the picker preserved the original timestamp in this UTC-server sandbox; that narrower action passed. The reproducible mutation requires confirming the incorrect picker value.

Source: [Tasks.jsx:213](/workspace/arthaleads/frontend/src/pages/Tasks.jsx:213) calls toISOString().slice(0,16), removing Z; [DateTimePicker.jsx:112](/workspace/arthaleads/frontend/src/components/DateTimePicker.jsx:112) constructs a local Date and emits a new ISO timestamp. Payload persistence: [Tasks.jsx:239](/workspace/arthaleads/frontend/src/pages/Tasks.jsx:239).

Evidence: `/tmp/ops-3bef-functional.json`, `/tmp/ops-3bef-more.json` (date picker re-confirm).

##### OPS-F02 / P3: Task summary cards and their rows use different day boundaries

**Browser + real sandbox, API-created own fixture.** At 9:49 PM IST on 8 October, create an own task due `2026-10-08T19:30:00Z`, i.e. 1 AM IST on 9 October. In Tasks select My Tasks and Upcoming. Cards show Today 1 and Upcoming 0, but the Upcoming table contains that task with Due Date 9 Oct 2026. One row under a zero-count card is the observed contradiction.

Source: [taskController.js:61](/workspace/arthaleads/backend/controllers/taskController.js:61) computes boundaries with server-local setHours (UTC); [taskController.js:69](/workspace/arthaleads/backend/controllers/taskController.js:69) builds summary counts. [Tasks.jsx:175](/workspace/arthaleads/frontend/src/pages/Tasks.jsx:175) computes Upcoming using browser-local end of day (IST).

Evidence: `/tmp/ops-3bef-last.json` (my summary; upcoming card contradiction).

##### OPS-F03 / P2: Settings password change does not replace the stored bearer token

**Browser + real sandbox, controlled cookie-unavailable fallback.** Use our synthetic member, login successfully, and save a password change through Settings. PUT /auth/me returns 200 with a fresh token. After the normal success toast, before clearing cookies, `_at` still equals the original login token and differs from the PUT response token. Clear the context cookies to exercise the documented bearer fallback: GET /auth/me with the stored bearer returns 401; the returned fresh bearer returns 200; login with the new password returns 200. Reload the actual frontend with cookies absent: it navigates to /login.

Normal cookie-backed continuation passed: the immediate refreshUser GET returned 200 because the response refreshed the cookie. The failure is in the supported bearer fallback, not failure to revoke old sessions.

Source: [authController.js:327](/workspace/arthaleads/backend/controllers/authController.js:327) returns `{ user, token }`. [Settings.jsx:540](/workspace/arthaleads/frontend/src/pages/Settings.jsx:540) receives the response, but line 541 passes only data.user to updateUserState. [AuthContext.jsx:158](/workspace/arthaleads/frontend/src/context/AuthContext.jsx:158) calls persist(nextUser, org), omitting the token. [AuthContext.jsx:50](/workspace/arthaleads/frontend/src/context/AuthContext.jsx:50) replaces the bearer only when token is supplied. refreshUser likewise omits it at [AuthContext.jsx:154](/workspace/arthaleads/frontend/src/context/AuthContext.jsx:154).

Evidence: `/tmp/ops-3bef-password-proof.json`: putStatus=200, storedMatchesOldToken=true, storedMatchesNewToken=false, oldBearerStatus=401, newBearerStatus=200, newPasswordLoginStatus=200, browserAfterCookieUnavailable=/login. Script: `/tmp/ops-3bef-password-proof.cjs`. Earlier independent reproduction: `/tmp/ops-3bef-more.json`.

##### OPS-F04 / P2: Open attendance from a previous day cannot be clocked out through the normal workflow

**Browser + real sandbox with API-seeded boundary fixture.** For our own synthetic admin, manager/admin-entry successfully creates a 7 October record with clockIn `2026-10-07T14:30Z` (8 PM IST), clockOut null. On 8 October, GET attendance/status returns 200 with data=null. The browser offers Clock In and has no Clock Out button. POST attendance/clockout with proofUnavailable=true returns 400, "You haven't clocked in yet." The prior-day unfinished row remains open. The runtime state was seeded; this audit did not wait across actual midnight.

Source: [attendanceController.js:86](/workspace/arthaleads/backend/controllers/attendanceController.js:86) restricts status to today's date. [attendanceController.js:163](/workspace/arthaleads/backend/controllers/attendanceController.js:163) restricts clock-out lookup to today's date, and line 169 rejects the missed record. [Attendance.jsx:291](/workspace/arthaleads/frontend/src/pages/Attendance.jsx:291) presents capture based on that status.

This is distinct from historical O07: full datetime arithmetic for an overnight **manual entry** now passes; normal lookup across days remains broken.

Evidence: `/tmp/ops-3bef-last.json` (prior-day unfinished seed/status, overnight clock-out, own admin browser clock control).

##### OPS-F05 / P2: Attendance summary strip totals only the current page

**Browser + real sandbox with database-seeded own records.** Our own synthetic member has 63 attendance rows: 61 eight-hour fixture days plus two tested 15.5-hour overnight records. In My Records, clear From and keep To=8 October. Page 1 says 63 records, but Total Hours=495h, Days Present=60, Full Days=60. Click Next. The same filter and 63 total now show Total Hours=24h, Days Present=3, Full Days=3. Full filtered totals are 519h and 63 days; pagination changes the advertised summary without changing its scope. No label explains that these are page-only totals.

Source: [Attendance.jsx:221](/workspace/arthaleads/frontend/src/pages/Attendance.jsx:221) requests 60 records per page; [Attendance.jsx:226](/workspace/arthaleads/frontend/src/pages/Attendance.jsx:226) stores only that page; [Attendance.jsx:357](/workspace/arthaleads/frontend/src/pages/Attendance.jsx:357) sums records; [Attendance.jsx:559](/workspace/arthaleads/frontend/src/pages/Attendance.jsx:559) labels the result Total Hours and Days Present.

Evidence: `/tmp/ops-3bef-page.json`, `/tmp/ops-3bef-attendance-page2.png`. Fixture seed: `/tmp/ops-3bef-page-seed.cjs`.

##### OPS-F06 / P3: Performance Refresh leaves call analytics stale

**Browser + real sandbox, synthetic called-activity fixture.** Open Performance with the current call volume chart showing 1 for 8 October. Insert one synthetic called activity on our own project lead. The real calls/analytics endpoint now returns total=2. Click the page Refresh button: the chart still shows 1. Reload the page: it shows 2. No provider call was used.

Source: [Performance.jsx:371](/workspace/arthaleads/frontend/src/pages/Performance.jsx:371) calls fetchData; [Performance.jsx:281](/workspace/arthaleads/frontend/src/pages/Performance.jsx:281) fetches only auth/performance. calls/analytics is loaded only in the mount effect at [Performance.jsx:295](/workspace/arthaleads/frontend/src/pages/Performance.jsx:295).

Evidence: `/tmp/ops-3bef-callrefresh.json` has before=1, API total=2, afterRefresh=1, afterReload=2. Its request list spans both Refresh and Reload, so use the separate earlier Refresh-only trace in `/tmp/ops-3bef-functional.json` for request-omission evidence: it contains only GET /auth/performance.

#### Per-menu tested actions and latest-fix status

| Menu | Browser actions against real sandbox | Other fresh checks / outcome | Remaining checks |
|---|---|---|---|
| Tasks | Empty title gives Title is required; choose assignee/date; create with no links; reload persists; edit and save; complete with note persists. Admin and manager have Add/Edit/Delete controls; agent has assigned-task view without Add. Date edit and Upcoming counts fail as above. | Empty lead/project saved as null (201), confirming historical O03 fix. Agent completing our admin-assigned task gets 404; manager completes it (200), confirming O02 ownership behavior. Agent view excludes our admin task. | Invalid/foreign assignee and foreign lead/project writes, inactive assignee submission, linked-lead navigation, task deletion, priority filter races, full cross-org matrix. O04 org-reference validation is source-reviewed at taskController.js:13, not runtime-certified. |
| Attendance | Admin and manager render Team Today/All Records; agent renders My Records. Manager has no Shift Settings control, confirming O08 fix. Camera/location unavailable capture can clock our synthetic admin in and out; both persisted through real status responses. Manager manual entry 09:30 to next-day 01:00 auto-checks overnight, persists 930 minutes, full day, overtime 360, no early leave; reload row shows 15h30m/+6h. CSV Download Report completes. Date clearing and paging exercised. | Missing selfie with no declaration rejected 400; explicit proofUnavailable accepted 200. Overnight manual-entry calculation confirms O07 fixed. Prior-day normal clock-out and page summary fail. | Selfie-off O05 branch source-reviewed (explicit mode at Attendance.jsx:297) but not runtime-tested because no shared settings were changed. Successful camera/GPS capture, upload-failure/quota paths, genuine browser location/camera permission recovery, midnight transition live. |
| Team | Admin creates our synthetic member through UI (201), edits phone, reloads, deactivates and reactivates; card status/phone persist. Manager gets read-only Team with 15 disabled mutation buttons and no Add. Agent direct Team route redirects to Dashboard. | Before other synthetic admins were added, demoting the sole sandbox admin was rejected 400 with continuity message, confirming P04. Normal reactivation passes when capacity exists. | Reactivation at purchased-seat limit, concurrent last-admin demotion, remove-user workflow, image-upload persistence/error paths, duplicate/invalid email and phone form boundaries. P06 capacity guards source-reviewed at authService.js:434 and :473; cap-hit runtime untested. |
| Performance | Admin and manager page render; agent direct route redirects to Dashboard. Refresh reloads lead metrics. Global Total Leads drill opens and lists shared synthetic lead once. Shared project with one imported lead and two assigned agents gives each agent project count=1, while global total moves 17 to 18 and drill has 18 records, confirming O14 distinct-total fix. Call Refresh fails as above. | Fixture created by real POST /projects and POST /projects/:id/leads/import (inserted=1). No mocked analytics. | Date filter boundaries and races, member filter/drill edit persistence, drill paging at volume, PDF/print export, live telephony ingestion and answered-call metrics. |
| Settings | Admin has Organization tab and role selector; manager/agent show My Profile, role text set by admin, no Organization tab. Own synthetic member password-change success with cookie, new-password login, and stale-bearer failure tested. | Old bearer rejected and fresh bearer accepted, confirming backend P02 revocation/response fix while exposing frontend continuation gap. Sole-admin guard tested via real team-update API. | Profile name/avatar save, invalid-password submissions, Google-only password creation, organization name/billing/auto-assignment persistence, logo quota/upload/removal, deletion flow. Shared settings intentionally not mutated; live file-storage checks require provider environment. |

No task UI Reopen defect is claimed. There is no supported Reopen button in this page; any request to add one is an improvement, separate from failures.

#### Source-only review, remaining risks and limitations

- Organization settings are admin-only in the frontend (Settings.jsx:412 and :550); manager Attendance settings write button is now hidden (Attendance.jsx:392). Team mutation controls are disabled for managers (Team.jsx:305, :308, :316). These role outcomes also passed in the browser.
- Task reference validation checks active org-local assignee and org-local lead/project in taskController.js:13. Foreign-reference attack permutations remain unrun; do not promote source review to a runtime security pass.
- Seat-reactivation guards exist in authService.js:434 and :473; our Enterprise sandbox with no seat ceiling did not exercise a full purchased-seat bucket. No new source-only seat defect is established.
- Selfie-off handler now passes the explicit clock-out mode, so do not repeat historical O05 blindly. That configuration remains source-only here. Proof upload errors and successful storage persistence require a storage-capable environment.
- Normal UI clock fallback used actual Chromium camera/location errors, not injected capture results. Saved selfie/location fields were empty by explicit unavailable-proof declaration, not a claim that photo/GPS capture succeeded.
- The parent's global sandbox-admin 1500-request rate exhaustion was audit load from multiple agents, not counted as an ordinary-use product bug. Switched to manager and then an own synthetic admin without resetting runtime. Shared public/options 429 was observed; parent owns cross-scope reporting/deduplication of that limiter issue.
- Source graph was built at b52cae10 and is stale; current source and fresh sandbox behavior determine findings.
- No builds/backend test suites were run by this worker; parent owns those checks. External providers were unavailable and no secrets were requested.
- UI tests did not cover every form boundary, concurrency interleaving, plan state, provider integration, or all record mutations. Remaining checks above are explicit; absence of a finding is not a pass for an untested action.

#### Artifacts and retained synthetic fixtures

Final report: `/tmp/frontend-avicenna-report.md`.

Machine-readable evidence: `/tmp/ops-3bef-functional.json`, `/tmp/ops-3bef-more.json`, `/tmp/ops-3bef-password-proof.json`, `/tmp/ops-3bef-attendance-final.json`, `/tmp/ops-3bef-last.json`, `/tmp/ops-3bef-page.json`, `/tmp/ops-3bef-callrefresh.json`.

Screenshots: `/tmp/ops-3bef-task-form.png`, `/tmp/ops-3bef-performance.png`, `/tmp/ops-3bef-performance-drill.png`, `/tmp/ops-3bef-attendance-capture.png`, `/tmp/ops-3bef-attendance-page2.png`. Download: `/tmp/ops-3bef-attendance-export.csv`.

Our synthetic member ID `6ac7c1d06013854e9ed2bdea`; own admin ID `6ac7c2547500d39138523345`; own project ID `6ac7c2926013854e9ed2cec1`. Member/admin fake logins and fixture IDs are in scope-prefixed /tmp files. Member's current fake password is Sandbox#12347; own admin remains Sandbox#12345. Fixtures retained for parent reproduction; none of another worker's fixtures were modified. Original task was assigned to an existing peer-created agent but all task mutations were confined to our own prefixed tasks. Shared project visibility assigns a seeded sandbox agent and our own member; only our new project was mutated.

The first attendance attempt could not seed its previous-day fixture because shared admin received 429; do not use that attempt as overnight-failure evidence. The successful later seed/status/clock-out reproduction in ops-3bef-last.json supplies that evidence. The first clock capture probe fell back to API requests; the later own-admin capture buttons supplied actual browser clock-in/out evidence. These distinctions prevent preliminary failures from becoming false passes or findings.

## Worker appendix: Fermat

### Commercial frontend functional audit — Fermat

Application cutoff: **3bef24a**. Checkout HEAD during testing: **97017fd**; `git diff --name-only 3bef24a HEAD` showed only AGENT_BRIDGE.md. Audit performed 2026-10-08 against the parent's fresh real sandbox at localhost:5000 and Vite at localhost:3000. Read CLAUDE.md, AGENTS.md, AGENT_BRIDGE.md and the full graph report before source. Graph report itself is stale (built from b52cae10); findings below use current source and fresh runtime. Historical launch findings were rechecked, not carried forward as current failures.

Scope: Developers, Bookings, Invoices, Referrals, Help & Support. Repository and mobile were not edited; no pull, commit, push, runtime restart or shared settings mutation. Parent owns multi-agent coordination, runtime and publication. A nested CLI reviewer could not initialize its app-server client on the read-only filesystem; no independent nested review is claimed here.

Evidence labels:
- **B+S**: actual Chromium workflow with real fresh sandbox backend/database, plus source trace.
- **B+S/timing**: real API responses held/released by Playwright to reproduce response-order races; response bodies were not fabricated.
- **B/M+S**: browser with explicitly simulated API failures, plus source trace.
- **S**: source-only; not a runtime pass or failure claim.

Synthetic data prefixes: `COMM-8OCT-muzqmzsv`, initial developer-only attempt `COMM-8OCT-muzqld1m`, and support `COMM-SUPPORT-muzqmouz`. Own Chromium contexts; admin initially, manager after shared admin audit load hit its request budget. Parent's Audit*/Parent Race* records were observed but never changed. Fifty-one additional own booking/invoice pairs were created through the real API for pagination tests. Own records remain for parent review; the simple-template test booking/invoice and its developer were deleted through the UI.

#### Reproduced failures

##### COMM-01 — P1 — Duplicate invoices for one booking through two browser tabs — B+S/timing

Reproduction: create a new booking; open Bookings in two tabs; click that booking's Generate Invoice in both. For deterministic overlap, pause both outgoing POST requests until both buttons are disabled, then release both to the real backend together. Both responses returned **201**, producing invoice numbers **63 and 64**, each **₹23,600**, for booking `6ac7c2776013854e9ed2cc83`. Invoice IDs: `6ac7c27e6013854e9ed2cd34`, `6ac7c27e6013854e9ed2cd36`. This independently corroborates the parent's concurrent API reproduction.

Expected: one invoice, and an idempotent existing result or 409 for the competitor. Actual: both financial snapshots exist and count toward raised/pending totals; booking.invoiceId can only point at one of them.

Source: `backend/routes/invoiceRoutes.js:49` checks existing invoice separately from creation at `:54`; `backend/models/Invoice.js:9` requires bookingId but has no unique booking constraint; the only compound index is at `:68`. Browser protection is local: `frontend/src/pages/Bookings.jsx:358` sets one genLoading ID and `:494` disables only the matching button in that component. Both tabs' buttons really were disabled after clicking; that does not serialize backend generation. The handler has no in-flight guard at entry (`:357`). No ordinary single-tab double-click failure is claimed without reproduction.

Evidence: `/tmp/commercial-audit-scale-results.json`, `/tmp/commercial-audit-scale.cjs`.

##### COMM-02 — P2 — Saving an unchanged manual booking replaces its negotiated amount — B+S

Reproduction: through New Booking select own developer, set consideration ₹10,00,000 at 2%, check Enter amount directly, enter ₹12,345, retain developer FOS ₹50, save. Real API stored brokerageManual=true, brokerageAmount=12345, totalBill=14626.10. Click customer name to edit, change nothing, press Save Changes. Checkbox opens unchecked; preview switches to ₹20,000. Persisted result: brokerageManual=false, brokerageAmount=20000, totalBill=23659.

Expected: unchanged edit preserves negotiated amount and calculation mode. Actual: an unchanged save increased the bill **₹9,032.90**.

Source: `frontend/src/pages/Bookings.jsx:116` unconditionally sets manualBrokerage=false when editing; `:149` omits brokerageAmount in that mode; `backend/routes/bookingRoutes.js:142` interprets explicit false as switching to automatic mode and `:149` recalculates. Separate from historical O09: automatic recalculation now works; preserving manual mode does not.

Evidence: `/tmp/commercial-audit-results.json`, `/tmp/commercial-audit-workflows.cjs`.

##### COMM-03 — P2 — Decimal invoice amount-in-words is malformed in the actual PDF — B+S

Reproduction: own booking manual brokerage ₹123.45, CGST/SGST ₹11.11 each, invoice total ₹145.67; generate invoice and Download PDF. Download succeeded as one A4 page, 325,155 bytes, but both preview and rasterized downloaded PDF say:

`Rupees One Hundred Forty Six and undefined Crore undefined Lakh undefined Thousand Paise Only.`

Expected: one hundred forty-five rupees and sixty-seven paise. Source: `frontend/src/pages/Invoices.jsx:47` rounds rupees up, then `:48` computes negative paise; `:50` passes those to toWords. Both templates share the helper (`:193`, `:352`); detailed decimal template was exercised, simple integer template separately passed.

Evidence: `/tmp/commercial-audit-decimal.pdf`, `/tmp/commercial-audit-decimal-render.png`, `/tmp/commercial-audit-decimal-preview.png`, `/tmp/commercial-audit-results.json`.

##### COMM-04 — P2 — Old filter responses overwrite the currently selected status in both lists — B+S/timing

Reproduction with actual sandbox responses: on Bookings, select New and hold its fetched real response; select Paid and let it finish. Two Paid rows display. Release older New response: Paid tab remains selected (white active text), but table becomes **25 New rows**. Repeat Invoices with held Draft response then Payment Received: two paid rows become **50 Draft rows** while Payment Received remains selected.

Expected: only latest selected filter response changes rows/page/totals. Actual: old response overwrites current filter state; a user could inspect/download the wrong subset.

Source: `frontend/src/pages/Bookings.jsx:339` load closure, `:346` unconditional row update, `:355` effect; `frontend/src/pages/Invoices.jsx:485` load closure, `:489` unconditional row update, `:497` effect. Neither request cancellation nor current-filter/request-version guard is present. This is a commercial-list race; historical Leads polling fix does not cover these components.

Evidence: `/tmp/commercial-audit-filter-race-results.json`, `/tmp/commercial-audit-filter-race.cjs`, `/tmp/commercial-audit-bookings-filter-race.png`, `/tmp/commercial-audit-invoices-filter-race.png`.

##### COMM-05 — P2 — Total Bookings tile still counts loaded/filtered rows — B+S

Reproduction: whole-set API summary.count=83 and total=83. First page has 50 rows; tile says **Total Bookings 50**, Load more says **50 of 83**. Load more succeeds and tile becomes 83. Select New: 25 rows and tile **25**, although whole-set summary count is still 83 and the other tiles remain whole-set summaries.

Expected: tile uses whole-set count, consistent with other aggregate tiles and source comment. Actual: count depends on page/filter. Source: `frontend/src/pages/Bookings.jsx:409` uses bookings.length despite storing the correct summary at `:348`; source's whole-set stats comment at `:384`. Backend summary implementation is present (`backend/routes/bookingRoutes.js:54`). Bookings API returning total rather than pages is valid and is not a finding.

Evidence: `/tmp/commercial-audit-scale-results.json`, `/tmp/commercial-audit-booking-count.png`.

##### COMM-06 — P2 — Stored support attachment cannot be opened in tested Chromium — B+S

Reproduction: raise ticket with a 49-byte `.txt` attachment through UI. Ticket saves successfully, reopen thread, click attachment chip. Persisted href is `data:text/plain;base64,...`; Chromium popup navigates to `chrome-error://chromewebdata/` and says **This page is blocked / Your organization doesn’t allow you to view this site**. No file content opens. Claim is limited to the tested Chromium `.txt` workflow; other browser/MIME combinations were not exhaustively tested.

Expected: attachment content opens or downloads. Source: `frontend/src/pages/HelpSupport.jsx:394` stores FileReader data URLs; `:412` copies URL into attachment; `:641` opens the data URL as a top-level target=_blank link without download/blob handling.

Evidence: `/tmp/commercial-audit-support-results.json`, `/tmp/commercial-audit-referral-support.cjs`. Ticket: `TKT-20261008-0001`, `_id=6ac7c1a86013854e9ed2b89b`.

##### COMM-07 — P2 — Developers and Referrals mask API failure as genuinely empty data — B/M+S

Developers: while real developers exist, fulfill GET /api/developers with simulated JSON 500. Browser displays **No developers added yet** and first-developer CTA, with no error/retry explanation. Source: `frontend/src/pages/Developers.jsx:253` empty catch.

Referrals: fulfill GET /api/referrals/mine with simulated JSON 500; click Refresh. Browser displays four zero counts and **No referrals yet**, without an error. Source: `frontend/src/pages/Referrals.jsx:83` replaces failed fetch with empty list/zero summary. This synthetic response test proves frontend error handling, not an observed production outage or live referral loss.

Evidence: `/tmp/commercial-audit-support-resume-results.json`, `/tmp/commercial-audit-support-results.json`.

##### COMM-08 — P3 — Support ticket snapshot records workspace name as Unknown — B+S

Own UI-created ticket/reply response contains orgName=Unknown despite actual workspace Sandbox Realty. Source: `backend/controllers/ticketController.js:38` reads req.org.name, but the auth middleware projects org without name at `backend/middlewares/auth.js:118`, then attaches it at `:146`. Ticket's orgId and customer identity are correct; no authorization failure is claimed. User ticket thread does not display the workspace snapshot; downstream support-display impact is source-only/not exercised.

Evidence: `/tmp/commercial-audit-support-resume-results.json` (real POST reply response retains the saved snapshot).

#### Tested actions by menu

| Menu | Actions and result | Evidence/limits |
|---|---|---|
| Developers | **PASS** UI create with 0% brokerage, add RERA, edit 2%/FOS ₹50, persist defaults; blank-name validation and Cancel with zero POSTs. **PASS** soft-delete own simple developer removes it from list. **FAIL** simulated initial load failure appears empty. | Real create/update/list responses; `/tmp/commercial-audit-results.json`, `/tmp/commercial-audit-delete-results.json`; error case explicitly mocked. Logo upload/removal not exercised. |
| Bookings | **PASS** UI creation/manual calculation initially; required-customer validation and Cancel with zero POSTs; **FAIL** unchanged manual edit loses mode/amount. **PASS** deliberate typed automatic edit ₹20 lakh at 3% gives ₹60,000 brokerage, ₹60,050 pre-GST with ₹50 FOS, ₹70,859 gross. **PASS** change own developer before invoice. **PASS** load more 50→83; normal New/Paid filtering. **FAIL** count tile; **FAIL** delayed filter race. **PASS** delete own booking deletes linked invoice (booking GET404, invoice list has no matching bookingId). | `/tmp/commercial-audit-auto-edit-results.json`, `/tmp/commercial-audit-simple-results.json`, `/tmp/commercial-audit-delete-results.json`, scale/timing results. Earlier runner fill selected a formatted input before focus rerender and concatenated digits; that input was corrected with explicit focus/select-all typing and was not classified as an application bug. |
| Invoices | **PASS** UI Generate action/navigation for new booking; **FAIL** same booking can generate twice across tabs. **PASS** UI Payment Received updates booking to payment_received; custom number save persists. **PASS** real detailed and simple PDF files download, one A4 page each; detailed file visually inspected. **FAIL** decimal amount words. **PASS** 50→62 list load more and whole-set raised/received/pending totals, stable across paid filter. **FAIL** delayed filter race. | Snapshot totals: raised ₹2,72,017.67, received ₹70,945.67, pending ₹2,01,072.00 before later own test cleanup/race mutations. `/tmp/commercial-audit-scale-results.json`; detailed PDF 325155B, simple PDF 188131B. Source indicates shared words bug in both variants; simple integer IGST ₹200+₹36=₹236 preview passed. |
| Referrals | **PASS** real endpoint/render available; sandbox list empty. **PASS** Copy puts generated signup link in actual clipboard under granted browser clipboard permission. **PASS** calculator at 12 shows capped 6 free months. **FAIL** mocked 500 shows false-empty state. | Existing-grant lifecycle not browser-tested: no referred organizations seeded. External WhatsApp/email sharing delivery not attempted. |
| Support | **PASS** blank subject/too-short description client validation; Cancel with zero POSTs; valid ticket with attachment stored, success number, reopen thread, send reply 200 with persisted body. **PASS** 12 tickets paged 10+2 with total12. **PASS** agent GET of admin-owned ticket returns404 through real API. **FAIL** tested attachment opening. **P3** orgName snapshot Unknown. | Reply response excludes adminNotes; no real populated private note was seeded, so concealment of a populated note is source-verified rather than full regression sign-off. `/tmp/commercial-audit-support-resume-results.json`, `/tmp/commercial-audit-delete-results.json`. |

#### Historical fixes and source-only risks

- O09 automatic brokerage recalculation: verified fixed through actual deliberate typed UI edit; new manual-mode overwrite is separate COMM-02.
- O10 changing developer: verified fixed before invoicing; backend now returns409 if an invoice exists (`backend/routes/bookingRoutes.js:132`). That rejection path was not browser-tested.
- O11 fixed past-first-page accessibility and aggregate money totals: actual scale workflow passed; Total Bookings count tile remains COMM-05. No pages-key requirement exists.
- O12 0% developer default: actual UI create returned0; fixed.
- O13 reply serializer: current controller deletes adminNotes at `backend/controllers/ticketController.js:122`; own real reply response has none, but populated private-note fixture not tested.
- O15 reward fulfillment: current backend distinguishes reward_due from rewarded using referralRewardGrantedAt (`backend/routes/referralRoutes.js:26`), and UI labels reward_due **Reward Processing** (`frontend/src/pages/Referrals.jsx:22`). Treat as source-rechecked, not a verified actual grant or timer lifecycle.
- Invoice amendment policy remains a historical decision/risk, not counted again as a new bug: booking updates can change financial fields after an invoice snapshot exists (`backend/routes/bookingRoutes.js:138`, `:155`), while invoices snapshot them on creation (`backend/routes/invoiceRoutes.js:80`). Policy/sign-off needed; existing snapshot may be intentional.
- Clipboard rejection/unavailable API: `frontend/src/pages/Referrals.jsx:56` neither awaits nor catches clipboard write, then shows Copied at `:57`. Successful granted-permission copy passed; denied/missing clipboard behavior is source-only.
- Save/submit/reply buttons disable during ordinary requests, but keyboard Ctrl+Enter reply path calls sendReply without checking sending (`frontend/src/pages/HelpSupport.jsx:834`, `:679`). No duplicate reply runtime reproduction performed; source-only concurrency risk.

#### Environment evidence and remaining untested/live checks

- Shared sandbox-admin's 1500 requests/15min quota was consumed by five concurrent audit scopes. This interrupted initial scale attempts; those are audit-load artifacts, not ordinary-use failure findings. Tests resumed as sandbox-manager without restarting backend or clearing fixtures.
- Real GET /api/public/options repeatedly returned429 **Too many submissions** after the shared IP's contactLimiter10/15min was exhausted. Source mounts contactLimiter on every /api/public request (`backend/server.js:269`, `:350`), including GET options. This is separately confirmed design evidence for the parent to merge/deduplicate, not a commercial CRUD rate-limit finding. Options behavior when fetched successfully was not rechecked here.
- No build/npmtest/health certification from this scope: parent owns those checks.
- Untested: mobile/narrow layouts; browser zoom/large long forms; uploaded developer or organization logos, billing identity or brand settings; MIME/browser matrix for attachments; support category/priority combinations, oversized attachments, closed/resolved/admin-replied states, populated internal notes; manager-vs-admin-vs-agent matrix for all financial mutations; another tenant's records; deleted-developer existing booking/invoice behavior; invoice number uniqueness/reset, negative/extreme financial validation, crash/partial-write recovery, duplicate invoice cleanup; comprehensive deletion/retry races; invoice status reversions; template decimal matrix.
- Requires live/owner-provider checks: actual support email/WhatsApp/call delivery, human ticket handling and SLA; WhatsApp/email referral sharing destinations, signup attribution through public site, first paid referral reward scheduling and actual entitlement grant/annual cap enforcement; externally stored logos/image CORS and branded organization billing identity. No external provider was contacted, no secrets requested, no shared settings changed.
- Repository status remained clean after this scope; only HEAD-vs-cutoff difference is parent bridge documentation. All artifacts here are under /tmp.

#### Primary temporary evidence

`/tmp/commercial-audit-results.json` — developer CRUD, manual overwrite, detailed preview/PDF, paid sync and invoice number.
`/tmp/commercial-audit-auto-edit-results.json` — corrected deliberate automatic edit input and persistence.
`/tmp/commercial-audit-scale-results.json` — count/pagination/money and two-tab duplicate-generation evidence.
`/tmp/commercial-audit-filter-race-results.json` — real delayed-response status races.
`/tmp/commercial-audit-support-results.json` — referral simulated500/copy/calculator and ticket attachment reproduction.
`/tmp/commercial-audit-support-resume-results.json` — reply and ticket pagination, developer simulated500.
`/tmp/commercial-audit-simple-results.json` — developer swap and simple IGST/PDF.
`/tmp/commercial-audit-delete-results.json` — linked deletion, developer soft-delete and agent ticket404.
`/tmp/commercial-audit-decimal.pdf`, `/tmp/commercial-audit-simple.pdf`, `/tmp/commercial-audit-decimal-render.png` — actual exported PDFs and rendered malformed words.

`/tmp/commercial-audit-cancel-results.json` — actual developer/booking required-field validation and developer/booking/support Cancel: modal closed, no create POST issued.

## Worker appendix: Dalton

### Messaging frontend functional scope report

Application cutoff: 3bef24ac2e551208bb7021bf55ec09f15a6c30e2. Observed HEAD 97017fd2dc91e2e111f69a08a2cc227a6f1f987a (bridge-only change per parent). Fresh localhost:3000 frontend and localhost:5000 sandbox backend; sandbox DB localhost:35281/sandbox. Read CLAUDE.md, AGENTS.md, AGENT_BRIDGE.md fully and GRAPH_REPORT.md before source. Graph is stale at b52cae10; no wiki index exists. Historical launch audit used as leads for rechecking, not current proof. No repository/mobile edits, pulls, commits, pushes, runtime restarts or shared-settings mutations. Parent owns build and suite checks; they are not evidence produced by this scope.

#### Verified failures

##### MSG-01 / P2: Late Inbox response shows another contact's messages
Proof mode: real browser and real sandbox authentication/balance, MOCKED connected status, conversation list/details and message responses. Not reproduced with delayed real DB transport.
Reproduction: open contact A, delay its messages response 1.4 seconds, immediately select B. B's response first shows msg-B-private-message; after A's response, B's header and phone remain selected while msg-A-private-message replaces the thread. URL stays /conversations/bbbbbbbbbbbbbbbbbbbbbbbb. Polling may later correct it, but the incorrect state is visible.
Expected: only responses for the currently selected thread update its transcript and reply-window state. Actual: A updates B's displayed transcript and lastInboundAt.
Source: frontend/src/pages/Inbox.jsx:358-360 unconditionally updates shared state; :375-381 clears timers but does not cancel/ignore in-flight responses. loadConv clears state at :409-415 without preventing the delayed update.
Evidence: /tmp/msg-connected-tests.json actions “race before delayed A response” and “race after delayed A response”; screenshot /tmp/msg-inbox-race.png; replay /tmp/msg-connected-tests.cjs.

##### MSG-02 / P2: Inbox cannot retrieve history older than 60 messages
Proof mode: browser + REAL sandbox messages endpoint/DB; only WhatsApp connection-status response mocked. Seeded 61 own synthetic inbound messages with ordered timestamps. No provider involved.
Reproduction: open the synthetic 61-message thread and scroll to the top. Latest message 061 and message 002 render; message 001 does not. No older-message button exists; browser makes only GET /whatsapp/conversations/<id>/messages with no page parameter. Separately GET the same endpoint with ?page=2: returns 200 and msg-history-001. Synthetic records removed after test.
Expected: a way to view the full transcript. Actual: oldest messages are inaccessible in Inbox, despite existing API support.
Source: frontend/src/pages/Inbox.jsx:358 always requests the default page, :359 replaces rather than appends; :698-715 renders the thread with no history pagination. backend/routes/whatsappRoutes.js:3001 defaults limit=60; :3005-3007 paginates correctly.
Evidence: /tmp/msg-history.json, screenshot /tmp/msg-history.png, replay /tmp/msg-history.cjs.

##### MSG-03 / P3: Forbidden assistant builder remains usable through its URL
Proof mode: browser + REAL sandbox authorization; only WhatsApp connection-status response mocked.
Reproduction: log in as manager or agent, navigate directly to /conversations/agent/new, enter msg-role-denied-test, click Create agent. Both roles see the whole editable builder and the creation action. Both requests return 403 “Access denied. Required role: admin or super_admin”. No assistant is created.
Expected: consistent admin-only UI gate, as on /conversations/agent and /conversations/settings. Actual: builder permits work that can never be saved. Backend authorization HOLDS; this finding is a UI contract failure, not an authorization bypass.
Source: frontend/src/App.jsx:821-822 wraps builders in PlanOnly but no role gate; frontend/src/pages/conversations/AgentBuilder.jsx:261-267 reads role only for Enterprise flow entitlement, :347-362 submits without an admin UI gate. Contrast AgentsPage.jsx:247 with its admin explanation. Backend admin authorization: backend/routes/whatsappRoutes.js:2650,2672.
Evidence: /tmp/msg-connected-tests.json manager/agent “unauthorized assistant builder submit”, including real 403 response statuses; replay /tmp/msg-connected-tests.cjs.

##### MSG-04 / P3: Manager Inbox wallet opens an unusable checkout
Proof mode: browser + REAL sandbox balance/quote authorization; only WhatsApp connection-status response mocked.
Reproduction: manager opens /conversations/credits: no Add credits button (correct). Open Inbox and click the wallet pill titled “WhatsApp credits — click to top up”. It opens Add WhatsApp credits with the valid default ₹1,000 amount, but displays “Enter an amount” and cannot obtain a quote. Real manager GET /credits/topup/quote?creditPaise=100000 returns 403. No order/payment is attempted.
Expected: consistent admin-only top-up action, or a clear admin instruction. Actual: Inbox opens the admin-only modal and silently consumes quote failure.
Source: frontend/src/pages/Inbox.jsx:544-545 gates wallet click only on credits existing, not isAdmin; frontend/src/components/CreditTopUpModal.jsx:34-36 suppresses quote errors. backend/routes/creditRoutes.js:233 authorizes admin/super_admin only; :243 likewise gates orders. CreditsPage.jsx:337 gates its Add credits correctly.
Evidence: /tmp/msg-targeted.json “manager credits role gate” and “manager inbox credit pill opens admin-only checkout”; /tmp/msg-gates.json “real quote authorization” (403).

#### Separate cross-scope public API finding

PUB-OPTIONS / P2: GET /api/public/options shares the submission budget with contact/career forms.
Proof mode: browser + REAL sandbox 429 responses, corroborated by current source. Current exhaustion arose during multi-agent audit load; the shared admin's separate 1,500-request cap is NOT reported as ordinary-use failure.
Observed: repeated page loads show “Too many submissions, please try again later.” /tmp/msg-connected-tests.json records /api/public/options 429 across all three roles; the hydrated-options request itself is read-only.
Source: backend/server.js:269-272 creates max=10 requests per IP per 15 minutes; :347-350 applies the same limiter to contact, careers and all /api/public methods, including GET. backend/routes/publicRoutes.js:67-68 exposes options as a public cacheable GET. frontend/src/App.jsx:39-42 calls hydrateLeadOptions at module load; frontend/src/utils/constants.js:124 calls /public/options. frontend/src/services/api.js:115-116 displays the server 429 message.
Effect grounded in source: uncached GETs consume the budget intended for submissions, and once exhausted options reads get a submission-error toast. Bundled options remain as fallback. Did not deliberately perform a real external contact/career submission or measure a fresh eleven-request window; initial counter consumption by earlier agents is unknown.

#### Tested passes

| Action | Proof mode | Observed result |
|---|---|---|
| Admin, manager, agent fake login through UI | Browser + real sandbox | Each reached dashboard; disconnected messaging gate rendered. Initial incorrect test selector was corrected; not a product failure. |
| Disconnected Inbox/settings ownership explanation | Browser + real sandbox | Admin sees connect UI; manager/agent see admin-needed explanation. |
| Agent opens /integrations | Browser + real sandbox | Redirected to dashboard; admin/manager Integrations rendered. |
| Assistant create/edit/activate/pause/delete | Browser + real sandbox, connection status stub only | 201 create; 200 edit/active/paused/delete. Own synthetic assistant deleted. Live activation response verifies saved status, not actual AI reply delivery. |
| Routing rule creation | Browser + real sandbox | 201, persisted own rule label. API cleanup removed own rule. Does not prove webhook routing delivery. |
| Manager statement and top-up button visibility on Credits | Browser + real sandbox, connection status stub | Statement visible; Add credits absent. |
| CAPI setup prerequisite | Browser + real sandbox | Send a test event disabled when credentials/test code missing; enabled switch disabled without configuration. No settings saved. |
| Template role controls | Browser + real sandbox auth; approved-template list and connection status mocked | Approved template renders for all roles. Admin Delete visible; manager Delete absent; agent Delete and New template absent. Historical I18 not repeated. |
| Starter locks on Templates, Campaigns, AI Agents | Browser, auth/me plan response and connected status mocked | Each shows Growth-required upgrade wall. Does not prove backend downgrade runtime behavior. |
| Existing campaign edited name sent with reviewed settings | Browser + real auth; campaign/template/status/preview/send APIs mocked | Send payload name=msg-reviewed-new-name, correct template/language/category, mapping and audienceFilter included. No campaign executed or provider called. Historical I04 not repeated. |

Evidence: /tmp/msg-fresh-browser-real.json, /tmp/msg-targeted.json, /tmp/msg-gates.json, /tmp/msg-campaign-ui.json. Some early connected-screen captures used short waits and show only the shell; these are not counted as successful loaded-workflow tests. Subsequent explicit locator assertions provide the passes above.

#### Per-menu coverage for merge

| Menu | Tested actions and result | Outstanding |
|---|---|---|
| WhatsApp Inbox | PASS disconnected explanation, template role visibility, thread render with real synthetic messages. FAIL history >60 (real messages endpoint), contact-switch response race (mocked), manager top-up action (real authorization). | Actual outbound reply/template/media transport, resolve/reopen controls, assignment/handoff, bot resumption, qualification flow runtime. |
| Templates | PASS approved list fixture for all roles; admin Delete visible, manager Delete hidden, agent New/Delete absent. | Provider-backed create/edit/review/delete, header/button validation, AI draft; no claim of provider success. |
| Campaigns | PASS existing draft edited name included with full reviewed send payload (mocked campaign APIs). PASS Starter UI lock (mocked plan). | Actual preview audience/consent/cost, persisted execution, transport/concurrency/interruption/recovery. |
| AI Agents | PASS real sandbox create/edit/activate/pause/delete; PASS Starter UI lock (mocked plan). FAIL manager/agent direct builder URL (real 403 on save). | Default selection, scope/ad routing, real AI preview/replies, Enterprise flow runtime; state activation alone is not reply acceptance. |
| Credits | PASS real manager balance/statement view and no Add credits button. FAIL Inbox wallet action exposes forbidden quote. | Paid top-up, ledger CSV/pagination, free-tier race/exhaustion, auto-recharge mutation. |
| Integrations / routing | PASS admin/manager page load, agent redirect, synthetic rule create via UI (real 201); cleanup via API. | Rule edit/toggle/delete through UI, all-source actual ingress/routing, connections/OAuth/diagnostics/repair. |
| Meta conversions | PASS real initial setup display and disabled Send test event/switch with missing configuration. | Settings save/toggle, real test transport, event arrival/stage processing, logs/retry/dedupe. No shared settings changed. |

#### Source-only risks (not reproduced bugs)

- **Conversation-start ownership asymmetry:** backend/routes/whatsappRoutes.js:2951 looks up a lead by ID and organization only; :2956 looks up an existing conversation by phone and organization; :2968-2975 returns the populated conversation without canAccessConversation. Detail/messages endpoints do enforce canAccessConversation (:2982-3004). A connected-org test with an agent naming another agent's lead/phone should verify whether the start action reveals that conversation or creates outreach tied to the other agent's lead. This branch was not executed because sandbox WhatsApp is disconnected and shared provider settings were not changed. Report as an authorization risk needing isolated handler/connected-fixture verification, not a confirmed browser exploit.
- **Other builder role gates:** App.jsx:814-815 and :817-818 use PlanOnly for template/campaign builders, without RequireRole; their save APIs are admin/manager gated. Their unauthorized direct-URL submits were not reproduced here. Distinct from the reproduced assistant-builder defect.

#### Source-only checks and remaining limits

Current source shows Growth route/API gates for templates/campaigns/assistant features (App.jsx:813-822; whatsappRoutes.js:2157), admin/super_admin assistant mutations, Enterprise conditional CTWA creation gate (whatsappRoutes.js:2541-2547), and admin/Growth CAPI API gate (metaConversionRoutes.js:18). Campaign send carries current reviewed fields (CampaignBuilder.jsx:132-135). Manager Delete UI gate is present (TemplatesPage.jsx:84-85,359). These statements describe code, not unexecuted transport success. No assertion that historical concurrency/consent/webhook/Google/CAPI transport findings passed this scope's runtime tests.

Not tested: actual text/template/media delivery, webhook signatures/batches/media/dedup, human handoff and assignment races, assistant OpenAI preview or real replies, default-assistant selection, campaign transport/concurrent start/interruption/consent filtering, free-credit exhaustion/races, Razorpay purchase/verify/duplicate callback, auto-recharge mutations, statement export with populated multi-page ledger, routing edit/pause/delete through UI or live ingestion for each source, retained Google connection after downgrade, OAuth/diagnose/repair/provider connection flows, real CAPI save/toggle/event transport/log retries/dedupe, super-admin messaging variants. Providers unavailable; no secrets requested. Actual provider acceptance remains requires-live.

Multi-agent context: parent coordinates the five-agent audit. Two additional independent source-review CLI launches within this scope were attempted but failed to initialize their app-server client with “Read-only file system (os error 30)”; no independent-review evidence claimed from them. Failure logs /tmp/msg-campaign-agent.log and /tmp/msg-integration-agent.log.

Only /tmp/msg-* artifacts written. Own synthetic admin (msg-audit-own-admin-1620@example.com) created directly in sandbox DB to avoid shared admin request cap; cleanup confirmed separately in /tmp/msg-cleanup.json. No shared settings were changed. Repository status remained clean at final check.

## Worker appendix: Carson

### Global frontend functional audit — Carson scope

Application cutoff: **3bef24a**. Workspace HEAD checked at **97017fd2dc91e2e111f69a08a2cc227a6f1f987a**; `git diff --name-only 3bef24a HEAD` reports only `AGENT_BRIDGE.md`. Date: 2026-10-08 UTC. Repo `/workspace/arthaleads`.

Read CLAUDE.md, AGENTS.md, AGENT_BRIDGE.md fully and graphify-out/GRAPH_REPORT.md before source; historical docs/audits/2026-10-08-launch-audit.md treated as superseded evidence, not a list of current defects. Parent owns runtime, bridge, build and backend tests. No repository/mobile edits, pull, commit, push, settings changes, provider transactions, or service restarts performed here. All scratch artifacts are under /tmp. This is the global frontend agent's independent scope in the parent's multi-agent audit.

#### Evidence contract and runtime

- **BR**: real Chromium UI + freshly started real sandbox backend localhost:5000 and Vite localhost:3000. Chromium `/usr/bin/chromium`, Playwright, own browser contexts, desktop 1440×900 and phone 390×844.
- **BR-delay**: same real sandbox responses, with one response delivery deliberately held by Playwright; no fabricated lead response.
- **BM**: browser with specifically mocked failure response. Does not establish a currently failing sandbox service.
- **S**: source trace only, not a reproduced workflow.
- Shared sandbox-admin exhausted its 1,500 requests/15 minutes across the concurrent audit. Those later errors/empty screens were excluded from ordinary-use findings. A separate synthetic admin, `Global3bef Audit Admin` / `global3bef-audit@example.com`, was created directly in the **sandbox** DB on port 35281 under the parent's explicit instruction; fake password Sandbox#12345, same seeded org. No shared settings changed. This isolated account was used to reconfirm mounted-page actions and race tests. Parent may remove it during sandbox teardown.
- Cross-agent synthetic records were read, never edited by this scope. Their names below identify the tested fixtures; existing seed names work for the generic navigation reproductions.
- No production or external-provider evidence. Parent-confirmed ProjectDetail missing-useMemo crash blocks its nested project actions; this agent did not claim those actions passed.

#### Reproduced findings

##### GF01 — P2 — Command actions are ignored on already-mounted Leads (BR)

Reproduce: open `/leads`; Ctrl+K; search `Audit Owned` or any existing seeded name; select **See all leads matching ...**. Command closes, URL remains `/leads`, table search stays empty, and the unfiltered first ten rows remain. From `/dashboard`, the same command opens Leads with the typed filter and one matching row. On already-mounted Leads, **Add a lead** opens no form, and **Follow-ups due today** leaves the all-leads list unchanged. Add a lead from Dashboard successfully opens the Add Lead modal. These are one route-state consumption defect family, not three independently counted bugs.

Source: `frontend/src/components/CommandMenu.jsx:75` and `:77` send navigation state; `frontend/src/components/Sidebar.jsx:233` sends presetSearch. `frontend/src/pages/Leads.jsx:298` passes presets only as initial filters; `frontend/src/hooks/useLeads.js:14` reads them only in initial state. `frontend/src/pages/Leads.jsx:390` consumes openAddLead in an effect with empty dependencies at `:398`.

Evidence: `/tmp/global-3bef-focused.json` (own-account due-today failure and successful cross-page Add Lead); initial real browser run also observed search input empty versus `Audit Owned` after Dashboard navigation, and zero dialogs after mounted-page Add. No data was submitted.

##### GF02 — P2 — Selecting a search lead on Calls or Follow Ups does nothing (BR)

Reproduce: open `/calls` or `/followups`; Ctrl+K; search `Sandbox Lead 2`; click the lead suggestion, rather than See all. Search closes and no Lead Details modal appears. The same result was observed before admin throttling with `Audit Owned Lead`, then reconfirmed on the separate synthetic admin. No error is shown for the ignored action. **See all leads matching ...** on these pages correctly changes `?q=...` and the page search input, so this is specific to opening suggestions.

Source: `frontend/src/components/CommandMenu.jsx:70` keeps these actions on the current page and sends `openLeadId` at `:71`. The effects in `frontend/src/pages/FollowUps.jsx:200` and `frontend/src/pages/Calls.jsx:704` only run on mount (empty dependencies at `FollowUps.jsx:208`, `Calls.jsx:711`).

Evidence: `/tmp/global-3bef-more.json`, entries `Own account suggestion on mounted FollowUps` and `...Calls`, both `dialogs: []`.

##### GF03 — P2 — Command search can show old matches for the current query (BR-delay)

Reproduce: Ctrl+K on Dashboard; type `Sandbox Lead 1`; hold its real `/api/leads/unified?search=Sandbox%20Lead%201&limit=6&page=1` response after it has been fetched. Type `Sandbox Lead 2` and let the real new response finish. UI correctly shows only Sandbox Lead 2. Release the first response. Input still reads **Sandbox Lead 2**, but suggestions change to **Sandbox Lead 12, 11, 10, 1**. Selecting a suggestion can therefore open an unrelated lead.

Source: `frontend/src/components/CommandMenu.jsx:60` starts the request and `:61` unconditionally installs its results. Cleanup at `:65` cancels the debounce timer only, not an in-flight request or response generation. This is distinct from historical F04 in useLeads: the table poll now has a stale-filter guard; the command menu does not.

Evidence: `/tmp/global-3bef-focused.json`, race before/after entries; `/tmp/global-3bef-search-race.png`; runner `/tmp/global-3bef-focused.cjs`.

##### GF04 — P2 — Project-lead search result cannot open when absent from current table (BR)

Reproduce with any project lead: open `/leads`, filter its table to another ordinary lead (tested `Sandbox Lead 2`). Ctrl+K; search the project lead (tested `CoreCRM3bef Main A`, returned by unified search with `_type: project` and `projectId`); select it. No Lead Details opens; toast **Unable to open that lead** appears. The command result exists and is accessible in unified search, but the fallback GET addresses the main-lead collection. This test does not enter ProjectDetail or depend on that page's crash.

Source: `frontend/src/components/CommandMenu.jsx:71` passes only `_id`, dropping `_type` and projectId. `frontend/src/pages/Leads.jsx:423` uses an entity only if it happens to be in the currently displayed table; otherwise `:430` requests `/leads/:id`. `backend/services/leadService.js:493` searches only Lead and `:500` emits 404 for a project-lead ID.

Evidence: `/tmp/global-3bef-more.json`, `Current unified types`, `Project suggestion`, `Project suggestion outside current list`; `/tmp/global-3bef-project-search.png`. The project fixture may be moved later by its owner; preserve the tested entity type as the reproduction prerequisite.

##### GF05 — P2 — Admin's recent lead details remain visible after logout and agent login (BR)

Reproduce: as admin, open a lead assigned to a different agent through Ctrl+K (tested `CoreCRM3bef Import B`, assigned to Audit Second Agent). Close detail. Sign out with the profile-menu button. Sign in as `sandbox-agent@example.com` in that same browser. Ctrl+K with an empty query. **Recent leads** still displays the previous admin's lead name, phone `9000036102`, and status Negotiation. An authenticated agent GET `/api/leads/<that-id>` concurrently returns **403 Access denied**, so this is stale frontend disclosure across an actual account boundary; the backend correctly refuses the record. No ability to edit/read its full detail was established.

Source: `frontend/src/components/CommandMenu.jsx:8` uses one global `cmd_recent_leads` key; `:12` persists ID/name/phone/status; `:89` renders it without current-account scoping. `frontend/src/context/AuthContext.jsx:56` clears crm_user, crm_org and bearer token, but leaves this cache. `backend/services/leadService.js:502` applies the agent ownership guard.

Evidence: `/tmp/global-3bef-cache.json`, actual admin detail, agent role, denied API request, and resulting command text; `/tmp/global-3bef-cache-leak.png`. This requires reuse of the same browser profile; it is not a cross-device backend disclosure.

##### GF06 — P2 — Startup options GET is blocked by the contact-submission budget and shows misleading copy (BR + S)

Fresh browser sessions and the separate synthetic admin received **429** on GET `/api/public/options`, body `Too many submissions, please try again later.` The same misleading toast appeared on ordinary CRM page loads even without a contact/career submission. Parent independently observed this separate limiter and reproduced GET requests returning nine 200 responses followed by 429 (the bucket already had a prior request), confirming the 10-request budget without any form submissions. This is not the 1,500-request audit concurrency finding.

Source: `backend/server.js:269` constructs a shared contactLimiter with `max: 10`, 15-minute window at `:270`, submission-only wording at `:272`; `:350` mounts it on **all** `/api/public`, including GET options. `backend/routes/publicRoutes.js:67` defines GET `/options`. `frontend/src/utils/constants.js:124` loads this endpoint for startup option hydration; its fallback retains bundled options. `frontend/src/services/api.js:115` globally toasts the misleading response. The source establishes that ordinary uncached GET requests consume the same small IP budget as contact/careers; no 11-request destructive burst or external submission was needed to reconfirm the already exhausted bucket.

Evidence: `/tmp/global-3bef-more.json`, `Fresh options GET` = 429. Impact established: spurious submission error and skipped runtime hydration, not missing entire CRM dropdowns (bundled defaults remain).

##### GF07 — P2 — Storage overview failure leaves an endless unexplained loading state (BM + S)

In a fresh own-account context, intercept only `/api/storage/overview` with 503 JSON `{success:false,message:"GLOBAL3BEF injected storage outage"}`. Open Plans → **Free up or add space**. Completed failed request leaves dialog text only **Manage storage**, one spinning loader, no alert, no retry action. Real overview and storage quotes worked in the normal sandbox; this is an error-path defect demonstrated with a controlled failure, not a claim of a live storage outage.

Source: `frontend/src/components/StorageManageModal.jsx:109` swallows overview errors; `:101` leaves ov null; `:192` maps null to the spinner with no failed state. Closing/reopening allows another attempt but offers no indication that loading already failed.

Evidence: `/tmp/global-3bef-more.json`, `Mocked overview503`; `/tmp/global-3bef-storage-error.png`.

#### Per-menu/action verification

| Surface | Actually tested | Result / limit |
|---|---|---|
| Login/account | Email/password seeded admin login; own synthetic admin login; seeded agent login after logout; profile Sign out | PASS, real sandbox. Bad-password, reset, Google/OTP and signup not executed. |
| Account switching | Seeded admin → Sandbox Manager; Viewing as banner; remove browser cookies and GET auth/me using newly stored bearer; reload; Switch back | PASS. Bearer-only request returned manager role, restore returned admin role. Historical P08 not repeated. No manager data mutation or session-expiry boundary test. |
| Sidebar/topbar | Admin/manager/agent menu visibility observed; breadcrumb/profile/search/bell present; phone drawer open then Leads link navigation | PASS on exercised actions. Agent command page list excludes Team/Integrations/Performance/Plans. Pin/flyout exhaustive interaction and every route not tested here. |
| Search | Ctrl+K; live seed/fixture matches; Escape; search-all from Dashboard; global phone search from Dashboard; Calls/FollowUps search-all; Add lead from Dashboard | PASS for these. GF01–GF05 capture failed cases; no lead was created through the form. Keyboard arrow selection and Team/Performance targeting not separately tested. |
| Notifications | Open bell; see real seven-day lead list; select entry to open populated lead details; bell badge cleared in context | PASS. External Web Push delivery/subscription, service-worker foreground delivery and device permission handling require dedicated browser/provider checks. |
| Help/Copilot | Open assistant; expand Common questions; start welcome tour; Next; close tour; Help & FAQ and Contact & Tickets tabs; open Raise Ticket form; cancel | PASS for UI/static actions. Actual FAQ answer expansion, AI answers/action previews/confirm/undo, ticket submit/reply/attachments/delivery not executed by this scope; parent messaging/support scope owns those. |
| Plans | Enterprise page; open Growth checkout; annual amount 5 seats ₹49,950; change Monthly and add seat → 6 seats ₹5,994; close checkout | PASS, real sandbox quotes. Same-plan renew/seat-change button source present; sandbox Enterprise has no self-serve current-plan renewal. Cancellation/resumption, paid proration and webhook/payment completion untested here. |
| Storage | Real 0 B/100 GB overview; initial 10 GB/12-month quote ₹1,401.84 including GST; change More + 1 month → 20 GB quote ₹233.64; unavailable-payment explanation; close | PASS. Normal zero-file overview exercised. File review/delete, recordings/selfie cleanup and quota warning thresholds not executed, since no files were seeded in this scope. GF07 is mocked error path. |
| Responsive | Dashboard and drawer 390×844; no document/main horizontal overflow (all 390px); phone Search then Enter navigates with correct Leads filter; drawer Leads navigation | PASS for these phone actions. Full Plans/storage/checkout/help-sheet phone interaction, landscape and very narrow 320px not checked. |
| Project drill-down | Global-search fallback tested without entering ProjectDetail | GF04 FAIL. Nested project actions blocked by parent-confirmed ProjectDetail useMemo ReferenceError; no nested action claimed as tested. |

#### Source-only risks, distinct from reproduced findings

1. **Calls/FollowUps detail-response envelope mismatch:** `frontend/src/pages/Calls.jsx:709` and `frontend/src/pages/FollowUps.jsx:206` assign `data.lead || data`, whereas actual controller emits `{success:true,data:lead}` at `backend/controllers/leadController.js:77`. Even after GF02 is repaired, these handlers need to unwrap `data.data`. Browser reopening via history/reload was not tested, so do not count this as an additional independently reproduced bug.
2. **Verification failures always become payment-success promises:** `frontend/src/components/CheckoutModal.jsx:102` catches every /billing/verify failure and says the plan will activate shortly; `frontend/src/components/StorageManageModal.jsx:161` does the same for space. A transient client reporting failure may be recovered by webhook, but this code does not distinguish invalid payment, authorization failure or failed fulfillment. No fake paid transaction or actual provider charge was performed; validate with provider test mode and failure injection before asserting financial impact.
3. **Project-files listing errors become a false empty state:** `frontend/src/components/StorageManageModal.jsx:37` catches list failure as `[]`, while `:63` displays No project files. Source only; no project-file request failed in a normal real sandbox run here.

These are follow-up risks, not evidence that a successful observed action failed. No unsupported task-reopen UI counted as a bug.

#### Remaining coverage and merge notes

- Parent owns build/npm tests and runtime health; no duplicated build/test result claimed here.
- Role/plan permutations beyond observed admin/manager/agent menus, trial-expiry/deletion/disabled-workspace overlays, checkout renewal/cancel/resume, storage high-quota popups, file-delete/retry, external AI/payment/push/email providers remain unverified by this scope.
- Same-browser cached-record privacy needs session/user/org-scoped cache invalidation; successful bearer account switching does not solve it.
- Do not copy misleading late shared-admin empty-state observations into the merged ordinary-use bug list. GF01/GF02 were reconfirmed with the separate admin, GF03 used its real successful responses, and GF06 names the separate public limiter explicitly.
- Reports and screenshots contain synthetic sandbox data only. Auth storage-state file `/tmp/global-3bef-state.json` contains fake sandbox sessions; do not publish that file. Report itself contains no session tokens.
- Useful runners/logs: `/tmp/global-3bef-focused.cjs` + `.json`, `/tmp/global-3bef-more.cjs` + `.json`, `/tmp/global-3bef-cache.cjs` + `.json`, `/tmp/global-3bef-extra.cjs` + `.json`. Some initial exploratory runners exited on selector timeouts; those are test-harness failures, not application findings. Final focused/more/cache runners completed their logged critical checks.
