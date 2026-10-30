import React from "react";
import ReactDOM from "react-dom/client";
import UpdateBanner from "./components/UpdateBanner";

// The app's code loaded and is running: tells the stale-page recovery in
// index.html not to reload.
window.__alBooted = true;

// ── Service Worker: periodic sync + message handling ─────────────────────────
// SW is registered in index.html so installs/crawlers can detect it.
// Here we set up periodic sync tags and listen for SW messages.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Wait for the SW registered in index.html to be ready
      const registration = await navigator.serviceWorker.ready;

      // ── Periodic Sync: refresh follow-ups hourly, leads every 2h ──────────
      if ("periodicSync" in registration) {
        try {
          const perm = await navigator.permissions.query({ name: "periodic-background-sync" });
          if (perm.state === "granted") {
            await registration.periodicSync.register("check-followups", {
              minInterval: 60 * 60 * 1000,      // 1 hour
            });
            await registration.periodicSync.register("check-leads", {
              minInterval: 2 * 60 * 60 * 1000,  // 2 hours
            });
          }
        } catch {
          // Browser doesn't support periodic-background-sync - silent fail
        }
      }

      // ── Background Sync: pre-register so offline mutations get replayed ───
      if ("sync" in registration) {
        registration.sync.register("sync-pending-requests").catch(() => {});
      }
    } catch {
      // SW not ready - app still works fine
    }
  });

  // ── Messages from the Service Worker → in-app UI ─────────────────────────
  //
  // PUSH_NOTIFICATION is deliberately NOT handled here. Sidebar.jsx already
  // listens for it and renders a toast carrying the title, the body and a
  // click-through to the lead. Handling it in both places meant every push
  // produced two stacked toasts for the same lead — one titled, one not.
  navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, resource } = event.data || {};

    if (type === "PERIODIC_SYNC") {
      window.dispatchEvent(new CustomEvent("arthaleads:refresh", { detail: { resource } }));
    }
  });
}

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
// Self-hosted Inter (served from Vercel, no Google Fonts CDN dependency)
// Only weights 400-700 loaded - matches the original Google Fonts setup exactly
// so font rendering is identical to what users expect
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
// Manrope: display face for marketing headings only (owner, 24 Oct 2026).
// Applied through the .font-display class; Inter stays the body font.
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./styles.css";
// React Bits styles load with the main stylesheet, not with the lazy page
// chunks: otherwise the prerendered menu shows unstyled until the JS arrives.
import "./components/site/reactbits/CardNav.css";
import "./components/site/reactbits/Grainient.css";
import "./components/site/reactbits/Threads.css";
import { isAppHost, isMarketingHost } from "./utils/hosts";
import "./utils/analytics";   // GA4 on the live website, after cookie consent

// Google sign-in is only used on /login and /signup, which live on
// app.arthaleads.com. On the marketing site the provider would still load
// Google's ~100 KB client script on every page for nothing.
const IS_MARKETING_HOST = isMarketingHost();
// VITE_GOOGLE_CLIENT_ID is the "ArthaLeads Web" client in the Google Cloud project
// "Arthaleads" (id arthaleads, account arhtalead@gmail.com) since 29 Oct 2026;
// it was the PropCRM project's client before. Set per environment in Vercel.
const GoogleAuth = ({ children }) => IS_MARKETING_HOST
  ? children
  : <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>{children}</GoogleOAuthProvider>;

// ── Prerendered pages ──────────────────────────────────────────────────────
// Marketing pages ship with their HTML already inside #root (scripts/
// prerender.mjs), so the page is readable before any JavaScript runs. React
// does not hydrate that markup (theme, cookie banner and other browser-only
// state would never match); it renders the live page into #root while the
// static copy stays on screen in a sibling, and the two swap once the live
// page has rendered its footer. Until then, the pages' own "scroll to top on
// mount" must not yank a visitor who has already started reading.
const rootEl = document.getElementById("root");
// A prerendered website page: the static copy is already readable, so the live
// page can be built in small slices (see the render below).
const fromStaticCopy = rootEl.hasAttribute("data-prerendered") && !isAppHost();
if (rootEl.hasAttribute("data-prerendered") && isAppHost()) {
  // The CRM host serves the same files for / and the marketing paths (they
  // redirect to /login or the marketing site): never show marketing copy there.
  rootEl.removeAttribute("data-prerendered");
  rootEl.textContent = "";
} else if (rootEl.hasAttribute("data-prerendered")) {
  const staticCopy = document.createElement("div");
  staticCopy.setAttribute("data-prerendered", "");
  while (rootEl.firstChild) staticCopy.appendChild(rootEl.firstChild);
  rootEl.removeAttribute("data-prerendered");
  rootEl.parentNode.insertBefore(staticCopy, rootEl);
  rootEl.style.cssText = "position:absolute;top:0;left:0;width:100%;visibility:hidden;pointer-events:none";

  const realScrollTo = window.scrollTo.bind(window);
  window.scrollTo = (...args) => {
    const top = typeof args[0] === "object" ? args[0]?.top : args[1];
    if (top === 0 && window.scrollY > 0) return;   // ignore the mount-time reset while swapping
    realScrollTo(...args);
  };

  let swapped = false;
  const swap = () => {
    if (swapped) return;
    swapped = true;
    observer.disconnect();
    // A timer, not requestAnimationFrame: background tabs and some crawlers
    // never run animation frames, and the static copy must not stay forever.
    setTimeout(() => {
      staticCopy.remove();
      rootEl.style.cssText = "";
      // Light-theme visitors never saw the splash (hidden by prerender-css); make
      // sure removing that CSS below cannot bring it back mid-fade.
      if (!document.documentElement.hasAttribute("data-prerender-hide")) document.getElementById("app-splash")?.remove();
      window.scrollTo = realScrollTo;
      document.getElementById("prerender-css")?.remove();
      document.documentElement.removeAttribute("data-prerender-hide");
    }, 30);
  };
  const observer = new MutationObserver(() => { if (rootEl.querySelector("footer")) swap(); });
  observer.observe(rootEl, { childList: true, subtree: true });
  setTimeout(swap, 8000);   // never leave the static copy up if a page has no footer
}

const tree = (
  <React.StrictMode>
    <HelmetProvider>
      <GoogleAuth>
        <ThemeProvider>
          <BrowserRouter>
            <App />
            {/* Modals render at z-[9999] (UI.jsx); react-hot-toast's own
                container defaults to that same z-index, so whichever mounted
                later in the DOM won the tie and any toast fired while a
                modal was open rendered invisibly behind its backdrop —
                exactly what happened saving WhatsApp settings. Toasts should
                always sit above a modal that triggered them. */}
            <Toaster position="top-right" containerStyle={{ zIndex: 10000 }} />
            <UpdateBanner />
          </BrowserRouter>
        </ThemeProvider>
      </GoogleAuth>
    </HelmetProvider>
  </React.StrictMode>
);
// Behind a static copy the live page is built as a transition: React yields to
// the browser every few milliseconds instead of building the whole page (3,000+
// elements on the home page) in one block, which held the main thread for
// 0.3-1.9 s on desktop (Lighthouse "total blocking time", 30 Oct 2026). The
// CRM app renders straight away as before.
const reactRoot = ReactDOM.createRoot(rootEl);
if (fromStaticCopy) React.startTransition(() => reactRoot.render(tree));
else reactRoot.render(tree);

// Fade out splash only after BOTH conditions are met:
//  1. React has painted its first frame (double rAF)
//  2. At least 1.8s has passed so the animation is actually visible
const reactReady = new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
  // Hidden tabs and some crawlers never run animation frames; don't let the
  // splash cover the marketing site forever because of that.
  if (!isAppHost()) setTimeout(resolve, 400);
});
// The marketing site skips the 1.8s minimum: visitors (and Google's page-speed
// measurement) should see the page the moment it has content. It waits only
// until the routed page has painted a heading or nav, capped at 1.5s.
const isCrmHost = isAppHost();
const minDisplay = isCrmHost
  ? new Promise((resolve) => setTimeout(resolve, 1800))
  : new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (document.querySelector("#root h1, #root nav") || Date.now() - started > 1500) resolve();
        else setTimeout(check, 40);
      };
      check();
    });

Promise.all([reactReady, minDisplay]).then(() => {
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.classList.add("splash-hidden");
    setTimeout(() => splash.remove(), 600);
  }
  // Tell the app it's safe to show its own loading spinners now. Until this
  // fires, the CSS splash above is guaranteed to still be covering the screen
  // (or mid-fade), so any spinner React renders underneath it during that
  // window would double up with the splash's own ring animation for the
  // ~0.55s crossfade — this flag is what App.jsx's guard components check to
  // stay blank instead of painting a second, redundant loader behind it.
  window.__splashDone = true;
  window.dispatchEvent(new Event("splash:done"));
});
