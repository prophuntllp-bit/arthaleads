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
