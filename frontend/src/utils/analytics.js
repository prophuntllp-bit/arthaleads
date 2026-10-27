// utils/analytics.js - Google Analytics 4 on the marketing website only.
//
// Property "arthaleads.com" (account Arthaleads, created 27 Oct 2026), web
// stream https://www.arthaleads.com. GA loads only:
//   - on the live marketing hosts (www.arthaleads.com / arthaleads.com), never
//     on the CRM (app.*), staging or local previews, and
//   - after the visitor chose "Accept all" (or turned analytics on in the
//     Cookie Policy), as the cookie banner promises (DPDP Act).
// Page views, scrolls, outbound clicks, site search and file downloads come
// from GA's enhanced measurement (page views follow React route changes).
// The site's own actions are sent as events, see EVENTS below. On staging
// the same events are only kept in window.__siteEvents, so they can be
// checked without touching the live numbers.
//
// EVENTS
//   generate_lead        Book a Demo form sent (form: "book_demo"), contact
//                        form sent (form: "contact"), job application sent
//                        (form: "careers")
//   book_demo_click      any link to /book-demo (link_text, page)
//   trial_click          any link to the CRM sign-up (link_text, page)
//   whatsapp_click       any wa.me link
//   phone_click          any tel: link
//   email_click          any mailto: link
//   artha_open           Artha chat opened
//   artha_question       a question sent to Artha (no text, only its length)
//   artha_cta_click      a button inside an Artha answer (cta)
import { isMarketingHost, IS_STAGING } from "./hosts";

export const GA_ID = "G-YB3DEB0JHG";

const LIVE = typeof window !== "undefined" && isMarketingHost() && !IS_STAGING;
const RECORD = typeof window !== "undefined" && isMarketingHost() && IS_STAGING;
let loaded = false;

function consented() {
  try {
    const prefs = JSON.parse(localStorage.getItem("cookie_prefs") || "null");
    if (prefs) return !!prefs.analytics;
    return localStorage.getItem("artha_cookie_consent") === "accepted";
  } catch { return false; }
}

/** Loads gtag once, if this is the live website and analytics are allowed. */
export function initAnalytics() {
  if (!LIVE || loaded || !consented()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

/** Sends one event (live, with consent) or records it (staging). */
export function track(name, params = {}) {
  if (typeof window === "undefined") return;
  const p = { page: window.location.pathname, ...params };
  if (RECORD) { (window.__siteEvents = window.__siteEvents || []).push([name, p]); return; }
  if (LIVE && loaded && window.gtag) window.gtag("event", name, p);
}

// Link clicks anywhere on the site, without wiring every button.
function onClick(e) {
  const a = e.target.closest?.("a[href]");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  const text = (a.textContent || "").trim().slice(0, 60);
  if (href.startsWith("tel:")) return track("phone_click", { link_text: text });
  if (href.startsWith("mailto:")) return track("email_click", { link_text: text });
  if (/wa\.me|api\.whatsapp\.com/.test(href)) return track("whatsapp_click", { link_text: text });
  let url;
  try { url = new URL(href, window.location.href); } catch { return; }
  if (url.pathname === "/book-demo" && url.hostname === window.location.hostname) return track("book_demo_click", { link_text: text });
  if (/^app(-staging)?\.arthaleads\.com$/.test(url.hostname) && url.pathname.startsWith("/signup")) return track("trial_click", { link_text: text });
}

if (typeof window !== "undefined" && (LIVE || RECORD)) {
  document.addEventListener("click", onClick, true);
  // The cookie banner and the Cookie Policy page fire this after a choice.
  window.addEventListener("cookie-consent", initAnalytics);
  initAnalytics();
}
