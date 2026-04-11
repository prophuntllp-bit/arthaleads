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

const automationController = {
  async list(req, res, next) {
    try {
      const automations = await automationService.list();
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
      await automationService.remove(req.params.id);
      res.json({ success: true, message: "Automation source removed successfully" });
    } catch (err) {
      next(err);
    }
  },

  async facebookConnect(req, res, next) {
    // Must set COOP before redirect — helmet's default COOP: same-origin
    // nullifies window.opener on the very first popup page load
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    try {
      const rawToken = req.query.token || "";
      const user = await automationService.verifyPopupToken(rawToken);
      const state = automationService.createFacebookState({ userId: user._id.toString(), crmToken: rawToken });
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
      const { code, state } = req.query;
      if (!code || !state) throw new Error("Missing Facebook callback data");

      automationService.verifyFacebookState(state);
      const pages = await automationService.getFacebookConnectionData(code);

      const sessionId = require("crypto").randomBytes(16).toString("hex");
      automationService.storeOAuthResult(sessionId, { type: "success", pages });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    } catch (err) {
      const sessionId = require("crypto").randomBytes(16).toString("hex");
      automationService.storeOAuthResult(sessionId, { type: "error", message: err.message || "Facebook connection failed" });
      return res.redirect(`${frontendOrigin}/fb-callback?session=${sessionId}`);
    }
  },

  async getFacebookResult(req, res) {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: "Missing session" });
    const result = automationService.getOAuthResult(session);
    if (!result) return res.status(404).json({ error: "Session not found or expired" });
    return res.json(result);
  },
};

module.exports = automationController;
