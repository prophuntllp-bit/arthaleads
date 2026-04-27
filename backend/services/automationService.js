const jwt = require("jsonwebtoken");
const Automation = require("../models/Automation");
const OAuthSession = require("../models/OAuthSession");
const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

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
    webhookPath: "/api/leads",
    leadSourceLabel: "Other",
    description: "Use a custom data source and map it into your CRM lead fields.",
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
    return Automation.find({ orgId }).sort({ createdAt: -1 });
  },

  async create(payload, actor) {
    const normalized = applyDefaults(payload);
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
    if (!["admin", "manager"].includes(user.role)) {
      throw new AppError("Not authorized to manage automations", 403);
    }

    return user;
  },

  createFacebookState({ userId, crmToken }) {
    return jwt.sign(
      { userId, crmToken, type: "facebook_oauth" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  },

  verifyFacebookState(state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      if (decoded.type !== "facebook_oauth") throw new Error("Invalid state type");
      return decoded;
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
      scope: [
        "pages_show_list",
        "pages_manage_metadata",
        "pages_read_engagement",
        "leads_retrieval",
        "business_management",
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
    // 1️⃣ Try /me/accounts — works for pages managed directly by the user
    const params = new URLSearchParams({ access_token: accessToken, fields: "id,name,access_token,tasks", limit: "200" });
    const resp1 = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${params.toString()}`);
    const json1 = await resp1.json();

    if (!resp1.ok) {
      console.error("[fetchFacebookPages] /me/accounts error:", JSON.stringify(json1));
      throw new AppError(json1.error?.message || "Failed to fetch Facebook pages", 400);
    }

    const directPages = json1.data || [];
    console.log(`[fetchFacebookPages] /me/accounts returned ${directPages.length} page(s)`);

    if (directPages.length > 0) return directPages;

    // 2️⃣ Fallback: pages managed through Meta Business Manager
    console.log("[fetchFacebookPages] No direct pages — trying Business Manager API...");
    try {
      const bizParams = new URLSearchParams({ access_token: accessToken, fields: "id,name", limit: "50" });
      const bizResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?${bizParams.toString()}`);
      const bizJson = await bizResp.json();

      if (!bizResp.ok || bizJson.error) {
        console.warn("[fetchFacebookPages] /me/businesses failed:", JSON.stringify(bizJson.error || bizJson));
        return [];
      }

      const businesses = bizJson.data || [];
      console.log(`[fetchFacebookPages] /me/businesses: ${businesses.length} business(es) — ${businesses.map(b => `${b.name}(${b.id})`).join(", ")}`);

      if (businesses.length === 0) {
        console.warn("[fetchFacebookPages] No businesses found.");
        return [];
      }

      const allPages = [];
      for (const biz of businesses) {
        for (const endpoint of ["owned_pages", "client_pages"]) {
          const pageParams = new URLSearchParams({ access_token: accessToken, fields: "id,name,access_token", limit: "200" });
          const pageResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${biz.id}/${endpoint}?${pageParams.toString()}`);
          const pageJson = await pageResp.json();
          if (pageJson.error) {
            console.warn(`[fetchFacebookPages] ${endpoint} for biz ${biz.id} error:`, JSON.stringify(pageJson.error));
            continue;
          }
          const bizPages = pageJson.data || [];
          console.log(`[fetchFacebookPages] Business "${biz.name}" ${endpoint}: ${bizPages.length} page(s) — ${bizPages.map(p => `${p.name}(token:${!!p.access_token})`).join(", ")}`);
          allPages.push(...bizPages);
        }
      }

      // For pages that don't have access_token in the response, fetch it explicitly
      const enriched = await Promise.all(
        allPages.map(async (page) => {
          if (page.access_token) return page;
          const pageToken = await this.fetchPageToken(page.id, accessToken);
          return { ...page, access_token: pageToken };
        })
      );

      // Deduplicate by page ID
      const seen = new Set();
      return enriched.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    } catch (bizErr) {
      console.warn("[fetchFacebookPages] Business Manager fallback exception:", bizErr.message);
      return [];
    }
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
      rawPages.map(async (page) => ({
        id: page.id,
        name: page.name,
        tasks: page.tasks || [],
        accessToken: page.access_token || "",
        forms: await this.fetchFacebookForms(page.id, page.access_token),
      }))
    );

    // Return pages + the fresh user token (used as fallback access token on reconnect)
    return { pages, freshToken: userAccessToken };
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
