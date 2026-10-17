// Outbound "lead.created" delivery to Vistrow Voice.
//
// What this is: when the owner has switched the integration on, every NEW CRM
// lead is queued as a delivery job and POSTed to Vistrow as a Contact. Whether
// Vistrow may also CALL it is a separate, explicit decision (routing.js): only
// if the lead's source is switched on and a route row names an agent. What it
// is not: a sync. Updates never emit, Vistrow-originated leads never emit (that
// would loop), and nothing is ever replayed -- a job exists only because a lead
// was created while the integration was on.
//
// Everything with side effects (database, HTTP, clock, alerts) is injected, so
// the state machine below is exercised directly in tests with no network and
// no database. Production wiring is in index.js.
//
// Store contract (see store.mongo.js; tests use an in-memory twin):
//   getIntegration(orgId)                 -> cfg|null  (cfg.secret already decrypted)
//   insertDelivery(doc)                   -> { inserted, delivery }  unique per (orgId,eventId)
//   findRecentDeliveryForPhone({...})     -> delivery|null  (autoCallOnly: only deliveries that asked for a call)
//   claimById(id, {now, leaseMs})         -> job|null   atomically pending->sending, attempts++
//   claimDue({now, leaseMs, limit})       -> job[]      same, for due or lease-expired jobs
//   update(id, patch)                     -> void       patch.appendAttempt is pushed to attemptLog
//   recordIntegrationOutcome(orgId, patch)-> void
//   throttleAlert(orgId, now, gapMs)      -> boolean    true when this caller should alert
//   cancelPending(orgId, now, reason)     -> number

const crypto = require("crypto");
const { buildLeadCreatedPayload, buildTestPayload, eventIdForLead, eventIdForEnquiry, eventIdForCallRequest } = require("./payload");
const { notQueuedText } = require("./callReasons");
const T = require("./transport");
const { toE164 } = require("./phone");
const { resolveRouting, routingInputsFrom } = require("./routing");

const IMPORT_EMIT_CAP = 25;       // a bigger import is a list upload, not a lead arriving
const LEASE_MS = 45 * 1000;
const ALERT_GAP_MS = 60 * 60 * 1000;
const DEFAULT_MAX_LEAD_AGE_MIN = 15;
const WORKER_CONCURRENCY = 5;

// Only leads that arrived on their own through these channels can ever be
// phoned. A lead typed in by an agent, imported from a spreadsheet, or captured
// from a QR/Google form is never called, whatever source label it carries: the
// source on a lead is editable text, the creation path is not.
// Each such path may only route as the source it really is, so a Google lead
// can never be matched against Website rules, and so on.
const ORIGIN_ROUTE_SOURCES = {
  "webhook-website": ["website"],
  "webhook-facebook": ["facebook"],
  "webhook-custom": ["whatsapp"], // a WhatsApp-provider token on the custom webhook
  "whatsapp-ctwa": ["whatsapp"],
  "whatsapp-inbound": ["whatsapp"],
  "webhook-google": ["google"],
  "poller-google": ["google"],
  // "Call now via Vistrow" pressed by a person on the lead page: routed as the
  // source the lead really came from (routes/vistrowLeadRoutes.js decides it).
  "manual-call": ["website", "facebook", "whatsapp", "google"],
  // The one automatic call for a WhatsApp chat the assistant was handling
  // (owner decision 17 Oct 2026, routes/whatsappRoutes.js requestWhatsAppCall):
  // the customer asked for a call or was handed to the team, or went quiet.
  "whatsapp-handoff": ["whatsapp"],
  "whatsapp-quiet": ["whatsapp"],
};
const CALLABLE_ORIGINS = new Set(Object.keys(ORIGIN_ROUTE_SOURCES));
// Origins that ask for a call about a lead Vistrow already has, now. Only
// "manual-call" is a person pressing a button; the others are automatic and
// still keep the same-number dedupe window.
const CALL_REQUEST_ORIGINS = new Set(["manual-call", "whatsapp-handoff", "whatsapp-quiet"]);

const plain = (lead) => (lead && typeof lead.toObject === "function" ? lead.toObject() : (lead || {}));
// Error text from drivers can quote document values; keep only the class + code.
const safeErr = (err) => `${err?.name || "Error"}${err?.code ? `:${err.code}` : ""}`;

function createService({
  store,
  send = T.httpSend,
  now = () => new Date(),
  logger = { info() {}, warn() {}, error() {} },
  notifyFailure = async () => {},
  autoKick = true,
  rand = Math.random,
  killSwitch = () => process.env.VISTROW_OUTBOUND_DISABLED === "1",
  testSendAllowed = () => process.env.VISTROW_OUTBOUND_ALLOW_TEST_SEND === "1",
  // Called (not awaited by the delivery) when Vistrow confirms it queued a call.
  onCallQueued = async () => {},
  // Called (not awaited) whenever Vistrow answers a call we asked for:
  // { queued, reason, reasonText, queuedUntil }. Shown on the lead itself.
  onCallResult = async () => {},
  // The first retry also runs in this process at its due time, not only on
  // the worker's next tick. The job lease still allows exactly one send.
  schedule = (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); },
} = {}) {
  const inflight = new Set();
  const track = (p) => { inflight.add(p); p.finally(() => inflight.delete(p)); return p; };
  const drain = async () => { while (inflight.size) await Promise.allSettled([...inflight]); };

  // ── Enqueue ───────────────────────────────────────────────────────────────

  // Decisions that need no database read. Order matters: the loop guard is
  // first so a Vistrow-originated lead can never reach the queue by any route.
  // A repeat enquiry is the person reaching out again on their own, so a lead
  // Vistrow once called (or created) may be called again; only an event that
  // itself came from Vistrow is dropped.
  function earlyIgnore(l, ctx) {
    if (ctx.isTest) return "test_lead";
    if (ctx.vistrowOrigin) return "vistrow_origin";
    if (ctx.repeat !== true && ctx.callRequest !== true && (l.source === "Vistrow Voice" || (Array.isArray(l.voiceCalls) && l.voiceCalls.length))) return "vistrow_origin";
    if (l.isDeleted) return "deleted";
    if (!l._id || !l.orgId) return "invalid_lead";
    return null;
  }

  async function enqueueWithConfig(l, ctx, cfg) {
    const t = now();
    const createdAt = l.createdAt ? new Date(l.createdAt) : t;
    // Age is judged from when the person actually enquired (a polled Google
    // lead can sit upstream for days), not from when we happened to create it.
    const enquiredAt = ctx.submittedAt ? new Date(ctx.submittedAt) : createdAt;
    const repeat = ctx.repeat === true && !!ctx.submittedAt;
    // A person asked for this call now: the lead's age and the watermark do not
    // apply (it is a request, not a replay), and it is only sent as a call.
    const callRequest = ctx.callRequest === true && CALL_REQUEST_ORIGINS.has(ctx.origin);
    const automaticCallRequest = callRequest && ctx.origin !== "manual-call";

    // The "no replay" watermark: a lead created before the owner switched this
    // on is never sent, however late its creation path finishes. A repeat
    // enquiry is judged by when it happened, not by the lead's age.
    if (!callRequest && cfg.enabledAt && (repeat ? enquiredAt : createdAt) < new Date(cfg.enabledAt)) return { queued: false, reason: "pre_enable" };
    if (String(ctx.origin || "").startsWith("import") && !cfg.emitImports) return { queued: false, reason: "imports_off" };

    const eventId = callRequest ? eventIdForCallRequest(l._id, t) : repeat ? eventIdForEnquiry(l._id, enquiredAt) : eventIdForLead(l._id);
    const base = {
      orgId: l.orgId, integrationId: cfg.id, eventId, eventType: "lead.created",
      // For a repeat enquiry the delivery clock starts at the enquiry.
      leadId: l._id, leadCreatedAt: callRequest ? t : repeat ? enquiredAt : createdAt, origin: ctx.origin || "unknown",
      isTest: false, attempts: 0, maxAttempts: T.MAX_ATTEMPTS,
    };
    const skip = async (reason) => {
      const r = await store.insertDelivery({ ...base, status: "skipped", skipReason: reason, terminalAt: t });
      return { queued: false, reason, deliveryId: r.delivery?._id, duplicateEvent: !r.inserted };
    };

    // An old enquiry is not a new lead: it is neither imported nor called.
    const maxAgeMs = (cfg.maxLeadAgeMinutes || DEFAULT_MAX_LEAD_AGE_MIN) * 60 * 1000;
    if (!callRequest && t - enquiredAt > maxAgeMs) return skip("stale_lead");

    const phone = toE164(l.phone, cfg.defaultCountryCode);
    if (!phone) return skip("invalid_phone");

    // May Vistrow CALL this lead? Decided once, now, from the lead as it is at
    // creation. Not routed => still sent (a tagged Contact), with auto_call:false.
    const mayRoute = (ORIGIN_ROUTE_SOURCES[ctx.origin] || []).includes(ctx.routeSource);
    const inputs = routingInputsFrom(l, mayRoute ? ctx : { ...ctx, routeSource: "" });
    let routing = resolveRouting(cfg, inputs);
    // A call request with no agent to route to is refused outright, never
    // downgraded to a Contact (the person wanted a call, not an import).
    if (callRequest && !routing.autoCall) return { queued: false, reason: routing.reason || "no_route" };
    // An automatic call request is still one person not phoned twice.
    if (automaticCallRequest && cfg.dedupeWindowHours > 0) {
      const since = new Date(t.getTime() - cfg.dedupeWindowHours * 3600 * 1000);
      const prior = await store.findRecentDeliveryForPhone({ orgId: l.orgId, phoneKey: phone, since, excludeEventId: eventId, autoCallOnly: true });
      if (prior) return { queued: false, reason: "recent_duplicate_phone" };
    }

    // One person submitting twice must not be phoned twice: the repeat is still
    // sent, but as a Contact only. A person pressing "call now" is exempt.
    if (!callRequest && routing.autoCall && cfg.dedupeWindowHours > 0) {
      const since = new Date(t.getTime() - cfg.dedupeWindowHours * 3600 * 1000);
      const prior = await store.findRecentDeliveryForPhone({ orgId: l.orgId, phoneKey: phone, since, excludeEventId: eventId, autoCallOnly: true });
      if (prior) routing = { autoCall: false, reason: "recent_duplicate_phone", sourceKey: routing.sourceKey };
    }
    // The caller holds the call back for now (a WhatsApp chat the assistant is
    // handling): the Contact goes, without a call. Only ever a downgrade.
    if (!callRequest && routing.autoCall && ctx.deferCall) {
      routing = { autoCall: false, reason: String(ctx.deferCall), sourceKey: routing.sourceKey };
    }

    const built = buildLeadCreatedPayload(l, { ...ctx, eventId }, { orgId: l.orgId, defaultCountryCode: cfg.defaultCountryCode, now: t, routing });
    if (built.error) return skip(built.error);

    const job = {
      ...base, status: "pending", payload: built.payload, phoneKey: phone, nextAttemptAt: t,
      autoCall: routing.autoCall, autoCallReason: routing.reason || "", routeSource: inputs.routeSource,
      routeLabel: routing.route?.label || "", agentId: routing.agentId || "", agentLabel: routing.agentLabel || "",
      routingInputs: inputs,
    };
    let r = await store.insertDelivery(job);
    // A lead whose phone was recovered after it was first queued without one:
    // its never-sent "invalid_phone" row becomes this job (same event id).
    if (!r.inserted && ctx.recovered === true) r = await store.reviveSkipped({ orgId: l.orgId, eventId, skipReason: "invalid_phone", doc: job });
    if (!r.inserted) return { queued: false, reason: "already_queued", deliveryId: r.delivery?._id };

    logger.info(`[vistrow-outbound] queued event=${eventId} org=${l.orgId} origin=${base.origin} call=${routing.autoCall}${routing.autoCall ? "" : ` why=${routing.reason}`}`);
    if (autoKick) track(processById(r.delivery._id).catch((e) => logger.error(`[vistrow-outbound] first attempt crashed: ${safeErr(e)}`)));
    return { queued: true, deliveryId: r.delivery._id, eventId, autoCall: routing.autoCall, reason: routing.reason || "" };
  }

  // Never throws and never makes the caller wait on the network: a CRM lead
  // that was created successfully must not fail (or slow down) because the
  // integration is down, misconfigured, or switched off.
  async function enqueueLeadCreated(lead, ctx = {}) {
    try {
      if (killSwitch()) return { queued: false, reason: "kill_switch" };
      const l = plain(lead);
      const early = earlyIgnore(l, ctx);
      if (early) return { queued: false, reason: early };
      const cfg = await store.getIntegration(l.orgId);
      if (!cfg || !cfg.enabled) return { queued: false, reason: "disabled" };
      return await enqueueWithConfig(l, ctx, cfg);
    } catch (err) {
      logger.error(`[vistrow-outbound] enqueue failed: ${safeErr(err)}`);
      return { queued: false, reason: "error" };
    }
  }

  // Bulk import: a spreadsheet of leads is not leads arriving, so it is opt-in
  // (emitImports) and capped. Over the cap nothing at all is sent.
  async function enqueueLeadsCreated(leads, ctx = {}) {
    try {
      if (killSwitch() || !Array.isArray(leads) || !leads.length) return { queued: 0, reason: "none" };
      const first = plain(leads[0]);
      const cfg = first.orgId ? await store.getIntegration(first.orgId) : null;
      if (!cfg || !cfg.enabled) return { queued: 0, reason: "disabled" };
      if (!cfg.emitImports) return { queued: 0, reason: "imports_off" };
      if (leads.length > IMPORT_EMIT_CAP) {
        logger.info(`[vistrow-outbound] import of ${leads.length} leads exceeds cap ${IMPORT_EMIT_CAP}; nothing sent`);
        return { queued: 0, reason: "import_too_large" };
      }
      let queued = 0;
      for (const lead of leads) {
        const l = plain(lead);
        if (earlyIgnore(l, ctx)) continue;
        const r = await enqueueWithConfig(l, ctx, cfg);
        if (r.queued) queued++;
      }
      return { queued };
    } catch (err) {
      logger.error(`[vistrow-outbound] batch enqueue failed: ${safeErr(err)}`);
      return { queued: 0, reason: "error" };
    }
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  async function finish(job, cfg, patch, { failed } = {}) {
    await store.update(job._id, patch);
    if (failed) {
      await store.recordIntegrationOutcome(job.orgId, {
        lastFailureAt: patch.terminalAt || now(),
        lastError: { code: patch.lastErrorCode, message: patch.lastErrorMessage, at: now(), deliveryId: job._id },
      });
      if (await store.throttleAlert(job.orgId, now(), ALERT_GAP_MS)) {
        notifyFailure(cfg, { code: patch.lastErrorCode, deliveryId: job._id }).catch(() => {});
      }
    }
  }

  async function attempt(job) {
    const t0 = now();
    const cfg = await store.getIntegration(job.orgId);

    // Fail closed: a switch-off (or kill switch) cancels what is still queued.
    if (!cfg || !cfg.enabled || killSwitch()) {
      await store.update(job._id, { status: "cancelled", skipReason: "integration_disabled", terminalAt: t0, lockedUntil: null });
      return;
    }
    const permanent = (code, message) => finish(job, cfg, {
      status: "failed", lastErrorCode: code, lastErrorMessage: message, terminalAt: t0, lockedUntil: null,
      appendAttempt: { at: t0, code, outcome: "permanent" },
    }, { failed: true });

    if (!cfg?.secret || /^enc1:/.test(cfg.secret)) return permanent("NO_SECRET", "No usable credential is stored for this integration");
    if (!T.validateBaseUrl(cfg.baseUrl).ok || !T.validateAccountId(cfg.accountId)) return permanent("BAD_ENDPOINT", "The configured endpoint is not valid");
    if (t0 - new Date(job.leadCreatedAt) > T.MAX_AGE_MS) {
      return finish(job, cfg, {
        status: "dead", lastErrorCode: "EXPIRED", lastErrorMessage: "Not delivered within the allowed window; no call was placed late",
        terminalAt: t0, lockedUntil: null, appendAttempt: { at: t0, code: "EXPIRED", outcome: "dead" },
      }, { failed: true });
    }

    // The owner may have switched the source off, or changed the route, in the
    // seconds since this lead was queued. A call that is no longer approved must
    // not go out: re-check against the CURRENT settings and, if the same agent is
    // not still approved, send the Contact alone. Only ever downgrades; a lead
    // queued without a call is never upgraded into one.
    let payload = job.payload;
    if (job.autoCall) {
      const fresh = resolveRouting(cfg, job.routingInputs || {});
      if (!(fresh.autoCall && fresh.agentId === job.agentId)) {
        payload = { ...job.payload, auto_call: false, auto_call_reason: "changed_before_send" };
        delete payload.agent_id;
        delete payload.route_label;
        await store.update(job._id, { autoCall: false, autoCallReason: "changed_before_send", agentId: "", agentLabel: "", routeLabel: "", payload });
        job = { ...job, autoCall: false, payload };
        logger.info(`[vistrow-outbound] call withdrawn before send event=${job.eventId} org=${job.orgId}`);
      }
    }

    const req = T.buildRequest({
      baseUrl: cfg.baseUrl, accountId: cfg.accountId, authMode: cfg.authMode, secret: cfg.secret,
      eventId: job.eventId, payload, nowSeconds: Math.floor(t0.getTime() / 1000),
    });
    const res = await send({ url: req.url, headers: req.headers, body: req.rawBody });
    const verdict = T.classifyResult(res, [cfg.secret]);
    const t1 = now();
    const common = {
      lastHttpStatus: res.httpStatus, lastLatencyMs: res.latencyMs, lastAttemptAt: t0,
      firstAttemptAt: job.firstAttemptAt || t0, lockedUntil: null,
      appendAttempt: { at: t0, httpStatus: res.httpStatus, code: verdict.code, latencyMs: res.latencyMs, outcome: verdict.outcome },
    };

    if (verdict.outcome === "delivered") {
      const callNotQueued = job.autoCall && verdict.queued === false;
      await finish(job, cfg, {
        ...common, status: "delivered", deliveredAt: t1, terminalAt: t1, deduped: !!verdict.deduped,
        endToEndMs: t1 - new Date(job.leadCreatedAt), lastErrorCode: "", lastErrorMessage: "",
        callQueued: typeof verdict.queued === "boolean" ? verdict.queued : null, callReason: verdict.reason || "",
        callQueuedUntil: verdict.queuedUntil || null,
      });
      await store.recordIntegrationOutcome(job.orgId, { lastSuccessAt: t1, clearError: true, ...(job.autoCall && !callNotQueued ? { clearWarning: true } : {}) });
      if (job.autoCall && verdict.queued === true) {
        track(Promise.resolve().then(() => onCallQueued(job, { queuedUntil: verdict.queuedUntil || null })).catch((e) => logger.error(`[vistrow-outbound] call-queued hook failed: ${safeErr(e)}`)));
      }
      if (job.autoCall && typeof verdict.queued === "boolean") {
        const result = { queued: verdict.queued, reason: verdict.reason || "", reasonText: verdict.queued ? "" : notQueuedText(verdict.reason), queuedUntil: verdict.queuedUntil || null };
        track(Promise.resolve().then(() => onCallResult(job, result)).catch((e) => logger.error(`[vistrow-outbound] call-result hook failed: ${safeErr(e)}`)));
      }
      logger.info(`[vistrow-outbound] delivered event=${job.eventId} org=${job.orgId} attempt=${job.attempts} http=${res.httpStatus} ms=${res.latencyMs} deduped=${!!verdict.deduped} call=${job.autoCall}${callNotQueued ? " NOT_QUEUED" : ""}`);
      // Accepted as a Contact, but Vistrow declined to call although we asked
      // (unknown agent, no caller number...). Not a failed delivery, and a retry
      // would not help, so it must be made visible rather than left silent.
      if (callNotQueued) {
        await store.recordIntegrationOutcome(job.orgId, {
          lastWarning: { code: "CALL_NOT_QUEUED", message: verdict.reason || "Vistrow did not queue the call", at: t1, deliveryId: job._id },
        });
        if (await store.throttleAlert(job.orgId, t1, ALERT_GAP_MS)) {
          notifyFailure(cfg, { code: "CALL_NOT_QUEUED", reason: verdict.reason, deliveryId: job._id }).catch(() => {});
        }
      }
      return;
    }

    const err = { lastErrorCode: verdict.code, lastErrorMessage: verdict.message };
    if (verdict.outcome === "permanent") {
      logger.warn(`[vistrow-outbound] failed event=${job.eventId} org=${job.orgId} code=${verdict.code} http=${res.httpStatus}`);
      return finish(job, cfg, { ...common, ...err, status: "failed", terminalAt: t1 }, { failed: true });
    }
    if (job.attempts >= (job.maxAttempts || T.MAX_ATTEMPTS)) {
      logger.warn(`[vistrow-outbound] gave up event=${job.eventId} org=${job.orgId} code=${verdict.code} attempts=${job.attempts}`);
      return finish(job, cfg, { ...common, ...err, status: "dead", terminalAt: t1 }, { failed: true });
    }
    const delay = Math.max(T.backoffMs(job.attempts, rand), verdict.retryAfterMs || 0);
    logger.warn(`[vistrow-outbound] retry event=${job.eventId} org=${job.orgId} code=${verdict.code} attempt=${job.attempts} in=${delay}ms`);
    await store.update(job._id, { ...common, ...err, status: "pending", nextAttemptAt: new Date(t1.getTime() + delay) });
    if (autoKick && job.attempts === 1) {
      schedule(() => track(processById(job._id).catch((e) => logger.error(`[vistrow-outbound] first retry crashed: ${safeErr(e)}`))), delay);
    }
  }

  async function processById(id) {
    const job = await store.claimById(id, { now: now(), leaseMs: LEASE_MS });
    if (job) await attempt(job);
  }

  // One worker tick: claim what is due (including jobs whose worker died
  // mid-send) and run them with bounded concurrency.
  async function processDue({ limit = 25 } = {}) {
    const jobs = await store.claimDue({ now: now(), leaseMs: LEASE_MS, limit });
    let i = 0;
    const lane = async () => {
      while (i < jobs.length) {
        const job = jobs[i++];
        try { await attempt(job); } catch (e) { logger.error(`[vistrow-outbound] attempt crashed: ${safeErr(e)}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKER_CONCURRENCY, jobs.length) }, lane));
    return { processed: jobs.length };
  }

  // ── Owner-facing test ─────────────────────────────────────────────────────

  function configProblems(cfg) {
    const p = [];
    const u = T.validateBaseUrl(cfg?.baseUrl);
    if (!u.ok) p.push(u.reason);
    if (!T.validateAccountId(cfg?.accountId)) p.push("Account ID is missing or contains unsupported characters.");
    if (!cfg?.secret) p.push("No credential is saved yet.");
    else if (/^enc1:/.test(cfg.secret)) p.push("The saved credential cannot be decrypted with this server's key. Re-enter it.");
    return p;
  }

  // dry_run builds and validates the exact request for a SYNTHETIC lead and
  // sends nothing. send transmits that synthetic event, marked test:true, and
  // is refused unless the server operator has explicitly allowed it.
  async function runTest(cfg, { mode = "dry_run" } = {}) {
    const problems = configProblems(cfg);
    const eventId = `evt_test_${crypto.randomBytes(8).toString("hex")}`;
    const payload = buildTestPayload({ orgId: cfg.orgId, eventId });
    if (problems.length) return { mode, ok: false, sent: false, problems };

    const req = T.buildRequest({ baseUrl: cfg.baseUrl, accountId: cfg.accountId, authMode: cfg.authMode, secret: cfg.secret, eventId, payload, isTest: true });
    const preview = { method: "POST", url: req.url, headers: T.redactHeaders(req.headers), body: payload };
    if (mode !== "send") return { mode: "dry_run", ok: true, sent: false, problems: [], request: preview };

    if (!testSendAllowed()) {
      return { mode: "send", ok: false, sent: false, problems: ["Sending test events is switched off on this server."], request: preview };
    }
    const t = now();
    const ins = await store.insertDelivery({
      orgId: cfg.orgId, integrationId: cfg.id, eventId, eventType: "lead.created", leadId: null, leadCreatedAt: t,
      origin: "test", isTest: true, status: "sending", payload, attempts: 1, maxAttempts: 1, lastAttemptAt: t,
    });
    const res = await send({ url: req.url, headers: req.headers, body: req.rawBody });
    const verdict = T.classifyResult(res, [cfg.secret]);
    const ok = verdict.outcome === "delivered";
    await store.update(ins.delivery._id, {
      status: ok ? "delivered" : "failed", lastHttpStatus: res.httpStatus, lastLatencyMs: res.latencyMs,
      lastErrorCode: ok ? "" : verdict.code, lastErrorMessage: ok ? "" : verdict.message,
      deliveredAt: ok ? now() : undefined, terminalAt: now(), deduped: !!verdict.deduped,
    });
    return { mode: "send", ok, sent: true, problems: [], httpStatus: res.httpStatus, latencyMs: res.latencyMs, code: verdict.code, message: verdict.message || "", deduped: !!verdict.deduped, request: preview };
  }

  return { enqueueLeadCreated, enqueueLeadsCreated, processDue, processById, runTest, configProblems, drain, IMPORT_EMIT_CAP };
}

module.exports = { createService, IMPORT_EMIT_CAP, CALLABLE_ORIGINS, CALL_REQUEST_ORIGINS };
