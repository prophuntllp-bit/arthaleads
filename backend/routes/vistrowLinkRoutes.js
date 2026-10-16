// Single-token handshake from Vistrow Voice (contract 2026-10-16).
//
// The customer pastes the organisation's "Vistrow Voice" connection token
// (Automation.verifyToken, the same one Vistrow sends to POST /webhook/lead)
// once, in Vistrow Voice. Vistrow then calls here and fills step 1 of the
// Auto-call tab (web address + account number + key) by itself:
//
//   POST /webhook/vistrow/link    { token, account_id, base_url, account_name? }
//   POST /webhook/vistrow/unlink  { token }
//
// Linking never switches calling on: POST /api/integrations/vistrow-outbound/enable
// by a logged-in owner stays the only way. Re-pointing an enabled integration
// switches it off and cancels pending deliveries, like a manual settings change.

const express = require("express");
const rateLimit = require("express-rate-limit");
const Automation = require("../models/Automation");
const Organization = require("../models/Organization");
const OutboundIntegration = require("../models/OutboundIntegration");
const { levelOf } = require("../middlewares/planGate");
const T = require("../services/vistrowOutbound/transport");
const { mongoStore } = require("../services/vistrowOutbound/store.mongo");
const logger = require("../config/logger");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.body?.token || req.ip,
  message: { success: false, code: "rate_limited", message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Resolves the token to { automation, org } or sends the 401 / 403 and returns null.
async function authenticate(req, res, label) {
  const token = String(req.body?.token || "").trim();
  const automation = token
    ? await Automation.findOne({ platform: "Vistrow Voice", verifyToken: token, isActive: true }).select("orgId").lean()
    : null;
  if (!automation) {
    logger.warn(`[${label}] rejected: unknown or inactive token (${token.length} chars)`);
    res.status(401).json({ success: false, code: "key_rejected", message: "Invalid token" });
    return null;
  }
  const org = await Organization.findById(automation.orgId).select("name plan").lean();
  if (!org || levelOf(org.plan) < levelOf("enterprise")) {
    res.status(403).json({ success: false, code: "plan", message: "This integration is part of the Enterprise plan." });
    return null;
  }
  return { automation, org, token };
}

router.post("/link", express.json(), limiter, async (req, res) => {
  try {
    const auth = await authenticate(req, res, "vistrow link");
    if (!auth) return;
    const { org, token } = auth;

    const base = T.validateBaseUrl(req.body?.base_url);
    if (!base.ok) return res.status(400).json({ success: false, code: "base_url", message: base.reason });
    const accountId = String(req.body?.account_id ?? "").trim();
    if (!T.validateAccountId(accountId)) return res.status(400).json({ success: false, code: "account_id", message: "That is not a valid Vistrow account number." });
    const accountName = String(req.body?.account_name || "").replace(/\s+/g, " ").trim().slice(0, 120);

    let doc = await OutboundIntegration.findOne({ orgId: org._id, provider: "vistrow" }).select("+secretEnc");
    if (!doc) doc = new OutboundIntegration({ orgId: org._id, provider: "vistrow" });

    let current = "";
    try { current = doc.getSecret(); } catch { current = ""; }
    const changed = doc.baseUrl !== base.origin || doc.accountId !== accountId || current !== token;
    const now = new Date();
    let switchedOff = false;
    if (changed) {
      doc.baseUrl = base.origin;
      doc.accountId = accountId;
      doc.authMode = "header";
      try { doc.setSecret(token); }
      catch { return res.status(500).json({ success: false, code: "server_error", message: "This server has no encryption key configured, so the credential cannot be stored safely." }); }
      if (doc.enabled) { doc.enabled = false; switchedOff = true; }
    }
    doc.linkedAt = now;
    doc.linkedBy = "vistrow";
    doc.linkedAccountName = accountName;
    await doc.save();
    if (switchedOff) {
      await mongoStore.cancelPending(org._id, now, "relinked");
      logger.warn(`[vistrow link] switched off by re-link org=${org._id}`);
    }
    logger.info(`[vistrow link] linked org=${org._id} account=${accountId} changed=${changed}`);
    res.json({
      success: true, org_id: String(org._id), org_name: org.name || "", account_id: accountId,
      enabled: !!doc.enabled, switched_off: switchedOff, linked_at: now.toISOString(),
    });
  } catch (err) {
    logger.error(`[vistrow link] failed: ${err?.name || "Error"}`);
    res.status(500).json({ success: false, code: "server_error", message: "Something went wrong. Please try again." });
  }
});

router.post("/unlink", express.json(), limiter, async (req, res) => {
  try {
    const auth = await authenticate(req, res, "vistrow unlink");
    if (!auth) return;
    const { org } = auth;
    const doc = await OutboundIntegration.findOne({ orgId: org._id, provider: "vistrow" }).select("+secretEnc");
    if (doc) {
      const now = new Date();
      doc.enabled = false;
      doc.baseUrl = "";
      doc.accountId = "";
      doc.secretEnc = "";
      doc.linkedAt = null;
      doc.linkedBy = "";
      doc.linkedAccountName = "";
      await doc.save();
      await mongoStore.cancelPending(org._id, now, "unlinked");
      logger.warn(`[vistrow unlink] unlinked org=${org._id}`);
    }
    res.json({ success: true, unlinked: true });
  } catch (err) {
    logger.error(`[vistrow unlink] failed: ${err?.name || "Error"}`);
    res.status(500).json({ success: false, code: "server_error", message: "Something went wrong. Please try again." });
  }
});

module.exports = router;
