# Graph Report - PROPHUNT CRM  (2026-05-23)

## Corpus Check
- 132 files · ~220,018 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 881 nodes · 1789 edges · 62 communities (55 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `822da4b9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 47 edges
2. `usePublicTheme()` - 34 edges
3. `Spinner()` - 27 edges
4. `AppError` - 19 edges
5. `protect()` - 16 edges
6. `PageLoader()` - 15 edges
7. `useSEO()` - 15 edges
8. `EmptyState()` - 14 edges
9. `PublicThemeProvider()` - 12 edges
10. `Modal()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Signup()` --calls--> `useAuth()`  [EXTRACTED]
  pages/Signup.jsx → frontend/src/context/AuthContext.jsx
- `Team()` --calls--> `useAuth()`  [EXTRACTED]
  pages/Team.jsx → frontend/src/context/AuthContext.jsx
- `LegalLayout()` --calls--> `useAuth()`  [EXTRACTED]
  components/LegalLayout.jsx → frontend/src/context/AuthContext.jsx
- `SuperAdmin()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/SuperAdmin.jsx → frontend/src/context/AuthContext.jsx
- `NotificationBanner()` --calls--> `useAuth()`  [EXTRACTED]
  App.jsx → frontend/src/context/AuthContext.jsx

## Communities (62 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (19): { AppError }, _getCachedOrg(), invalidateOrgCache(), jwt, Organization, _orgCache, protect(), _setCachedOrg() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (41): Sentry, allowedOrigins, app, authLimiter, authRoutes, automationRoutes, blogController, blogLimiter (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (20): Automation, autoRefreshPageToken(), crypto, express, fetchLeadWithFallback(), fieldMap, findFacebookAutomationByPayload(), getFacebookLeadFields() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (29): { AppError }, authController, authService, cookieOptions(), otpService, sendAuthResponse(), { AppError }, authService (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (60): CursorGlow(), AuthContext, AuthProvider(), useAuth(), DumpLeads(), NotFound(), Projects(), ResetPassword() (+52 more)

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (11): authController, express, { protect, authorize }, router, {
  signupSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
}, validate, createUserSchema, loginSchema (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (11): mongoose, projectSchema, mongoose, routingRuleSchema, Automation, Lead, mongoose, Organization (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (62): ContactBox(), LegalLayout(), Section(), PublicFooter(), NavInner(), PublicNav(), resourcesLinks, PublicThemeContext (+54 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (19): Info(), LeadDetail(), FormField(), getPlatform(), openWABusiness(), openWAPersonal(), PhoneActions(), PriorityBadge() (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (34): followupController, followupService, activitySchema, formResponseSchema, Lead, leadSchema, mongoose, noteSchema (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (13): { AppError }, getDateRangeFilter(), { getNextAssignee }, Lead, leadService, logActivity(), Organization, Project (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (10): navItems, Sidebar(), useLiveClock(), ThemeContext, ThemeProvider(), useTheme(), minDisplay, reactReady (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.57
Nodes (6): arthaleads_connection_status(), arthaleads_detected_plugins(), arthaleads_get_site_name(), arthaleads_get_token(), arthaleads_send_lead(), arthaleads_settings_page()

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (11): useLeads(), BOOKING_OPTIONS, fmtLocalTime(), InlineDate(), Leads(), nowLocal(), _pad(), PROJ_BOOKING_OPTIONS (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (9): { AppError }, automationController, { createAutomationSchema, updateAutomationSchema }, express, { protect, authorize }, router, validate, createAutomationSchema (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (16): Automation(), emptyNonFbForm, FacebookIcon(), FacebookIcon2(), FacebookWizard(), FORM_PLUGINS, LeadRoutingSection(), MATCH_FIELD_LABELS (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (18): BOOKING_OPTIONS, cleanPhone(), fmtDate(), fmtLocalTime(), fmtPrice(), fromLocalInput(), InlineBooking(), InlineDate() (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (9): authorize(), express, projectController, { protect, authorize }, router, ctrl, express, { protect, authorize } (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (13): { createLeadSchema, updateLeadSchema, addNoteSchema, assignLeadSchema, importLeadsSchema }, express, leadController, { protect, authorize }, router, validate, addNoteSchema, assignLeadSchema (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (5): adminOnly, ctrl, express, { protect, authorize }, router

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (11): { AppError }, { invalidateOrgCache }, Lead, Organization, { runBackup }, superAdminController, { uploadOrgLogo, deleteOrgLogo }, User (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (5): BLOCK_TYPES, BlogEditor(), genId(), newBlock(), parseMarkdown()

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (8): initialForm, STAGE_META, BHK_OPTIONS, PRIORITY_OPTIONS, PROPERTY_TYPES, PURPOSE_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (4): express, followupController, { protect }, router

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (6): bcrypt, mongoose, obj, ROLES, User, userSchema

### Community 25 - "Community 25"
Cohesion: 0.26
Nodes (8): Login(), PhoneOtpPanel(), toE164(), Signup(), toE164(), app, auth, firebaseConfig

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (10): mongoose, oauthSessionSchema, { AppError }, applyDefaults(), Automation, automationService, DEFAULTS, jwt (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (4): faqs, PRIVACY_SECTIONS, quickActions, supportCards

### Community 28 - "Community 28"
Cohesion: 0.6
Nodes (3): extractName(), extractPhone(), ShareTarget()

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): express, { protect, authorize }, router, RoutingRule, User

### Community 30 - "Community 30"
Cohesion: 0.4
Nodes (11): copy, data, idbGetAll(), notifData, notifyClients, notifyClientsToRefresh(), openSyncDB(), queueRequest() (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.39
Nodes (7): ConfirmDialog(), EmptyState(), Modal(), PageLoader(), emptyMember, SummaryCard(), Team()

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (6): { AppError }, Attendance, attendanceController, User, attendanceSchema, mongoose

### Community 35 - "Community 35"
Cohesion: 0.36
Nodes (6): { AppError }, Lead, Project, ProjectLead, projectService, User

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (9): getResend(), logger, { Resend }, sanitize(), sendContactForm(), YEAR, express, router (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.28
Nodes (13): sendPushToUser(), cron, getManagersByOrg(), getTodayRange(), Lead, logger, notifyLeads(), ProjectLead (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.2
Nodes (6): Automation, automationController, automationService, crypto, automationSchema, mongoose

### Community 48 - "Community 48"
Cohesion: 0.32
Nodes (6): DateRangePicker(), DAYS, MONTHS, presetDates(), PRESETS, toIST()

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (6): AMENITY_OPTIONS, BHK_OPTIONS, empty, SOURCES, Spinner(), api

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (18): { AppError }, blocksToText(), BlogCategory, blogController, BlogPost, BlogTag, escapeRegex(), slugify() (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (8): { AppError }, leadController, leadService, { sendPushToAll }, logger, PushSubscription, sendPushToAll(), webPush

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (9): buildEmail(), COLLECTIONS, fmtBytes(), gzip(), logger, mongoose, { Resend }, runBackup() (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (5): { AppError }, projectController, projectService, AppError, logger

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (6): StatCard(), Dashboard(), getGreeting(), SOURCE_CHART_COLORS, SOURCE_COUNTERS, STATUS_CHART_COLORS

### Community 58 - "Community 58"
Cohesion: 0.43
Nodes (7): Attendance(), fmtDate(), fmtDuration(), fmtTime(), LiveTimer(), pad(), todayStr()

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (5): logFormat, logger, path, transports, winston

## Knowledge Gaps
- **204 isolated node(s):** `authService`, `otpService`, `{ AppError }`, `authController`, `crypto` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 4` to `Community 34`, `Community 7`, `Community 8`, `Community 11`, `Community 13`, `Community 16`, `Community 50`, `Community 25`, `Community 58`, `Community 57`, `Community 31`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `PublicThemeProvider()` connect `Community 7` to `Community 4`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Spinner()` connect `Community 50` to `Community 34`, `Community 4`, `Community 8`, `Community 13`, `Community 15`, `Community 16`, `Community 22`, `Community 25`, `Community 58`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `authService`, `otpService`, `{ AppError }` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._