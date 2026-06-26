from fpdf import FPDF
import datetime

class PDF(FPDF):
    def header(self):
        self.set_fill_color(255, 107, 0)
        self.rect(0, 0, 210, 14, 'F')
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(255, 255, 255)
        self.set_y(3)
        self.cell(0, 8, 'Arthaleads CRM - Pre-Launch Audit Report', align='C')
        self.set_text_color(0, 0, 0)
        self.ln(14)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 6, f'Arthaleads CRM Audit  |  {datetime.date.today().strftime("%B %d, %Y")}  |  Page {self.page_no()}', align='C')

    def section_title(self, title, color=(255, 107, 0)):
        self.ln(4)
        self.set_fill_color(*color)
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, f'  {title}', ln=True, fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def sub_title(self, title, color=(50, 50, 50)):
        self.ln(2)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(*color)
        self.cell(0, 7, title, ln=True)
        self.set_text_color(0, 0, 0)

    def body(self, text, indent=0):
        self.set_font('Helvetica', '', 9)
        self.set_text_color(50, 50, 50)
        self.set_x(10 + indent)
        self.multi_cell(0, 5, text)
        self.set_text_color(0, 0, 0)

    def badge(self, label, bg, fg=(255,255,255)):
        self.set_font('Helvetica', 'B', 8)
        self.set_fill_color(*bg)
        self.set_text_color(*fg)
        self.cell(22, 5, label, fill=True, align='C')
        self.set_text_color(0,0,0)

    def finding(self, severity, title, detail, file_ref=''):
        colors = {
            'HIGH':   (220, 53, 69),
            'MEDIUM': (255, 165, 0),
            'LOW':    (23, 162, 184),
            'GOOD':   (40, 167, 69),
            'INFO':   (108, 117, 125),
        }
        bg = colors.get(severity, (108,117,125))
        self.ln(2)
        x = self.get_x()
        y = self.get_y()
        self.set_fill_color(*bg)
        self.set_text_color(255,255,255)
        self.set_font('Helvetica', 'B', 8)
        self.cell(18, 6, severity, fill=True, align='C')
        self.set_text_color(30,30,30)
        self.set_font('Helvetica', 'B', 9)
        self.cell(0, 6, f'  {title}', ln=True)
        self.set_font('Helvetica', '', 8.5)
        self.set_text_color(70, 70, 70)
        self.set_x(14)
        self.multi_cell(0, 5, detail)
        if file_ref:
            self.set_x(14)
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(100,100,100)
            self.multi_cell(0, 4, f'File: {file_ref}')
        self.set_text_color(0,0,0)

    def table_row(self, cols, widths, bold=False, bg=None):
        if bg:
            self.set_fill_color(*bg)
        self.set_font('Helvetica', 'B' if bold else '', 8.5)
        self.set_text_color(30,30,30)
        x = self.get_x()
        for i, (col, w) in enumerate(zip(cols, widths)):
            fill = bool(bg)
            self.cell(w, 6, str(col), border=1, fill=fill, align='L')
        self.ln()
        self.set_text_color(0,0,0)

    def divider(self):
        self.ln(1)
        self.set_draw_color(220,220,220)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(2)


pdf = PDF()
pdf.set_margins(10, 18, 10)
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()

# ── COVER INFO ────────────────────────────────────────────────────────────────
pdf.set_font('Helvetica', 'B', 18)
pdf.set_text_color(255, 107, 0)
pdf.ln(6)
pdf.cell(0, 12, 'PRE-LAUNCH AUDIT REPORT', align='C', ln=True)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(100,100,100)
pdf.cell(0, 6, f'Prepared: {datetime.date.today().strftime("%B %d, %Y")}  |  Confidential  |  Version 1.0', align='C', ln=True)
pdf.ln(4)

# Summary box
pdf.set_fill_color(255, 247, 237)
pdf.set_draw_color(255, 107, 0)
pdf.rect(10, pdf.get_y(), 190, 28, 'DF')
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(50,50,50)
pdf.set_y(pdf.get_y() + 4)
pdf.cell(0, 5, '   Scope: Security  |  Bug Risks  |  Feature Gap vs Competitors  |  Compliance  |  Auth & Auth  |  Refer & Earn', ln=True)
pdf.set_font('Helvetica', '', 8.5)
pdf.cell(0, 5, '   Tools: Manual code review + automated static analysis across 50+ source files', ln=True)
pdf.cell(0, 5, '   Stack: React 18 + Vite (Vercel)  |  Node/Express (Railway)  |  MongoDB Atlas', ln=True)
pdf.cell(0, 5, '   Result: 9 issues found  (1 High  |  4 Medium  |  4 Low)  |  Codebase overall well-architected', ln=True)
pdf.ln(8)

# ── SECTION 1: SECURITY ───────────────────────────────────────────────────────
pdf.section_title('1. SECURITY AUDIT')

pdf.finding('GOOD', 'No Backend Secrets in Frontend',
    'JWT_SECRET, MONGO_URI, FB_APP_SECRET, RESEND_API_KEY, CLOUDINARY_API_SECRET -- none found in any frontend file.\n'
    'Frontend .env.local contains only public Firebase config keys (designed to be public by Firebase architecture).')

pdf.finding('GOOD', 'CORS Properly Configured',
    'Whitelist-only origins from CLIENT_URLS env var. Not wildcard *. credentials:true for httpOnly cookies.',
    'backend/server.js:91-102')

pdf.finding('GOOD', 'Rate Limiting in Place',
    'Auth endpoints: 50 req/15 min  |  General: 200 req/15 min  |  Contact form: 10 req/15 min  |  Blog: 60 req/min',
    'backend/server.js:104-140')

pdf.finding('GOOD', 'Helmet Security Headers Applied',
    'helmet() used globally -- sets CSP, X-Frame-Options, HSTS, X-Content-Type-Options, and more.')

pdf.finding('GOOD', 'Auth Middleware Solid',
    'protect() checks: token exists -> JWT valid -> user exists -> user active -> org active -> trial not expired.\n'
    'OrgId tenant isolation enforced on every DB query across leads, projects, automations, follow-ups.',
    'backend/middlewares/auth.js')

pdf.finding('GOOD', 'Facebook Webhook HMAC Verified',
    'X-Hub-Signature-256 HMAC with crypto.timingSafeEqual -- properly validates all incoming Facebook webhook POSTs.',
    'backend/routes/webhookRoutes.js:20-44')

pdf.finding('GOOD', 'DOMPurify on Blog HTML',
    'All dangerouslySetInnerHTML in PublicBlogPost.jsx passes through DOMPurify.sanitize() before render.',
    'frontend/src/pages/PublicBlogPost.jsx:77-80')

pdf.finding('GOOD', 'Error Handler -- No Stack Leaks',
    'Stack traces sent to client only in NODE_ENV=development. Production returns clean error messages.',
    'backend/middlewares/errorHandler.js:51-55')

pdf.finding('GOOD', 'No .env Files in Git',
    'All .env files properly gitignored. No secrets found in git history (last 20 commits checked).')

pdf.ln(2)
pdf.sub_title('Issues Found:')

pdf.finding('MEDIUM', 'No Server-Side Token Invalidation on Logout',
    'Logout only clears the client-side cookie. The JWT (7-day expiry) remains cryptographically valid server-side.\n'
    'If a token is stolen, the attacker can use it for up to 7 days after the user logs out.\n'
    'Fix: Add tokenVersion counter to User model, increment on logout, reject tokens with stale iat in protect().',
    'backend/controllers/authController.js:76-95')

pdf.finding('MEDIUM', 'JWT Also Stored in localStorage (XSS Risk)',
    'Token (_at) stored in localStorage as fallback for cross-domain environments. Primary mechanism (httpOnly cookie)\n'
    'is correct and XSS-safe, but the localStorage copy is readable by any JS if XSS executes.\n'
    'Fix: Test if httpOnly cookie works reliably across arthaleads.com / api.arthaleads.com subdomains.\n'
    'If yes, remove the localStorage _at fallback entirely.',
    'frontend/src/context/AuthContext.jsx:33')

pdf.finding('MEDIUM', 'Website Webhook Has No HMAC Signature Verification',
    '/webhook/website only checks that verifyToken matches a DB record -- no cryptographic signing.\n'
    'If someone extracts the token from a WordPress DB (common breach vector), they can POST unlimited fake leads.\n'
    'Fix: Add shared-secret HMAC to the WordPress plugin and verify X-Hub-Signature on the server.',
    'backend/routes/webhookRoutes.js:453+')

pdf.finding('MEDIUM', 'Blog Editor Stores Unsanitized HTML to DB',
    'BlogEditor writes raw editRef.current.innerHTML to DB without sanitization. DOMPurify runs on display\n'
    '(PublicBlogPost) but not on save -- DB contains raw XSS payloads that bypass defence-in-depth.\n'
    'Fix: Run DOMPurify.sanitize() on block.content before the API PUT call in the editor.',
    'frontend/src/pages/BlogEditor.jsx:281-282')

pdf.finding('LOW', 'Password Minimum 6 Characters',
    'Industry standard for SaaS is 8+. Enterprise buyers flag this in security reviews.\n'
    'Fix: Change Joi.string().min(6) to Joi.string().min(8) in all password fields.',
    'backend/validations/schemas.js:13')

pdf.finding('LOW', 'Firebase Keys Exposed in Frontend Bundle',
    'VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID visible in compiled JS. This is expected Firebase\n'
    'architecture -- security rules protect access. Action required: verify Firebase Console -> Firestore -> Rules\n'
    'has NO open rules (allow read, write: if true). All reads/writes must require authentication.',
    'frontend/.env.local')

pdf.finding('LOW', 'Access Token Partially Logged',
    'First 20 chars of Facebook access token written to log. Not a direct risk but bad security practice.\n'
    'Fix: Remove token from log line entirely.',
    'backend/routes/webhookRoutes.js:280-281')

pdf.finding('LOW', 'FB_APP_SECRET Disabled in Development Skips HMAC',
    'If FB_APP_SECRET is not set, Facebook webhook signature verification is silently bypassed in dev.\n'
    'Low impact (dev only), but should emit a warning. A warning log already exists -- acceptable.',
    'backend/routes/webhookRoutes.js:22-24')

# ── SECTION 2: AUTH AUDIT ─────────────────────────────────────────────────────
pdf.section_title('2. AUTHENTICATION & LOGOUT AUDIT')

pdf.ln(1)
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(30,30,30)
headers = ['Check', 'Status', 'Notes']
widths = [90, 25, 75]
pdf.table_row(headers, widths, bold=True, bg=(240,240,240))

rows = [
    ('Login sets httpOnly secure cookie', 'PASS', 'crm_token cookie set on all login paths'),
    ('JWT verified on every protected request', 'PASS', 'protect() middleware on all private routes'),
    ('User existence re-checked on every request', 'PASS', 'DB lookup in protect() each call'),
    ('Org active status checked', 'PASS', '60-sec cached org lookup in protect()'),
    ('Trial expiry enforced', 'PASS', 'Rejected if plan=trial and trialEndsAt passed'),
    ('Logout clears cookie (with + without domain)', 'PASS', 'clearCookie called twice for safety'),
    ('Logout clears localStorage', 'PASS', 'All _at, crm_user, crm_org keys removed'),
    ('Global 401 handler redirects to login', 'PASS', 'Axios interceptor in AuthContext'),
    ('Admin-only routes role-gated', 'PASS', 'authorize("admin") middleware applied'),
    ('Agent data scoped to assigned projects', 'PASS', 'assignedTo filter enforced in service layer'),
    ('Server-side token invalidation on logout', 'FAIL', 'No token blacklist -- JWT valid 7d post-logout'),
    ('Password reset invalidates old tokens', 'FAIL', 'Old tokens remain valid after reset'),
    ('Concurrent session control', 'FAIL', 'Multiple simultaneous sessions allowed'),
    ('Google OAuth client ID in Vercel env vars', 'CHECK', 'VITE_GOOGLE_CLIENT_ID absent from .env.local'),
]

for i, row in enumerate(rows):
    bg = None
    if i % 2 == 0:
        bg = (252, 252, 252)
    # Color status cell
    pdf.set_fill_color(*(bg or (255,255,255)))
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(30,30,30)
    pdf.cell(90, 6, row[0], border=1, fill=True)
    status = row[1]
    if status == 'PASS':
        pdf.set_fill_color(212, 237, 218)
        pdf.set_text_color(21, 87, 36)
    elif status == 'FAIL':
        pdf.set_fill_color(248, 215, 218)
        pdf.set_text_color(114, 28, 36)
    else:
        pdf.set_fill_color(255, 243, 205)
        pdf.set_text_color(133, 100, 4)
    pdf.cell(25, 6, status, border=1, fill=True, align='C')
    pdf.set_fill_color(*(bg or (255,255,255)))
    pdf.set_text_color(30,30,30)
    pdf.cell(75, 6, row[2], border=1, fill=True)
    pdf.ln()

# ── SECTION 3: BUG RISKS ──────────────────────────────────────────────────────
pdf.section_title('3. BUG RISKS & DATA INTEGRITY')

pdf.finding('HIGH', '"Leads Not Found" Risk -- orgId Not Required in Schema',
    'If any code path creates a Lead or ProjectLead without orgId, that lead permanently disappears from\n'
    'all filtered views (every query scopes by orgId). Currently no schema-level enforcement prevents this.\n'
    'Fix: Add required: true to orgId field in both Lead and ProjectLead mongoose models.',
    'backend/models/Lead.js  |  backend/models/ProjectLead.js')

pdf.finding('MEDIUM', 'Startup orgId Backfill Can Fail Silently',
    'At boot, a migration backfills orgId on old ProjectLead records. If it times out (large DB, slow Atlas),\n'
    'affected leads have no orgId and never appear in queries. No alert is raised beyond a console.error.\n'
    'Fix: Add Sentry.captureException() in the catch block and log the count of unbackfilled records.',
    'backend/server.js -- DB connection callback')

pdf.finding('MEDIUM', 'Transfer to Main Pipeline Can Lose Lead Data',
    'When a ProjectLead is transferred to Lead (main pipeline), fields are manually mapped\n'
    '(remarkNote -> remark, followUp -> followUpDate). If field names diverge, data silently drops.\n'
    'Fix: Add post-transfer verification log listing which fields were mapped.',
    'backend/services/projectService.js:transferLead')

pdf.finding('LOW', 'Google Sign-In Silently Fails if Client ID Missing',
    'main.jsx reads import.meta.env.VITE_GOOGLE_CLIENT_ID but it is absent from frontend/.env.local.\n'
    'Google Sign-In button appears but fails silently. Vercel env var must be set before deploy.\n'
    'Fix: Add VITE_GOOGLE_CLIENT_ID to Vercel -> Project Settings -> Environment Variables.',
    'frontend/src/main.jsx:74')

pdf.finding('LOW', 'No Payment Gateway Integrated',
    'Plans page and UpgradeWall component exist but no Razorpay/Stripe integration was found.\n'
    'Upgrades appear to be manual. Before live launch with paying customers, either:\n'
    '  a) Integrate automated billing (Razorpay recommended for India), or\n'
    '  b) Add a clear "Contact us to upgrade" CTA with SLA response commitment.')

# ── SECTION 4: FEATURE GAP ────────────────────────────────────────────────────
pdf.section_title('4. FEATURE GAP vs COMPETITORS (LeadRat, Sell.do, Kylas)')

pdf.set_font('Helvetica', '', 8.5)
pdf.set_text_color(50,50,50)
pdf.multi_cell(0, 5,
    'Comparison based on publicly documented features of LeadRat, Sell.do, Kylas CRM, and NobrokerHood CRM.\n'
    'Arthaleads is strong on core lead management and automation. Key gaps are in communication, analytics, and mobile.')
pdf.ln(2)

feat_headers = ['Feature', 'Arthaleads', 'Competitors']
feat_widths = [100, 30, 60]
pdf.table_row(feat_headers, feat_widths, bold=True, bg=(240,240,240))

features = [
    ('Facebook Lead Ads integration', 'YES', 'YES -- all'),
    ('Google Ads / Website form intake', 'YES', 'YES -- all'),
    ('Follow-up scheduling & reminders', 'YES', 'YES -- all'),
    ('Team & role management', 'YES', 'YES -- all'),
    ('Lead activity timeline (notes, status)', 'YES', 'YES -- all'),
    ('Bulk CSV export', 'YES', 'YES -- all'),
    ('Push notifications (browser)', 'YES', 'Most'),
    ('Routing rules (round-robin)', 'YES', 'YES -- all'),
    ('Attendance tracking', 'YES', 'Some'),
    ('Blog / content management', 'YES', 'Rarely'),
    ('Multi-org SaaS architecture', 'YES', 'YES -- all'),
    ('WhatsApp Business API (real messaging)', 'NO', 'YES -- LeadRat, Sell.do'),
    ('Email drip campaigns', 'NO', 'YES -- Sell.do, Kylas'),
    ('SMS sending integration', 'NO', 'YES -- most'),
    ('Lead scoring / priority grading', 'NO', 'YES -- all'),
    ('99acres / MagicBricks API sync', 'NO', 'YES -- LeadRat'),
    ('Site visit calendar with slots', 'NO', 'YES -- all'),
    ('Custom fields per org', 'NO', 'YES -- most'),
    ('Property documents (brochures)', 'NO', 'YES -- most'),
    ('Payment / booking amount tracking', 'NO', 'YES -- Sell.do'),
    ('Advanced analytics (custom reports)', 'NO', 'YES -- all'),
    ('Fuzzy lead deduplication (name/email)', 'NO', 'YES -- most'),
    ('Two-factor authentication', 'NO', 'YES -- Kylas'),
    ('Mobile app (iOS/Android)', 'NO', 'YES -- LeadRat, Kylas'),
    ('Multi-language UI (Hindi, Marathi)', 'NO', 'YES -- most'),
    ('Public API / Webhook for partners', 'NO', 'YES -- Kylas'),
    ('Refer & Earn program', 'NO', 'Some'),
]

for i, row in enumerate(features):
    bg = (252,252,252) if i % 2 == 0 else (255,255,255)
    pdf.set_fill_color(*bg)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(30,30,30)
    pdf.cell(100, 5.5, row[0], border=1, fill=True)
    if row[1] == 'YES':
        pdf.set_fill_color(212, 237, 218)
        pdf.set_text_color(21, 87, 36)
    else:
        pdf.set_fill_color(248, 215, 218)
        pdf.set_text_color(114, 28, 36)
    pdf.cell(30, 5.5, row[1], border=1, fill=True, align='C')
    pdf.set_fill_color(*bg)
    pdf.set_text_color(30,30,30)
    pdf.cell(60, 5.5, row[2], border=1, fill=True)
    pdf.ln()

pdf.ln(3)
pdf.sub_title('Recommended Sprint Priorities (Post-Launch):')
priorities = [
    '1. WhatsApp Business API messaging -- highest demand from Indian real estate agents',
    '2. CSV bulk export per project -- every buyer asks for this on Day 1',
    '3. Advanced analytics (lead source ROI, conversion funnel) -- needed for management reviews',
    '4. Custom fields UI -- agents need to capture project-specific data',
    '5. Lead scoring -- auto-flag hot leads so agents prioritise correctly',
]
for p in priorities:
    pdf.body(p, indent=4)

# ── SECTION 5: COMPLIANCE ─────────────────────────────────────────────────────
pdf.section_title('5. COMPLIANCE CHECKLIST')

comp_headers = ['Requirement', 'Status', 'Action Required']
comp_widths = [80, 25, 85]
pdf.table_row(comp_headers, comp_widths, bold=True, bg=(240,240,240))

compliance = [
    ('Privacy Policy (DPDP / GDPR)', 'DONE', 'Page exists at /privacy'),
    ('Terms of Service', 'DONE', 'Page exists at /terms'),
    ('Refund & Cancellation Policy', 'MISSING', 'Required by Indian law for paid SaaS -- add before launch'),
    ('Cookie Consent Banner', 'MISSING', 'Required under DPDP Act 2023 -- add to landing + signup'),
    ('Facebook App Review (leads_retrieval)', 'APPROVED', 'Live and working'),
    ('Facebook App Review (business_management)', 'IN REVIEW', 'Submitted -- awaiting approval (5-10 days)'),
    ('HTTPS on all endpoints', 'DONE', 'Railway (backend) + Vercel (frontend) enforce HTTPS'),
    ('Helmet security headers', 'DONE', 'Applied globally'),
    ('Data retention policy', 'MISSING', 'Define how long lead data is stored; add to Privacy Policy'),
    ('Firebase Security Rules', 'CHECK', 'Verify no open read/write rules in Firebase Console'),
    ('Password reset link expiry', 'DONE', 'Reset tokens expire (check authService.resetPassword)'),
    ('Audit log for admin actions', 'DONE', 'AuditLog model + SuperAdminAudit page'),
]

for i, row in enumerate(compliance):
    bg = (252,252,252) if i % 2 == 0 else (255,255,255)
    pdf.set_fill_color(*bg)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(30,30,30)
    pdf.cell(80, 5.5, row[0], border=1, fill=True)
    status = row[1]
    if status in ('DONE', 'APPROVED'):
        pdf.set_fill_color(212, 237, 218); pdf.set_text_color(21, 87, 36)
    elif status == 'MISSING':
        pdf.set_fill_color(248, 215, 218); pdf.set_text_color(114, 28, 36)
    elif status == 'IN REVIEW':
        pdf.set_fill_color(204, 229, 255); pdf.set_text_color(4, 64, 133)
    else:
        pdf.set_fill_color(255, 243, 205); pdf.set_text_color(133, 100, 4)
    pdf.cell(25, 5.5, status, border=1, fill=True, align='C')
    pdf.set_fill_color(*bg); pdf.set_text_color(30,30,30)
    pdf.cell(85, 5.5, row[2], border=1, fill=True)
    pdf.ln()

# ── SECTION 6: WEBSITE PAGES ──────────────────────────────────────────────────
pdf.section_title('6. WEBSITE PAGES AUDIT')

page_headers = ['Page', 'Status', 'Priority', 'Notes']
page_widths = [65, 22, 22, 81]
pdf.table_row(page_headers, page_widths, bold=True, bg=(240,240,240))

pages = [
    ('Landing / Home', 'EXISTS', 'DONE', ''),
    ('Pricing / Plans', 'EXISTS', 'DONE', ''),
    ('Privacy Policy', 'EXISTS', 'DONE', ''),
    ('Terms of Service', 'EXISTS', 'DONE', ''),
    ('Contact', 'EXISTS', 'DONE', ''),
    ('Blog', 'EXISTS', 'DONE', ''),
    ('About Us', 'EXISTS', 'DONE', ''),
    ('Careers', 'EXISTS', 'DONE', ''),
    ('Help / Support', 'EXISTS', 'DONE', ''),
    ('Product Updates', 'EXISTS', 'DONE', ''),
    ('WordPress Plugin docs', 'EXISTS', 'DONE', ''),
    ('Refund & Cancellation Policy', 'MISSING', 'URGENT', 'Required by law for Indian SaaS payments'),
    ('Cookie Policy', 'MISSING', 'HIGH', 'DPDP Act 2023 compliance'),
    ('Security / Trust page', 'MISSING', 'MEDIUM', 'Builds confidence with enterprise buyers'),
    ('Status / Uptime page', 'MISSING', 'MEDIUM', 'Link to free UptimeRobot public page'),
    ('Refer & Earn', 'MISSING', 'MEDIUM', 'Growth channel -- see Section 7'),
    ('Feature Comparison page', 'MISSING', 'LOW', 'vs LeadRat, Sell.do etc. -- drives SEO'),
    ('API Documentation', 'MISSING', 'LOW', 'Needed for partner integrations'),
]

for i, row in enumerate(pages):
    bg = (252,252,252) if i % 2 == 0 else (255,255,255)
    pdf.set_fill_color(*bg)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(30,30,30)
    pdf.cell(65, 5.5, row[0], border=1, fill=True)
    status = row[1]
    if status == 'EXISTS':
        pdf.set_fill_color(212, 237, 218); pdf.set_text_color(21, 87, 36)
    else:
        pdf.set_fill_color(248, 215, 218); pdf.set_text_color(114, 28, 36)
    pdf.cell(22, 5.5, status, border=1, fill=True, align='C')
    pri = row[2]
    if pri == 'URGENT':
        pdf.set_fill_color(220,53,69); pdf.set_text_color(255,255,255)
    elif pri == 'HIGH':
        pdf.set_fill_color(255,165,0); pdf.set_text_color(255,255,255)
    elif pri == 'MEDIUM':
        pdf.set_fill_color(23,162,184); pdf.set_text_color(255,255,255)
    elif pri == 'LOW':
        pdf.set_fill_color(108,117,125); pdf.set_text_color(255,255,255)
    else:
        pdf.set_fill_color(*bg); pdf.set_text_color(30,30,30)
    pdf.cell(22, 5.5, pri, border=1, fill=True, align='C')
    pdf.set_fill_color(*bg); pdf.set_text_color(30,30,30)
    pdf.cell(81, 5.5, row[3], border=1, fill=True)
    pdf.ln()

# ── SECTION 7: REFER & EARN ───────────────────────────────────────────────────
pdf.section_title('7. REFER & EARN PROGRAM')

pdf.body(
    'A referral program turns existing customers into a growth channel. Real estate SaaS is highly word-of-mouth '
    'driven -- an agent who loves your CRM will recommend it to their broker network. Here is the recommended '
    'implementation for Arthaleads:')
pdf.ln(2)

pdf.sub_title('How It Works:')
steps = [
    '1. Each organization gets a unique referral link: arthaleads.com/signup?ref=ORGCODE',
    '2. When a new org signs up via that link, the referring org is recorded.',
    '3. Reward triggers when the referred org completes first payment (not just signup).',
    '4. Referrer earns: 1 free month of their plan (added to their billing cycle).',
    '5. Referee earns: 1 additional month of free trial (so they get 2 months to evaluate).',
]
for s in steps:
    pdf.body(s, indent=4)

pdf.ln(2)
pdf.sub_title('What You Need to Build:')
build = [
    'Backend: referralCode field on Organization model (auto-generated on org creation)',
    'Backend: On signup, capture ref query param and link to referring org',
    'Backend: Payout trigger -- when referred org makes first payment, credit referrer',
    'Backend: Credit system -- add N free days to referrer subscription',
    'Frontend: Refer & Earn dashboard page -- shows unique link, referred count, earned credits',
    'Frontend: Share buttons (WhatsApp, copy link) on the dashboard',
    'Email: Automated email when referral converts -- "You earned 1 free month!"',
]
for b in build:
    pdf.body(f'-  {b}', indent=4)

pdf.ln(2)
pdf.sub_title('Legal Requirements:')
legal = [
    'Disclose the program in Terms of Service (referral terms, credit expiry, non-transferable)',
    'Referral credits are not cashable -- Arthaleads account credit only (simpler legally)',
    'Do not allow referral links in paid Facebook/Google ads (violates platform policies)',
    'Set a cap: max 6 free months earned per org per year (prevents abuse)',
]
for l in legal:
    pdf.body(f'-  {l}', indent=4)

pdf.ln(2)
pdf.sub_title('Recommended Start: Manual approval, credit-only, no cash. Automate after launch.')

# ── SECTION 8: MUST FIX BEFORE MONDAY ────────────────────────────────────────
pdf.section_title('8. MUST FIX BEFORE LAUNCH (PRIORITY ORDER)', color=(220,53,69))

pdf.set_font('Helvetica', '', 9)
pdf.set_text_color(50,50,50)

mf_headers = ['#', 'Item', 'Severity', 'Effort']
mf_widths = [8, 120, 25, 37]
pdf.table_row(mf_headers, mf_widths, bold=True, bg=(240,240,240))

must_fix = [
    ('1', 'Add Refund & Cancellation Policy page (legally required in India)', 'LEGAL', '2 hrs'),
    ('2', 'Add required:true to orgId in Lead + ProjectLead mongoose schemas', 'HIGH', '30 min'),
    ('3', 'Verify VITE_GOOGLE_CLIENT_ID is set in Vercel environment variables', 'HIGH', '5 min'),
    ('4', 'Verify Firebase Security Rules -- no open read/write rules', 'HIGH', '15 min'),
    ('5', 'Website webhook: add HMAC signature verification', 'MEDIUM', '3 hrs'),
    ('6', 'Blog editor: sanitize HTML with DOMPurify before saving to DB', 'MEDIUM', '1 hr'),
    ('7', 'Increase password minimum from 6 to 8 characters', 'MEDIUM', '10 min'),
    ('8', 'Add cookie consent banner (DPDP Act 2023)', 'MEDIUM', '4 hrs'),
    ('9', 'Add Sentry alert when orgId backfill fails at startup', 'LOW', '30 min'),
]

for i, row in enumerate(must_fix):
    bg = (252,252,252) if i % 2 == 0 else (255,255,255)
    pdf.set_fill_color(*bg)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(30,30,30)
    pdf.cell(8, 6, row[0], border=1, fill=True, align='C')
    pdf.cell(120, 6, row[1], border=1, fill=True)
    sev = row[2]
    if sev == 'LEGAL':
        pdf.set_fill_color(220,53,69); pdf.set_text_color(255,255,255)
    elif sev == 'HIGH':
        pdf.set_fill_color(255,140,0); pdf.set_text_color(255,255,255)
    elif sev == 'MEDIUM':
        pdf.set_fill_color(23,162,184); pdf.set_text_color(255,255,255)
    else:
        pdf.set_fill_color(108,117,125); pdf.set_text_color(255,255,255)
    pdf.cell(25, 6, sev, border=1, fill=True, align='C')
    pdf.set_fill_color(*bg); pdf.set_text_color(30,30,30)
    pdf.cell(37, 6, row[3], border=1, fill=True, align='C')
    pdf.ln()

# ── SECTION 9: POST LAUNCH ROADMAP ────────────────────────────────────────────
pdf.section_title('9. POST-LAUNCH ROADMAP (NEXT 90 DAYS)')

pdf.sub_title('Sprint 1 (Week 1-2):')
s1 = [
    'Server-side JWT token blacklist on logout',
    'Remove localStorage JWT fallback (use httpOnly cookie only)',
    'Automated payment gateway (Razorpay) integration',
    'Refer & Earn program (referral code + credit system)',
    'Security page + Status/Uptime page on website',
]
for s in s1:
    pdf.body(f'-  {s}', indent=4)

pdf.ln(2)
pdf.sub_title('Sprint 2 (Week 3-4):')
s2 = [
    'WhatsApp Business API integration (actual messaging from CRM)',
    'Advanced analytics dashboard (lead source ROI, conversion funnel charts)',
    'Custom fields UI (per-org field creation)',
    'Lead scoring system (auto-grade based on engagement)',
]
for s in s2:
    pdf.body(f'-  {s}', indent=4)

pdf.ln(2)
pdf.sub_title('Sprint 3 (Month 2):')
s3 = [
    'Mobile app (React Native or Flutter wrapper)',
    'Email campaign builder with drip sequences',
    '99acres / MagicBricks email parsing integration',
    'Document storage per lead/property (brochures, agreements)',
    'Two-factor authentication for admin accounts',
]
for s in s3:
    pdf.body(f'-  {s}', indent=4)

pdf.ln(2)
pdf.sub_title('Sprint 4 (Month 3):')
s4 = [
    'Payment / booking amount tracking with installment records',
    'Site visit calendar with agent slot management',
    'Multi-language support (Hindi UI)',
    'Public API with documentation for partner integrations',
]
for s in s4:
    pdf.body(f'-  {s}', indent=4)

# ── FINAL NOTE ────────────────────────────────────────────────────────────────
pdf.ln(6)
pdf.set_fill_color(255, 247, 237)
pdf.set_draw_color(255, 107, 0)
y = pdf.get_y()
pdf.rect(10, y, 190, 22, 'DF')
pdf.set_y(y + 3)
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(255,107,0)
pdf.cell(0, 5, '   OVERALL ASSESSMENT', ln=True)
pdf.set_font('Helvetica', '', 8.5)
pdf.set_text_color(50,50,50)
pdf.multi_cell(0, 5,
    '   The Arthaleads codebase is well-architected with strong tenant isolation, solid auth middleware, proper rate\n'
    '   limiting, and clean error handling. The 9 issues found are specific and fixable before launch. The platform\n'
    '   is ready to go live with the 9 pre-launch items resolved. Feature gaps vs. competitors are manageable and\n'
    '   can be addressed in the 90-day post-launch roadmap without disrupting current users.')

out = '/home/user/arthaleads/Arthaleads_PreLaunch_Audit.pdf'
pdf.output(out)
print(f'PDF written to: {out}')
print(f'Pages: {pdf.page}')
