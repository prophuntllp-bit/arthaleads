# Arthaleads prelaunch dashboard and marketing audit

> **Historical report at 0763d37.** Latest functional evidence and remaining launch blockers are in [the frontend cross-verification report](2026-10-08-cross-verification.md), tested against 3bef24a. The 57 findings and blocked sandbox status below are the original snapshot, not current unresolved counts.

Audit date: 8 October 2026, IST. Proposed launch: 15 October 2026.
Application source reviewed: **0763d37**. Audit registration: f12e1a4.
Final pull also included Claude's 4d65a5c mobile 1.0.12 release metadata; it did not change the dashboard workflow implementation reviewed here.
Five parallel agents completed independent reviews: core CRM, business operations, integrations, platform/access/billing, and marketing.

## Launch recommendation

**Do not sign off the launch yet.** Address the access-control, payment recovery, transfer/data-loss and financial-calculation findings first, then run database-backed regression and provider checks. This report is a complete consolidation of the five source-review scopes and the available local verification. It is **not an assertion that every button or every production workflow was exercised**.

| Measure | Result |
|---|---:|
| Canonical customer capabilities inventoried | 61 |
| Capabilities associated with engineering findings | 39 |
| Capabilities needing engineering or documentation attention | 44 |
| Engineering findings | 57: 12 P1, 41 P2, 4 P3 |
| Additional marketing/documentation findings | 10 |
| Marketing coverage | 25 Present, 21 Partial, 15 Missing |
| Capabilities needing additional marketing explanation | 36: 21 Partial + 15 Missing |
| Customer dashboard pages rendered with API fixtures | 27 / 27 without browser exceptions |
| Public pages rendered with API fixtures | 20 / 20 without browser exceptions |
| Public marketing/content/legal templates source-reviewed | 21, including the blog article template |
| Database-backed dashboard CRUD sign-off | Not completed: sandbox MongoDB download blocked |
| Production/provider sign-off | Not completed; no production secrets used |

These counts have different meanings. A finding can affect several capabilities, and a capability can have several findings. The remaining 22 capabilities without an engineering finding are **not certified bug-free**. Marketing Present means an explicit public explanation exists, not that the underlying feature passed runtime tests. Super-admin tools and native-only mobile capabilities are excluded from the 61-feature customer inventory.

## Evidence and scope

**C** = frontend/API/service/model source trace. **M** = repository handlers/models executed with isolated synthetic dependencies; Mongo persistence and concurrency remain unverified. **B** = actual Chromium UI interaction with controlled API fixtures. A combination describes the evidence, not production verification.

The main reviewer reproduced:
- Storage and WhatsApp-credit payment recovery failures using real service functions with a simulated failed grant.
- Clock Out posting to /attendance/clockin when selfie requirements are off, through an actual browser click.
- Unlinked task edits sending empty lead/project IDs, through an actual browser click; the actual Mongoose Task model rejected both IDs.
- An old unfiltered lead poll overwriting a newer Beta search result, through controlled browser response timing.

The agents supplied additional source and isolated-handler/model evidence described below. No live campaigns, messages, calls, payments, production records or production storage were changed.

Verification completed:
- Frontend production build passed on the reviewed application source. Large bundle and mixed static/dynamic import warnings remain.
- Backend npm test failed at account-deletion coverage with **8 failed assertions**; its chained database suites did not run.
- Account-deletion behaviour suite was run separately and passed its mocked behavioural checks. It does not resolve the coverage failures or demonstrate database correctness.
- 27 customer dashboard routes rendered with valid empty-state API fixtures, including Inbox subpages and integration configuration pages.
- 20 public routes rendered without page exceptions; API-dependent content was stubbed. Blog article data, case-study production content, form delivery and all public interactions were not comprehensively exercised.

Sandbox startup still fails because the official MongoDB download domain returns proxy HTTP 403. An approved escalation also returned 403. The onboarding configuration draft now adds **fastdl.mongodb.org** and uses the repository's fake-secret sandbox instead of requesting a real database. **Draft save does not apply or publish the configuration.** Environment settings must be reviewed/saved and published before retrying database-backed tests. Frontend default port is 3000. No production credentials are required.

## What Claude Code shipped recently

The pulled code includes storage packs and cleanup; project-file removal; dashboard data prefetched before its main render; editable routing-rule labels/agents/projects; broader lead-source pills; stable sidebar/topbar while pages load; Meta CAPI event selection, log/testing/retries; and WhatsApp history for transferred and routing-copy project leads. Meta CAPI is shipped code at this cutoff, although Claude's bridge explicitly says real Meta verification is outstanding.

The preceding mobile release and mobile parity work were read as coordination context only. **No mobile files were edited by this audit.**
During consolidation, Claude published mobile 1.0.12 (build 38) with project WhatsApp chat; its release metadata was pulled and preserved.

## Severity and release gates

- **P1:** fix before launch because the path risks unauthorized access, credential exposure, data loss, paid entitlement loss, or materially incorrect subscription grants.
- **P2:** user-visible correctness or workflow failure; fix before exposing the affected launch workflow, or explicitly disable it with a clear explanation.
- **P3:** lower-impact permission, validation or allowance mismatch; schedule promptly and correct public promises before launch.

Severity depends on stated reproduction conditions. Provider-facing source findings need a controlled provider or transport test before claiming production impact. No production ingress protection or operational backup coverage was assumed.

## Engineering findings

### Shared data, payments and deletion

| ID / priority / evidence | Reproduction, expected versus actual, and repair direction |
|---|---|
| F01 / P1 / M+C | **Paid storage can remain ungranted permanently.** Fail the organization pack write after the order is marked applied; retry the callback. Expected: eventual pack grant once. Actual: retry reports already applied and skips the grant. Use an atomic grant/order transition or a recoverable idempotent state machine. [storageOrderService.js:54](../../backend/services/storageOrderService.js#L54). Feature 50. |
| F02 / P1 / M+C | **Paid WhatsApp credits have the same recovery hole.** Fail the wallet top-up after claiming the order; retry. Expected: eventual credit grant once. Actual: the order prevents retrying the failed grant. [creditTopUpService.js:100](../../backend/services/creditTopUpService.js#L100). Feature 31. |
| F03 / P2 / test+C | **User deletion misses current user references.** Coverage reports missing CreditOrder, StorageOrder, WaAgent and WaCampaign dispositions; Lead.deletedBy, Project.advisorId, ProjectLead.assignedTo and three WhatsApp notification-recipient fields are also missed. This is one cleanup defect family with eight assertions, not eight separate bugs. Extend disposition coverage and verify retained records after deletion. [accountDeletionService.js:49](../../backend/services/accountDeletionService.js#L49). Feature 61. |
| F04 / P2 / B+C | **Background polling overwrites newer lead filters.** Hold an unfiltered poll, search Beta and receive Beta, then release the old Alpha result. Expected: Beta remains. Actual: Alpha replaces the list while the Beta filter remains. Guard the full request/filter generation and cancel superseded work. [useLeads.js:62](../../frontend/src/hooks/useLeads.js#L62). Feature 5. |

### Core CRM

| ID / priority / evidence | Reproduction, expected versus actual, and repair direction |
|---|---|
| C01 / P1 / C | **Agent can PATCH another agent's known same-org lead.** The partial-update route checks orgId but not agent ownership; expected denial, actual update and full lead response. Reuse the authorized lead lookup. [leadRoutes.js:195](../../backend/routes/leadRoutes.js#L195). Features 6, 56. |
| C02 / P1 / M+C | **Unassigned agent can transfer a known project lead.** Transfer checks source/target organization, not the agent's project assignment. Expected denied access after unassignment; actual transfer allowed. Authorize source and destination access. [projectService.js:431](../../backend/services/projectService.js#L431). Features 12, 56. |
| C03 / P1 / M+C | **Project-to-main transfer drops history and commercial details.** Transfer a populated project lead. Expected: notes, activities, budget, status and owner survive. Actual: only selected fields are copied and the project record is deleted. Define lossless mapping and an atomic/recoverable transfer. [projectService.js:449](../../backend/services/projectService.js#L449). Feature 12. |
| C04 / P2 / C | **ProjectDetail pencil saves to the main-lead API.** The row lacks the project type tag required by LeadForm. Expected project PATCH; actual main-lead PUT, normally 404. Pass an explicit entity type/project ID. [ProjectDetail.jsx:1306](../../frontend/src/pages/ProjectDetail.jsx#L1306), [LeadForm.jsx:135](../../frontend/src/components/LeadForm.jsx#L135). Feature 11. |
| C05 / P2 / C | **Project edit fields silently fail to persist.** Tagged project edits expose budget/priority/follow-up fields not accepted by the service, including followUpDate versus followUp. Expected saved values; actual ignored fields despite success. Align editable fields with API contract. [LeadForm.jsx:120](../../frontend/src/components/LeadForm.jsx#L120), [projectService.js:354](../../backend/services/projectService.js#L354). Feature 11. |
| C06 / P2 / C | **Exports omit records and selected project contacts.** Export 2,500 ordinary leads or selected imported project contacts. The unified export path caps each collection at 2,000; selected IDs are matched against the wrong/default list. Expected complete selection or explicit truncation; actual omissions. Use export-specific pagination/querying across entity types. [leadService.js:921](../../backend/services/leadService.js#L921), [leadController.js:342](../../backend/controllers/leadController.js#L342). Feature 7. |
| C07 / P2 / M+C | **Ordinary lead Follow Ups Note is discarded.** UI writes remarkNote, which is not a Lead schema field; Mongoose strips it. Map to the real note field. [FollowUps.jsx:32](../../frontend/src/pages/FollowUps.jsx#L32), [Lead.js:187](../../backend/models/Lead.js#L187). Feature 24. |
| C08 / P2 / M+C | **Future follow-up From date is ignored.** Choose next month; tomorrow's records still qualify. Apply the requested lower date bound. [followupService.js:78](../../backend/services/followupService.js#L78). Feature 24. |
| C09 / P2 / C | **Dashboard misses project follow-ups.** Move a due-today follow-up into a project. The union does not normalize the project's followUp field before followUpDate counting. Expected reminder remains; actual undercount. Normalize both entity schemas before aggregation. [leadService.js:1187](../../backend/services/leadService.js#L1187), [leadService.js:1247](../../backend/services/leadService.js#L1247). Features 1, 24. |
| C10 / P2 / C | **Repeated dump restore can duplicate project leads.** Repeat restore without requiring deleted state. Expected idempotent restoration; actual another project row can be created. Claim restoration and enforce unique origin/copy identity. [leadService.js:1519](../../backend/services/leadService.js#L1519). Features 13, 36. |

### Team and business operations

| ID / priority / evidence | Reproduction, expected versus actual, and repair direction |
|---|---|
| O01 / P1 / M+C | **Organization responses expose integration credentials to members.** Agent GET /org/me serializes the whole organization, including WhatsApp API key, telephony keys and voice API key when configured. Expected public profile fields; actual secrets included. Use an explicit shared public serializer; also review logo-save responses. Dummy values only were used. [orgRoutes.js:13](../../backend/routes/orgRoutes.js#L13), [Organization.js:148](../../backend/models/Organization.js#L148), [Organization.js:283](../../backend/models/Organization.js#L283). Features 51, 56. |
| O02 / P1 / C | **Task assignment accepts a foreign tenant's user ID.** Submit a known other-org assignee. Expected rejection; actual Task accepts the reference and notification routing targets that user ID with the task title/caller name. Validate assignee, lead and project tenancy before saving or notifying. Actual push delivery untested. [taskController.js:53](../../backend/controllers/taskController.js#L53), [push.js:156](../../backend/utils/push.js#L156). Features 33, 56. |
| O03 / P2 / M+C | **Agent can complete another agent's same-org task.** Completion checks organization, while listing scopes assignment. Expected forbidden/not found; actual status/note overwritten. Apply the same access predicate to reads and writes. [taskService.js:16](../../backend/services/taskService.js#L16). Features 33, 56. |
| O04 / P2 / B+M+C | **Unlinked task edits fail ObjectId validation.** Edit only the title of a task with no lead/project. Browser submits empty strings; actual Task schema rejects both. Normalize optional references to null and test clearing existing links. [Tasks.jsx:216](../../frontend/src/pages/Tasks.jsx#L216), [taskController.js:93](../../backend/controllers/taskController.js#L93). Feature 33. |
| O05 / P2 / B+C | **Clock Out calls Clock In with selfies disabled.** setCaptureMode does not update the handler's current closure before submitClock. Actual browser request was POST /attendance/clockin. Pass the operation directly. [Attendance.jsx:271](../../frontend/src/pages/Attendance.jsx#L271), [Attendance.jsx:292](../../frontend/src/pages/Attendance.jsx#L292). Feature 34. |
| O06 / P2 / M+C | **Mandatory attendance proof is client-only.** With requireSelfie true, post no proof or fail upload. Expected rejection; actual handler saves attendance without proof. Validate required selfie/location server-side and distinguish upload failure. [attendanceController.js:102](../../backend/controllers/attendanceController.js#L102). Feature 34. |
| O07 / P2 / M+C | **Overnight attendance gets wrong early-leave/overtime flags.** 09:30 in, next-day 01:00 out against a 19:00 shift end is marked 1,080 minutes early. Compare complete datetimes anchored to the attendance date. [attendanceController.js:46](../../backend/controllers/attendanceController.js#L46). Feature 35. |
| O08 / P3 / C | **Manager sees attendance settings Save but receives 403.** UI includes managers; organization settings write is admin-only. Hide/disable the action or explicitly grant the permission. [Attendance.jsx:159](../../frontend/src/pages/Attendance.jsx#L159), [orgRoutes.js:164](../../backend/routes/orgRoutes.js#L164). Feature 35. |
| O09 / P2 / M+C | **Booking edit retains old brokerage despite its new preview.** Change ₹10 lakh at 2% to ₹20 lakh at 3% in automatic mode. Expected ₹60,000 brokerage and ₹70,800 gross; actual ₹20,000 and ₹23,600. Preserve calculation mode and recalculate automatic values. [Bookings.jsx:147](../../frontend/src/pages/Bookings.jsx#L147), [bookingRoutes.js:117](../../backend/routes/bookingRoutes.js#L117). Feature 17. |
| O10 / P2 / M+C | **Changing booking developer silently does nothing.** UI submits developerId but update route never assigns it. Expected new developer on booking/invoice; actual old one remains. Validate/persist the change or make the field immutable. [bookingRoutes.js:105](../../backend/routes/bookingRoutes.js#L105). Feature 16. |
| O11 / P2 / C | **Bookings and Invoices hide records after the first 20.** APIs default to 20; pages have no pagination and filter/sum the returned subset. Expected accessible older records and complete totals; actual incomplete rows/totals and false empty filters. Add server paging/filtering and full aggregate totals. [Bookings.jsx:332](../../frontend/src/pages/Bookings.jsx#L332), [Invoices.jsx:478](../../frontend/src/pages/Invoices.jsx#L478), [bookingRoutes.js:39](../../backend/routes/bookingRoutes.js#L39). Features 16, 19. |
| O12 / P2 / M+C | **Zero developer brokerage becomes 2%.** Number(value) || 2 replaces valid zero. Distinguish absent/invalid values from zero. [developerRoutes.js:33](../../backend/routes/developerRoutes.js#L33). Feature 20. |
| O13 / P2 / M+C | **Support reply response exposes internal admin notes.** GET excludes notes, but reply loads/returns the complete ticket. Expected public conversation only; actual adminNotes included. Reuse a public ticket serializer. [ticketController.js:85](../../backend/controllers/ticketController.js#L85), [ticketController.js:103](../../backend/controllers/ticketController.js#L103). Feature 53. |
| O14 / P2 / C | **Performance tiles double-count shared project leads.** One lead in a project with two agents produces tile total 2 but drill-down 1. Aggregate distinct records for global tiles while retaining per-member attribution. [authService.js:585](../../backend/services/authService.js#L585), [Performance.jsx:303](../../frontend/src/pages/Performance.jsx#L303). Feature 47. |
| O15 / P2 / C | **Referrals say Rewarded without recorded fulfillment.** A past scheduled reward timestamp is enough; no grant-completed state is required. Expected completed status from actual entitlement grant; actual elapsed-time status. Introduce recorded fulfillment/reconciliation; actual reward delivery unverified. [referralRoutes.js:24](../../backend/routes/referralRoutes.js#L24). Feature 58. |

### Authentication, entitlement and storage

| ID / priority / evidence | Reproduction, expected versus actual, and repair direction |
|---|---|
| P01 / P1 / M+C | **Trial expiry blocks deletion cancellation.** Last admin schedules deletion, trial expires inside the 30-day window, then cancels. Expected cancellation available; actual TRIAL_EXPIRED leaves the schedule. Exempt authenticated status/cancellation from entitlement blocking. [auth.js:123](../../backend/middlewares/auth.js#L123), [auth.js:136](../../backend/middlewares/auth.js#L136). Feature 61. |
| P02 / P1 / M+C | **Password reset/change does not revoke existing sessions.** Keep JWT A, reset password elsewhere, reuse A. Expected old session rejected; actual middleware accepts it. Add password-change/session-version invalidation across all password change paths. [authService.js:509](../../backend/services/authService.js#L509), [auth.js:83](../../backend/middlewares/auth.js#L83). Feature 60. |
| P03 / P1 / M+C | **Short upgrade inherits the previous lower-tier paid term.** Buy one higher-tier month while a long lower-tier term remains. Higher tier activates immediately and runs through the old paid-through date plus the new month. Expected priced upgrade/seat adjustment; actual underpriced long entitlement. Separate renewal from upgrade/seat-change calculations. [billingService.js:44](../../backend/services/billingService.js#L44). Feature 48. |
| P04 / P2 / M+C | **Sole admin can demote themselves and strand administration.** Save Manager/Agent from Settings or Team without another active admin. Expected continuity guard; actual demotion saved. Enforce at least one active admin. [authService.js:321](../../backend/services/authService.js#L321), [authService.js:415](../../backend/services/authService.js#L415). Features 37, 51. |
| P05 / P2 / C | **No same-plan renewal or seat-change checkout.** Current card is noninteractive even near renewal/grace. Expected Renew/Add seats; actual only other plans open checkout. Add explicit renewal and seat-management flows. [Plans.jsx:178](../../frontend/src/pages/Plans.jsx#L178), [Plans.jsx:435](../../frontend/src/pages/Plans.jsx#L435). Feature 48. |
| P06 / P2 / M+C | **Reactivation bypasses purchased seats.** Deactivate a user, fill that seat, reactivate them. Creation checks limits; toggle/edit do not. Apply a single activation invariant to all transitions. [authService.js:368](../../backend/services/authService.js#L368), [authService.js:449](../../backend/services/authService.js#L449). Features 38, 48. |
| P07 / P2 / M+C | **Storage cleanup reports success after failed object removal.** References clear first and storage.remove swallows errors; the same batch can be counted repeatedly. Isolated failure contract counted 3,000 freed files from 300 undeleted objects over ten rounds. Delete successfully before clearing references/counting freed space, with durable retry state. [storageCleanup.js:63](../../backend/services/storageCleanup.js#L63), [storage.js:141](../../backend/utils/storage.js#L141). Feature 50. |
| P08 / P2 / C | **Account switching leaves the old Bearer token.** In supported cookie-unavailable mode, switching updates cookie/display identity but not stored _at. Expected target authorization; actual old identity continues. Synchronize token and cookie on switch/restore. Browser cookie-fallback conditions untested. [AccountSwitcher.jsx:36](../../frontend/src/components/AccountSwitcher.jsx#L36), [superAdminController.js:764](../../backend/controllers/superAdminController.js#L764). Feature 60. |
| P09 / P3 / C | **Reset form accepts six-character passwords rejected by API.** Matching Abc123 passes the UI but backend requires eight. Share one password policy. [ResetPassword.jsx:27](../../frontend/src/pages/ResetPassword.jsx#L27), [authController.js:698](../../backend/controllers/authController.js#L698). Feature 60. |
| P10 / P3 / C | **Logo upload bypasses documented quota.** The helper omits assertCanStore and errors can fall back to base64 in Mongo. Check quota with replacement accounting and preserve quota errors. [upload.js:65](../../backend/utils/upload.js#L65), [orgRoutes.js:200](../../backend/routes/orgRoutes.js#L200). Features 50, 51. |

### Messaging, integrations, calls and Meta CAPI

| ID / priority / evidence | Reproduction, expected versus actual, and repair direction |
|---|---|
| I01 / P1 / M+C | **Agents can access another agent's call recordings/notes.** History/detail helper checks orgId only, unlike the agent-scoped list. Expected denial; isolated request returned recording metadata and source permits notes changes. Authorize lead/project/activity access consistently. [enablexRoutes.js:58](../../backend/routes/enablexRoutes.js#L58), [enablexRoutes.js:1140](../../backend/routes/enablexRoutes.js#L1140). Features 22, 56. |
| I02 / P1 / C | **WhatsApp inbound POSTs lack signature authentication.** A correctly shaped unsigned request for an enabled org proceeds into capture/message/bot paths. Expected provider authentication before processing; actual no signature check on these routes. Verify provider signatures over raw bodies; production ingress protection remains unknown. [whatsappRoutes.js:2009](../../backend/routes/whatsappRoutes.js#L2009), [whatsappRoutes.js:2053](../../backend/routes/whatsappRoutes.js#L2053). Features 25, 56. |
| I03 / P2 / M+C | **Inbound parser loses batched messages and customer media.** Two-message envelope returns only the first; image/audio/document returns null. Iterate all entries/changes/messages and retain unsupported-to-AI media in the Inbox. [whatsappRoutes.js:227](../../backend/routes/whatsappRoutes.js#L227). Features 25, 26. |
| I04 / P2 / C | **Review & send ignores changes to an existing campaign draft.** Preview uses edited template/audience/mappings but execution sends the stored campaign ID. Expected reviewed settings; actual old draft settings. Persist/version the reviewed draft before send. [CampaignBuilder.jsx:129](../../frontend/src/pages/conversations/CampaignBuilder.jsx#L129), [waCampaignService.js:173](../../backend/services/waCampaignService.js#L173). Feature 28. |
| I05 / P2 / M+C | **Concurrent campaign starts can send twice.** Both requests read draft before asynchronous preview/reservation and later save sending. Isolated interleaving produced two reservations and sends. Atomically claim draft before side effects. [waCampaignService.js:168](../../backend/services/waCampaignService.js#L168). Feature 28. |
| I06 / P2 / M+C | **Campaign audience admits deleted records and uses the wrong domain field.** The query lacks deletion/archive exclusions; siteFilter uses websiteDomain rather than sourceDomain. Exclude deleted records, define archive eligibility explicitly, and align filters with Leads. [waCampaignService.js:76](../../backend/services/waCampaignService.js#L76). Feature 28. |
| I07 / P2 / M+C | **Inbox marketing-template sends bypass consent checks.** Denied/unknown linked-lead consent blocks campaigns but not send-template. Isolated handler sent without reading consent. Centralize marketing-send eligibility. [whatsappRoutes.js:3439](../../backend/routes/whatsappRoutes.js#L3439). Features 8, 27. |
| I08 / P2 / M+C | **Concurrent reservations exceed free reply allowance.** At 999 used, two reservations both get a free unit and usage reaches 1,001. Atomically allocate remaining free units before paid reservation. [creditService.js:146](../../backend/services/creditService.js#L146). Feature 31. |
| I09 / P2 / C | **CTWA manual starts/nudges bypass runtime gating.** After downgrade or agent pause, these paths can still send because plan/agent/connection eligibility is not consistently checked. Centralize pre-send eligibility. [whatsappRoutes.js:2950](../../backend/routes/whatsappRoutes.js#L2950), [ctwaFlowService.js:721](../../backend/services/ctwaFlowService.js#L721). Features 29, 30. |
| I10 / P2 / M+C | **Google capture persists after downgrade.** Enterprise-gated setup does not gate retained webhook/polling connections. Isolated polling processed a Starter org. Apply entitlement checks at runtime ingestion. [webhookRoutes.js:1449](../../backend/routes/webhookRoutes.js#L1449), [googleAdsPoller.js:229](../../backend/utils/googleAdsPoller.js#L229). Feature 41. |
| I11 / P2 / M+C | **Facebook routing can match another source's rule.** Object spread's source $or is overwritten by match-value $or. Expected Facebook-only rules; actual source restriction disappears. Combine predicates under $and. [routingRules.js:18](../../backend/utils/routingRules.js#L18). Feature 44. |
| I12 / P2 / M+C | **Google OAuth capture ignores project routing.** Agent assignment is applied, but fileLeadInRoutedProject is omitted on the OAuth insert path. Expected Lead plus project copy; actual Lead only. Reuse the shared project-filing path. [googleAdsPoller.js:145](../../backend/utils/googleAdsPoller.js#L145), [googleAdsPoller.js:197](../../backend/utils/googleAdsPoller.js#L197). Features 12, 41, 44. |
| I13 / P2 / M+C | **Google sync advances past failed submissions.** Cursor moves before insert; failures are swallowed and cursor saved. Expected retry; next strict-greater-than query excludes the failed item. Pagination/token handling also needs correction. Use durable per-submission processing and safe cursor advancement. [googleAdsPoller.js:122](../../backend/utils/googleAdsPoller.js#L122), [googleAdsPoller.js:220](../../backend/utils/googleAdsPoller.js#L220). Feature 41. |
| I14 / P2 / M+C | **Calls Create follow-up returns 404 for project leads.** UI sends project lead ID; backend resolves only Lead. Resolve both entities and store correct task association. [Calls.jsx:243](../../frontend/src/pages/Calls.jsx#L243), [enablexRoutes.js:1171](../../backend/routes/enablexRoutes.js#L1171). Features 22, 24, 33. |
| I15 / P2 / C | **CAPI can miss initial CTWA Lead event.** CTWA advances to Site Visit before the sweep, which only sends the current stage. Expected arrival plus visit; actual arrival never queued. Queue arrival at capture/attribution. [metaConversions.js:165](../../backend/services/metaConversions.js#L165), [ctwaFlowService.js:679](../../backend/services/ctwaFlowService.js#L679). Feature 46. |
| I16 / P2 / M+C | **CAPI pending events have no recovery path.** Lookup outside try fails after pending insertion; sweep retries failed only and dedupe stops later tracking. Recover stale pending work with an atomic processing claim. [metaConversions.js:103](../../backend/services/metaConversions.js#L103), [metaConversions.js:159](../../backend/services/metaConversions.js#L159). Feature 46. |
| I17 / P2 / M+C | **Send test event can send an ordinary dataset event.** Empty test code omits test_event_code from the payload. Require a code before this test-only action. This was transport-intercepted, not sent to Meta. [metaConversions.js:173](../../backend/services/metaConversions.js#L173). Feature 46. |
| I18 / P3 / C | **Manager sees template Delete but API forbids it.** UI canEdit includes managers; DELETE is admin-only. Separate delete permission from edit. [TemplatesPage.jsx:357](../../frontend/src/pages/conversations/TemplatesPage.jsx#L357), [whatsappRoutes.js:3197](../../backend/routes/whatsappRoutes.js#L3197). Feature 27. |

## Customer menu/action coverage and improvements

All rows below include source tracing. The 27-page browser smoke covered valid empty-state rendering, not all listed actions. Nested populated project details, individual chats, edit/build routes and every role/plan permutation still need database-backed interaction tests.

| Menu | Main actions reviewed | Findings / next improvement |
|---|---|---|
| Dashboard | Period/source analytics, hot/stale queues, follow-up panels, goal, project/team/source widgets | C09; distinct totals and retryable per-widget failure states; verify period changes and reminders against real records |
| Leads | Create/edit/inline fields, assign, outcomes, consent, notes, import, source tree/filter, selection/export, transfer/delete | C01, C06, F04; protect every mutation; export complete datasets; explain import conflicts and errors |
| Pipeline | Main/project stages, movement, contact/booking actions, refresh/member filter | Verify stage persistence and synchronized copies; prevent failed drag operations from appearing saved |
| Projects / project detail | Project/team/advisor/media setup, prospective/imported leads, pencil/detail edits, transfer, dump restore, WhatsApp history, QR | C02–C05, C10; preserve history, type every entity correctly, show recoverable errors |
| Bookings | Create/edit, developer defaults, automatic/manual finances, filters/delete, generate/view invoice | O09–O11; paging, reliable financial preview, explicit invoice-amendment policy |
| Invoices | Lists/status/custom numbers, booking sync, preview and PDF variants | O11; full totals/paging; test populated PDFs and duplicate-generation recovery |
| Developers | Create/edit/delete, logo/RERA/defaults/template | O12; zero-value handling, clear defaults and soft-delete behavior |
| Calls / telephony | Settings/test, PSTN/WebRTC start/end, history/filter/recording, notes, AI summary, follow-up | I01, I14; consistent permissions and project support; provider/audio permission sign-off |
| Follow Ups | Overdue/today/future filters, note/outcome/date edits, done, contact/WhatsApp | C07–C09; shared schema/semantics and clearly defined completion versus untouched backlog |
| WhatsApp Inbox | Search/open/thread, replies/templates/media, assign/resolve/handoff, bot toggles, qualification start | I02, I03, I07, I09; authentic complete ingestion, consent parity and pause controls |
| Templates | Gallery/list/create/edit/delete, AI draft, approved-template sending | I07, I18; role parity and provider component validation |
| Campaigns | Audience preview, drafts/mappings/review/send, status polling/delivery | I04–I06; immutable approved review, atomic send, failure recovery and eligibility |
| Credits | Balance/usage/ledger, quote/top-up/verify, low-balance/recharge settings | F02, I08; atomic balances, reliable payment fulfillment, transparent costs |
| AI Agents | Create/edit/default/scope/pause/delete, preview/funnel, persona/media/flow settings | I09; central send eligibility and explicit plan limits |
| Conversation Settings | Connect/diagnose/test, profile/PIN, hours/operating controls | Verify every configured provider and keep disconnected/paused states truthful |
| Tasks | Summary/My Tasks/filter, links/assignee pickers, create/edit/delete, complete/reopen/note | O02–O04, I14; normalized optional fields, assignment security, timezone-safe dates |
| Attendance | Status/clock/capture, team/date/user lists/paging, manual entry/edit/export/rules | O05–O08; datetime arithmetic, backend proof validation, page versus global report totals |
| Dump Leads | Main/project search/list, origin-aware restore/import/permanent removal | C10; idempotent restores and clear origin/history policy |
| Team | Members/create/edit/avatar, activate/deactivate/remove, seats/roles | P04, P06; enforce admin continuity and seats on all mutations |
| Integrations | Facebook forms/tokens/labels, website/WordPress setup, Google sync, custom/voice ingestion, pause/diagnose/repair, routing edit | I10–I13; runtime plan enforcement, shared routing, durable ingestion |
| Meta Conversions | Save/toggle/stages, test event, log/retry, hooks/sweep | I15–I17; complete arrival events, recover pending work, test-only transport |
| Performance | Period/member/filter/refresh, tiles, paged drill-down/detail, call metrics, PDF | O14; distinct global totals; refresh call metrics with the rest of the page |
| Plans & Billing | Plan/seats/terms, checkout/history, cancel/resume, expiry/grace | P03, P05, P06; upgrade pricing and accessible renewal/seat management |
| Manage storage | Meter/overview/packs, project-file list/delete, recording/selfie preview/free-up | F01, P07, P10; recoverable deletion and quota accounting |
| Settings | Profile/password/role/avatar, workspace identity/logo/billing/auto-assignment/preferences | O01, P02, P04, P09, P10; response redaction and consistent validation |
| Help & Support | Guides/FAQ/tours/Copilot, contact, tickets/attachments/list/replies | O13; public ticket serialization and actual delivery/error verification |
| Referrals | List/summary, share/copy, calculator/status | O15; grant-backed reward states and truthful loading/error states |
| Global / account | Search/commands, alerts/PWA, signup approval/onboarding, login/reset/logout/switch, deletion/cancel | P01, P02, P08, P09, F03; consistent session lifecycle and access states |

Super-admin review covered approval/rejection, trials, plan/seats/storage grants, relevant impersonation and billing/access controls. It did **not** exhaustively interact with every super-admin editorial/analytics menu.

## Stable 61-capability inventory and marketing map

P = Present, A = Partial, M = Missing. Partial includes inaccurate or incomplete descriptions. Classification considers the entire current marketing site, not just the 17-card Features page.

| ID | Customer capability | Marketing |
|---:|---|:---:|
| 1 | Dashboard business/source analytics and admin intelligence | P |
| 2 | Prioritized leads and hot/stale attention queues | A |
| 3 | Unified lead records | P |
| 4 | Import, phone normalization and deduplication | A |
| 5 | Search/source/campaign filtering | A |
| 6 | Assignment, outcomes, notes and activity history | A |
| 7 | Lead export | P |
| 8 | WhatsApp consent management | M |
| 9 | Main/project pipeline and stage movement | P |
| 10 | Project/team/advisor configuration and media library | A |
| 11 | Project/prospective lead management | A |
| 12 | Transfer, merge and copy synchronization | M |
| 13 | Project dump recovery | M |
| 14 | Project WhatsApp history | M |
| 15 | Project/organization QR capture | P |
| 16 | Booking lifecycle | A |
| 17 | Brokerage and GST calculations | P |
| 18 | Branded invoices and letterhead | P |
| 19 | Invoice number/status management | M |
| 20 | Developer partners and financial defaults | M |
| 21 | Bridged/browser calling | P |
| 22 | Call history and recordings | P |
| 23 | Transcription, summaries, intent and optional stage advancement | P |
| 24 | Scheduled/overdue/upcoming follow-ups | P |
| 25 | WhatsApp conversations and manual replies | P |
| 26 | Conversation assignment, human handoff and media sending | A |
| 27 | Template lifecycle and AI drafting | A |
| 28 | Audience-based campaigns and delivery tracking | P |
| 29 | Scoped/configurable WhatsApp AI agents | A |
| 30 | CTWA qualification and site-visit flow | P |
| 31 | Credits, top-ups, statements and recharge | M |
| 32 | WhatsApp profile/PIN/business hours/operating settings | M |
| 33 | Assigned/linked tasks, completion and notes | M |
| 34 | Selfie/location clock-in/out and worked hours | P |
| 35 | Attendance reports, manual entries and rules | A |
| 36 | Dump review, restore, import and permanent removal | M |
| 37 | Team membership and roles | P |
| 38 | Seat usage visibility | M |
| 39 | Facebook capture and form mapping | P |
| 40 | Website/WordPress capture | P |
| 41 | Google Ads capture and sync | P |
| 42 | Custom webhook/API ingestion | A |
| 43 | Vistrow Voice ingestion | P |
| 44 | Campaign routing rules | A |
| 45 | Connection pause, diagnostics and repair | M |
| 46 | Shipped Meta CAPI selection/testing/logs/retries | M |
| 47 | Member performance, conversion/call metrics and drill-down | P |
| 48 | Plan/seat purchases, terms and payment history | P |
| 49 | Subscription cancellation/resumption | A |
| 50 | Storage quota/retention/packs/cleanup | A |
| 51 | Profile/password, workspace identity and preferences | A |
| 52 | Contextual guides/tours/Copilot answers/actions/undo | A |
| 53 | Support tickets, replies and attachments | M |
| 54 | Command/global search | M |
| 55 | Push alerts | P |
| 56 | Tenant/role-controlled workspace access | P |
| 57 | Installable web PWA | A |
| 58 | Referral links, qualification and rewards | P |
| 59 | Workspace request, approval, trial and onboarding | A |
| 60 | Authentication, verification and password recovery | A |
| 61 | Deletion request/cancellation | A |

Inventory evidence is the menu/action source trace above plus the marketing catalogue in [features.js](../../frontend/src/data/features.js), [Pricing.jsx](../../frontend/src/pages/Pricing.jsx), [Compare.jsx](../../frontend/src/pages/Compare.jsx), [ProductUpdates.jsx](../../frontend/src/pages/ProductUpdates.jsx), [HelpGuide.jsx](../../frontend/src/pages/HelpGuide.jsx) and the other public templates below.

Engineering attention applies to IDs:
**1, 5, 6, 7, 8, 11, 12, 13, 16, 17, 19, 20, 22, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 41, 44, 46, 47, 48, 50, 51, 53, 56, 58, 60, 61** (39).

Documentation adds five otherwise unflagged IDs: **2, 9, 42, 57, 59**. Combined attention: **44 / 61**. These flags denote a related finding, not that every action in a capability is broken.

The 15 missing explanations are IDs **8, 12, 13, 14, 19, 20, 31, 32, 33, 36, 38, 45, 46, 53, 54**. Storage is Partial because quotas/retention are described while packs and cleanup are not meaningfully showcased.

## Marketing/documentation corrections

| ID / priority | Evidence and required correction |
|---|---|
| M01 / P2 | Help Guide promises instant signup with no approval; signup creates pending organizations. Describe request, approval and onboarding accurately. [HelpGuide.jsx:10](../../frontend/src/pages/HelpGuide.jsx#L10), [authService.js:39](../../backend/services/authService.js#L39). Feature 59. |
| M02 / P2 | API Docs example uses verifyToken where the website receiver requires token; generic integration-token Bearer instructions do not match session-JWT authentication. Publish executable examples and distinguish webhook credentials from user sessions. [ApiDocs.jsx:139](../../frontend/src/pages/ApiDocs.jsx#L139), [ApiDocs.jsx:229](../../frontend/src/pages/ApiDocs.jsx#L229), [webhookRoutes.js:766](../../backend/routes/webhookRoutes.js#L766). Feature 42. |
| M03 / P2 attention | Daily-backup claims need operational substantiation: repository backup selects only eight collections. Other production backup coverage is unknown; a production backup failure was not established. Scope the claim and run a full restoration drill. [Security.jsx:21](../../frontend/src/pages/Security.jsx#L21), [backup.js:10](../../backend/utils/backup.js#L10). Feature 56. |
| M04 / P2 | Privacy's sales-follow-up-only Facebook use description omits enabled CAPI sending identifiers and outcomes back to Meta. Update the documented data flow and controls. [Privacy.jsx:129](../../frontend/src/pages/Privacy.jsx#L129), [metaConversions.js:63](../../backend/services/metaConversions.js#L63). Feature 46. |
| M05 / P3 | AI scoring copy overstates deterministic weighted rule scoring/project budget matching. Describe implemented scoring accurately or implement and verify the promised model behavior. [features.js:16](../../frontend/src/data/features.js#L16), [leadScorer.js:1](../../backend/utils/leadScorer.js#L1). Feature 2. |
| M06 / P3 | Public copy mixes booking outcomes with pipeline stages and uses Site Visited inconsistently with accepted values. Align all examples with the options catalogue. [leadOptions.js:20](../../backend/constants/leadOptions.js#L20). Features 9, 11, 24. |
| M07 / P3 | All Growth features trial copy omits trial's 1 GB versus paid Growth's 15 GB storage allowance. State trial limits visibly. [Pricing.jsx:114](../../frontend/src/pages/Pricing.jsx#L114), [plans.js:11](../../backend/constants/plans.js#L11). Features 50, 59. |
| M08 / P3 | Help Guide blurs marketing/CRM hosts, PWA and native-app instructions. Give platform-specific install/open steps. [HelpGuide.jsx:48](../../frontend/src/pages/HelpGuide.jsx#L48). Feature 57. |
| M09 / P2 | Product Updates advertises blog publishing as a customer feature, but writes require super-admin. Correct the announcement or define the intended customer product. [ProductUpdates.jsx:95](../../frontend/src/pages/ProductUpdates.jsx#L95), [blogRoutes.js:13](../../backend/routes/blogRoutes.js#L13). Outside customer feature count. |
| M10 / P2 | Cookie banner/preferences use different storage keys; Essential only is not reconciled with analytics-on preferences defaults. Share one preference state and verify its consumers. Actual tracking without consent was not established. [CookieBanner.jsx:5](../../frontend/src/components/CookieBanner.jsx#L5), [CookiePolicy.jsx:7](../../frontend/src/pages/CookiePolicy.jsx#L7). Outside customer feature count. |

## Page-by-page marketing improvement scope

Use **current product screenshots** wherever the screen itself proves the benefit. Capture the actual current UI with seeded or anonymized records; label demo data appropriately. Verify flows first. Never expose names, phone numbers, credentials, financial identifiers or internal support notes in public images. Real team/property photography belongs in trust/story sections where permission and provenance are available. Existing older laptop/dashboard compositions do not explain new workflows.

Replace repetitive equal-sized card grids with a clear narrative: customer problem, a substantial product screenshot, a short workflow, and one concrete outcome. Keep copy widths readable, increase section separation, and use lightweight purposeful transitions with reduced-motion support. Motion cannot substitute for current product evidence.

| Public page/template | Product/content improvement | Visual evidence to add |
|---|---|---|
| Landing | Preserve improved hero spacing; update old menu labels; substantiate portal automation, statistics and testimonials; tell capture → prioritize → act → close | Current populated dashboard, then a wide Inbox/lead workflow screenshot |
| Features | Organize the 61 capabilities into customer workflows; expand the 17-card catalogue without rendering 61 identical cards; show plan/role prerequisites | Inbox, project detail/transfer, Tasks, storage management and CAPI |
| Pricing | Explain credits, storage packs, trial allowance, seats and negotiated services; clearly separate included and usage-priced items | Billing/seat and storage-purchase views with readable allowances |
| Compare | Date/source competitor comparisons; clarify customer audit-log availability | Optional annotated examples rather than decorative cards |
| About Us | Reconcile adoption/uptime numbers; replace unsupported credibility statements | Verified team photography and genuine product-in-use images |
| Case Studies | Distinguish load failure from no content; publish dated, supported customer outcomes | Anonymized case-specific before/after workflows |
| Product Updates | Add October storage/routing/project chat/CAPI releases; correct blog/stage claims | One current screen per substantial release |
| Help Guide | Correct approval/tokens/navigation/platform instructions; teach one successful end-to-end journey | Sequential current screens with small annotations |
| WordPress Plugin | Replace outdated automation navigation; clarify setup token and deduplication behavior | Current CRM token location and real plugin configuration |
| Download App | State verified web/native parity and calling/cache limits; separate attendance from site visits | Current approved-release screens, without editing mobile code |
| Contact | Verify delivery/success/error states, clear response expectations and contact ownership | No CRM screenshot necessary |
| Careers | Support team/response-time claims and test application delivery | Real team/workplace photography where available |
| Blog index | Test loading/error/empty and image fallbacks; curate current release/use-case content | Article images with provenance |
| Blog article | Test missing slugs, long content and broken images; label illustrations | Article-specific real product captures where relevant |
| Refer & Earn | State qualification and actual grant timing; avoid implying automatic fulfillment until verified | Referral dashboard/status journey |
| API Docs | Correct payloads/authentication/base paths; provide tested copyable examples | Small token-location screenshot, not large decorative graphics |
| Security | Scope backup/export/operational guarantees and validate them | A clear data/control diagram; no decorative product photo required |
| Privacy | Describe CAPI and current plan-specific retention | Clear data-flow explanation; no screenshot required |
| Terms | Reconcile support-access controls/navigation with actual implementation | Text clarity; no screenshot required |
| Refund | Explain in-app cancellation, downgrade and actual retention behavior | Verified cancellation journey |
| Cookie Policy | Unify consent preferences and document functioning controls | No screenshot required |

Public-template sources are the corresponding files under frontend/src/pages plus shared marketing components. Dynamic live blog/case-study content, external testimonial evidence and delivered contact/career submissions remain unverified.

## Risks and policy decisions outside the 57 engineering findings

These are follow-up items, not additional confirmed bugs:
- Decide whether archived-project leads remain visible and whether former project members retain historical follow-ups.
- Reconcile Mark done with an old untouched New lead reappearing in the backlog.
- Test concurrent invoice generation and interrupted invoice/booking writes; define amendments for already-invoiced bookings.
- Super-admin impersonation lacks the actBy restrictions/attribution used in team switching. Decide and document intended support powers.
- Expired-trial checkout currently routes users toward contacting support. Decide whether self-service paid conversion should remain accessible.
- WordPress delivery has no durable retry; test transport failures and deduplication recovery.
- Confirm Google's API/GAQL compatibility and Meta template header/button requirements with provider test accounts.
- Fault-test campaign interruption recovery and rolling messaging-tier accounting.
- Substantiate adoption/uptime/testimonials, portal Auto connectors, SLA/white-label and cancellation-retention claims.
- Verify backup coverage and recovery across current models and object storage.

## Required regression and provider acceptance before launch

1. **Access matrix:** two synthetic organizations, admin/manager/two agents, every read and mutation for owned/unowned records. Test guessed known IDs, foreign assignees, removed project membership, call recordings, ticket responses and org serialization. Assert no credential/internal-note fields leak.
2. **Core journey:** capture/import → assign → contact → note/follow-up → project copy/transfer → stage change → booking → invoice → delete/dump/restore. Compare fields, history, ownership, counts and totals after every step; retry mutations.
3. **Scale/data:** 21+ bookings/invoices; 2,500+ leads; exports/selections across ordinary/project contacts; source/campaign/date filters and delayed polls; shared-project performance totals.
4. **Team/account:** last-admin continuity, seat reactivation, password/session revocation, cookie-disabled switching, trial/grace/downgrade, deletion request/cancellation after expiry.
5. **Money/storage:** provider test-mode payment success/failure/cancel, duplicate and interrupted callbacks, wallet/pack recovery, plan upgrades/renewals/seats, expiry boundaries, quota/replacement and storage-delete failures. Reconcile paid orders with granted entitlements.
6. **Attendance:** selfie-required/optional, missing proof, upload failure, clock-out after reload, overnight shifts, manager settings, paging/export/totals and browser camera/location permissions.
7. **Messaging:** signed/unsigned webhooks, batches/media/duplicates, consent/deleted recipients, reviewed draft, concurrent sends, insufficient/free credits, pause/downgrade/nudges and human handoff.
8. **Integration/CAPI:** every source routes correctly; Google pagination/failure retry and project filing; CAPI arrival plus stage events, pending recovery/dedupe, test-code-only test events; provider test-event/delivery confirmation.
9. **Public experience:** every navigation/CTA/form and desktop/narrow layout; accurate plan/trial claims; updated screenshots; cookie preference consistency; legal text aligned with shipped data flows.
10. **Operations:** verified complete backup and restore, monitoring/error alerts, rollback steps and named release owner. Owners/providers can perform necessary live sign-off without sharing secrets with Codex.

## Seven-day delivery sequence

| Day | Focus and acceptance |
|---|---|
| 1 — Oct 8 | Fix P1 access/credential/webhook/session paths and paid storage/credit recovery; unblock isolated Mongo sandbox. Repeat negative access and payment-failure checks. |
| 2 — Oct 9 | Fix transfer preservation, project editing, exports, reminders and restore idempotency; run the complete CRM record journey with field/history comparison. |
| 3 — Oct 10 | Fix tasks, attendance, brokerage/developer changes, list pagination, seat/admin continuity and renewal/upgrade math; reconcile totals and entitlements. |
| 4 — Oct 11 | Fix campaign review/concurrency/audience, free-credit allocation, CTWA gates, Google routing/cursor and CAPI recovery/test behavior; run transport/fault tests. |
| 5 — Oct 12 | Owner/provider test-account sign-off for Meta/WhatsApp, telephony, Google, payment, storage and email; complete backup restoration rehearsal. |
| 6 — Oct 13 | Publish accurate feature/plan/guide/privacy copy and verified product screenshots; complete responsive/public CTA and permission-matrix regression. |
| 7 — Oct 14 | Freeze scope, rerun release regression, review unresolved findings, disable any unsafe unfinished workflow, rehearse rollback and approve launch criteria. |
| Launch — Oct 15 | Launch only with explicit acceptance of residual limitations, no unresolved P1 paths and passing enabled-workflow regression/provider sign-off. |

If the full scope cannot pass within seven days, reduce enabled launch scope. Do not replace acceptance evidence with a successful build or a clean empty-state smoke run.

## Coordination and changes

Only this audit document and the audit's own AGENT_BRIDGE entry are changed. Application logic, tests, dependency manifests/lockfiles and mobile files are unchanged by the audit. Claude entries are preserved. The report is documentation for review and prioritization; none of its proposed repairs have been implemented.

