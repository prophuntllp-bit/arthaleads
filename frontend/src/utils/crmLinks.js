// utils/crmLinks.js
// The CRM (login/signup/dashboard/etc.) now lives on its own subdomain,
// separate from the marketing site — see App.jsx's isAppHost()/isMarketingHost()
// split. Every "Sign In" / "Get Started" CTA on a marketing page must be a
// plain cross-origin <a>, not a React Router <Link>, since the target is a
// different origin the SPA router can't navigate to client-side.
export const CRM_URL = "https://app.arthaleads.com";
export const CRM_LOGIN_URL  = `${CRM_URL}/login`;
export const CRM_SIGNUP_URL = `${CRM_URL}/signup`;

// Spread onto an <a> so every marketing CTA opens the CRM the same way:
// new tab, no opener leak back to the CRM window.
export const CRM_LINK_PROPS = { target: "_blank", rel: "noopener noreferrer" };

// ── Contact details ─────────────────────────────────────────────────────────
// The sales number was written out by hand in six files. Five of them were
// right and /contact still had a placeholder -- on the button a visitor is
// most likely to press, directly under a "Call Us" row showing the real
// number. Copies drift silently; a constant cannot.
export const WHATSAPP_NUMBER = "918080197945";
export const PHONE_DISPLAY   = "+91 80801 97945";
export const PHONE_TEL       = "tel:+918080197945";

/**
 * A wa.me link with the first message already typed.
 *
 * Worth writing properly: WhatsApp shows this text in the composer, and
 * whatever it says is what lands in the sales inbox. "Hi" tells the team
 * nothing; naming the product and what the person wants means the reply can
 * be useful on the first message.
 */
export const waLink = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const WA_MESSAGES = {
  sales:   "Hi Arthaleads! I'd like to know more about your real estate CRM - pricing, a quick demo, and whether it fits my team.",
  demo:    "Hi Arthaleads! I'd like to book a demo of the CRM for my real estate team.",
  support: "Hi, I need help with Arthaleads CRM.",
  upgrade: "Hi, I'd like to upgrade my Arthaleads plan.",
  trialExpired: "Hi, my Arthaleads trial has expired. I'd like to upgrade my plan.",
};
