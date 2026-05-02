import React from "react";
import ReactDOM from "react-dom/client";
import toast from "react-hot-toast";

// Register service worker and listen for foreground push messages
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });

  // When app is open and a push arrives, SW sends a message → show toast
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "PUSH_NOTIFICATION") {
      const { title, body } = event.data;
      toast(body || title, {
        duration: 6000,
        icon: "🔔",
        style: { fontWeight: "500" },
      });
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

// Fade out splash once React has painted its first frame
// Two rAF calls ensure the DOM has actually been painted before we hide
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("app-splash");
    if (splash) {
      splash.classList.add("splash-hidden");
      // Remove from DOM after the CSS transition completes (0.55s)
      setTimeout(() => splash.remove(), 600);
    }
  });
});
