// services/whatsappOnboardingService.js
//
// WhatsApp Embedded Signup (v4) — the customer clicks one button, logs into
// their own Facebook, and picks or creates their own Business Portfolio, WABA
// and phone number entirely inside Meta's popup. Everything below runs after
// that popup hands the frontend a short-lived `code`; it turns that code into
// a working, receiving-messages connection with no token ever typed by hand.
//
// Mirrors the multi-tenant Facebook OAuth pattern already in
// automationService.js (fetch-based, not axios; same graph version).

const { encryptField } = require("../utils/fieldCrypto");

const GRAPH_VERSION = "v21.0"; // matches every other WhatsApp call in this codebase
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function onboardingError(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * Turn the popup's short-lived code into the customer's business access token.
 *
 * This is the Embedded Signup / Tech Provider variant of the code exchange —
 * no `redirect_uri`, unlike the browser-redirect OAuth flow automationService.js
 * uses for Facebook Lead Ads. The token returned here is already long-lived;
 * there is no separate fb_exchange_token step for this flow.
 */
async function exchangeCode(code) {
  if (!process.env.WA_APP_ID || !process.env.WA_APP_SECRET) {
    throw onboardingError("WhatsApp Embedded Signup is not configured on this server.", 500);
  }
  const params = new URLSearchParams({
    client_id: process.env.WA_APP_ID,
    client_secret: process.env.WA_APP_SECRET,
    code,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw onboardingError(json.error?.message || "Could not complete the WhatsApp connection.", 400);
  }
  return json.access_token;
}

/**
 * Subscribes Arthaleads' app to the customer's WABA.
 *
 * Meta only delivers a WABA's messages to apps actually subscribed to it — a
 * popup that finished successfully still produces silence on the inbox side
 * without this call. Same requirement already discovered by hand for PropHunt
 * on 9 Sep (see subscribeAndVerify in routes/whatsappRoutes.js for the
 * settings-page equivalent of this call).
 */
async function subscribeApp(wabaId, token) {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw onboardingError(json.error?.message || "Could not subscribe to this WhatsApp Business Account.", 400);
  }
  return true;
}

/** A random 6-digit PIN — Meta's own format for /register and 2-step verification. */
function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Registers the phone number for Cloud API messaging.
 *
 * A number picked or newly verified inside the Embedded Signup popup is not
 * yet registered for API sends — this is the one remaining step, and it needs
 * a PIN Meta has never seen before (encrypted at rest like every other secret
 * field this codebase stores, via fieldCrypto).
 */
async function registerNumber(phoneNumberId, token) {
  const pin = generatePin();
  const res = await fetch(`${GRAPH}/${phoneNumberId}/register?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw onboardingError(json.error?.message || "Could not register this phone number for messaging.", 400);
  }
  return { pinEncrypted: encryptField(pin) };
}

/** Cached display fields — the same ones already read for the manual-connect settings UI. */
async function fetchProfile(phoneNumberId, token) {
  const params = new URLSearchParams({
    access_token: token,
    fields: "verified_name,display_phone_number,quality_rating",
  });
  const res = await fetch(`${GRAPH}/${phoneNumberId}?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    // Not fatal — the connection already works without these display fields;
    // whoever calls this can log and continue rather than fail onboarding
    // over a field the inbox merely uses for a badge.
    return { verifiedName: "", displayPhoneNumber: "", qualityRating: "" };
  }
  return {
    verifiedName: json.verified_name || "",
    displayPhoneNumber: json.display_phone_number || "",
    qualityRating: json.quality_rating || "",
  };
}

/**
 * Shares Arthaleads' own Meta credit line onto the customer's WABA, so the
 * customer never sees a Meta billing dialog — Arthaleads is billed instead,
 * and re-bills through the credit wallet at a markup (the AiSensy model).
 *
 * This is the ONE step gated on Arthaleads' own standing with Meta, which does
 * not exist yet (Tech Provider status alone does not carry a credit line —
 * see docs/whatsapp-embedded-signup-plan.md for what does). WA_CREDIT_LINE_ID
 * stays unset until that changes, so this quietly no-ops today: the customer
 * adds their own card at Meta, same as PropHunt does now. The moment it IS
 * set, every future onboarding starts sharing automatically — nothing else
 * in this file, or in the exchange route that calls it, needs to change.
 */
async function tryShareCreditLine(wabaId, token) {
  const creditLineId = process.env.WA_CREDIT_LINE_ID;
  if (!creditLineId) return { shared: false, reason: "not_configured" };

  try {
    // Endpoint intentionally not hardcoded further than this — Meta's exact
    // credit-allocation path should be confirmed against the live docs (or the
    // Business Settings > Payments panel) at the point Arthaleads actually has
    // a credit line to test against, not guessed now.
    const res = await fetch(`${GRAPH}/${creditLineId}/whatsapp_credit_sharing_and_attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waba_id: wabaId, access_token: token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[whatsappOnboarding] credit line share failed, falling back to tenant's own card:", json.error?.message || res.status);
      return { shared: false, reason: "api_error" };
    }
    return { shared: true };
  } catch (err) {
    console.warn("[whatsappOnboarding] credit line share threw, falling back to tenant's own card:", err.message);
    return { shared: false, reason: "exception" };
  }
}

module.exports = {
  exchangeCode, subscribeApp, registerNumber, fetchProfile, tryShareCreditLine, generatePin,
};
