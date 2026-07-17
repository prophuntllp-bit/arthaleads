# Arthaleads Web-to-Android Parity Audit

Updated: 17 July 2026

This is the working parity ledger for the installed Arthaleads web app (`com.arthaleads.www.twa`) and the native Flutter app (`com.arthaleads.crm`). A feature is only marked complete when its API behavior and phone interaction are both represented in the native app.

## Status legend

- **Complete**: native workflow is present and wired to the same backend behavior.
- **Improved / verify**: implementation exists; final phone regression testing is still required.
- **Partial**: core workflow exists but web controls or edge cases remain.
- **Missing**: no equivalent native workflow yet.

## Menu and feature matrix

| Area | Web behavior audited | Native status | Remaining parity work |
|---|---|---|---|
| App shell | Drawer, role-gated menus, theme, notifications, back navigation | Complete | Continue regression checks for deep links and cached tabs |
| Dashboard | KPI cards, trends, action-required overdue dropdown, hot leads, source/status charts, quick actions | Improved / verify | Phone-compare every card's empty/loading state and each drill-down |
| Leads | Search, filters, import/export/QR, lead detail, booking/remarks/follow-ups, contact actions | Partial | Audit every detail-sheet inline edit, bulk operation, saved filter, source icon, and import error state |
| Pipeline | Main/project pipelines, stages, drag/update workflows, filtering | Partial | Phone-test stage moves and project pipeline edge cases against web |
| Projects | CRUD, assignment, photos, BHK, amenities, possession, RERA, project leads | Improved / verify | Verify multi-photo data payloads and every Project Detail action on phone |
| Developers | Builder profiles, logo, statutory details, RERA, brokerage/incentive defaults, invoice template, delete | Improved / verify | New native screen and backend logo persistence require phone/API regression test |
| Bookings | Customer/unit/brokerage/GST/developer workflow, edit/detail/status | Partial | Full field-by-field form and calculations comparison still required |
| Invoices | Generate from booking, organization/developer data, PDF/download/share/status | Partial | Compare each template and PDF field against web output |
| Calls | Stats, filters, agent filter, call initiation, recording, transcript, AI analysis, notes, callback, follow-up task | Improved / verify | Verify provider states, recording failures, analytics and new full follow-up form |
| Follow Ups | Past/today/future, search, My Leads, latest/earliest, future range, inline lead fields, complete/reschedule | Partial | My Leads/sort/date range added; rich inline booking/remarks/note/second follow-up still need parity |
| Conversations | Conversation list, channels, messages, media/state actions | Partial | Audit WhatsApp/Facebook/Google channel-specific actions and attachment flows |
| Tasks | Manage/add, status, priorities, assignment, due filters, lead/project linking | Partial | Compare Add Task and Manage Tasks web forms, overdue actions, edit/delete and filters |
| Attendance | Clock in/out, in-app front camera, GPS, team today, proof drill-down, map, records, filters, summaries, CSV, manual entry/settings | Improved / verify | All Records added; verify member filter, selfie/map proofs, CSV and camera orientation on device |
| Dump Leads | List, filters, restore/delete/bulk behavior | Partial | Audit destructive confirmations, permissions, paging and all bulk actions |
| Team | Members, roles, invite/add/edit/disable, performance links | Partial | Compare role permission rules, activation and editing workflows |
| Automation | Rules, routing, templates/triggers/actions, enable/disable/edit/delete | Partial | Audit every rule type and validation path on phone |
| Performance | Member/date filters, pipeline metrics, conversion, downloadable report | Improved / verify | Report exists; compare PDF data and selected filters with web report |
| Settings | Profile, organization/billing, security, bank/GST/RERA, theme, assignment, attendance settings | Partial | Full organization field audit, logo/avatar upload, password/security and validation parity |
| Help & Support | Guide, FAQ, tickets, attachments, support contacts, AI help | Partial | Phone-test ticket lifecycle, attachments/replies and external contact actions |
| Referrals | Referral code/link, copy/share, history, how-it-works | Partial | Resolve loading placeholders and compare referral-history states |

## Current implementation batch

1. Follow Ups now sends `myOnly`, explicit sort direction, and future `from`/`to` parameters.
2. Projects now use a real multi-photo phone picker with 640 px / 60% compression, preview/removal, maximum five images, URL fallback, structured BHK and amenity chips, possession date, and agent visibility warning.
3. Attendance now separates My, Team Today, and All Records; My is correctly scoped to the signed-in user. All Records includes team/date filtering, six summary metrics, proof drill-down, map opening, and report download.
4. Calls now expose refresh, a complete follow-up task form (title/date/description), and summary copy.
5. Developers now has a native CRUD screen including logos, statutory data, RERA numbers, brokerage/incentive defaults, invoice template, and safe delete. The backend now persists developer logos as the web UI intended.

## Verification gate for every batch

1. Format and static-analyze changed Flutter files.
2. Build a release APK.
3. Install over the existing native app without clearing session data.
4. Exercise changed workflows on the connected phone and inspect screenshots/logcat.
5. Update this ledger, refresh Graphify, commit, and push `main`.
