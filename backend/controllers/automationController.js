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

    // Allow window.opener.postMessage — helmet defaults break both of these:
    // - COOP: same-origin nullifies window.opener
    // - CSP: script-src 'self' blocks inline <script> tags
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    res.setHeader("Content-Security-Policy", "script-src 'unsafe-inline'");

    try {
      const { code, state } = req.query;
      if (!code || !state) {
        throw new Error("Missing Facebook callback data");
      }

      automationService.verifyFacebookState(state);
      const pages = await automationService.getFacebookConnectionData(code);

      res.status(200).send(renderPopupScript({
        type: "facebook_oauth_success",
        pages,
      }, frontendOrigin));
    } catch (err) {
      res.status(200).send(renderPopupScript({
        type: "facebook_oauth_error",
        message: err.message || "Facebook connection failed",
      }, frontendOrigin));
    }
  },
};

module.exports = automationController;
