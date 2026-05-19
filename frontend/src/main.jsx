import React from "react";
import ReactDOM from "react-dom/client";
import toast from "react-hot-toast";

// ── Service Worker registration + messaging ───────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // ── Periodic Sync: refresh follow-ups + leads hourly ──────────────────
      if ("periodicSync" in registration) {
        try {
          const perm = await navigator.permissions.query({ name: "periodic-background-sync" });
          if (perm.state === "granted") {
            await registration.periodicSync.register("check-followups", {
              minInterval: 60 * 60 * 1000, // 1 hour
            });
            await registration.periodicSync.register("check-leads", {
              minInterval: 2 * 60 * 60 * 1000, // 2 hours
            });
          }
        } catch {
          // periodic-background-sync not supported on this browser — silent fail
        }
      }

      // ── Background Sync: retry queued offline mutations ───────────────────
      if ("sync" in registration) {
        // Pre-register the tag; the SW will replay as soon as the device is online
        registration.sync.register("sync-pending-requests").catch(() => {});
      }
    } catch {
      // SW registration failed — app still works, just no offline support
    }
  });

  // ── Messages from the Service Worker → in-app UI ─────────────────────────
  navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, title, body, resource } = event.data || {};

    if (type === "PUSH_NOTIFICATION") {
      // Push arrived while app is open → show toast instead of system notification
      toast(body || title, {
        duration: 6000,
        icon: "🔔",
        style: { fontWeight: "500" },
      });
    }

    if (type === "PERIODIC_SYNC") {
      // Periodic sync fired → silently ask React query/store to re-fetch
      window.dispatchEvent(new CustomEvent("propcrm:refresh", { detail: { resource } }));
    }
  });
}

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
          <Toaster position="top-right" />
        </BrowserRouter>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Fade out splash only after BOTH conditions are met:
//  1. React has painted its first frame (double rAF)
//  2. At least 1.8s has passed so the animation is actually visible
const reactReady = new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});
const minDisplay = new Promise((resolve) => setTimeout(resolve, 1800));

Promise.all([reactReady, minDisplay]).then(() => {
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.classList.add("splash-hidden");
    setTimeout(() => splash.remove(), 600);
  }
});
