# Personal data breach response runbook

Operator: Vistrow Technologies (makes and runs ArthaLeads).
Law: Digital Personal Data Protection Act 2023 and DPDP Rules 2025.
Contact for everything below: Grievance Officer, Vistrow Technologies, contact@arthaleads.com.
Written 28 Oct 2026. Review it every six months and after every incident.

## 1. Who we are in each case

- **Customer data (leads, bookings, chats, call records, attendance).** The customer organisation is the data fiduciary. Vistrow is its data processor. We must tell the customer without delay and help it meet its own duties. The customer notifies the Board and its people unless it asks us, in writing, to do it for them.
- **Our own data (customer account holders, billing contacts, website enquiries, demo requests, careers applicants, our staff).** Vistrow is the data fiduciary and notifies the Data Protection Board of India and the affected people itself.
- Many incidents touch both. Treat each set of people separately.

## 2. Who decides

- The **incident lead** is the most senior Vistrow person reachable at the time. They own the incident until they hand it over in writing.
- The incident lead decides: whether it is a personal data breach (if unsure, treat it as one), when to take systems offline, and when to notify.
- The Grievance Officer sends all notices. Nobody else talks to customers, the Board or the press about the incident.
- Keep one running incident log (time in IST, what was seen, what was done, by whom). It becomes the 72 hour report.

## 3. First hour

1. **Write down the time we became aware.** The "without delay" and 72 hour clocks start here.
2. **Contain.** Stop the leak before investigating it: disable the affected feature, user or integration; block the attacking IP; if needed, put the API in maintenance on Railway.
3. **Preserve evidence.** Do not delete logs, rows or files. Export the relevant audit log rows (section 4) and copy Railway logs before they roll off.
4. **Rotate secrets** that could be exposed, in this order, and redeploy after each:
   - MongoDB Atlas: database user passwords, then the connection string (MONGO_URI) on Railway; check Atlas network access and the Atlas access log.
   - JWT_SECRET on Railway. This signs every session, so everyone is signed out. Do it whenever a session or the server could be compromised.
   - Backblaze B2 application keys (media and backups). Check the bucket stays private.
   - OpenAI API key.
   - Meta: WhatsApp Cloud API system user tokens, app secret, webhook verify tokens, Facebook lead ads page tokens.
   - Plivo and EnableX auth tokens and API keys.
   - Railway and Vercel: account passwords, team members, deploy tokens, and any env var shared with the incident.
   - Per-organisation keys we hold (voice API keys, website form tokens, outbound integration keys) for affected organisations.
5. **Check access to the consoles themselves** (Atlas, Railway, Vercel, Backblaze, Meta Business, GitHub): remove unknown members, turn on two-factor login where missing.

## 4. Scope it with the audit log

ArthaLeads keeps an activity log in the `auditlogs` collection for about 400 days (never less than a year). Activity rows have an `at` field. Each row holds: time, organisation (`targetOrg`), who (`performedBy`, and `targetUser` when someone acted as another person), role, `via` (switch_user, support_access, api_key), IP, browser, action, method, path, status and record ids from the path. It never holds request bodies, passwords, tokens, OTPs or a lead's phone or email.

Org admins can read their own log at `GET /api/audit-log`; a super admin can read all of it (filters: from, to, userId, action, orgId).

Useful questions, run read-only against Atlas:

- What did a suspect account do? `{ at: { $gte: <start> }, $or: [{ performedBy: <id> }, { targetUser: <id> }] }`
- What came from a suspect IP? `{ at: { $gte: <start> }, ip: "<ip>" }`
- Who exported data? `{ action: "data_export", at: { $gte: <start> } }`
- Who deleted in bulk? `{ action: { $in: ["bulk_delete", "permanent_delete"] } }`
- Password guessing? `{ action: "login_failed" }`, grouped by `ip` and by `details.identifierHash`.
- Support access to a customer? `{ action: "support_access" }` and `{ via: "support_access" }`.

From this, list: which organisations, which people (staff and, through the record ids, which leads), which kinds of data, and the first and last time of unauthorised access. Railway, Atlas, Backblaze and Meta logs fill the gaps.

## 5. Notify

**Customers (where we are the processor).** Without delay, and in any case on the same day we confirm their data is affected, email each affected organisation's admins from contact@arthaleads.com with: what happened, when, which of their data, what we have done, what they should do now, and that we will help them notify the Board and their people. Give them the audit rows for their organisation. Send updates as facts change and a written summary for their 72 hour report.

**Where Vistrow is the fiduciary,** do both of these:

- **Affected people, without delay,** in plain language by email (or the channel we normally use with them): what happened, the likely consequences for them, what we are doing about it, what they can do to protect themselves (for example change a password, watch for phishing), and the contact above.
- **Data Protection Board of India, without delay,** through the Board's online channel: a description of the breach, including its nature, extent, timing and location, and its likely impact.
- **Within 72 hours** of becoming aware (or a longer period the Board allows on request), send the Board the detailed report in section 6.

Also consider CERT-In: a cyber security incident must be reported to CERT-In within 6 hours under its 2022 directions. Check whether this incident is reportable.

## 6. The detailed report (72 hours)

1. Nature of the breach: what happened and how (for example stolen session, exposed key, misconfigured bucket).
2. Extent: number of people and organisations, kinds of personal data, number of records.
3. Timing: when it started, when it was found, when it was contained (IST).
4. Location: which systems and services, and where they run.
5. Likely impact on the people affected.
6. Facts and circumstances, and the reasons it happened.
7. Measures taken to contain and reduce harm, and changes to stop it happening again.
8. What is known about who caused it.
9. A report of the notices sent to affected people (when, how, how many).
10. Contact: Grievance Officer, Vistrow Technologies, contact@arthaleads.com.

## 7. After

- Keep the incident log, the exported audit rows and copies of every notice for at least one year.
- Hold a review within two weeks: what let it happen, what slowed us down, what to change in this runbook.
