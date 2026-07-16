const automationService = require("../services/automationService");

function renderPopupScript(payload, targetOrigin) {
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <p>Completing Facebook connection...</p>
    <script>
      (function () {
        var payload = ${serialized};
        if (window.opener) {
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
          window.close();
        } else {
          document.body.innerHTML = '<p>You can close this window and return to the CRM.</p>';
        }
      })();
    </script>
  </body>
</html>`;
}

const crypto = require("crypto");
const Automation = require("../models/Automation");
const { AppError } = require("../middlewares/errorHandler");

function generateWebsiteToken() {
  // 192 bits of entropy - URL-safe hex, no need for slice
  return "AW-" + crypto.randomBytes(24).toString("hex");
}

const automationController = {
  // GET /api/automations/website/connections - list all website automations (read-only)
  async getWebsiteToken(req, res) {
    try {
      const automations = await Automation.find({
        orgId: req.user.orgId,
        platform: "Website Form",
        isActive: true,
      }).sort({ createdAt: 1 });

      res.json({
        success: true,
        connections: automations.map((a) => ({
          id: a._id,
          name: a.name,
          token: a.verifyToken,
          status: a.status,
          lastSyncAt: a.lastSyncAt,
          siteUrl: a.siteUrl || "",
          siteName: a.siteName || "",
          connectedForms: a.connectedForms || [],
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/website/create - add a new website connection
  async createWebsiteConnection(req, res) {
    try {
      const { name } = req.body || {};
      const automation = await Automation.create({
        name: name || "New WordPress Site",
        platform: "Website Form",
        mode: "form",
        status: "draft",
        leadSourceLabel: "Website",
        webhookPath: "/webhook/website",
        verifyToken: generateWebsiteToken(),
        description: "Receives leads from WordPress contact forms via the Arthaleads plugin.",
        isActive: true,
        orgId: req.user.orgId,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      res.status(201).json({
        success: true,
        connection: {
          id: automation._id,
          name: automation.name,
          token: automation.verifyToken,
          status: automation.status,
          lastSyncAt: automation.lastSyncAt,
          siteUrl: "",
          siteName: "",
          connectedForms: [],
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/automations/voice/connections - list Vistrow Voice connections (read-only)
  async getVoiceConnections(req, res) {
    try {
      const automations = await Automation.find({
        orgId: req.user.orgId,
        platform: "Vistrow Voice",
        isActive: true,
      }).sort({ createdAt: 1 });

      res.json({
        success: true,
        connections: automations.map((a) => ({
          id: a._id,
          name: a.name,
          token: a.verifyToken,
          status: a.status,
          lastSyncAt: a.lastSyncAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/voice/create - add a new Vistrow Voice connection
  async createVoiceConnection(req, res) {
    try {
      const { name } = req.body || {};
      const automation = await Automation.create({
        name: name || "Vistrow Voice",
        platform: "Vistrow Voice",
        mode: "webhook",
        status: "draft",
        leadSourceLabel: "Vistrow Voice",
        webhookPath: "/webhook/lead",
        verifyToken: generateWebsiteToken(),
        description: "Receives qualified leads from the Vistrow Voice AI calling platform.",
        isActive: true,
        orgId: req.user.orgId,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      res.status(201).json({
        success: true,
        connection: {
          id: automation._id,
          name: automation.name,
          token: automation.verifyToken,
          status: automation.status,
          lastSyncAt: automation.lastSyncAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/facebook/diagnose  { automationId? }
  // Live-checks why Facebook leads may not be arriving: token validity and
  // whether the Page is actually subscribed to the "leadgen" webhook field.
  async diagnoseFacebook(req, res) {
    try {
      const { automationId } = req.body || {};
      const q = { platform: "Facebook", orgId: req.user.orgId };
      if (automationId) q._id = automationId;

      const autos = await Automation.find(q);
      if (!autos.length) {
        return res.json({ success: true, results: [], message: "No Facebook connection found for this organisation." });
      }

      const appId = process.env.FB_APP_ID;
      const appSecret = process.env.FB_APP_SECRET;
      const V = "v23.0";
      const results = [];

      for (const a of autos) {
        const pageId = a.pageId || "";
        const token = a.accessToken || ""; // decrypted by the model getter
        const checks = [];

        checks.push({ key: "active", label: "Connection is active", ok: a.isActive !== false,
          detail: a.isActive !== false ? "Active" : "This connection is paused — toggle it active." });
        checks.push({ key: "page_id", label: "Page is selected", ok: !!pageId,
          detail: pageId ? `Page: ${a.pageName || pageId}` : "No Page saved — reconnect and pick your Facebook Page." });
        checks.push({ key: "app_creds", label: "Server has Meta app credentials", ok: !!(appId && appSecret),
          detail: (appId && appSecret) ? "Configured" : "FB_APP_ID / FB_APP_SECRET are missing on the server." });
        checks.push({ key: "token", label: "Access token stored", ok: !!token,
          detail: token ? "Present" : "No token stored — reconnect Facebook." });

        // Live token check
        let tokenValid = false;
        if (pageId && token) {
          try {
            const r = await fetch(`https://graph.facebook.com/${V}/${pageId}?fields=name&access_token=${encodeURIComponent(token)}`);
            const j = await r.json();
            tokenValid = !!(j.id || j.name);
            checks.push({ key: "token_valid", label: "Token works with Meta", ok: tokenValid,
              detail: tokenValid ? `Verified for "${j.name || pageId}"` : (j.error?.message || "Meta rejected the token — reconnect Facebook.") });
          } catch (e) {
            checks.push({ key: "token_valid", label: "Token works with Meta", ok: false, detail: e.message });
          }
        }

        // Live page-subscription check (the usual culprit for "campaign live, no leads")
        let subscribed = false;
        if (pageId && token) {
          try {
            const r = await fetch(`https://graph.facebook.com/${V}/${pageId}/subscribed_apps?access_token=${encodeURIComponent(token)}`);
            const j = await r.json();
            const apps = Array.isArray(j.data) ? j.data : [];
            const ours = apps.find((x) => String(x.id) === String(appId)) || (apps.length === 1 ? apps[0] : null);
            const fields = ours?.subscribed_fields || [];
            subscribed = fields.includes("leadgen");
            checks.push({ key: "subscribed", label: "Page is subscribed to leadgen webhook", ok: subscribed,
              detail: subscribed ? "Subscribed — leads should flow." :
                (j.error?.message || (apps.length ? `App is on the Page but 'leadgen' isn't subscribed (has: ${fields.join(", ") || "none"}).` : "This Page is NOT subscribed to the app. Click Re-subscribe below.")) });
          } catch (e) {
            checks.push({ key: "subscribed", label: "Page is subscribed to leadgen webhook", ok: false, detail: e.message });
          }
        }

        const allOk = checks.every((c) => c.ok);
        results.push({
          automationId: a._id,
          name: a.name,
          pageName: a.pageName || pageId,
          checks,
          allOk,
          // Offer the one-click fix when the token works but the subscription is missing.
          canResubscribe: tokenValid && !subscribed,
        });
      }

      res.json({ success: true, results });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/facebook/resubscribe  { automationId }
  // Re-subscribes a Page to the app's leadgen webhook using its stored token.
  async resubscribeFacebook(req, res) {
    try {
      const { automationId } = req.body || {};
      if (!automationId) return res.status(400).json({ success: false, message: "automationId is required" });

      const a = await Automation.findOne({ _id: automationId, platform: "Facebook", orgId: req.user.orgId });
      if (!a) return res.status(404).json({ success: false, message: "Connection not found" });
      if (!a.pageId || !a.accessToken) {
        return res.status(400).json({ success: false, message: "No Page/token to subscribe with. Reconnect Facebook first." });
      }

      await automationService.subscribePageWebhook(a.pageId, a.accessToken);
      a.status = "connected";
      await a.save();
      res.json({ success: true, message: "Page re-subscribed to the leadgen webhook. New leads should now arrive." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/automations/google/connections - list Google Ads connections (read-only)
  async getGoogleConnections(req, res) {
    try {
      const automations = await Automation.find({
        orgId: req.user.orgId,
        platform: "Google",
        isActive: true,
      }).sort({ createdAt: 1 });

      res.json({
        success: true,
        connections: automations.map((a) => ({
          id: a._id,
          name: a.name,
          token: a.verifyToken, // this is the "Webhook Key" in Google Ads' UI
          status: a.status,
          lastSyncAt: a.lastSyncAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/automations/google/create - add a new Google Ads Lead Form connection
  async createGoogleConnection(req, res) {
    try {
      const { name } = req.body || {};
      const automation = await Automation.create({
        name: name || "Google Ads",
        platform: "Google",
        mode: "webhook",
        status: "draft",
        leadSourceLabel: "Google",
        webhookPath: "/webhook/google",
        verifyToken: generateWebsiteToken(),
        description: "Receives leads from a Google Ads Lead Form extension via webhook.",
        isActive: true,
        orgId: req.user.orgId,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      res.status(201).json({
        success: true,
        connection: {
          id: automation._id,
          name: automation.name,
          token: automation.verifyToken,
          status: automation.status,
          lastSyncAt: automation.lastSyncAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async list(req, res, next) {
    try {
      const automations = await automationService.list(req.user.orgId);
      res.json({ success: true, automations });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const automation = await automationService.create(req.body, req.user);
      res.status(201).json({ success: true, automation });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const automation = await automationService.update(req.params.id, req.body, req.user);
      res.json({ success: true, automation });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await automationService.remove(req.params.id, req.user.orgId);
      res.json({ success: true, message: "Automation source removed successfully" });
    } catch (err) {
      next(err);
    }
  },

  async facebookConnect(req, res, next) {
    // Must set COOP before redirect - helmet's default COOP: same-origin
    // nullifies window.opener on the very first popup page load
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    try {
      // Cookie is sent automatically by browser for same-origin popup navigation;
      // fall back to query param for backward compatibility
      const rawToken = req.cookies?.crm_token || req.query.token || "";
      const user = await automationService.verifyPopupToken(rawToken);
      // Pass only userId - never embed the session token in the OAuth state (URL-visible)
      const state = automationService.createFacebookState({ userId: user._id.toString() });
      const authUrl = automationService.getFacebookAuthUrl(state);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  },

  async facebookCallback(req, res) {
    const frontendOrigin = automationService.getFrontendOrigin();
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");

    try {
      console.log(`[facebookCallback] query params: ${JSON.stringify(req.query)}`);
      const { code, state, error, error_description } = req.query;

      // Facebook returns ?error= when the user denies or the app lacks App Review approval
      if (error) {
        const fbMsg = error_description
          ? decodeURIComponent(error_description.replace(/\+/g, " "))
          : error;
        console.warn(`[facebookCallback] Facebook returned error: ${error} — ${fbMsg}`);
        throw new Error(`Facebook declined the connection: ${fbMsg}`);
      }

      if (!code || !state) throw new Error("Missing Facebook callback data");

      const statePayload = automationService.verifyFacebookState(state);
      const { pages, freshToken } = await automationService.getFacebookConnectionData(code);

      console.log(`[facebookCallback] pages fetched: ${pages.length} | userId: ${statePayload.userId}`);
      pages.forEach(p => console.log(`  page: ${p.name} (${p.id}) | forms: ${p.forms?.length ?? 0} | ${JSON.stringify(p.forms?.map(f => f.name))}`));
      if (pages.length === 0) console.warn("[facebookCallback] WARNING: No pages returned - user may not have approved pages_show_list or has no admin pages");

      const sessionId = require("crypto").randomBytes(16).toString("hex");
      await automationService.storeOAuthResult(sessionId, { type: "success", pages, freshToken });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    } catch (err) {
      const sessionId = require("crypto").randomBytes(16).toString("hex");
      await automationService.storeOAuthResult(sessionId, { type: "error", message: err.message || "Facebook connection failed" });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    }
  },

  async getFacebookResult(req, res) {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: "Missing session" });
    const result = await automationService.getOAuthResult(session);
    if (!result) return res.status(404).json({ error: "Session not found or expired" });
    return res.json(result);
  },

  async verifySystemToken(req, res, next) {
    try {
      const { token } = req.body;
      if (!token?.trim()) return next(new AppError("Token is required", 400));
      const result = await automationService.verifySystemToken(token.trim());
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = automationController;
