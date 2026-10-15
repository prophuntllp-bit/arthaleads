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

1. `git checkout staging && git pull`, merge `main` in if staging is behind.
2. Commit the change to `staging` and push. Vercel builds the staging website and
   CRM; `.github/workflows/deploy-backend-staging.yml` deploys the API to the
   Railway staging environment.
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

### 1. Railway: a separate "staging" environment
1. Project > Environments > **New environment** > name it `staging`. Choose an
   **empty** environment, not "duplicate", so no production variable is copied.
2. In `staging`, add a **MongoDB** database (New > Database > MongoDB).
3. In `staging`, add the backend service from the same GitHub repo, named
   `Arthaleads` (same name as production, the deploy workflow uses it).
4. Set its variables (below). Generate fresh secrets; never copy production's.
5. Settings > Networking > custom domain `api-staging.arthaleads.com`. Railway
   shows the CNAME target for step 3.
6. Project settings > Tokens > create a **project token for the staging
   environment** and add it in GitHub (repo Settings > Secrets > Actions) as
   `RAILWAY_STAGING_TOKEN`.

Staging variables for the `Arthaleads` service:

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

### 2. Vercel: staging hosts on the `staging` branch
1. Project > Settings > Domains > add `staging.arthaleads.com` and
   `app-staging.arthaleads.com`, and set each to **Git branch: staging**.
2. Settings > Environment Variables > add `VITE_API_URL` =
   `https://api-staging.arthaleads.com/api` for **Preview**, branch `staging`
   only. (Production keeps its own value.)

### 3. DNS (wherever arthaleads.com is managed)
- `staging` CNAME `cname.vercel-dns.com`
- `app-staging` CNAME `cname.vercel-dns.com`
- `api-staging` CNAME `<target shown by Railway>`

### 4. Test data
Once the staging API is up, seed it with the sandbox data (demo org, admin,
manager, agent, 2 projects, 12 fake leads) so the CRM can be checked after
every change. Never load production data into staging.
