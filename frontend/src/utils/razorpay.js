// utils/razorpay.js — shared Razorpay Checkout loader.
//
// Extracted from CheckoutModal so the WhatsApp credit top-up reuses the same
// hardened loader rather than a copy. The failure handling below was learned
// the hard way; a second copy would only inherit the bugs and not the fixes.

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// How long to wait for checkout.js before giving up. An ad blocker or a DNS
// filter can drop the request in a way that fires NEITHER load nor error, so
// waiting on those events alone can hang forever.
const RZP_LOAD_TIMEOUT_MS = 8000;

/**
 * Load checkout.js on demand. Resolves true once window.Razorpay exists.
 *
 * Loaded on demand rather than in index.html: most sessions never pay for
 * anything, and this is a third-party script on every page load otherwise.
 *
 * Every failure path removes the <script> tag it created. An earlier version
 * looked for an existing tag and attached fresh load/error listeners to it —
 * but a tag that has already failed will never fire either event again, so the
 * promise never settled and the Pay button span forever on every attempt after
 * the first. A transient blip on the first click bricked checkout until a full
 * page reload.
 */
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    // Always start from a clean slate — a leftover tag is, by definition, one
    // that did not succeed.
    document
      .querySelectorAll(`script[src="${RZP_SCRIPT}"]`)
      .forEach((el) => el.remove());

    const s = document.createElement("script");
    s.src = RZP_SCRIPT;

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Leave the tag in place only when it actually gave us window.Razorpay,
      // so the next attempt genuinely retries instead of inheriting a corpse.
      if (!ok) s.remove();
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), RZP_LOAD_TIMEOUT_MS);
    s.onload = () => finish(Boolean(window.Razorpay));
    s.onerror = () => finish(false);

    document.body.appendChild(s);
  });
}

// By far the most common cause is an ad blocker or privacy extension dropping
// checkout.razorpay.com, not a flaky connection — so name that first. "Check
// your connection" sends people to look in the wrong place.
export const RZP_LOAD_ERROR =
  "Couldn't load the payment window. An ad blocker or privacy extension is usually the cause — " +
  "pause it for this site, or try a different browser, then retry.";

/**
 * Checkout display config that puts UPI first.
 *
 * This is a margin decision, not a cosmetic one: UPI carries effectively zero
 * MDR in India while cards run ~2%, and on a ~30% markup that 2% is roughly
 * three points of margin. Cards stay available, just not the default.
 */
export const UPI_FIRST_CONFIG = {
  display: {
    blocks: {
      upi: { name: "Pay by UPI", instruments: [{ method: "upi" }] },
      rest: { name: "Cards, Net Banking & Wallets", instruments: [
        { method: "card" }, { method: "netbanking" }, { method: "wallet" },
      ] },
    },
    sequence: ["block.upi", "block.rest"],
    preferences: { show_default_blocks: false },
  },
};
