// Bridge page for WhatsApp Embedded Signup from the MOBILE app.
//
// The web app runs this exact flow (FB JS SDK + FB.login with a config_id)
// directly inside frontend/src/components/WhatsAppSettings.jsx, because a
// browser can host the Facebook SDK natively. The Flutter app has no
// equivalent JS runtime, so it loads this page inside a WebView instead —
// same SDK, same FB.login call, same config_id — and this page hands the
// result back across the WebView boundary via a JavaScript channel the
// Flutter side registers as `FlutterES`, instead of `window.postMessage`
// back to an opener (there is no opener in a WebView).
//
// appId/configId arrive as query params rather than baked in here, because
// they come from GET /api/public/whatsapp-es-config at runtime — rotating
// the Meta config_id this way never needs a mobile app release.
function waEmbeddedSignupPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect WhatsApp</title>
<style>
  body { font-family: -apple-system, Roboto, sans-serif; display: flex; align-items: center;
    justify-content: center; min-height: 100vh; margin: 0; background: #f0ede8; color: #18181b; }
  .card { text-align: center; padding: 24px; max-width: 320px; }
  .spinner { width: 32px; height: 32px; border: 3px solid #e5e5e5; border-top-color: #ff6b00;
    border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 14px; line-height: 1.5; }
  .err { color: #dc2626; }
</style>
</head>
<body>
<div class="card">
  <div class="spinner" id="spinner"></div>
  <p id="status">Opening WhatsApp connect…</p>
</div>
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var appId = params.get('appId');
  var configId = params.get('configId');
  var statusEl = document.getElementById('status');
  var esIds = { wabaId: '', phoneNumberId: '' };

  function fail(msg) {
    document.getElementById('spinner').style.display = 'none';
    statusEl.textContent = msg;
    statusEl.className = 'err';
    if (window.FlutterES) {
      window.FlutterES.postMessage(JSON.stringify({ error: msg }));
    }
  }

  if (!appId || !configId) {
    fail('WhatsApp connect is not configured.');
    return;
  }

  window.addEventListener('message', function (event) {
    if (!event.origin || event.origin.indexOf('facebook.com') === -1) return;
    try {
      var data = JSON.parse(event.data);
      if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
        esIds.wabaId = (data.data && data.data.waba_id) || esIds.wabaId;
        esIds.phoneNumberId = (data.data && data.data.phone_number_id) || esIds.phoneNumberId;
      }
    } catch (e) {}
  });

  window.fbAsyncInit = function () {
    window.FB.init({ appId: appId, version: 'v21.0' });
    statusEl.textContent = 'Waiting for you to finish in the WhatsApp window…';
    window.FB.login(function (response) {
      var code = response && response.authResponse && response.authResponse.code;
      if (!code) {
        fail('WhatsApp connect was cancelled or did not complete.');
        return;
      }
      // Meta's postMessage with the waba/phone ids can land a beat after this
      // callback fires — give it a short grace window before giving up on IDs
      // it already sent (same race the web client handles with esIds.current).
      setTimeout(function () {
        if (window.FlutterES) {
          window.FlutterES.postMessage(JSON.stringify({
            code: code,
            wabaId: esIds.wabaId,
            phoneNumberId: esIds.phoneNumberId,
          }));
        } else {
          fail('This page must be opened inside the Arthaleads app.');
        }
      }, 300);
    }, { config_id: configId, response_type: 'code', override_default_response_type: true, extras: {} });
  };

  var s = document.createElement('script');
  s.src = 'https://connect.facebook.net/en_US/sdk.js';
  s.async = true;
  s.defer = true;
  s.onerror = function () { fail('Could not reach Facebook. Check your connection.'); };
  document.body.appendChild(s);
})();
</script>
</body>
</html>`;
}

module.exports = { waEmbeddedSignupPage };
