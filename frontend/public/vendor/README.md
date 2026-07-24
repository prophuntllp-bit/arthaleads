# EnableX Web SDK (EnxRtc.js)

The in-app soft phone ("Call in browser") loads EnableX's browser SDK from
`/vendor/EnxRtc.js` **on demand** (only when an agent starts an in-app call).

`EnxRtc.js` is already vendored here (the official build from EnableX's public
sample repos). If you ever need a newer build, download the latest `EnxRtc.js`
from your EnableX dashboard (Video → Web SDK / Toolkit) and replace this file —
keep the same filename/path.

## What the soft phone needs on EnableX's side

- An EnableX **Video** project; its **App ID / App Key** go into
  Arthaleads → Automation → Telephony → In-app calling.
- A phone number added under the Video project's **PSTN Integration** tab — it
  becomes the caller ID and enables dialing leads' phones into the room.

No domain whitelisting is required: call tokens are minted server-side by the
backend using the Video App ID/Key, and that token is what authorizes the
browser to join the room.

This README is safe to keep in the repo; it is not served as code.
