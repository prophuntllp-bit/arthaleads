# ArthaLeads -> Vistrow Voice: outbound `lead.created`

Opt-in, off by default. Admin setup: **Automation -> "Let Vistrow's AI agents call your new leads"** (four steps: connect, sources, agents, review and switch on). Technical details (web address, header mode, test/check tools, safety settings, delivery log) sit in a collapsed section.

## What is sent, and when
* Only for a **new** lead, after it is saved, from: manual add, Website webhook, Facebook webhook, Google webhook/poller, custom `/webhook/lead` (legacy path), WhatsApp/CTWA auto-capture, QR/public form, and small spreadsheet imports (opt-in, never called).
* Never for updates, never for leads that came from Vistrow Voice (loop prevention), never for existing leads (no backfill or replay; nothing reads the Lead collection).
* Delivery is a stored job: retries with backoff (3s, 10s, 30s, 2m, 10m, 30m, 1h; 8 attempts / 6h), never blocks lead creation.

## Request
`POST {web address}/leads/inbound/{account_id}` (default address `https://api.vistrowvoice.com`, host allow-listed, redirects not followed).

Headers: `X-Vistrow-Webhook-Token: <key>` (or `Authorization: Bearer <key>`), `Idempotency-Key: <org_id>:<lead_id>`, `X-ArthaLeads-Event`, `X-ArthaLeads-Event-Id`, `X-ArthaLeads-Timestamp`, `X-ArthaLeads-Signature: v1=<HMAC-SHA256 of "<ts>.<body>">`, `X-ArthaLeads-Test: 1` on tests. The key is never put in the URL or logs.

## Source values (`lead_source`)
`Website`, `Facebook Ad`, `WhatsApp`; other ArthaLeads sources pass through unchanged (e.g. `Google Ads`, `Manual`, `Import`, `QR`). The CRM's own value is in `custom_fields.arthaleads_source`. Only Website, Facebook and WhatsApp leads can ever have `auto_call: true`.

## Body fields
Required: `event` (`"lead.created"`), `source` (`"arthaleads"`), `org_id`, `lead_id`, `name`, `phone` (E.164), plus `id`/`event_id` (`evt_lc_<lead_id>`), `created_at`.
Optional, only when present: `email`, `whatsapp`, `lead_source`, `source_detail`, `project`, `campaign_id/name`, `ad_id/name`, `form_id/name`, `requirements`, `priority`, `timeline`, `preferred_location`, `street_address`, `city`, `property_type`, `purpose`, `bhk`, `budget` (display string), `remark`, `remark_1`, `remark_2`, `assigned_to`, `follow_up_date`, `consent_basis`, `opt_out`, `custom_fields`.

**Call decision (always present):** `auto_call` (bool). When true: `agent_id` and `route_label`. When false: `auto_call_reason` (`source_disabled`, `no_route`, `ambiguous_route`, `agent_missing`, `not_auto_source`, `test_event`) and **no** `agent_id`. Vistrow must import/tag the Contact either way and may queue a call **only** if `auto_call === true`, only for `agent_id`, with no fallback agent.

`custom_fields`: `arthaleads_source`, `source_page`, `source_domain`, `form_plugin`, `page_id`, `adset_*`, `adgroup_*`, `meta_lead_id`, `ad_headline/body/source_url`, `project_id`, `status`, `remark_3/4`, `remark_note`, `budget_min/max/currency`, `tags`, `form_responses`, `whatsapp_consent`. Text has control characters stripped.

## Routing (owner-configured; mirrors Website Widget page rules)
* Each source (Website, Facebook, WhatsApp) has a switch, **off by default**.
* Rules: Website = page address contains X (optionally tagged with a project); Facebook = project; WhatsApp = project or ad. Most specific wins; equal ties with different agents -> `ambiguous_route`; a rule with no agent -> `agent_missing`. No default agent.
* **Website page rules can carry project context:** the page URL is sent as `custom_fields.source_page`; a rule's optional project becomes `project` / `custom_fields.project_id` when the lead has no project of its own.
* Re-checked at send time; a change since creation can only downgrade to no-call.

## Response handling
2xx `{ok:true}` (also `deduped`) = delivered. `queued:false` => delivered but warning "call not queued". 2xx `{ok:false,reason}` and 4xx (except 408/429) = permanent, shown to the admin, never marked delivered. Transport errors, 408, 429 (Retry-After honoured), 5xx = retry.

## Open points for Vistrow to confirm
`auto_call` / `agent_id` / `auto_call_reason` / `route_label` key names; `budget` as a display string; `queued:false` response shape; an agent-list endpoint (so the UI can offer agents without a pasted code). **Compliance:** ArthaLeads holds no call-consent or DND data (only WhatsApp marketing opt-in, sent as `consent_basis` / `opt_out`); DND/TRAI checks must be done on the Vistrow side.

## Tests
`cd backend && npm run test:vistrow` (197 checks, no database needed); browser check in `frontend/e2e/vistrow-outbound`.
