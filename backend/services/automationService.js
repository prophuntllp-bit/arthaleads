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

// Platforms authenticated only by a per-source token/key (no OAuth / user JWT).
// Each maps to its own ingestion route in routes/webhookRoutes.js — Google uses
// Google Ads' own webhook payload shape, so it gets a dedicated endpoint rather
// than sharing /webhook/lead's generic {name,phone,email,message} contract.
const TOKEN_INGEST_WEBHOOK_PATH = {
  Custom: "/webhook/lead",
  "Vistrow Voice": "/webhook/lead",
  WhatsApp: "/webhook/lead",
  Google: "/webhook/google",
};
const TOKEN_INGEST_PLATFORMS = Object.keys(TOKEN_INGEST_WEBHOOK_PATH);

const META_GRAPH_VERSION = "v23.0";

const DEFAULTS = {
  Facebook: {
    mode: "webhook",
    webhookPath: "/webhook",
    leadSourceLabel: "Facebook",
    description: "Receive Meta Lead Ads leads directly into the CRM through the Facebook webhook.",
  },
  Google: {
    mode: "webhook",
    webhookPath: "/webhook/google",
    leadSourceLabel: "Google",
    description: "Receive Google Ads Lead Form submissions directly — no OAuth, just a webhook URL and key.",
  },
  WhatsApp: {
    mode: "webhook",
    webhookPath: "/webhook/lead",
    leadSourceLabel: "WhatsApp",
    description: "Receive enquiries from a WhatsApp bot or provider (e.g. Wati, Interakt, Twilio) via the lead webhook with your token.",
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

// A Facebook Page, or a lead-intake key, belongs to one company only. Leads
// are routed by page id and by key, so a second company "connecting" the same
// page (with no form filter) or reusing a key would start receiving the first
// company's leads (16 Oct 2026 audit, H4).
async function assertNotClaimedElsewhere(normalized, orgId, selfId = null) {
  const others = { orgId: { $ne: orgId }, isActive: true, ...(selfId ? { _id: { $ne: selfId } } : {}) };
  if (normalized.platform === "Facebook" && normalized.pageId) {
    if (await Automation.exists({ ...others, platform: "Facebook", pageId: String(normalized.pageId) })) {
      throw new AppError("This Facebook Page is already connected to another ArthaLeads workspace. Disconnect it there first, or contact support.", 409);
    }
  }
  if (normalized.verifyToken && typeof normalized.verifyToken === "string") {
    if (await Automation.exists({ ...others, verifyToken: normalized.verifyToken })) {
      throw new AppError("That key is already in use. Leave it empty and a new one will be created.", 409);
    }
  }
}

const automationService = {
  async list(orgId) {
    const rows = await Automation.find({ orgId }).select("-accessToken -userToken").sort({ createdAt: -1 });
    await Promise.all([this.fillSiteNames(rows), this.fillSiteIcons(rows)]);
    return rows;
  },

  // Website connections that only know a generic name ("WordPress Site") read
  // their real one from the site's homepage, once a week at most. Bounded so a
  // slow site can never hold the page up.
  async fillSiteNames(rows) {
    const { fetchSiteName, isGenericSiteName } = require("../utils/siteName");
    const weekAgo = Date.now() - 7 * 86400000;
    const todo = rows.filter((a) => a.platform === "Website Form" && a.siteUrl && isGenericSiteName(a.siteName)
      && (!a.siteNameCheckedAt || a.siteNameCheckedAt.getTime() < weekAgo));
    if (!todo.length) return;
    const work = Promise.all(todo.map(async (a) => {
      const name = await fetchSiteName(a.siteUrl);
      const patch = { siteNameCheckedAt: new Date() };
      if (name) patch.siteName = name;
      await Automation.updateOne({ _id: a._id }, { $set: patch });
      if (name) a.siteName = name;
      a.siteNameCheckedAt = patch.siteNameCheckedAt;
    }));
    await Promise.race([work, new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
  },

  // Each website connection's own icon (favicon, else logo), found once a week
  // at most; the page never waits more than a few seconds for slow sites.
  async fillSiteIcons(rows) {
    const { fetchSiteIcon } = require("../utils/siteIcon");
    const weekAgo = Date.now() - 7 * 86400000;
    const todo = rows.filter((a) => a.platform === "Website Form" && a.siteUrl
      && (!a.siteIconCheckedAt || a.siteIconCheckedAt.getTime() < weekAgo));
    if (!todo.length) return;
    const work = Promise.all(todo.map(async (a) => {
      const icon = await fetchSiteIcon(a.siteUrl);
      const patch = { siteIconCheckedAt: new Date(), siteIconUrl: icon?.url || "", siteIconKind: icon?.kind || "" };
      await Automation.updateOne({ _id: a._id }, { $set: patch });
      Object.assign(a, patch);
    }));
    await Promise.race([work, new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
  },

  async create(payload, actor) {
    const normalized = applyDefaults(payload);

    // Token-ingest sources (Custom, Vistrow Voice, Google-webhook) authenticate
    // incoming webhook calls by a per-source token/key (there is no OAuth / user
    // JWT on the ingestion path). Mint one on create if the caller didn't supply
    // it, so the UI always has a token to show. Google can also be mode "oauth"
    // (created directly via createGoogleOAuthConnection, not through this
    // generic path) — that variant authenticates via a refresh token instead
    // and must never get a webhook Key/path assigned.
    if (TOKEN_INGEST_PLATFORMS.includes(normalized.platform) && normalized.mode !== "oauth" && !normalized.verifyToken) {
      normalized.verifyToken = generateIngestToken();
    }

    await assertNotClaimedElsewhere(normalized, actor.orgId);
    const automation = await Automation.create({
      ...normalized,
      orgId: actor.orgId,
      createdBy: actor._id,
      updatedBy: actor._id,
    });

    // Subscribe the Page to send leadgen events to our webhook.
    //
    // This is NOT cosmetic: without it Facebook never delivers a single lead.
    // Treating a failure here as merely "non-fatal" meant the org saw a
    // connected source and silently received nothing, which is worse than an
    // outright error — so the reason is recorded and surfaced instead.
    if (normalized.platform === "Facebook" && normalized.pageId && normalized.accessToken) {
      automation.webhookWarning = await automationService.trySubscribePage(
        normalized.pageId,
        normalized.accessToken
      );
    }

    return automation;
  },

  // Returns null on success, or a human-readable reason the Page could not be
  // subscribed. Persists the reason so a silently-broken connection is
  // diagnosable later rather than living only in a log line.
  async trySubscribePage(pageId, pageAccessToken, automationDoc = null) {
    try {
      await automationService.subscribePageWebhook(pageId, pageAccessToken);
      return null;
    } catch (err) {
      const reason = err.message || "Unknown error";
      console.error(`[subscribePageWebhook] FAILED for page ${pageId} — this Page will receive NO leads: ${reason}`);
      if (automationDoc) {
        try {
          automationDoc.mappingNotes = `Webhook subscription failed: ${reason}`.slice(0, 500);
          await automationDoc.save();
        } catch { /* best effort — never mask the original failure */ }
      }
      return reason;
    }
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
    await assertNotClaimedElsewhere(normalized, actor.orgId, automation._id);
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

    // Token-ingest sources (Custom, Vistrow Voice, Google-webhook): never lose
    // the ingest token to an empty form field, and upgrade legacy records
    // (created before their dedicated webhook existed — they were saved with
    // webhookPath "/api/leads" and no token). Minting only happens when there
    // is genuinely no token, so re-saving never rotates a live one. Google can
    // also be mode "oauth" (created via createGoogleOAuthConnection, not this
    // generic path) — that variant must never get a webhook Key/path forced
    // onto it, since it authenticates via a refresh token instead.
    if (TOKEN_INGEST_WEBHOOK_PATH[automation.platform] && automation.mode !== "oauth") {
      automation.verifyToken = automation.verifyToken || existingToken || generateIngestToken();
      automation.webhookPath = TOKEN_INGEST_WEBHOOK_PATH[automation.platform];
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
      automation.webhookWarning = await automationService.trySubscribePage(
        normalized.pageId,
        normalized.accessToken
      );
    }

    return automation;
  },

  async remove(id, orgId) {
    const automation = await Automation.findOne({ _id: id, orgId });
    if (!automation) throw new AppError("Automation source not found", 404);
    // A removed Sign in with Google connection takes its webhook off the lead forms
    // (best effort; other webhooks on those forms are left alone).
    if (automation.platform === "Google" && automation.mode === "oauth" && automation.userToken && automation.googleCustomerId) {
      try {
        const { removeLeadFormWebhooks } = require("../utils/googleAdsApi");
        const { webhookUrl } = require("../utils/googleAdsPoller");
        const accessToken = await this.refreshGoogleAccessToken(automation.userToken);
        await removeLeadFormWebhooks(automation.googleCustomerId, { url: webhookUrl(), accessToken, loginCustomerId: automation.googleLoginCustomerId });
      } catch { /* Google unreachable or access revoked: the forms then fail to deliver, which Google reports to the advertiser */ }
    }
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

  createFacebookState({ userId, mobile = false, origin = "" }) {
    // Only embed userId - never the session JWT (which would leak via URL/browser history)
    return jwt.sign(
      { userId, mobile, origin, type: "facebook_oauth" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  },

  verifyFacebookState(state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      if (decoded.type !== "facebook_oauth") throw new Error("Invalid state type");
      return { userId: decoded.userId, mobile: decoded.mobile === true, origin: decoded.origin || "" };
    } catch {
      throw new AppError("Invalid Facebook OAuth state", 400);
    }
  },

  getFacebookRedirectUri() {
    return process.env.FB_REDIRECT_URI || "http://localhost:5000/api/automations/facebook/callback";
  },

  // The app is reachable on several domains (marketing + CRM subdomains, an
  // alternate Vercel host) - see CLIENT_URLS. The OAuth popup must redirect
  // back to whichever one actually opened it, or window.opener.postMessage's
  // targetOrigin check silently drops the result (popup just closes with no
  // feedback - it looks identical to the user cancelling).
  isAllowedFrontendOrigin(origin) {
    if (!origin) return false;
    const allowed = (process.env.CLIENT_URLS || "http://localhost:3000")
      .split(",").map((o) => o.trim());
    return allowed.includes(origin);
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
      // Force the permission/Page picker to re-render every time. Without this
      // Facebook shows "You've previously linked Arthaleads CRM — continue with
      // your previous settings?" and Continue silently re-grants the OLD asset
      // selection. A user whose first attempt failed before reaching the picker
      // (or who ticked no Pages) then re-grants zero Pages forever: /me/accounts
      // returns a clean, error-free 0 and the connect flow dead-ends at "No
      // Facebook Pages found" with nothing in the logs to explain why.
      auth_type: "rerequest",
      // leads_retrieval IS required here, despite the App Token
      // (FB_APP_ID|FB_APP_SECRET) handling all lead *fetching*. Subscribing a
      // Page to the "leadgen" webhook field is a separate operation, and Graph
      // rejects it without leads_retrieval on the subscribing token:
      //   (#200) To subscribe to the leadgen field, one of these permissions
      //          is needed: leads_retrieval
      // Omitting it let the connection save while the Page was never actually
      // subscribed, so the org looked connected and received zero leads.
      // It is approved for Advanced Access, so every user can grant it.
      // pages_manage_ads gates every read of a Page's lead forms — both the
      // connect-time Form dropdown and resolving a form's name for an incoming
      // lead. It is still at Standard Access ("Ready for testing"), so Facebook
      // grants it only to users holding a role on the app and simply omits it
      // for everyone else; login is unaffected either way, and the form list
      // already degrades to an empty "All forms" state. Requesting it now is
      // what makes the App Review screencast recordable — on approval it starts
      // working for every org with no further code change.
      scope: [
        "pages_show_list",
        "pages_manage_metadata",
        "pages_read_engagement",
        "leads_retrieval",
        "pages_manage_ads",
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

  // The Page IDs the user actually ticked in the consent picker.
  //
  // /me/accounts only lists Pages where the user holds a CLASSIC Page role.
  // A Page on the New Pages Experience comes back as an empty 200 there even
  // when the user just granted it — no error, nothing distinguishing it from
  // "this user manages no Pages" (an ambiguity that cost two wrong root-cause
  // diagnoses: Dev Mode, then Business Manager). The grant is intact either
  // way, and debug_token reports it under granular_scopes as the exact
  // target_ids per scope, so that is the reliable source of truth.
  async fetchGrantedPageIds(accessToken) {
    if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) return [];
    const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
    try {
      const params = new URLSearchParams({ input_token: accessToken, access_token: appToken });
      const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?${params.toString()}`);
      const json = await resp.json();
      if (json.error) {
        console.warn(`[fetchGrantedPageIds] debug_token error: ${json.error.message}`);
        return [];
      }

      const ids = new Set();
      for (const entry of json.data?.granular_scopes || []) {
        // Only pages_show_list is guaranteed to target Pages; other scopes can
        // target ad accounts or businesses, whose IDs are not Page IDs.
        if (entry.scope !== "pages_show_list") continue;
        for (const id of entry.target_ids || []) ids.add(String(id));
      }
      return [...ids];
    } catch (e) {
      console.warn(`[fetchGrantedPageIds] debug_token threw: ${e.message}`);
      return [];
    }
  },

  // Read one Page directly by ID. Used for Pages the grant covers but
  // /me/accounts refuses to enumerate (see fetchGrantedPageIds).
  async fetchPageById(pageId, userAccessToken) {
    try {
      // `tasks` is NOT requestable here — it exists only on the /me/accounts
      // edge, and asking for it makes Graph reject the whole call with
      // "(#100) Tried accessing nonexisting field (tasks)" rather than just
      // omitting it. Same trap as page_id/adgroup_id in webhookRoutes.js.
      const params = new URLSearchParams({ access_token: userAccessToken, fields: "id,name,access_token" });
      const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?${params.toString()}`);
      const json = await resp.json();
      if (json.error) {
        console.warn(`[fetchPageById] ${pageId} failed: ${json.error.message}`);
        return null;
      }
      return {
        id: json.id,
        name: json.name || pageId,
        access_token: json.access_token, // may be absent; enriched by caller
        tasks: [], // unavailable on this path; only used for display
      };
    } catch (e) {
      console.warn(`[fetchPageById] ${pageId} threw: ${e.message}`);
      return null;
    }
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

    let directPages = json1.data || [];
    console.log(`[fetchFacebookPages] /me/accounts returned ${directPages.length} direct page(s)`);

    // Empty here does NOT mean the user granted nothing — /me/accounts omits
    // New Pages Experience Pages entirely. Fall back to the Page IDs carried
    // in the token's own grant and read each Page directly.
    if (directPages.length === 0) {
      const grantedIds = await this.fetchGrantedPageIds(accessToken);
      console.log(`[fetchFacebookPages] /me/accounts empty - grant covers ${grantedIds.length} Page id(s): ${grantedIds.join(", ") || "none"}`);
      if (grantedIds.length) {
        directPages = (await Promise.all(
          grantedIds.map((id) => this.fetchPageById(id, accessToken))
        )).filter(Boolean);
        console.log(`[fetchFacebookPages] recovered ${directPages.length} Page(s) directly by id`);
      }
    }

    // 2️⃣ Fetch page tokens for any pages missing them, then deduplicate
    // Note: this no longer depends on /me/accounts alone — the granular_scopes
    // fallback above covers New Pages Experience Pages, which /me/accounts
    // silently omits. business_management (for Pages reachable ONLY through a
    // Business portfolio, with no direct grant) is still unapproved and remains
    // out of scope; the System User Token panel is the path for those.
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

  // ── Google Ads OAuth ─────────────────────────────────────────────────────────
  // "Sign in with Google" -> Ads API polling, as an alternative to the manual
  // webhook (URL+Key pasted into Google Ads' UI). Requires the org to have set
  // up a Google Cloud OAuth Client whose project has Google Ads API access
  // (Explorer or higher; developer tokens were retired in Sep 2026);
  // see GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
  createGoogleState({ userId, mobile = false, origin = "" }) {
    return jwt.sign(
      { userId, mobile, origin, type: "google_oauth" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  },

  verifyGoogleState(state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      if (decoded.type !== "google_oauth") throw new Error("Invalid state type");
      return { userId: decoded.userId, mobile: decoded.mobile === true, origin: decoded.origin || "" };
    } catch {
      throw new AppError("Invalid Google OAuth state", 400);
    }
  },

  getGoogleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/automations/google/callback";
  },

  getGoogleAuthUrl(state) {
    if (!process.env.GOOGLE_CLIENT_ID) throw new AppError("GOOGLE_CLIENT_ID is not configured", 500);

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.getGoogleRedirectUri(),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline", // required to receive a refresh_token
      prompt: "consent",      // forces the consent screen so a refresh_token is issued every time (not just first-ever auth)
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeGoogleCode(code) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new AppError("Google OAuth credentials are not configured", 500);
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: this.getGoogleRedirectUri(),
      code,
      grant_type: "authorization_code",
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new AppError(json.error_description || json.error || "Failed to exchange Google OAuth code", 400);
    }
    // refresh_token is only returned when access_type=offline + prompt=consent
    // (both set above), and even then only reliably on this first exchange.
    return { accessToken: json.access_token, refreshToken: json.refresh_token || "", expiresIn: json.expires_in };
  },

  async refreshGoogleAccessToken(refreshToken) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new AppError("Google OAuth credentials are not configured", 500);
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new AppError(json.error_description || json.error || "Failed to refresh Google access token", 400);
    }
    return json.access_token;
  },

  // The ad accounts this Google login can read leads from, client accounts of a
  // manager included (see utils/googleAdsApi.js listAccounts).
  async fetchGoogleAdsAccounts(accessToken) {
    try {
      return await require("../utils/googleAdsApi").listAccounts(accessToken);
    } catch (err) {
      throw new AppError(err.message || "Failed to list Google Ads accounts", 400);
    }
  },

  async getGoogleConnectionData(code) {
    const { accessToken, refreshToken } = await this.exchangeGoogleCode(code);
    const customers = await this.fetchGoogleAdsAccounts(accessToken);
    return { customers, accessToken, refreshToken };
  },

  async storeOAuthResult(sessionId, data, userId = "") {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await OAuthSession.findOneAndUpdate(
      { sessionId },
      { sessionId, data, expiresAt, userId: userId ? String(userId) : "" },
      { upsert: true }
    );
  },

  // Only the person who started the connect gets the result (it holds the
  // Facebook/Google tokens): the session id travels through a custom-scheme
  // link another app could catch. Results stored without a person (an error
  // before the state was read) carry no tokens.
  async getOAuthResult(sessionId, userId) {
    const entry = await OAuthSession.findOne({ sessionId });
    if (!entry || entry.expiresAt < new Date()) return null;
    if (entry.userId && entry.userId !== String(userId)) return null;
    await OAuthSession.deleteOne({ _id: entry._id }); // one-time use
    return entry.data;
  },

  // A 60-second ticket the phone app puts in the connect link instead of its
  // login token, so a token never sits in a URL (server logs, browser history).
  createPopupTicket(userId) {
    return jwt.sign({ id: String(userId), type: "popup_ticket" }, process.env.JWT_SECRET, { expiresIn: "60s" });
  },
};

module.exports = automationService;
