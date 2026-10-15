// utils/hosts.js - which public hostnames are the website and which the CRM.
//
// Production: www.arthaleads.com / arthaleads.com (website) and
// app.arthaleads.com (CRM). Staging mirrors that on staging.arthaleads.com
// (website) and app-staging.arthaleads.com (CRM), so changes can be checked
// there before they reach live. localhost and *.vercel.app previews match
// neither and keep the full router, as before.
const host = typeof window !== "undefined" && window.location ? window.location.hostname : "";

export const IS_STAGING = host === "staging.arthaleads.com" || host === "app-staging.arthaleads.com";
export const APP_HOST = IS_STAGING ? "app-staging.arthaleads.com" : "app.arthaleads.com";
export const MARKETING_HOSTS = IS_STAGING ? ["staging.arthaleads.com"] : ["www.arthaleads.com", "arthaleads.com"];
export const APP_ORIGIN = `https://${APP_HOST}`;

export const isAppHost = () => window.location.hostname === APP_HOST;
export const isMarketingHost = () => MARKETING_HOSTS.includes(window.location.hostname);
