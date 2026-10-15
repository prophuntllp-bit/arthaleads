# Staging environment

Every change goes to staging first, is checked there, and only then reaches the
live site. Staging is a full copy of the website, CRM and API that never touches
production data, real customers, payments or WhatsApp.

| | Live | Staging |
|---|---|---|
| Website | www.arthaleads.com | staging.arthaleads.com |
| CRM | app.arthaleads.com | app-staging.arthaleads.com |
| API | api.arthaleads.com (Railway "production") | api-staging.arthaleads.com (Railway "staging") |
| Database | production MongoDB | staging MongoDB (separate, test data only) |
| Git branch | `main` | `staging` |
| Login cookie | `crm_token` | `crm_token_staging` |

## Day-to-day flow (every agent, every change)

Several sessions share the main checkout (E:\PROPHUNT CRM) on `main`: never
`git checkout staging` there, it would switch the branch under everyone else.
Work on staging in its own worktree instead (create once):
`git worktree add "E:/PROPHUNT CRM-staging" staging`, then run `npm install`
in its frontend/ and backend/.

1. `git checkout staging && git pull`, merge `main` in if staging is behind.
2. Commit the change to `staging` and push. Vercel builds the staging website and
   CRM; Railway's `arthaleads-staging` service (staging environment) deploys the
   API straight from the `staging` branch (GitHub integration, watch path
   /backend/**). No GitHub Action or token is involved.
3. Check the change on staging.arthaleads.com / app-staging.arthaleads.com.
4. When it works, merge `staging` into `main` and push. That deploys live.
5. Log both commits in AGENT_BRIDGE.md.

Exception: an urgent live bug fix the owner approves explicitly may go straight
to `main`; merge it back into `staging` right after.

## Safety switches (already in the code, set by staging's variables)

- `BACKGROUND_JOBS=off`: no cron jobs (reminders, push, backups, Facebook token
  refresh, Google Ads polling, blog sync) and no outbound worker.
- `AUTH_COOKIE_NAME=crm_token_staging`: staging logins never overwrite or read
  the live `crm_token` cookie (both are on `.arthaleads.com`).
- Both staging hosts send `X-Robots-Tag: noindex` (frontend/vercel.json), so
  search engines never index staging.
- No real WhatsApp, Meta, Razorpay, email or AI keys: staging uses fake or
  test-mode values only.
- frontend/src/utils/hosts.js maps the staging hostnames, so the website's
  "Get Started" and login links stay on staging.

## One-time setup (owner, in the dashboards)

### 1. Railway: a separate "staging" environment (DONE 15 Oct 2026)
Project `prolific-endurance` > environment `staging` (created empty, nothing
copied from production) with:
- `MongoDB` (Railway template, staging data only)
- `arthaleads-staging`: GitHub repo prophuntllp-bit/arthaleads, branch
  `staging`, root `/backend`, watch path `/backend/**`, healthcheck `/health`,
  restart on failure x10, custom domain `api-staging.arthaleads.com` (port 5000).
  JWT_SECRET and CRYPTO_KEY were generated with Railway's secret() function.

Staging variables for the `arthaleads-staging` service:

```
NODE_ENV=production
BACKGROUND_JOBS=off
AUTH_COOKIE_NAME=crm_token_staging
MONGO_URI=${{MongoDB.MONGO_URL}}
JWT_SECRET=<new random 64+ characters>
JWT_EXPIRES_IN=7d
CRYPTO_KEY=<new 64 hex characters>
CLIENT_URLS=https://staging.arthaleads.com,https://app-staging.arthaleads.com
FRONTEND_URL=https://app-staging.arthaleads.com
FB_APP_ID=0
FB_APP_SECRET=staging-not-real
FB_VERIFY_TOKEN=staging-not-real
RESEND_API_KEY=re_staging_not_real
OPENAI_API_KEY=sk-staging-not-real
```
Leave RECAPTCHA_SECRET_KEY unset: the backend then treats reCAPTCHA as
unavailable and lets forms through (backend/utils/recaptcha.js), which is what
a test environment wants. Leave WhatsApp, Razorpay, Google Ads and push keys
unset too.

### 2. Vercel: staging hosts on the `staging` branch (DONE 15 Oct 2026)
- Domains `staging.arthaleads.com` and `app-staging.arthaleads.com`: Preview,
  git branch `staging`.
- `VITE_API_URL` = `https://api-staging.arthaleads.com/api` for Preview, branch
  `staging` only (the original VITE_API_URL stays on all other environments).

### 3. DNS at Hostinger (arthaleads.com uses dns-parking.com nameservers)
| Type | Name | Value |
|---|---|---|
| CNAME | staging | f241532a71ba57e8.vercel-dns-017.com |
| CNAME | app-staging | f241532a71ba57e8.vercel-dns-017.com |
| CNAME | api-staging | 2ykmh9ku.up.railway.app |
| TXT | _railway-verify.api-staging | (verification value shown in Railway > arthaleads-staging > Networking) |

### Note: staging MongoDB runs mongo:7.0
Railway's MongoDB template ships mongo:8.0, which cannot start on Linux kernel
6.19+ (MongoDB SERVER-121912, tcmalloc/rseq). Staging uses mongo:7.0 until
that is fixed upstream.

### 4. Test data
Once the staging API is up, seed it with the sandbox data (demo org, admin,
manager, agent, 2 projects, 12 fake leads) so the CRM can be checked after
every change. Never load production data into staging.
