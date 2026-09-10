# WhatsApp Embedded Signup — Implementation Plan

**Goal:** Replace the "pick a BSP / paste an API key" onboarding with Arthaleads' own
Embedded Signup. A tenant clicks **Connect WhatsApp**, a Facebook Login popup opens,
they pick or create their number inside it, and they're live — no tokens, no webhook
URLs, no technical steps. Same experience AiSensy/Wati give, but on Arthaleads' own
Meta app.

Arthaleads Meta app: **`2072559546698201`** ("Arthaleads Messaging").
First test tenant: **PropHunt LLP** (org `69e85fa021cfb72e0c389654`).

---

## 1. What the tenant sees (end state)

1. Opens **Conversations** → not connected → one green **Connect WhatsApp** button.
2. Button opens Meta's Facebook Login for Business popup (`FB.login` with our
   `config_id`).
3. Inside the popup Meta walks them through: log in → pick Business Portfolio (or
   create) → pick/create WhatsApp Business Account → add phone number → OTP verify.
   All Meta's UI, all inside the popup.
4. Popup closes, returns an **auth code** + `phone_number_id` + `waba_id`.
5. Frontend sends those to our backend. Backend finishes wiring (token exchange,
   webhook subscription, number registration) and flips the org to connected.
6. Tenant is in the inbox. Bot + agents work exactly as they do for PropHunt today.

---

## 2. Architecture change: webhook routing

**Today:** `POST /api/whatsapp/webhook/:orgId` — the org is in the URL, because each
tenant pastes their own per-org webhook URL into their BSP.

**With ES:** Meta sends **every tenant's** events to **one** app-level callback URL
(set once in the Meta app dashboard). The payload identifies the tenant by
`entry[].id` (the WABA ID) and `value.metadata.phone_number_id`.

**Change:**
- Add `POST /api/whatsapp/webhook` (no orgId). Resolve the org with
  `Organization.findOne({ "whatsapp.wabaId": <entry.id> })` (fallback: by
  `phoneNumberId`). Then run the existing `parseStatusUpdates` / `parseWebhookPayload`
  / `handleInbound` pipeline unchanged.
- Keep `POST /api/whatsapp/webhook/:orgId` for the current direct-path tenants.
- Migrate PropHunt's record to carry `whatsapp.wabaId` so the app-level route can
  resolve it once we point the Meta app's webhook config at the new URL.
- GET verification (`hub.challenge`) on the app-level route checks a single
  app-wide verify token from env, not the per-org one.

---

## 3. Data model — extend `org.whatsapp`

Already present: `provider`, `apiKey`, `phoneNumberId`, `wabaId`, `webhookVerifyToken`,
`enabled`, `botEnabled`, `botName`, `botSystemPrompt`.

Add:
- `accessToken` — the long-lived business token from the ES code exchange (rename
  intent of `apiKey`; keep `apiKey` as the field name to avoid a migration, or add
  `accessToken` and read both).
- `esOnboarded: Boolean`, `onboardedAt: Date`
- `registrationPin: String` — the 6-digit PIN used for `/{phone-number-id}/register`
  and two-step verification (store encrypted).
- `verifiedName`, `displayPhoneNumber`, `qualityRating` — cached for display in the UI.
- `tokenHealthCheckedAt`, `tokenValid: Boolean` — from a periodic `debug_token` check.

---

## 4. Phase 0 — Meta-side setup (BLOCKING, start now)

None of this is code. It has the longest lead time (App Review = days to weeks) and
gates a real end-to-end test.

1. **Business Verification** of the Arthaleads Business Portfolio that owns app
   `2072559546698201`. Required before ES can serve businesses other than app
   admins/testers.
2. **Facebook Login for Business → Configurations → Create** with the **WhatsApp
   Embedded Signup** use case. Produces the **`config_id`** the frontend passes to
   `FB.login`. Set the requested permissions: `whatsapp_business_messaging`,
   `whatsapp_business_management`.
3. **App-level webhook**: App Dashboard → WhatsApp → Configuration → set Callback URL
   to `https://api.arthaleads.com/api/whatsapp/webhook`, set a verify token (new env
   var), subscribe the **`messages`** field on the `whatsapp_business_account` object.
4. **App Review / Advanced Access** for `whatsapp_business_management` +
   `whatsapp_business_messaging`. Needs a screencast of the ES flow, privacy policy
   URL, use-case write-up. Until approved the app is in Development Mode and ES only
   works for users who are admins/developers/**testers** of the app — which is enough
   for Phase 3 testing on PropHunt.
5. **Tech Provider** — accept the Tech Provider terms (Independent Tech Provider
   path). Also gated on App Review.
6. New env vars on Railway: `WA_APP_ID=2072559546698201`, `WA_APP_SECRET=<secret>`,
   `WA_ES_CONFIG_ID=<config_id>`, `WA_WEBHOOK_VERIFY_TOKEN=<random string>`.
   (Note: existing `FB_APP_ID`/`FB_APP_SECRET` belong to the **Lead Ads** app
   `1481761319894796` — do not reuse them.)

---

## 5. Phase 1 — Backend (build in parallel with Phase 0)

Mirror the existing multi-tenant OAuth pattern in `services/automationService.js`
(`oauth/access_token` exchange, `fb_exchange_token`, `subscribed_apps`,
`debug_token`, `{app-id}|{app-secret}` app token).

New: `services/whatsappOnboardingService.js`

- `exchangeCode(code)` →
  `GET graph.facebook.com/v21.0/oauth/access_token?client_id=WA_APP_ID&client_secret=WA_APP_SECRET&code=<code>`
  → returns the business access token (long-lived for the ES/Tech-Provider case; no
  `redirect_uri` needed for the ES code).
- `subscribeApp(wabaId, token)` →
  `POST /{wabaId}/subscribed_apps` (the call run by hand for PropHunt on 9 Sep 2026).
- `registerNumber(phoneNumberId, token, pin)` →
  `POST /{phoneNumberId}/register` with `{ messaging_product: "whatsapp", pin }`.
  Generate + store the PIN.
- `fetchProfile(phoneNumberId, token)` → `GET /{phoneNumberId}?fields=verified_name,
  display_phone_number,quality_rating` to cache display fields.
- `checkTokenHealth(token)` → `debug_token`, run on a schedule; surface `tokenValid`
  in the settings UI.

New route in `routes/whatsappRoutes.js`:

- `POST /api/whatsapp/embedded-signup/exchange` (auth: admin/super_admin) —
  body `{ code, wabaId, phoneNumberId }`. Runs exchange → subscribeApp →
  registerNumber → fetchProfile, writes everything to `org.whatsapp`, sets
  `provider: "meta"`, `enabled: true`, `esOnboarded: true`. Returns the connected
  state. Idempotent (safe to re-run).
- `POST /api/whatsapp/webhook` + `GET /api/whatsapp/webhook` — app-level, resolve org
  by `wabaId`/`phoneNumberId` as in §2.

Webhook refactor in `routes/whatsappRoutes.js`: factor the body of
`POST /webhook/:orgId` into `processWebhook(org, body)` and call it from both routes.

Billing (only if Arthaleads pays Meta — see §8): after `subscribeApp`, share a credit
line with the tenant's WABA —
`POST /{business-id}/{waba-id}/allocation-configurations` style call (exact endpoint
per current Meta docs at build time).

---

## 6. Phase 2 — Frontend

`frontend/src/components/WhatsAppSettings.jsx`:

- Replace the provider grid + manual credential form with a single **Connect
  WhatsApp** button (keep the manual Meta Cloud API form behind an "Advanced" toggle
  as a fallback).
- Load Meta SDK: `https://connect.facebook.net/en_US/sdk.js`, `FB.init({ appId:
  WA_APP_ID, version: "v21.0" })`.
- On click: `FB.login(cb, { config_id: WA_ES_CONFIG_ID, response_type: "code",
  override_default_response_type: true, extras: { sessionInfoVersion: "3" } })`.
- `window.addEventListener("message", ...)` for `WA_EMBEDDED_SIGNUP` events — capture
  `phone_number_id` + `waba_id` from the `FINISH` event.
- `FB.login` callback gives `response.authResponse.code`. POST
  `{ code, wabaId, phoneNumberId }` to `/whatsapp/embedded-signup/exchange`.
- On success show connected state, fire `onConnected()`.
- Handle cancel / popup-blocked / partial-completion.

Expose `VITE_WA_APP_ID` and `VITE_WA_ES_CONFIG_ID` in the frontend env.

---

## 7. Phase 3 — Test on PropHunt (Development Mode, before App Review clears)

- Add PropHunt's Facebook account as a **Tester** on app `2072559546698201`.
- Use a number **not already attached to another WABA/BSP**. The AiSensy trial number
  (+1 555 392 9759) and the old Meta test number (+1 555 197 3423) are both already
  bound — either free one of them up (delete from AiSensy / the old WABA) or use a
  fresh number. Flow mechanics can be exercised with whatever's available; a clean
  end-to-end run needs an unbound number.
- Run the full flow, verify:
  1. `exchange` stores `accessToken`, `wabaId`, `phoneNumberId`, PIN.
  2. `subscribed_apps` shows "Arthaleads Messaging" on the WABA.
  3. Inbound WhatsApp message hits `POST /api/whatsapp/webhook`, resolves to PropHunt
     by `wabaId`, creates the `WaConversation` + `WaMessage`.
  4. Outbound send works; bot auto-reply works.
  5. `delivered` / `read` status events update the ticks.
- Fix whatever breaks. This is the "fix the flow" step.

---

## 8. Decisions needed from you

1. **Billing model.** Arthaleads' Meta account pays for all tenants' conversations
   (consolidated, re-billed through Arthaleads — adds a credit-line-sharing call per
   tenant) **vs.** each tenant adds their own card to their own WABA (simpler, no
   sharing call, tenant sees Meta's charges directly). Changes §5 and the pricing
   model. Needs deciding before App Review submission. **See Part 2 (§11–§17) for
   the full credit-business design.**
2. **Fresh number for PropHunt** to test cleanly, or accept exercising flow mechanics
   on a currently-bound number.
3. **Keep the manual Meta Cloud API path** as an "Advanced" fallback, or remove it
   once ES is live.

---

## 9. What can start now vs. what's blocked

| Work | Status |
|---|---|
| Phase 0 Meta setup (verification, config_id, webhook, App Review, Tech Provider) | **Start now** — longest lead time, no code |
| Phase 1 backend (onboarding service, exchange route, webhook refactor, model fields) | **Can build now** — no Meta approval needed to write it |
| Phase 2 frontend (Connect button, SDK, message listener) | **Can build now** — needs `config_id` only to run, not to write |
| Phase 3 real end-to-end test | **Blocked** on `config_id` (Phase 0.2) + an unbound number |
| Go live for all tenants | **Blocked** on App Review approval (Phase 0.4) |
| Profile-editing feature (picture/description/etc. from the CRM) | **After** ES works — builds on the stored per-org token; note the WhatsApp *display name* change always goes through a Meta review, not instant |

---

## 10. Realistic timeline

- Phase 1 + 2 code: a few days of build.
- Phase 0: Business Verification hours–days; App Review **days to weeks**, can bounce
  back once or twice.
- So: code ready in ~a week, but **cannot serve real external tenants until App
  Review passes.** PropHunt can be tested in Development Mode as soon as the
  `config_id` exists and there's an unbound number.

---
---

# Part 2 — Billing & Credits

Rates below were checked on **10 Sep 2026**. Meta revises rate cards periodically —
**re-verify against Meta's official rate card CSV before setting sell prices.**

---

## 11. The cost side — what Meta charges (India)

Meta moved from 24-hour *conversation* pricing to **per-message** pricing on
1 Jul 2025. Current card is effective 1 Jul 2026. All rates **exclusive of 18% GST**.

| Category | Ex-GST | With 18% GST |
|---|---|---|
| Marketing | ₹0.8631 | ₹1.0185 |
| Utility | ₹0.1150 | ₹0.1357 |
| Authentication | ₹0.1150 | ₹0.1357 |
| Authentication-International | ₹2.4971 | ₹2.9466 |
| Service | **Free until 30 Sep 2026** | — |

### ⚠️ The 1 October 2026 change

This is the most important fact in this document for the credit business:

- **Service messages become chargeable.** Every free-form reply an agent or the bot
  sends inside the 24-hour window gets billed.
- Meta's rule: service is priced **the same as utility/authentication for that
  country**. India is *not* on the list of countries getting a rate change on 1 Oct
  (that list is Bangladesh, Iraq, Nepal, Sri Lanka), so **India service = ₹0.1150
  ex-GST** (₹0.1357 with GST). Meta has not published a separate October service
  rate card; this is derived from their stated rule.
- **1,000 free service messages per business phone number per month. No rollover.**
- Utility messages inside an open 24-hour window also stop being free.

**Consequence:** the Conversations inbox currently costs nothing to run. From 1 Oct
it consumes credits on every reply past the first 1,000/month/number. This is
simultaneously the credit business's main volume driver and the thing tenants will
complain about first.

---

## 12. The sell side — competitor pricing and margin

AiSensy's published India rates (effective 1 Jan 2026):

| Category | Meta cost (ex-GST) | AiSensy price | Margin | Markup |
|---|---|---|---|---|
| Marketing | ₹0.8631 | ₹1.09 | ₹0.2269 | ~26% |
| Utility | ₹0.1150 | ₹0.145 | ₹0.0300 | ~26% |
| Authentication | ₹0.1150 | ₹0.145 | ₹0.0300 | ~26% |

**⚠️ UNVERIFIED — confirm before pricing:** the table assumes AiSensy's ₹1.09 is
**ex-GST**. Their virtual-number add-on is quoted "₹2,000 + GST", which suggests
ex-GST is their convention, but this has not been confirmed for per-message rates.
If ₹1.09 is GST-*inclusive*, real margin is ₹0.0606 — only **~7% markup**, and the
whole business case changes. Check an actual AiSensy invoice or ask their sales team.

**Worked example** — one tenant sending 10,000 marketing messages/month:
- Meta cost ₹8,631 → charged ₹10,900 → **margin ₹2,269/month**
- 50 such tenants ≈ **₹1.13L/month** gross margin

**Competitor's other revenue lines** (for reference when setting ours):
- Chatbot builder ₹2,500/mo (₹2,250/mo annual)
- AI agent builder ₹1,350/mo (₹1,215/mo annual)
- Indian virtual number ₹2,000/year + GST, or ₹299/quarter
- Float on a ₹1,500 minimum credit purchase

---

## 13. Prerequisite: Arthaleads needs its own Meta credit line

Observed directly on PropHunt's WABA in WhatsApp Manager:

> **Payment method: Credit line — AISENSY COMMUNICATIONS PRIVATE LIMITED**

That is the entire mechanism. The BSP extends *their* Meta credit line to the
customer's WABA; Meta bills the BSP; the customer pays the BSP in credits.

For Arthaleads to sell credits:
1. Obtain a Meta credit line (requires business verification + payment method).
2. **Share it with each tenant's WABA via API during onboarding** — an extra step in
   the `embedded-signup/exchange` flow (§5). Endpoint per current Meta docs at build
   time (credit-line sharing / allocation configuration).
3. Meta then bills Arthaleads for **every tenant's** messages.

### Risk this creates

Arthaleads carries the **float** and the **default risk**. If a tenant burns ₹50,000
of messages and disappears, Arthaleads owes Meta regardless.

**Mandatory mitigations:**
- **Strictly prepaid.** No overdraft, ever.
- **Hard block at zero balance** — the send path refuses before calling Meta.
- Low-balance warnings well above zero, so the block is never a surprise.
- Per-tenant spend velocity cap; alert on abnormal spikes.
- Reconcile our ledger against Meta's actual invoice monthly (§15).

---

## 14. GST treatment

- Meta's rates are **ex-GST**; 18% is added on the Indian invoice.
- Structurally GST is a **wash on margin**: pay Meta ₹X + 18%, charge the tenant
  ₹Y + 18%, claim input credit on the GST paid.
- **Two things for the accountant, before invoicing tenants:**
  1. We **float the GST** to Meta and reclaim it later — working capital tied up.
  2. If Meta bills from an overseas entity, **reverse-charge mechanism (RCM)** may
     apply. Affects filing, not margin, but must be settled up front.
- Store and display rates **ex-GST**, add GST at invoice generation. Never mix the
  two in the ledger.

---

## 15. Credit system — data model and deduction

`services/razorpayService.js` already exists — top-ups reuse existing payment
plumbing.

### Collections / fields

**`CreditLedger`** (new, append-only — balance is derived, never mutated in place):

| Field | Notes |
|---|---|
| `orgId` | tenant |
| `type` | `topup` / `debit` / `refund` / `adjustment` |
| `amountPaise` | integer paise, never floats |
| `balanceAfterPaise` | running balance snapshot |
| `category` | `marketing` / `utility` / `authentication` / `service` |
| `waMsgId`, `conversationId` | links back to the message |
| `metaPricing` | raw `pricing` object from the webhook, stored verbatim |
| `rateAppliedPaise` | the sell rate used, so historical entries stay explainable |
| `freeTierApplied` | boolean — counted against the 1,000/month allowance |
| `razorpayPaymentId` | top-ups only |
| `createdAt` | |

**On `org.credits`:**
- `balancePaise` — cached, recomputed from ledger
- `autoRecharge = { enabled, thresholdPaise, rechargePaise }`
- `sellRates = { marketing, utility, authentication, service }` — **per-org**, so
  tenants can be priced differently without a deploy
- `freeServiceUsed = { yyyymm, count }` — per phone number per month

### Where to deduct — use Meta's own pricing signal

**Do not deduct on send and guess the category.** Meta's status webhook returns a
`pricing` object on the `sent` event:

```json
"statuses": [{
  "id": "wamid...",
  "status": "sent",
  "pricing": { "billable": true, "pricing_model": "PMP", "category": "service" }
}]
```

That is the authoritative billing signal — deduct from it, refund on `failed`. This
keeps the ledger reconcilable against Meta's invoice.

Wire this into the existing `applyStatusUpdates` in `routes/whatsappRoutes.js`, which
already parses the `statuses` array.

### Free-tier handling

Meta may report `billable: true` on service messages and net the 1,000 free
allowance at invoice time, rather than flagging them free per-message. So:
- Track our **own** counter per phone number per calendar month.
- Also record Meta's `billable` flag verbatim.
- **Reconcile monthly against the real Meta invoice and alert on drift.**
  Reconciliation is where credit businesses quietly lose money.

### Send-path guard

Before calling `sendProviderMessage`, check `org.credits.balancePaise` against the
worst-case rate for that message category. Refuse with a clear error if insufficient.
This guard is what caps the default risk in §13.

---

## 16. Conversations page — states and credit UI

| State | Behaviour |
|---|---|
| **Not connected** | Onboarding chooser — two cards (§17) |
| **Connecting** | ES popup, or virtual-number wizard |
| **Connected, zero credits** | Inbox renders **read-only**; composer disabled with "Add credits to reply"; prominent top-up banner |
| **Connected, low credits** | Amber banner + auto-recharge prompt; sending still works |
| **Connected, healthy** | Normal inbox; **₹ balance pill** in the header |

**New UI pieces**
- **Credit pill** in the Conversations header — current balance, click opens top-up.
- **Top-up modal** — preset amounts (+₹500 / +₹1,000 / +₹2,500 / +₹5,000), minimum
  purchase, auto-recharge toggle with threshold + recharge amount. Razorpay checkout.
- **Usage / statement page** — per-category message counts, cost, running balance,
  free-tier consumed this month, downloadable statement. Tenants will demand this the
  day charging starts; ship it with the feature, not after.
- **1 Oct advisory banner** — one-time notice that inbox replies are now billable,
  shown before the change lands. Cheaper than a support queue.

---

## 17. The two number-onboarding flows

### A · Bring your own number (Embedded Signup)

Part 1 of this document. Free. Tenant owns the WABA. Requires their Facebook login.
Number must not already be active on WhatsApp (regular or Business app).

### B · Virtual number (paid add-on)

We sell the tenant a number. **Requires a supplier contract with an Indian DID /
virtual-number provider capable of receiving SMS or voice OTP** — that is a business
step, not code. Competitor sells this at ₹2,000/year + GST, so a viable supplier
route exists.

**Caveat:** WhatsApp rejects or flags many VoIP number ranges. The supplier matters;
validate a test number end-to-end before selling this.

**Recommended implementation** — keep the WABA with the tenant:
1. Arthaleads procures the number from the supplier.
2. Tenant runs the **same Embedded Signup flow**, entering the supplied number.
3. Arthaleads relays the OTP to the tenant (or surfaces it in the wizard).
4. WABA remains tenant-owned → avoids the ownership/liability problem, and the
   tenant can leave without a painful migration.

This keeps one onboarding code path for both flows; the only difference is where the
number came from.

---

## 18. Commercial decisions — SETTLED

| Decision | Settled as |
|---|---|
| **Markup** | **₹1.12 marketing / ₹0.15 utility-auth-service**, ex-GST (~30% over Meta). Defaults are in `Organization.credits.sellRatesPaise` and are per-org, so a tenant can be repriced without a deploy. |
| **Meta credit line** | **Yes** — Arthaleads is the biller. Float and default risk accepted, capped by the strictly-prepaid design in §15. |
| **GST** | Charged **once at top-up**, on the invoice. ₹1,000 of credit costs the tenant ₹1,180 and adds 100000 paise. Message debits are ex-GST. |
| **Virtual number (Flow B)** | **Deferred.** Blocked on a supplier contract, not code. Early requests handled manually — buy the number, relay the OTP, walk them through Flow A. |
| **Top-ups** | Razorpay, **UPI-first**. UPI MDR in India is effectively zero vs ~2% on cards; routing top-ups to UPI is what makes the 30% markup net a real 30%. |

Still open:
- **Free credits on signup?** Competitor gives ₹50. Cheap acquisition lever, direct
  cost per signup.
- **Minimum top-up**, and whether unused credits expire (float vs. goodwill).
- **Competitor GST question** (§12) — does not block the rate card above, but worth
  knowing where we actually sit against AiSensy's real price.

---

## 19. BUILT — the credit cap (commit `4020d9a`)

Shipped and verified against the real database. This is the piece that makes the
credit line safe to hold.

**Files:** `models/CreditLedger.js`, `services/creditService.js`, credit fields on
`models/Organization.js` and `models/WaMessage.js`, guards in `routes/whatsappRoutes.js`.

### Reserve / settle

Meta only reports a message's real price in the status webhook, which arrives
*after* the send. A naive check-then-send leaks money two ways: two concurrent
sends both pass the same balance check, and a send can succeed while the debit
never lands. So sending is two-phase, like a card authorisation:

1. `reserve()` — atomically holds the worst-case price, **fails closed**
2. send
3. `settle()` — converts the hold to a debit at Meta's reported price
4. `release()` — hands the hold back on failure or a `billable: false` verdict

`available = balancePaise − reservedPaise`. A tenant can only ever spend what is
actually sitting there.

The atomicity matters: the guard and the increment are **one** document update
(`findOneAndUpdate` with an `$expr` on the balance), so MongoDB serialises
concurrent sends. A read-then-write there is a money leak under any real load.

### What is capped, and what deliberately is not

| Action | At zero credits | Why |
|---|---|---|
| Receive inbound | **Always allowed and stored** | Receiving is free; dropping it loses data Meta never replays |
| Bot auto-reply | **Suppressed silently** | Outbound spend — an unfunded org goes quiet rather than run up a bill |
| Agent reply | **Blocked**, HTTP 402 `INSUFFICIENT_CREDITS` | Outbound spend; the code drives the top-up prompt |
| Campaign send | **Blocked** (whole campaign reserved up front) | Never strand a half-sent campaign |

### Two bugs the tests caught before this shipped

- **`sparse` + `partialFilterExpression` is rejected by MongoDB — silently**, through
  Mongoose's background index build. The idempotency index was therefore never
  created, and duplicate status webhooks double-charged. Meta *does* resend them.
  Fixed by dropping `sparse`, naming the index explicitly so it cannot collide with
  an auto-generated one, and adding an explicit pre-check that does not depend on
  the index existing at all.
- `waMsgId` declared with both `index: true` and `schema.index()` — two conflicting
  definitions for one key.

### Still to build on top

- Top-up endpoint + Razorpay checkout (UPI-first) and the auto-recharge worker
- Balance/usage API and the Conversations credit UI (§16)
- Campaign-level bulk reserve
- Monthly reconciliation job: ledger vs. Meta's actual invoice, alert on drift

---
---

# Part 3 — Templates & Campaigns

**Why this is not optional:** at the agreed rate card, marketing carries ₹0.2569
margin per message against ₹0.0350 for service — **~7.3× more**. A tenant whose
agents answer ~3,000 inbox messages a month earns roughly **₹70** (the first 1,000
are free). That same tenant running one 10,000-contact campaign earns **₹2,569**.
The credit business *is* a marketing-message business; inbox replies are a rounding
error. Without campaigns, the credit line carries risk for almost no return.

**The unfair advantage:** competitors have a contact list. Arthaleads has leads with
status, source, budget, project interest and follow-up dates. "Send this template to
every New lead from shaporjipallonji.com in the last 30 days" is a query the CRM can
already run — **reuse the existing Leads filters as the campaign audience picker.**

---

## 20. Template management

Meta requires every business-initiated message to use a pre-approved template.
Templates live **per-WABA**, so each tenant submits their own — we cannot share one
across tenants.

- CRUD against `/{waba-id}/message_templates` (create, list, delete; edit via
  `/{template-id}`).
- Builder form: name, category, language, header (text/image/video/doc), body with
  `{{1}}` variables, footer, buttons (quick-reply / URL / phone).
- WhatsApp-style live preview.
- Approval status arrives on the **`message_template_status_update`** webhook field —
  subscribe to it alongside `messages`. Surface PENDING / APPROVED / REJECTED with
  Meta's rejection reason.

**Product idea worth building:** a **real-estate template library** — pre-written
content ("New Project Launch", "Site Visit Reminder", "Price Drop Alert") that a
tenant one-clicks to submit to their own WABA. Cheap once the CRUD exists, and it
removes the blank-page problem that otherwise stops non-technical users ever sending
a campaign.

**Backend gap:** `sendProviderMessage`'s `meta` case is **text-only** — no template
support at all. That is the single blocker for any business-initiated message and is
worth fixing early, independent of everything else here.

---

## 21. Campaign sender

Flow: pick template → pick audience from lead filters → map template variables to
lead fields → **show estimated cost before sending** → credit check → queued,
rate-limited dispatch → per-recipient delivery tracking into the existing
`WaMessage` records.

- **Reserve the whole campaign up front** via `creditService.reserve()`. Never start
  a 10,000-message run and stop at 6,000 — that leaves a half-sent campaign and an
  angry tenant. Insufficient balance ⇒ refuse, or offer an explicit partial send.
- New `WaCampaign` model: template, audience query, variable mapping, status,
  counts, reserved/settled totals. `CreditLedger.campaignId` already links to it.
- Dispatch through the existing scheduler/cron rather than a request thread.

---

## 22. The four constraints — ours, because we hold the credit line

### 22.1 Opt-in is mandatory

Meta requires recorded consent before marketing messages. Not optional; violating it
risks the tenant's number **and** our standing as the biller.

- `Lead.whatsappConsent = { status, source, capturedAt, evidence }`.
- Campaign audience builder **hard-filters to consented leads only**.
- Preview shows "X of Y excluded — no consent" so it is visible, not silent.
- Capture points: website form checkbox, and inbound WhatsApp (implicit opt-in for
  service, **not** for marketing — those need explicit consent).

### 22.2 Quality rating

A tenant blasting uninterested recipients tanks their number's quality; Meta then
throttles or bans it. On our credit line their behaviour is our exposure.

- Poll `GET /{phone-number-id}?fields=quality_rating`, cache on
  `whatsapp.qualityRating` (field already added).
- Badge it in the Conversations header.
- **RED ⇒ auto-pause campaigns** for that tenant and alert them, writing the reason
  to `whatsapp.campaignsPausedReason`.

### 22.3 Messaging tiers

Meta caps marketing volume per number by tier (1K / 10K / 100K / unlimited per
rolling 24h), set by quality and verification.

- Read the WABA's `messaging_limit_tier`, cache on `whatsapp.messagingTier`.
- The dispatch queue respects the tier — exceeding it just fails the sends.
- Show remaining 24h allowance in the campaign preview, before they hit send.

### 22.4 Per-user frequency caps

Meta limits how many marketing messages one person receives across *all* businesses.
Some sends silently drop; this is not predictable in advance.

- Report them as their **own bucket** in campaign stats ("Not delivered — recipient
  limit reached"), never lumped into generic failures.
- **Refund the credit** for anything undelivered — `settle()` already releases on a
  `failed` status.

---

## 23. Sequencing

Templates and campaigns come **after** Embedded Signup and the credit UI: templates
need a live WABA, and campaigns must not run before credit deduction exists or we
are giving away ₹0.86 messages for free. The one exception is the `sendProviderMessage`
template branch (§20) — small, self-contained, and blocking everything else.
