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
