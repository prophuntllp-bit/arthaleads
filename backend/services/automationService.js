const jwt = require("jsonwebtoken");
const Automation = require("../models/Automation");
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
  async list() {
    return Automation.find().sort({ createdAt: -1 });
  },

  async create(payload, actor) {
    const normalized = applyDefaults(payload);
    const automation = await Automation.create({
      ...normalized,
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
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || "Failed to subscribe page webhook");
    }
    return json;
  },

  async update(id, payload, actor) {
    const automation = await Automation.findById(id);
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

  async remove(id) {
    const automation = await Automation.findById(id);
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
        "ads_management",
      ].join(","),
    });

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async exchangeFacebookCode(code) {
    if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
      throw new AppError("Facebook OAuth credentials are not configured", 500);
    }

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

    return json.access_token;
  },

  async fetchFacebookPages(accessToken) {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: "id,name,access_token,tasks",
    });

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) {
      throw new AppError(json.error?.message || "Failed to fetch Facebook pages", 400);
    }

    return json.data || [];
  },

  async fetchFacebookForms(pageId, pageAccessToken) {
    const params = new URLSearchParams({
      access_token: pageAccessToken,
      fields: "id,name,status",
    });

    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) return [];

    return json.data || [];
  },

  async getFacebookConnectionData(code) {
    const userAccessToken = await this.exchangeFacebookCode(code);
    const pages = await this.fetchFacebookPages(userAccessToken);

    return Promise.all(
      pages.map(async (page) => ({
        id: page.id,
        name: page.name,
        tasks: page.tasks || [],
        accessToken: page.access_token || "",
        forms: await this.fetchFacebookForms(page.id, page.access_token),
      }))
    );
  },
};

module.exports = automationService;
