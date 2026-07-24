# EnableX Web SDK (EnxRtc.js)

The in-app soft phone ("Call in browser") loads EnableX's browser SDK from
`/vendor/EnxRtc.js` **on demand** (only when an agent starts an in-app call).

EnableX distributes this SDK as a file you download from your dashboard — there
is no clean web npm package. To enable in-app calling:

1. Log into your EnableX dashboard → **Video** → **Web SDK / Toolkit** and
   download the latest `EnxRtc.js`.
2. Place it in this folder as:

   ```
   frontend/public/vendor/EnxRtc.js
   ```

3. In your EnableX project settings, whitelist the app's domain
   (`www.arthaleads.com`) so it is allowed to request call tokens.

Until the file is present, the "Call in browser" option still appears (when an
admin has enabled it in Automation → Telephony) but will show a clear error
telling the user the SDK file is missing — it never affects the existing
PSTN "Call via EnableX IVR" flow.

This file (README.md) is safe to keep in the repo; it is not served as code.
