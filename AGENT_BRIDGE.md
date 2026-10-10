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

- [Claude Code] 2026-10-10 IST: mobile app fixes for 1.0.13 (attendance no-camera clock-in, role gating for agents/managers, Bookings/Invoices paging + server totals, project price dash, follow-up note edit, duplicate lead warning, Performance totals, Referrals status, Pipeline filter labels). Files: mobile/lib/** only.
Format: `- [agent] 2026-10-08 14:30 IST: what, files`

## Change log (newest first)

### Claude Code, 2026-10-10 IST, prerendered marketing pages

- `npm run build` now ends with `scripts/prerender.mjs`: builds `src/entry-prerender.jsx` with Vite SSR (Node, no browser, works on Vercel) and writes each of the 20 marketing pages' HTML into its `dist/*.html` inside `<div id="root" data-prerendered>`. Raw HTML now has the h1, headings and copy. Rendered with fake browser globals and reduced motion (count-ups show final numbers, reveals visible); a failing page keeps its plain shell, never fails the build. `app.html` and blog posts (Vercel function) are untouched.
- `main.jsx`: React does NOT hydrate. The static copy moves to a sibling and stays on screen while the app renders invisibly into #root; swap when #root has a `<footer>` (8 s cap, timer not rAF). Mount-time `scrollTo(0,0)` is ignored while waiting so readers are not yanked up. Head extras per page (`#prerender-css`): opacity:0 sections shown in the static copy, splash hidden for light-theme visitors; dark-theme visitors and app.arthaleads.com (which serves these same files for /) keep the splash and never see the static copy.
- Videos in the static copy get `preload="none"` and no autoplay (the live app starts them). Measured on live, Lighthouse mobile: /pricing 74->89 (LCP 6.1->3.2 s), /features 75->92 (6.3->3.0 s), /blog 75->84 (22->4.2 s), best-practices 96->100 everywhere. Home stays ~71-75 (simulated LCP 5.2 s) because Lighthouse counts the 2.4 MB hero tour clip; real first paint of the static copy is ~0.4 s locally.
- If a new marketing page is added: add it to `PAGES` in `src/entry-prerender.jsx` (plus seo-pages and vercel.json as before). Pages must not touch window/document during render (effects are fine). If the site ever shows stale or doubled content, remove `&& node scripts/prerender.mjs` from the build script first.

### Claude Code, 2026-10-10 IST, social profiles in the footer

- `utils/crmLinks.js` `SOCIAL_LINKS` (Instagram arthaleads.crm, LinkedIn company/arthaleads, Facebook page id 61589532765469). `PublicFooter.jsx` has a "Follow Arthaleads" icon row (Instagram, Facebook, LinkedIn, email) under the WhatsApp button. `index.html` Organization `sameAs` now lists these three instead of an unverified twitter.com/arthaleads.

### Claude Code, 2026-10-10 IST, marketing site audit: speed, honesty, engagement, motion

- **Speed:** `public/logo.png` 1.1 MB -> 44 KB (512 px) and `ai-avatar2.png` 2.4 MB -> 55 KB (192 px), same names so every reference benefits. Deleted unreferenced `ai-avatar.png`, `hero-mockup.png`, `gallery-1..4.jpg`, `AI AVATAR AGENT .png` (only the unused `InfiniteGallery.jsx` named the gallery files). `vercel.json`: `/assets/*` cached 1 year immutable, `/tour` and `/video` 1 week. Marketing host skips the `/auth/me` session check (`AuthContext`) and the Google sign-in provider/script (`main.jsx`), since every CRM route there redirects to app.arthaleads.com. Chat widget lazy-loads when the page is idle (`PublicNav`). Blog uses resized Sanity images (`sizedImage` in `BlogCard.jsx`).
- **SEO:** generated marketing pages (`scripts/seo-pages.mjs`) allow pinch zoom and preconnect to the API and Sanity CDN; `app.html` (CRM) keeps its fixed viewport. Home description 156 chars, home canonical now `https://www.arthaleads.com/` (matches sitemap). Shorter titles on /compare, /download-app, /product-updates, /wordpress-plugin, /contact; longer /blog description. Home FAQ section with FAQPage JSON-LD.
- **Consistency:** plans moved to `src/data/plans.js`, used by home and /pricing (home showed old seat limits and "pricing on request"). Enterprise CTA is "Talk to sales" (WhatsApp) on both. About page now 50+ teams / 10,000+ leads / 24/7 AI replies (was 500+ / 50,000+ / 99.9% uptime). Removed the unbacked "4.8 from 90+ users" rating and real company names from home testimonials (quotes still unverified, see owner note). "Zero duplicate calls guaranteed" softened.
- **Engagement:** WhatsApp demo link under the hero, WhatsApp + phone in the footer, "Book a demo on WhatsApp" in the final CTA, /pricing shows a live price estimate (seats x plan, monthly/annual, GST) and sends Enterprise/pricing questions to WhatsApp instead of `sales@`. Home contact form now sends a reCAPTCHA token; both contact forms tolerate non-JSON errors. `/#pricing`-style links land on the section. Compare table scrolls sideways on phones; "Let us know" is a link. Refer link goes to app.arthaleads.com/signup.
- **Motion:** new `components/motion/Motion.jsx` (Reveal, CountUp, Spotlight, ScrollProgress, Magnetic; one shared IntersectionObserver, off for reduced-motion and Data Saver) + CSS in `styles.css`. Hero headline word rise, drifting glow, shine + magnetic CTA, count-up stats; staggered reveals and pointer spotlight on features, sources, pricing cards (home and /pricing), FAQ; scroll progress bar on all marketing pages. Timers in How-it-works/Testimonials/About counters now respect reduced motion. A11y labels on the menu button and carousel dots (bigger tap targets).
- Verified on a local production build (desktop + 375 px, no horizontal overflow, calculator maths checked). Not changed, for the owner: intro film autoplay-with-sound behaviour (owner's earlier choice), brand-orange contrast, apex domain 307 (Vercel dashboard), prerendering page bodies.

### Claude Code, 2026-10-10 IST, Studio on Sanity 6 + the 5 draft posts brought to 100/100

- `studio/`: upgraded Sanity 4.22 -> 6.16 (with @sanity/vision 6.16, React 19.3, styled-components 6.5.3); clears the "Studio is not fully compatible with Dashboard" banner. The hosted studio auto-updates its runtime (currently 6.18). `components/SeoAudit.jsx` now uses plain elements on the Studio CSS colour variables instead of @sanity/ui, because a bundled second copy of @sanity/ui lost the theme on the hosted runtime (text overlapped, grid collapsed). Deployed.
- Sanity content (drafts only, nothing published; owner asked to fill what was missing): on all 5 drafts set author "Arthaleads Team", 5 secondary keywords, breadcrumb title, social title/description/image (featured image reused), explicit robots/schema defaults. Focus keyword changed on 2 posts so it matches title + slug ("Facebook lead ads for real estate", "property enquiries on WhatsApp"; sales-team post now "real estate sales team"). SEO description reworded on 4 posts to contain the keyword. One sentence in each article's opening paragraph now uses the keyword (the articles never used it, so density was 0). Scores went from 49/49/77/77/49 to 100 on all five. Revert any of it from the document history in Studio.

### Claude Code, 2026-10-10 IST, Sanity blog: Vistrow-style SEO structure

- `studio/schemaTypes/post.js`: four tabs like the Vistrow studio. **Content** (title max 100, URL slug, summary 80 to 320 chars required, category required, author, publish at, collapsed "Image brief" editor notes, featured image with required alt, tags, article). **SEO** (live `components/SeoAudit.jsx` panel: weighted score out of 100, Google preview with character counters, 12-point checklist; focus keyword, up to 8 secondary keywords, SEO title required max 65, SEO description required max 170, breadcrumb title). **Social** (Facebook/LinkedIn title, description, image; X card type, title, description, image; each falls back to the one above). **Advanced SEO** (canonical URL https only, schema type BlogPosting/Article/NewsArticle, robots switches, snippet/video/image preview limits, exclude from sitemap, redirect URL + permanent switch). Kept our rich-text body (links, images, H2/H3) rather than Vistrow's plain sections.
- Note: SEO title and SEO description are now required, so the 5 existing drafts need them filled before they can be published.
- `BlogPost` model: new fields `authorName, secondaryKeywords, breadcrumbTitle, og*, twitter*, schemaType, robots{...}, excludeFromSitemap, redirectUrl, redirectPermanent`. `sanityBlogSync.applySeo` maps them with safe defaults (missing switches = index, follow) and rejects non-https canonicals and unsafe redirects.
- Sitemap leaves out noindex, excluded and redirected posts. `frontend/api/blog-post.js` now writes meta robots, canonical override, separate OG/X tags, keywords, article times and Article JSON-LD (schema type, author) into the page source, and 301/302-redirects when a redirect is set. `PublicBlogPost.jsx` sets the same tags client-side and follows redirects; `authorOf` prefers the Studio author name.
- Verified: 10-assertion sync/sitemap test (memory DB), 11-assertion Vercel-function test (stubbed API), score-logic test (Vistrow-style sample scores 95 with only the social check failing), studio build, frontend build. Studio UI itself checked only after deploy (local studio needs the owner's Sanity login).
- Studio deployed to https://arthaleads.sanity.studio (deployed schema has all 39 fields). `sanity deploy` was failing with "Failed to parse installed version for [object Object]": the auto-update check needs `@sanity/vision` installed, so it is now a dependency and the Vision tab is enabled (as in the Vistrow studio).

### Claude Code, 2026-10-09 IST, WhatsApp bot: notice for unsupported messages, no silent first "Hi"

- `routes/whatsappRoutes.js`: when a customer sends a Meta `unsupported` message and the bot is ON (Growth+), the bot sends one short polite line ("I could not open that message, please send it again as normal text or photo"), at most once an hour per chat, in English, Hinglish, Marathi (Latin letters) or Devanagari following the customer's earlier messages. Reactions get their own type and never trigger it. Photos and voice notes still get no automatic reply (unchanged, by design; easy to extend with the same helper if wanted).
- First-contact fallback: if the AI is not configured, errors, or returns nothing for a customer's FIRST message, they get "Hi <name>! Thanks for messaging <org>. Which project or property are you looking for? Our team will also be with you shortly." and the chat is handed to the team as before. Not sent again on later turns, and not when the org is out of credits.
- Both are marked `WaMessage.isNotice` so they never count as a real reply (first-reply logic ignores them). They use one service-reply credit like any bot message.
- 12-assertion scratch test (stubbed WhatsApp and OpenAI) plus the earlier WhatsApp scratch suites all pass.

### Claude Code, 2026-10-09 IST, booking clip

- New tour clip `frontend/public/tour/booking.{mp4,webm,webp}` (10 s, 1600x900, silent, ~0.3 MB): a new booking in the Bookings list, one click on Invoice, "Invoice #1 created!", then the Tax Invoice preview. Recorded by me from the LOCAL demo CRM (localhost:3002 + demo API 5055) using Chrome screencast frames encoded with ffmpeg; recorder scripts are in the session scratchpad, not in the repo. Demo-only changes: the 4 seeded demo bookings were re-saved so totals and GST show (were 0.00) and the demo firm got sample billing details (fake PAN/GSTIN/bank sample values).
- Added as the 7th hero-tour tab ("Bookings", before Performance) and as the screen for the "Close" workflow on /features.

### Claude Code, 2026-10-09 IST, WhatsApp: silent chats investigated, clearer unsupported text, lost-reply safety net

- Investigated two Prophunt chats the bot never answered (read-only DB look, counts and the two threads only; nothing written). **Sadare** (8 Oct 23:59 IST): Meta type `unsupported` (poll, view-once media, channel post and the like), which the bot cannot read by design; lead and thread were created from it. **Aditya Polekar** (8 Oct 18:14 IST): plain "Hi", bot ON, the reply was lost because the API container was replaced by the audit-fix deploys at 18:13 to 18:25 while the reply was in flight. Of about 210 new conversations in 3 weeks only these two had no reply.
- `parseMetaMessages`: `unsupported` now stores a plain explanation for the team; reactions store `[Reaction] <emoji>`.
- `recoverLostBotReplies` (`routes/whatsappRoutes.js`, cron every 2 min in `utils/scheduler.js`, `WaConversation.botRecoveryKey`): answers chats where the bot is ON, the last message is plain text, nothing was sent back for 2 to 30 minutes, not mid button-flow, never tried before. 11-assertion scratch test passed. Expect an `[wa-bot] re-answered N chat(s)` log line when it fires.

### Claude Code, 2026-10-09 IST, Features page rebuilt (film autoplay, first 5 blog posts)

- `Features.jsx`: sticky 7-step workflow progress bar (follows scroll, click to jump), each workflow has its real product screen (clip plays only while on screen, from `/tour/*`) beside its heading, alternating sides, with the feature cards below (grid fills every row, cards fade in, hover lifts). Last group ("Control") is centred with no screen. Respects reduced motion and Data Saver. Sections use `overflow-x-clip` so the slide-in does not cause sideways scroll on phones.
- `IntroVideo.jsx` (home film): autoplays muted when more than half visible, pauses when it leaves, "Turn on sound" button; Play button only when autoplay is blocked / reduced motion / Data Saver.
- Sanity: 5 draft posts imported (ids `drafts.blog-<slug>`, scheduled 10-14 Oct 2026 09:30 IST). They go live on their dates once published in the Studio.

### Claude Code, 2026-10-09 IST, blog link previews + hero cleanup

- `frontend/api/blog-post.js` (Vercel function, `vercel.json` routes `/blog/:slug` to it): fetches the post from the API and writes its own title, description, canonical and share image into the app shell, so WhatsApp/LinkedIn previews and Google's first pass see the real tags. Edge-cached 5 min; unknown slug returns 404 with the plain shell; API outage falls back to the plain shell. `GET /api/blog/posts/:slug?nocount=1` no longer adds a view. If blog posts ever 404, revert the `/blog/:slug` rewrite in `vercel.json` first.
- Removed the two floating cards ("+14 New Leads", "Site visit booked") from the home hero.

### Claude Code, 2026-10-09 IST, marketing site pass (hero tour, video, features, SEO)

- **Hero product tour** (`components/ProductTour.jsx`, used by `Landing.jsx`): six tabs, each plays a silent 10 s clip from `public/tour/<id>.mp4|.webm` (made by the video session) and moves on when it ends; clicking a tab stops auto-advance and loops that clip. Poster `<id>.webp` shows underneath, clips pause off screen, Data Saver / reduced motion get stills. The old laptop mockup is gone. Intro film (EN/HI, 13 MB each, `public/video/`) sits lower on the home page (`IntroVideo.jsx`), not on Features.
- **Features page** (`Features.jsx`, `data/features.js`): 32 features in 7 workflow groups; covers the 15 capabilities the launch audit listed as missing. Copy checked against the code.
- **Indexing**: `frontend/scripts/seo-pages.mjs` runs after `vite build` (`npm run build`) and writes one HTML file per public page with its own title, description, canonical and social tags (read from each page's `useSEO`). `index.html` = home page tags; untouched copy kept as `app.html`, which `vercel.json` rewrites everything else to (CRM host, unknown URLs). `cleanUrls` + no trailing slash; `app.arthaleads.com` sends `X-Robots-Tag: noindex`; 404 page is noindex. Static `public/sitemap.xml` removed, the API's dynamic sitemap (now all 20 public pages + posts) is served at `/sitemap.xml`. `og-image.png` added (end card of the film). The splash screen no longer holds the marketing site for 1.8 s.
- **Home copy**: removed "India's #1" / "best" and the "98% uptime guaranteed" tile (now "24/7 WhatsApp AI replies"); stats match the bots (50+ teams, 10,000+ leads). Nav switches to the hamburger below 1280 px so the two logos and menu never wrap.
- Watch: Vercel must run `npm run build` (default). Google Search Console: resubmit sitemap, then "Validate fix" on the duplicate-canonical issue.

### Claude Code, 2026-10-09 IST, blog redesign + "by Vistrow Technologies" logo

- Blog index (`PublicBlog.jsx`): title + search header, toolbar (count, active filters, topic dropdown), large featured card for the newest post, three-column card grid, pagination, closing CTA. Article page (`PublicBlogPost.jsx`): breadcrumb, category pill, author + share (LinkedIn, WhatsApp, copy link), summary callout, hero image, sticky sidebar (search, topic, numbered "In this article" with active section, suggested reading), About box, suggested articles. New shared `components/BlogCard.jsx`. Page size is now 10 (featured + 9 on page 1). Structure follows vistrow.com/blog; the chip "browse" bar is deliberately not copied.
- `PublicNav.jsx` / `PublicFooter.jsx`: "by Vistrow" text replaced by the Vistrow Technologies logo (`public/vistrow-technologies.png` and `-dark.png`, shown on mobile too). Verified on a local demo database seeded with 11 sample posts (local only, nothing in production).

### Claude Code, 2026-10-09 IST, Sanity blog connected

- Sanity project **ArthaLeads**, id `2racdioq`, dataset `production` (public, so published posts are readable with no token and nothing secret lives in Railway). Studio code in `studio/` (own package, not part of the app builds), deployed to https://arthaleads.sanity.studio (redeploy with `cd studio && npx sanity deploy`; needs `npx sanity login`).
- `backend/services/sanityBlogSync.js` copies live Sanity posts into `BlogPost` every 10 minutes (cron in `utils/scheduler.js`): portable text -> our block types, link/escape safe, category created by name, SEO fields fall back to title/summary. Posts need a `Publish at` time that has passed, so daily posts can be scheduled. Unpublishing in Sanity turns the copy into a draft. A slug already used by a CRM-editor post is never overwritten. `BlogPost.sanityId` / `sanityUpdatedAt` are new (sparse unique index). 13-assertion scratch test passed against the real Sanity query plus fakes. Env overrides if ever needed: `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN` (only for a private dataset).

### Claude Code, 2026-10-09 IST, hold-to-delete for projects

- Deleting a project now needs a press-and-hold (red fill sweeps across ~1.6s; releasing early, sliding off or blurring cancels; Enter/Space also works; reduced motion respected). New `components/HoldToConfirmButton.jsx`; `ConfirmDialog` in `components/UI.jsx` gained a backward-compatible `holdToConfirm` prop; only `ProjectDetail`'s project delete uses it. Check: `frontend/e2e/hold-to-delete/drive.cjs`. Not verified on the live site or with touch input.

### Claude Code, 2026-10-09 IST, project page crash + help bot knowledge

- `dc36292` ProjectDetail used `useMemo` without importing it, so every project page crashed in production (audit FE01, introduced by my batch A). Leads transfer callback for project leads called two setters that do not exist; now uses `removeLead`. Ran an `no-undef` lint over all of frontend/src: no other undefined names (only the Vite `__APP_BUILD__` define). Verified the project page Info/Leads/Prospective tabs render on the local demo account.
- (this commit) Help assistant and marketing bot knowledge in `backend/utils/openai.js`: corrected stats to the website's (50+ teams, 10,000+ leads), removed live features from "coming soon" (Google Ads, duplicate detection, late marks), fixed `/integrations` path and ticket location, dropped the obsolete "server sleeping" login step, added a "NEWER FEATURES" block (search, project transfer, project dump/chat, consent, tasks, seats and renewals with credit, storage and packs, Meta conversion tracking, connection health, Google Ads, Vistrow auto-call, attendance photo fallback, paging, referral statuses, password change sign-out). Four new quick answers in `frontend/src/data/helpData.js`. Every claim checked against the code; STOP-keyword opt-out and Dump "import into project" do not exist and are not claimed.

### Claude Code, 2026-10-09 IST, Vistrow Voice settings are a page, not a popup (branch claude/vistrow-picker-options)

- New settings page `pages/VistrowVoiceSettingsPage.jsx` with two tabs: Connection token (`/integrations/vistrow-voice`, the old popup's content, now `components/VistrowVoiceSettings.jsx` `VoiceConnectionPanel`) and Auto-call new leads (`/integrations/vistrow-calling`). The connected Vistrow Voice row shows a Settings gear (`ConnectionCard` `onSettings`) instead of Edit; the tile goes to the Auto-call tab. The `VoiceWizard` modal and `VistrowCalling.jsx` are removed. Browser checks: `frontend/e2e/vistrow-outbound/drive.cjs` and `drive-list.cjs`.

### Claude Code, 2026-10-09 IST, Vistrow Voice tile goes to the auto-call page (branch claude/vistrow-picker-options)

- The Vistrow Voice quick-connect tile on Integrations now navigates to `/integrations/vistrow-calling` instead of opening the token modal. The connected Vistrow Voice row keeps Edit (token modal) and gets a real "Auto-call new leads" button (`ConnectionCard` `onAutoCall`, admins only); the earlier link in PR #5 sat in the Facebook-only "Name your lead forms" slot and never showed. The auto-call page links back to the token modal. No setting or source switch is touched. Check: `frontend/e2e/vistrow-outbound/drive-list.cjs`.

### Claude Code, 2026-10-09 IST, Vistrow auto-call setup moved to its own page (branch claude/vistrow-calling-page)

- The "auto-call new leads" setup is now `/integrations/vistrow-calling` (new `pages/VistrowCalling.jsx`, route in `App.jsx`), opened from a button on the Vistrow Voice card in Integrations (admin only). Removed the inline block from `pages/Automation.jsx`; fixed step 1 layout. Backend unchanged. Browser check updated (`frontend/e2e/vistrow-outbound`).

### Claude Code, 2026-10-09 IST, Vistrow project picker API (branch claude/vistrow-picker-options)

- Added read-only `GET /webhook/lead/projects` (header `X-ArthaLeads-Connection-Token` = the org's Vistrow Voice connection token, tenant from the token, Enterprise only): active projects `{id,name}` only for Vistrow's picker (contract agreed with Vistrow, their PR #11). Replaces the earlier `/webhook/vistrow/picker-options` draft; no campaign/ad list. New `routes/vistrowPickerRoutes.js`, one mount line in `server.js`; contract in `docs/vistrow-outbound-lead-created.md`; tests `backend/tests/vistrowPicker.test.js` (in `npm run test:vistrow`). Not verified against a real MongoDB or live Vistrow.

### Claude Code, 2026-10-09 IST, Vistrow outbound lead.created (PR #3, draft, not merged, off by default)

- Opt-in outbound new-lead delivery to Vistrow Voice with per-source call switches, route rows and a guided setup in Automation; agents are picked by name/knowledge base from Vistrow's `GET /leads/inbound/{account}/agents` and the raw agent id never reaches the browser. Docs: `docs/vistrow-outbound-lead-created.md`. Tests: `cd backend && npm run test:vistrow`; browser check in `frontend/e2e/vistrow-outbound`. Not verified: real MongoDB for the new store, live Vistrow calls.

### Codex, 2026-10-08 22:02 IST, frontend functional cross-verification

- `4b5cab3` Five completed frontend agents plus parent sandbox/browser checks in `docs/audits/2026-10-08-cross-verification.md`, pinned to application `3bef24a`: 31 deduplicated failure families (4 P1, 22 P2, 5 P3), per-menu passes/blocked/unrun checks and complete worker reports. Independently reproduced project-detail crash, duplicate invoices, silent manual-booking overwrite, password bearer continuation and conversation-start ownership disclosure. Historical audit marked as superseded; no application/mobile edits or production writes.
- Frontend build and all four backend npm-test suites pass; fresh real Mongo sandbox works, correcting the earlier download/test-blocked state. Parent API checks 38/39 pass; remaining failure is invoice concurrency. Saved corrected cloud `start_skill` instructions (draft review/save/publish still needed for reuse). Live Meta/WhatsApp/Google/telephony/Razorpay/storage/email/AI acceptance remains unverified; source-only and mocked checks are explicitly distinguished. Do not sign off nested project actions until the crash is repaired and retested.

### Codex, 2026-10-08 (IST), prelaunch audit

- `c27172b` Five-agent dashboard/marketing audit in `docs/audits/2026-10-08-launch-audit.md`: 61 customer capabilities, 57 engineering findings (12 P1), 15 missing and 21 partial marketing explanations. Documentation only; no application or mobile edits. Frontend build passed; 27 dashboard/20 public pages rendered with API fixtures, three browser defects reproduced, payment retry failures reproduced, deletion coverage now has eight failed assertions.
- Mongo sandbox is blocked by proxy HTTP 403; saved an onboarding draft adding `fastdl.mongodb.org` and sandbox startup instructions, which still requires environment review/save/publish. Database CRUD/role regression and real Meta/WhatsApp, Google, telephony, Razorpay, storage and email delivery still need sign-off; no production secrets or writes used. Final pull preserved Claude's mobile 1.0.12 release.

### Claude Code, 2026-10-08 (IST), mobile 1.0.12

- Arthaleads Mobile **1.0.12 (build 38)** published to the whole fleet (`android.build` 38, GitHub Release `mobile-v1.0.12-38`): the WhatsApp Chat tab on project leads (see the entry below). Signed with the real key, universal APK, minBuild unchanged at 19.

### Claude Code, 2026-10-08 (IST), WhatsApp chat for transferred leads

- A lead moved into a project keeps its WhatsApp conversation on the archived original (`WaConversation.leadId`); the project lead only remembers `fromLeadId`. The Chat tab was hidden for every project lead. New `GET /api/projects/:id/leads/:leadId/whatsapp-messages` (in `backend/routes/projectRoutes.js`, not `leadService.js`) looks the chat up through `fromLeadId`; access is the project's (agents must be assigned to it). `frontend/src/components/LeadDetail.jsx` and the app's lead detail show the Chat tab for WhatsApp project leads that have a `fromLeadId`. **Correction, same day:** a routing rule's project copy has no `fromLeadId` by design (it is an "open copy" tied to the lead in Leads by phone, see `utils/projectCopies.js`), so following `fromLeadId` alone missed exactly those leads. The endpoint now finds the conversation by `fromLeadId` when there is one, otherwise by the lead's WhatsApp number (last ten digits), latest thread first, and the tab shows for every WhatsApp project lead. A lead with no chat shows "No WhatsApp conversation". The app needs the next release to get the tab.

### Claude Code, 2026-10-08 (IST), mobile app (owner asked for it; `mobile/` only)

- `c7a5369` + release commit: Arthaleads Mobile **1.0.11 (build 37)** published to the whole fleet (`backend/constants/appRelease.js` `android.build` 37, GitHub Release `mobile-v1.0.11-37`, universal APK, signed with the real key). The app now has: copy name and number, per-project Dump Leads (`GET /projects/:id/dumped-leads`), WhatsApp Chat tab (`GET /leads/:id/whatsapp-messages`), `ad:`/`form:` Source filter tokens, "Also in project" (`inProjects`), storage meter and 80% popup (`GET /org/storage`), plan locks, routing-rule editing (`PATCH /routing-rules/:id`), Dashboard source pills that sum to the total.
- Layout: shared `AdaptiveGrid` replaces fixed-ratio grids; text scale capped at 1.3x; lead/dump/follow-up/booking/invoice cards rebuilt like the Leads card. Tests in `mobile/test/` (not run by CI).
- Not in the app yet: the web's "Manage storage" modal (buy extra space, free up files, `/api/storage/*`) and the Meta Conversions card. Plan & Billing "Get more" opens Plan & Billing, not a purchase flow.


### Claude Code, 2026-10-08 (IST), remaining launch-audit fixes (batches A to E)

Each batch was tested against the real handlers with in-memory Mongo (scratch scripts, not in the repo); `npm test` (account-deletion suites) now passes fully. Commits: `8566a49` A, `3e7e789` B, `b0f7034` C, `9b19f87` D, then E (copy).
- **A, core CRM (F04, C04-C10):** lead list ignores a stale poll when the filter changed; project-lead edit form saves to the project and keeps budget/priority/follow-up/assignee (`projectService.updateLeadFields`); exports fetch exactly the selected rows and up to 5,000 (`getAllUnified(query, user, opts)`); `Lead.remarkNote` added for the Follow Ups note; future follow-ups honour From; dashboard counts moved project leads' follow-ups; restore is claimed atomically (second press gets 409).
- **B, operations (O05-O15):** clock-out with selfies off now clocks out; photo required server-side unless the client declares `proofUnavailable`; a photo that cannot be saved is an error; early-leave/overtime compare full date-times (night shifts); managers do not see attendance Save; booking edits recalculate unless the brokerage was typed (`Booking.brokerageManual`); developer can change (not when an invoice exists); bookings and invoices page 50 at a time with whole-set summaries; developers may have 0% brokerage; ticket replies hide admin notes; Performance tiles use distinct team totals (`getPerformanceTotals`); referrals show "Reward Processing" until a super admin marks it given (`Organization.referralRewardGrantedAt`, `PATCH /super-admin/orgs/:id/referral-reward`); first payment from a referred trial org schedules the reward.
- **C, team and auth (P04-P06, P08, P09, F03):** an org always keeps one active admin; reactivating someone checks seats (shared `assertSeatAvailable`); account switch also swaps the stored bearer token; reset password needs 8 characters; Plans page has "Renew or change seats"; account deletion covers every user reference and removes a person from a project's assignee list instead of nulling it.
- **D, messaging and integrations (I03-I13, I18):** routing rules cannot match another source; free-reply allowance claimed with compare-and-swap; a campaign is claimed once, the reviewed settings are what gets sent, and a campaign that cannot start returns to draft; campaign website filter uses `sourceDomain` (deleted/archived leads stay IN campaign audiences on purpose, owner's decision); inbound Meta webhooks keep every message in a batch and store photos, voice notes and documents as "[Image]" style entries (the bot answers only text and taps); one-to-one marketing templates refuse an opted-out lead; Google Ads webhook and sync need Enterprise, the sync files routed leads into projects and holds its cursor back on a failed save; manual button-flow start and nudges need Enterprise, an active assistant and a connected, bot-enabled WhatsApp; managers no longer see template Delete.
- **E, copy (M01-M10):** signup approval wording, API docs use `token` and describe the Bearer login token, backup wording, AI scoring wording, trial storage, product updates (Oct 2026 entries, blog claim fixed), site visit stage names, cookie banner and Cookie Policy share one preference.
- Still open (needs the owner, or a decision): AiSensy/Wati/Interakt per-org WhatsApp URLs are unauthenticated; archived-project leads and former project members' follow-ups; invoice amendment policy; marketing coverage gaps (15 features with no public explanation, screenshots).

### Claude Code, 2026-10-08 (IST), launch-audit fixes

Re-verified each P1 with a test against the real handlers (two orgs, in-memory Mongo) before and after. Commits: `2a72c8e` O01, `b8d6767` F01/F02/plan payments, `c0cfc51` C01/C02/O02/O03/O04/I01, `f1f6954` I02, `1009672` P02/P01, `fb97980` P03, `b609cfe` C03, then the commit with P07/P10/I15-I17/M04.
- O01: `utils/publicOrg.js` strips integration keys from every `/org` response (replaced by `...Set` booleans). Nothing in the apps called `GET /org/me`.
- F01/F02/plan: a failed grant releases the claim so the retry grants it (`billingService`, `storageOrderService`, `creditTopUpService`); `creditService.topUp` no longer throws after the balance moved.
- Ownership: agents are limited to their own leads on `PATCH /leads/:id`, to assigned projects on project transfer, to their own tasks on complete/reopen, and to their own leads' calls (`findLeadOrProjectLead` takes `user`). Tasks only accept assignee/lead/project from the caller's org; empty lead/project become null.
- I02: Meta signature check on `/whatsapp/meta-webhook` and per-org `meta` webhooks. **Logged only until `WA_WEBHOOK_ENFORCE=true` is set** (secret: `WA_APP_SECRET` else `FB_APP_SECRET`). AiSensy/Wati/Interakt per-org URLs are still unauthenticated: they need a per-org secret in the URL, which means changing the URL at the provider (owner decision).
- P02: `User.passwordChangedAt`; older tokens get 401 (`middlewares/auth.js`). Own password change returns a fresh cookie and `token` so the web session continues; the mobile app should store the returned token (otherwise it signs the person out after a change).
- P01: trial-expiry check no longer blocks `/api/auth/account/deletion`.
- P03: changing plan or seats mid-term credits the unused time (`billingService.termPlanFor`, `planPricing.withCredit`) and starts a fresh term; same plan and seats still stacks. `GET /api/billing/preview` feeds `CheckoutModal`.
- C03: project to main transfer reuses `leadFromProjectLead` (notes, activities, status, budget, assignee).
- Mine: P07 (`storage.removeStrict`, nothing counted unless the file is deleted), P10 (logo checks quota; `STORAGE_FULL` no longer falls back to base64), I15 to I17 (arrival event for leads that moved on, stale pending recovery, test event needs a test code), M04 (privacy text).

### Claude Code, 2026-10-08 (IST), night

- Dashboard (web): order is now Action Required, Admin Intelligence, Performance, Team (Agent Status and Lead Sources Health last in Team). All two-column rows are equal halves with the same gap and stretch to equal height. Stat cards centre their text (Dashboard KPIs, Integrations counts, Credits tiles, Tasks summary); icon stat cards (Performance, Team, `StatCard` in `UI.jsx`) centre the icon against the text. Integrations quick-connect tiles are centred with icons on one line. Layouts stay single column on phones.
- Mobile app (`dashboard_screen.dart`): metric cards centre their text. Section order already had Admin Intelligence above Performance. Not built into an APK; needs a release build.

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

- Claude: IntroVideo autoplay now tries sound first, falls back to muted and unmutes on first click/tap/key (frontend/src/components/IntroVideo.jsx).

- Claude 2026-10-10: role gates. Agents blocked from /api/bookings, /developers, /invoices (admin/manager only, matches sidebar + mobile); agent cannot assign a WhatsApp chat to someone else; frontend RoleGate on template/campaign builders, AI agent pages, conversation settings, bookings/invoices/developers; template cards no longer open the editor for agents.
