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
const { buildLeadCreatedPayload, buildTestPayload, eventIdForLead } = require("./payload");
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
const CALLABLE_ORIGINS = new Set(["webhook-website", "webhook-facebook", "webhook-custom", "whatsapp-ctwa", "whatsapp-inbound"]);

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
} = {}) {
  const inflight = new Set();
  const track = (p) => { inflight.add(p); p.finally(() => inflight.delete(p)); return p; };
  const drain = async () => { while (inflight.size) await Promise.allSettled([...inflight]); };

  // ── Enqueue ───────────────────────────────────────────────────────────────

  // Decisions that need no database read. Order matters: the loop guard is
  // first so a Vistrow-originated lead can never reach the queue by any route.
  function earlyIgnore(l, ctx) {
    if (ctx.isTest) return "test_lead";
    if (l.source === "Vistrow Voice" || (Array.isArray(l.voiceCalls) && l.voiceCalls.length) || ctx.vistrowOrigin) return "vistrow_origin";
    if (l.isDeleted) return "deleted";
    if (!l._id || !l.orgId) return "invalid_lead";
    return null;
  }

  async function enqueueWithConfig(l, ctx, cfg) {
    const t = now();
    const createdAt = l.createdAt ? new Date(l.createdAt) : t;

    // The "no replay" watermark: a lead created before the owner switched this
    // on is never sent, however late its creation path finishes.
    if (cfg.enabledAt && createdAt < new Date(cfg.enabledAt)) return { queued: false, reason: "pre_enable" };
    if (String(ctx.origin || "").startsWith("import") && !cfg.emitImports) return { queued: false, reason: "imports_off" };

    const eventId = eventIdForLead(l._id);
    const base = {
      orgId: l.orgId, integrationId: cfg.id, eventId, eventType: "lead.created",
      leadId: l._id, leadCreatedAt: createdAt, origin: ctx.origin || "unknown",
      isTest: false, attempts: 0, maxAttempts: T.MAX_ATTEMPTS,
    };
    const skip = async (reason) => {
      const r = await store.insertDelivery({ ...base, status: "skipped", skipReason: reason, terminalAt: t });
      return { queued: false, reason, deliveryId: r.delivery?._id, duplicateEvent: !r.inserted };
    };

    // Age is judged from when the person actually enquired (a polled Google
    // lead can sit upstream for days), not from when we happened to create it.
    // An old enquiry is not a new lead: it is neither imported nor called.
    const enquiredAt = ctx.submittedAt ? new Date(ctx.submittedAt) : createdAt;
    const maxAgeMs = (cfg.maxLeadAgeMinutes || DEFAULT_MAX_LEAD_AGE_MIN) * 60 * 1000;
    if (t - enquiredAt > maxAgeMs) return skip("stale_lead");

    const phone = toE164(l.phone, cfg.defaultCountryCode);
    if (!phone) return skip("invalid_phone");

    // May Vistrow CALL this lead? Decided once, now, from the lead as it is at
    // creation. Not routed => still sent (a tagged Contact), with auto_call:false.
    const inputs = routingInputsFrom(l, CALLABLE_ORIGINS.has(ctx.origin) ? ctx : { ...ctx, routeSource: "" });
    let routing = resolveRouting(cfg, inputs);

    // One person submitting twice must not be phoned twice: the repeat is still
    // sent, but as a Contact only.
    if (routing.autoCall && cfg.dedupeWindowHours > 0) {
      const since = new Date(t.getTime() - cfg.dedupeWindowHours * 3600 * 1000);
      const prior = await store.findRecentDeliveryForPhone({ orgId: l.orgId, phoneKey: phone, since, excludeEventId: eventId, autoCallOnly: true });
      if (prior) routing = { autoCall: false, reason: "recent_duplicate_phone", sourceKey: routing.sourceKey };
    }

    const built = buildLeadCreatedPayload(l, ctx, { orgId: l.orgId, defaultCountryCode: cfg.defaultCountryCode, now: t, routing });
    if (built.error) return skip(built.error);

    const r = await store.insertDelivery({
      ...base, status: "pending", payload: built.payload, phoneKey: phone, nextAttemptAt: t,
      autoCall: routing.autoCall, autoCallReason: routing.reason || "", routeSource: inputs.routeSource,
      routeLabel: routing.route?.label || "", agentId: routing.agentId || "", agentLabel: routing.agentLabel || "",
      routingInputs: inputs,
    });
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
      });
      await store.recordIntegrationOutcome(job.orgId, { lastSuccessAt: t1, clearError: true, ...(job.autoCall && !callNotQueued ? { clearWarning: true } : {}) });
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

module.exports = { createService, IMPORT_EMIT_CAP, CALLABLE_ORIGINS };
