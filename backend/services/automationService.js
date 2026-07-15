const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Automation = require("../models/Automation");
const OAuthSession = require("../models/OAuthSession");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

// Mint a URL-safe token for token-authenticated ingestion sources
// (Custom partner/vendor webhooks). Mirrors the Website Form flow's
// generateWebsiteToken() in automationController.js.
function generateIngestToken() {
  return "AW-" + crypto.randomBytes(24).toString("hex");
}

// Platforms whose leads arrive via POST /webhook/lead, authenticated only by a
// per-source token (no OAuth / user JWT). Keep this in sync with the webhook
// lookup in routes/webhookRoutes.js.
const TOKEN_INGEST_PLATFORMS = ["Custom", "Vistrow Voice"];

const META_GRAPH_VERSION = "v23.0";

const DEFAULTS = {
  Facebook: {
    mode: "webhook",
    webhookPath: "/webhook",
    leadSourceLabel: "Facebook",
    description: "Receive Meta Lead Ads leads directly into the CRM through the Facebook webhook.",
  },
  Google: {
    mode: "api",
    webhookPath: "/api/leads",
    leadSourceLabel: "Google",
    description: "Use this endpoint from Google Ads landing pages or lead form bridges.",
  },
  WhatsApp: {
    mode: "api",
    webhookPath: "/api/leads",
    leadSourceLabel: "WhatsApp",
    description: "Push WhatsApp enquiries into the lead API with source set to WhatsApp.",
  },
  "Website Form": {
    mode: "form",
    webhookPath: "/api/leads",
    leadSourceLabel: "Website",
    description: "Connect website or landing page forms to the lead create API.",
  },
  Custom: {
    mode: "webhook",
    webhookPath: "/webhook/lead",
    leadSourceLabel: "Custom",
    description: "Receive leads from any partner, broker, or vendor by POSTing to the lead webhook with your token.",
  },
  "Vistrow Voice": {
    mode: "webhook",
    webhookPath: "/webhook/lead",
    leadSourceLabel: "Vistrow Voice",
    description: "Receive qualified leads from the Vistrow Voice AI calling platform via the lead webhook.",
  },
};

function applyDefaults(payload = {}) {
  const preset = DEFAULTS[payload.platform] || DEFAULTS.Custom;
  return {
    ...preset,
    ...payload,
    webhookPath: payload.webhookPath || preset.webhookPath,
    leadSourceLabel: payload.leadSourceLabel || preset.leadSourceLabel,
    description: payload.description || preset.description,
  };
}

const automationService = {
  async list(orgId) {
    return Automation.find({ orgId }).select("-accessToken -userToken").sort({ createdAt: -1 });
  },

  async create(payload, actor) {
    const normalized = applyDefaults(payload);

    // Token-ingest sources (Custom, Vistrow Voice) authenticate incoming webhook
    // calls by a per-source token (there is no OAuth / user JWT on the ingestion
    // path). Mint one on create if the caller didn't supply it, so the UI always
    // has a token to show.
    if (TOKEN_INGEST_PLATFORMS.includes(normalized.platform) && !normalized.verifyToken) {
      normalized.verifyToken = generateIngestToken();
    }

    const automation = await Automation.create({
      ...normalized,
      orgId: actor.orgId,
      createdBy: actor._id,
      updatedBy: actor._id,
    });

    // Subscribe the Page to send leadgen events to our webhook
    if (normalized.platform === "Facebook" && normalized.pageId && normalized.accessToken) {
      try {
        await automationService.subscribePageWebhook(normalized.pageId, normalized.accessToken);
      } catch (err) {
        console.warn("Page webhook subscription failed (non-fatal):", err.message);
      }
    }

    return automation;
  },

  async subscribePageWebhook(pageId, pageAccessToken) {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/subscribed_apps`;
    const params = new URLSearchParams({
      subscribed_fields: "leadgen",
      access_token: pageAccessToken,
    });
    const res = await fetch(`${url}?${params.toString()}`, { method: "POST" });
    const json = await res.json();
    console.log(`[subscribePageWebhook] page=${pageId} response:`, JSON.stringify(json));
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || "Failed to subscribe page webhook");
    }
    return json;
  },

  async update(id, payload, actor) {
    const automation = await Automation.findOne({ _id: id, orgId: actor.orgId });
    if (!automation) throw new AppError("Automation source not found", 404);

    // Snapshot the stored ingest token before the field copy below — the edit
    // form submits verifyToken:"" for sources that don't manage it in the UI,
    // which would otherwise clobber a live Custom-source token on every save.
    const existingToken = automation.verifyToken;

    const normalized = applyDefaults({ ...automation.toObject(), ...payload });
    [
      "name",
      "platform",
      "mode",
      "status",
      "description",
      "leadSourceLabel",
      "externalSourceId",
      "pageId",
      "formId",
      "externalSourceUrl",
      "webhookPath",
      "verifyToken",
      "accessToken",
      "userToken",
      "mappingNotes",
      "lastSyncAt",
      "isActive",
    ].forEach((key) => {
      if (normalized[key] !== undefined) automation[key] = normalized[key];
    });

    // Token-ingest sources (Custom, Vistrow Voice): never lose the ingest token
    // to an empty form field, and upgrade legacy records (created before
    // /webhook/lead existed — they were saved with webhookPath "/api/leads" and
    // no token). Minting only happens when there is genuinely no token, so
    // re-saving never rotates a live one.
    if (TOKEN_INGEST_PLATFORMS.includes(automation.platform)) {
      automation.verifyToken = automation.verifyToken || existingToken || generateIngestToken();
      automation.webhookPath = "/webhook/lead";
    }

    // When a fresh userToken is saved, record expiry.
    // System user tokens (permanent) skip the 60-day window so the cron never touches them.
    if (payload.userToken && payload.userToken !== automation.userToken) {
      automation.userTokenExpiresAt = payload.isSystemToken
        ? new Date("2099-12-31")                                       // permanent — cron skips
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);            // normal 60-day token
      automation.tokenRefreshedAt = new Date();
    }

    automation.updatedBy = actor._id;
    await automation.save();

    // Re-subscribe page webhook on update (in case token changed or first save)
    if (normalized.platform === "Facebook" && normalized.pageId && normalized.accessToken) {
      try {
        await automationService.subscribePageWebhook(normalized.pageId, normalized.accessToken);
      } catch (err) {
        console.warn("Page webhook subscription failed (non-fatal):", err.message);
      }
    }

    return automation;
  },

  async remove(id, orgId) {
    const automation = await Automation.findOne({ _id: id, orgId });
    if (!automation) throw new AppError("Automation source not found", 404);
    await automation.deleteOne();
    return true;
  },

  async verifyPopupToken(rawToken) {
    if (!rawToken) throw new AppError("Missing CRM session token", 401);

    let decoded;
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    } catch {
      throw new AppError("Invalid CRM session token", 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) throw new AppError("User not found", 404);
    if (!["admin", "manager", "super_admin"].includes(user.role)) {
      throw new AppError("Not authorized to manage automations", 403);
    }

    return user;
  },

  createFacebookState({ userId }) {
    // Only embed userId - never the session JWT (which would leak via URL/browser history)
    return jwt.sign(
      { userId, type: "facebook_oauth" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  },

  verifyFacebookState(state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      if (decoded.type !== "facebook_oauth") throw new Error("Invalid state type");
      return { userId: decoded.userId };
    } catch {
      throw new AppError("Invalid Facebook OAuth state", 400);
    }
  },

  getFacebookRedirectUri() {
    return process.env.FB_REDIRECT_URI || "http://localhost:5000/api/automations/facebook/callback";
  },

  getFrontendOrigin() {
    return process.env.FRONTEND_URL || (process.env.CLIENT_URLS || "http://localhost:3000").split(",")[0].trim();
  },

  getFacebookAuthUrl(state) {
    if (!process.env.FB_APP_ID) throw new AppError("FB_APP_ID is not configured", 500);

    const params = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      redirect_uri: this.getFacebookRedirectUri(),
      state,
      response_type: "code",
      // leads_retrieval is intentionally omitted — the server-side App Token
      // (FB_APP_ID|FB_APP_SECRET) handles all lead fetching, so users never
      // need to grant that advanced permission personally.
      scope: [
        "pages_show_list",
        "pages_manage_metadata",
        "pages_read_engagement",
      ].join(","),
    });

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async exchangeFacebookCode(code) {
    if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
      throw new AppError("Facebook OAuth credentials are not configured", 500);
    }

    // Step 1: Exchange code for short-lived user token
    const params = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: this.getFacebookRedirectUri(),
      code,
    });

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) {
      throw new AppError(json.error?.message || "Failed to exchange Facebook OAuth code", 400);
    }

    const shortLivedToken = json.access_token;

    // Step 2: Extend to long-lived user token (60 days)
    // Page tokens derived from a long-lived user token become non-expiring
    try {
      const llParams = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      });
      const llResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${llParams.toString()}`);
      const llJson = await llResponse.json();
      if (llResponse.ok && llJson.access_token) {
        console.log("[facebookOAuth] Extended to long-lived user token successfully");
        return llJson.access_token;
      }
    } catch (extErr) {
      console.warn("[facebookOAuth] Could not extend token, using short-lived:", extErr.message);
    }

    return shortLivedToken;
  },

  // Get a page-specific access token using the user token
  // This is needed for Business Manager pages where /owned_pages doesn't return access_token
  async fetchPageToken(pageId, userAccessToken) {
    try {
      const params = new URLSearchParams({ access_token: userAccessToken, fields: "access_token" });
      const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?${params.toString()}`);
      const json = await resp.json();
      if (json.access_token) {
        console.log(`[fetchPageToken] Got page token for ${pageId}`);
        return json.access_token;
      }
      console.warn(`[fetchPageToken] No access_token returned for page ${pageId}:`, JSON.stringify(json));
    } catch (e) {
      console.warn(`[fetchPageToken] Failed for page ${pageId}:`, e.message);
    }
    return userAccessToken; // fallback to user token
  },

  async fetchFacebookPages(accessToken) {
    // 1️⃣ Direct pages — managed personally by the user (/me/accounts)
    const params = new URLSearchParams({ access_token: accessToken, fields: "id,name,access_token,tasks", limit: "200" });
    const resp1 = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${params.toString()}`);
    const json1 = await resp1.json();

    if (!resp1.ok) {
      console.error("[fetchFacebookPages] /me/accounts error:", JSON.stringify(json1));
      throw new AppError(json1.error?.message || "Failed to fetch Facebook pages", 400);
    }

    const directPages = json1.data || [];
    console.log(`[fetchFacebookPages] /me/accounts returned ${directPages.length} direct page(s)`);

    // 2️⃣ Fetch page tokens for any pages missing them, then deduplicate
    // Note: /me/businesses (Business Manager pages) requires the business_management
    // permission which needs separate Facebook App Review approval. Until that is
    // granted, only pages directly administered on the user's personal profile
    // (/me/accounts) are returned. Customers whose pages are Business-Manager-only
    // must add themselves as a personal Page Admin first, then reconnect.
    const enriched = await Promise.all(
      directPages.map(async (page) => {
        if (page.access_token) return page;
        const pageToken = await this.fetchPageToken(page.id, accessToken);
        return { ...page, access_token: pageToken };
      })
    );

    const seen = new Set();
    const deduped = enriched.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    console.log(`[fetchFacebookPages] Total unique pages: ${deduped.length} (direct /me/accounts)`);
    return deduped;
  },

  async fetchFacebookForms(pageId, pageAccessToken) {
    const params = new URLSearchParams({
      access_token: pageAccessToken,
      fields: "id,name,status,created_time",
      limit: "100",
    });

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) {
      console.error(`[fetchFacebookForms] API error for page ${pageId}:`, JSON.stringify(json));
      return [];
    }

    const forms = json.data || [];
    console.log(`[fetchFacebookForms] page ${pageId} returned ${forms.length} forms:`, forms.map(f => f.name));
    return forms;
  },

  async getFacebookConnectionData(code) {
    const userAccessToken = await this.exchangeFacebookCode(code);
    const rawPages = await this.fetchFacebookPages(userAccessToken);

    const pages = await Promise.all(
      rawPages.map(async (page) => {
        // page.access_token may be absent for Business Manager pages; fall back to user token
        const pageToken = page.access_token || userAccessToken;
        return {
          id: page.id,
          name: page.name,
          tasks: page.tasks || [],
          accessToken: pageToken,
          forms: await this.fetchFacebookForms(page.id, pageToken),
        };
      })
    );

    // Return pages + the fresh user token (used as fallback access token on reconnect)
    return { pages, freshToken: userAccessToken };
  },

  async verifySystemToken(token) {
    // Verify the token is valid and get the identity
    const meResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?access_token=${encodeURIComponent(token)}`);
    const me = await meResp.json();
    if (me.error) throw new AppError(me.error.message || "Invalid token — check permissions and try again", 400);

    // Fetch pages (reuses existing logic that handles personal + Business Manager pages)
    const rawPages = await this.fetchFacebookPages(token);
    const pages = await Promise.all(rawPages.map(async (page) => {
      const pageToken = page.access_token || token;
      return {
        id:          page.id,
        name:        page.name,
        tasks:       page.tasks || [],
        accessToken: pageToken,
        forms:       await this.fetchFacebookForms(page.id, pageToken),
      };
    }));

    return { pages, systemToken: token };
  },

  async storeOAuthResult(sessionId, data) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await OAuthSession.findOneAndUpdate(
      { sessionId },
      { sessionId, data, expiresAt },
      { upsert: true }
    );
  },

  async getOAuthResult(sessionId) {
    const entry = await OAuthSession.findOneAndDelete({ sessionId });
    if (!entry || entry.expiresAt < new Date()) return null;
    return entry.data; // one-time use (deleted above)
  },
};

module.exports = automationService;
