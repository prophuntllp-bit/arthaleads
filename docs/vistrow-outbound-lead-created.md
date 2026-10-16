# ArthaLeads -> Vistrow Voice: outbound `lead.created`

Opt-in, off by default. Admin setup: **Integrations -> Vistrow Voice card -> Settings gear** (page `/integrations/vistrow-voice`, tabs: Connection / Auto-call new leads at `/integrations/vistrow-calling`) (four steps: connect, sources, agents, review and switch on). Technical details (web address, header mode, test/check tools, safety settings, delivery log) sit in a collapsed section.

## What is sent, and when
* Only for a **new** lead, after it is saved, from: manual add, Website webhook, Facebook webhook, Google webhook/poller, custom `/webhook/lead` (legacy path), WhatsApp/CTWA auto-capture, QR/public form, and small spreadsheet imports (opt-in, never called).
* Never for updates, never for leads that came from Vistrow Voice (loop prevention), never for existing leads (no backfill or replay; nothing reads the Lead collection).
* **WhatsApp/CTWA timing (15 Oct 2026):** not at the first message. Sent once, after the chat's first AI read (name, location, type, BHK, budget filled in) or 60 s after the lead was created, whichever is first. Stored on the lead (`vistrowEmit.dueAt`), so a restart still sends it (15 s sweep). The project the first message names (ad-less match) is resolved first, so routing can use it.
* **Repeat enquiries:** a number already in the CRM starting a new WhatsApp chat is sent again as its own event about the existing lead: `event_id`/`id`/`enquiry_id` = `evt_re_<lead_id>_<ms>`, `lead_id` = the existing lead, `custom_fields.repeat_enquiry: true`, `custom_fields.enquiry_at`, `Idempotency-Key: <org_id>:<lead_id>:<enquiry_id>`. The 24 h same-number rule still makes it a Contact only if a call was asked for in the last 24 h. Website, Facebook and Google repeats already create a new lead (new `lead_id`) after the 2-minute retry window. **Vistrow side:** its receiver keys ArthaLeads leads on `org_id:lead_id`, so it must use `enquiry_id` when present or it will treat a repeat as already imported.
* **Recovered Facebook leads:** a Facebook lead saved with phone "N/A" (token fetch failed) is sent after the 45 s self-heal recovers its phone, reusing its never-sent row (same `evt_lc_` id).
* Delivery is a stored job: retries with backoff (3s, 10s, 30s, 2m, 10m, 30m, 1h; 8 attempts / 6h), never blocks lead creation. The first retry also runs in-process at its due time; the job lease still allows one send.

## Request
`POST {web address}/leads/inbound/{account_id}` (default address `https://api.vistrowvoice.com`, host allow-listed, redirects not followed).

Headers: `X-Vistrow-Webhook-Token: <key>` (or `Authorization: Bearer <key>`), `Idempotency-Key: <org_id>:<lead_id>`, `X-ArthaLeads-Event`, `X-ArthaLeads-Event-Id`, `X-ArthaLeads-Timestamp`, `X-ArthaLeads-Signature: v1=<HMAC-SHA256 of "<ts>.<body>">`, `X-ArthaLeads-Test: 1` on tests. The key is never put in the URL or logs.

## Source values (`lead_source`)
`Website`, `Facebook Ad`, `WhatsApp`; other ArthaLeads sources pass through unchanged (e.g. `Google Ads`, `Manual`, `Import`, `QR`). The CRM's own value is in `custom_fields.arthaleads_source`. Only Website, Facebook, WhatsApp and Google leads can ever have `auto_call: true`.

## Body fields
Required: `event` (`"lead.created"`), `source` (`"arthaleads"`), `org_id`, `lead_id`, `name`, `phone` (E.164), plus `id`/`event_id` (`evt_lc_<lead_id>`), `created_at`.
Optional, only when present: `email`, `whatsapp`, `lead_source`, `source_detail`, `project`, `campaign_id/name`, `ad_id/name`, `form_id/name`, `requirements`, `priority`, `timeline`, `preferred_location`, `street_address`, `city`, `property_type`, `purpose`, `bhk`, `budget` (display string), `remark`, `remark_1`, `remark_2`, `assigned_to`, `follow_up_date`, `consent_basis`, `opt_out`, `custom_fields`.

**Call decision (always present):** `auto_call` (bool). When true: `agent_id` and `route_label`. When false: `auto_call_reason` (`source_disabled`, `no_route`, `ambiguous_route`, `agent_missing`, `not_auto_source`, `test_event`) and **no** `agent_id`. Vistrow must import/tag the Contact either way and may queue a call **only** if `auto_call === true`, only for `agent_id`, with no fallback agent.

`custom_fields`: `whatsapp_first_message` (first text the person sent, max 500 chars), `repeat_enquiry`, `enquiry_at`, `arthaleads_source`, `source_page`, `source_domain`, `form_plugin`, `page_id`, `adset_*`, `adgroup_*`, `meta_lead_id`, `ad_headline/body/source_url`, `project_id`, `status`, `remark_3/4`, `remark_note`, `budget_min/max/currency`, `tags`, `form_responses`, `whatsapp_consent`. Text has control characters stripped.

## Routing (owner-configured; mirrors Website Widget page rules)
* Each source (Website, Facebook, WhatsApp, Google) has a switch, **off by default**.
* Rules: Website = page address contains X (optionally tagged with a project); Facebook = project; WhatsApp = project or ad; Google = campaign id or project. **Vistrow side:** its receiver currently recognises only website/facebook/whatsapp as ArthaLeads sources, so Google leads need a matching change there before they are dialled. Most specific wins; equal ties with different agents -> `ambiguous_route`; a rule with no agent -> `agent_missing`. No built-in default agent.
* **Routing rules (16 Oct 2026):** kinds per source: Website `url_contains`, `any`; Facebook `ad_id`, `form_id`, `campaign_id`, `project`, `any`; WhatsApp `ad_id`, `project`, `any`; Google `campaign_id`, `project`, `any`. `any` (matchValue `*`, at most one row per source, "Default agent for all ... leads" in the UI) is the source's default agent: it matches every lead of that source at the lowest specificity, so any specific rule beats it and it never ties. Precedence, highest first: ad id > campaign id > project > page (longer fragment wins) > any. Facebook ad/campaign ids come from the lead-form attribution Meta sends (`ad_id`, `campaign_id`, stored with their names on the lead's `created` activity); `GET /api/leads/campaign-options` lists `facebook.ad_id` / `facebook.campaign_id` as `{ value, label, count, lastSeenAt }` (label = the Meta ad/campaign name when the lead stored it) for the pickers. `POST .../simulate` takes `adId` / `campaignId` for Facebook too.
* **Facebook lead-form rules (16 Oct 2026):** Facebook also matches `form_id` (specificity between ad and campaign: ad > lead form > campaign > project > any), because Meta's lead-form webhook usually gives `form_id` but no `ad_id`/`campaign_id`. The form id comes from the attribution, else from the lead's `created` activity `meta.formId`; `GET /api/leads/campaign-options` lists `facebook.form_id` the same way (label = the lead's source label, which carries the form name); `POST .../simulate` takes `formId`; the UI offers "A lead form" first.
* **Website page rules can carry project context:** the page URL is sent as `custom_fields.source_page`; a rule's optional project becomes `project` / `custom_fields.project_id` when the lead has no project of its own.
* Re-checked at send time; a change since creation can only downgrade to no-call.

## Agent list (picker)
`GET {web address}/leads/inbound/{account_id}/agents`, same key in `X-Vistrow-Webhook-Token` or `Authorization: Bearer` (never the URL). Expected: `{agents:[{id,name,knowledge_base}]}`, active agents with a knowledge base only. ArthaLeads shows "name - knowledge base" in a searchable dropdown; the `id` stays on the server (the browser only holds an opaque ref, mapped back to the id when a choice is saved) and is stored/sent as `agent_id`. 401/403, 404, 5xx/timeouts, an empty list and an unreadable reply each get a plain-language message in the setup screen. The list is fetched after the connection is saved and on refresh.

## Project picker data for Vistrow
Vistrow's Integrations screen offers a searchable project picker instead of free text. Server to server, read-only, projects only (no campaign/ad list until a separate contract is agreed):

    GET {ArthaLeads API}/webhook/lead/projects
    X-ArthaLeads-Connection-Token: <the organisation's Vistrow Voice connection token>

    200 { "ok": true, "projects": [ { "id": "<project id>", "name": "SP Khopoli" } ] }
    401 { "ok": false, "reason": "missing_token" | "invalid_token" }
    403 { "ok": false, "reason": "plan" }
    400 { "ok": false, "reason": "token_in_url" }
    429 { "ok": false, "reason": "rate_limited" }

The token is the existing "Vistrow Voice" connection token (the one used for `POST /webhook/lead`); it identifies the organisation, so no org id is passed. Header only: a token in the URL is refused, and Website/Custom/Facebook/Google tokens and inactive connections get `401`. Enterprise plan only, 30 requests/min, `no-store`. Returns active projects only (`isArchived != true`, the CRM's own source), A-Z, at most 200, with only `id` and `name`. Nothing is written and no auto-call switch or integration setting is read or changed.

Show `name` in the picker; keep `id` on the Vistrow server. A lead's project reaches Vistrow as `project` (name) and `custom_fields.project_id` (this id) in `lead.created`.

## Linking from Vistrow (single token, 16 Oct 2026)
The customer pastes the organisation's "Vistrow Voice" connection token (Automation `verifyToken`, the one used for `POST /webhook/lead`) once, in Vistrow Voice → Integrations → ArthaLeads. Vistrow then calls ArthaLeads and step 1 of the Auto-call tab (web address, account number, key) fills itself; the same token is what ArthaLeads sends back in `X-Vistrow-Webhook-Token`. Routes: `backend/routes/vistrowLinkRoutes.js`, mounted at `/webhook/vistrow`, 60 requests per token per 15 min.

    POST {ArthaLeads API}/webhook/vistrow/link
    { "token": "AW-…", "account_id": "2", "base_url": "https://api.vistrowvoice.com", "account_name": "Vistrow Technologies" }

    200 { "success": true, "org_id": "…", "org_name": "Prophunt LLP", "account_id": "2", "enabled": false, "switched_off": false, "linked_at": "2026-10-16T…Z" }
    401 { "success": false, "code": "key_rejected" }   unknown or inactive token
    403 { "success": false, "code": "plan" }           organisation below Enterprise
    400 { "success": false, "code": "base_url" }       host not on VISTROW_OUTBOUND_ALLOWED_HOSTS (https, no path)
    400 { "success": false, "code": "account_id" }     not [A-Za-z0-9_-]{1,64}

Upserts `OutboundIntegration` (`baseUrl` = origin, `accountId`, `authMode` header, the token as the encrypted secret, `linkedAt`, `linkedBy: "vistrow"`, `linkedAccountName`, max 120 chars). Linking never enables: `POST /api/integrations/vistrow-outbound/enable` by a logged-in owner stays the only switch. If the integration was enabled and the address, account or token changed, it is switched off, pending deliveries are cancelled (`relinked`) and the reply carries `switched_off: true`; the same values again are a no-op.

    POST {ArthaLeads API}/webhook/vistrow/unlink
    { "token": "AW-…" }

    200 { "success": true, "unlinked": true }   (same auth; also 200 when there was nothing to unlink)

Unlink disables, cancels pending deliveries (`unlinked`) and clears the address, account, secret and link fields. `GET /api/integrations/vistrow-outbound` `config` now carries `linkedAt`, `linkedBy` (`""` | `vistrow` | `manual`) and `linkedAccountName`; the manual `PUT /config` sets `linkedBy: "manual"`. Test: `tests/vistrowLink.db.test.js`.

## "Call now via Vistrow" (lead page, 15 Oct 2026)
An admin or manager (Enterprise, integration on) can press **Call now via Vistrow** on a lead. ArthaLeads sends the same `lead.created` body again as its own event: `id`/`event_id`/`enquiry_id` = `evt_call_<lead_id>_<ms>`, `lead_id` = the existing lead, `auto_call: true` + `agent_id` for the agent the lead's source routes to (refused with no event when nothing routes), `custom_fields.call_request: true`, `custom_fields.requested_by` (the person's name), `custom_fields.requested_at`, `Idempotency-Key: <org_id>:<lead_id>:<enquiry_id>`. Once per lead per minute. **Vistrow side:** a `call_request` must be dialled now even if this number was called in the last 24 h (the repeat-enquiry rule does not apply), and keyed on `enquiry_id` like a repeat. The request is audited on the lead ("<name> asked Vistrow Voice to call this lead now"), and Vistrow's answer is written there too (next section). Endpoint: `POST /api/integrations/vistrow-outbound/leads/:id/call`; `GET .../leads/:id/status` gives the lead page the newest delivery and whether the button applies.

## Response handling
2xx `{ok:true}` (also `deduped`) = delivered. `queued:false` => delivered but warning "call not queued".

**What Vistrow says about the call (15 Oct 2026), shown in the delivery log and as a lead activity:**
* `queued: true, queued_until: "<ISO>"` = the call is scheduled for later (calling window closed). Stored as `callQueuedUntil`; the log shows "Call scheduled for 16 Oct, 9:00 am" and the lead gets the activity "Vistrow Voice call scheduled for 16 Oct, 9:00 am" (IST). Without `queued_until`: "Vistrow Voice is calling this lead now".
* `queued: false, reason: <code>` = no call. Known codes get plain text (`auto_call_off`, `agent_not_live`, `agent_has_no_caller_number`, `auto_call_campaign_paused`, `no_matching_enabled_route`, `lead_opted_out`); any other code is shown as "Vistrow did not queue the call (<code>)". The lead gets "Vistrow Voice did not call: <text>". Only for events that asked for a call (`auto_call: true`). `queued:true` on a WhatsApp lead pauses that chat's WhatsApp assistant until the call result arrives on `/webhook/lead` (then a team-only note with booking/status/follow-up/site visit is added and the assistant resumes, unless a person changed it), or for at most 15 minutes. 2xx `{ok:false,reason}` and 4xx (except 408/429) = permanent, shown to the admin, never marked delivered. Transport errors, 408, 429 (Retry-After honoured), 5xx = retry.

## Call results back into ArthaLeads (`POST /webhook/lead` with `call_id`)
Besides the fields already used (`call_id`, `arthaleads_lead_id`, `direction`, `transcript`, `duration_seconds`, `recording_url`, `crm_outcome.{booking,status,follow_up_at,site_visit_at,note}`), from 15 Oct 2026:
* **Retries exhausted:** `crm_outcome: { booking: "Not Reachable", attempts: N }`. The report may carry no `transcript`, no `recording_url` and `duration_seconds: 0` (an undelivered dial); it is still keyed on `call_id`, so a re-send updates the same call (and its `attempts`) instead of adding one. The lead gets the activity "Vistrow Voice could not reach this lead after N tries", the note heading says the same, and "Not Reachable" is applied only where nothing stronger is recorded (never over Booked / Site Visit Done / a result a person entered). `attempts` is also stored on the call (`voiceCalls[].attempts`) and shown as "Tries" on the lead page.
* **Scheduled follow-up calls:** `follow_up_kind` at the top level or in `custom_fields`, one of `callback` (the call-back the caller asked for), `visit_reminder` (site-visit reminder), `nurture`. The call activity and note are labelled "Scheduled call-back by Vistrow Voice", "Site-visit reminder call", "Follow-up call". A `visit_reminder` result's `crm_outcome.booking` ("Site Visit Done", "Site Visit Booked", "Not Interested") is applied with the same forward-only rules (a done visit is never undone). `crm_outcome.booking` is kept on the call as `voiceCalls[].result` even when the rules did not change the lead.

## Open points for Vistrow to confirm
`auto_call` / `agent_id` / `auto_call_reason` / `route_label` key names; `budget` as a display string; `queued:false` response shape; an agent-list endpoint (so the UI can offer agents without a pasted code). **Compliance:** ArthaLeads holds no call-consent or DND data (only WhatsApp marketing opt-in, sent as `consent_basis` / `opt_out`); DND/TRAI checks must be done on the Vistrow side.

## Tests
`cd backend && npm run test:vistrow` (in-memory MongoDB for the .db tests; tests/vistrowOwnerDecisions.db.test.js covers the 15 Oct 2026 decisions; tests/vistrowFollowUpCalls.db.test.js covers retries, follow-up kinds, queued_until / reasons and call now); browser check in `frontend/e2e/vistrow-outbound`.
