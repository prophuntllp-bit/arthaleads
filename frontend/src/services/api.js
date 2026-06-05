import axios from "axios";
import toast from "react-hot-toast";

// ── Storage helpers ───────────────────────────────────────────────────────────
// iOS Safari in Private Mode throws QuotaExceededError on localStorage writes
// and Apple's ITP evicts localStorage data after 7 days of no site interaction.
// These helpers fall back to sessionStorage so auth tokens survive both scenarios.
function storageGet(key) {
  try { const v = localStorage.getItem(key); if (v !== null) return v; } catch {}
  try { return sessionStorage.getItem(key); } catch {}
  return null;
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

// ── Auth-in-progress flag ─────────────────────────────────────────────────────
// Set to true while a login / signup / google / phone-login call is in flight.
// Prevents a concurrent /auth/me 401 (Railway cold-start race) from firing the
// session-expired flow and kicking the user out right after they authenticated.
// Toggled by AuthContext via setAuthInProgress().
let _authInProgress = false;
let _authCompletedAt = 0; // timestamp when last auth call finished

export function setAuthInProgress(v) {
  _authInProgress = v;
  if (!v) _authCompletedAt = Date.now(); // record when auth finished
}

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout:         45000,     // 45s - handles Railway cold-start (~20-30s)
  withCredentials: true,      // send httpOnly cookie on every request (XSS-safe auth)
});

// Bearer token fallback — check localStorage first, sessionStorage second.
// Covers: cross-domain cookie rejection, iOS Private Mode, and ITP eviction.
api.interceptors.request.use((config) => {
  const t = storageGet("_at");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Propagate auth failures and org-level blocks as window events
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Aborted requests (e.g. /auth/me cancelled by a concurrent login) must be
    // ignored entirely — do not treat them as auth failures.
    if (axios.isCancel(err)) return Promise.reject(err);

    const status = err.response?.status;
    const msg    = err.response?.data?.message;

    if (status === 401) {
      // Auth endpoints (login, signup, OTP verify) return 401 for bad credentials —
      // those must propagate so the form can show the error message.
      const isAuthEndpoint = /\/auth\/(login|signup|otp\/verify|google|phone-login)/.test(err.config?.url || "");
      if (isAuthEndpoint) return Promise.reject(err);

      // A login/signup/google/phone auth call is actively in flight — swallow the
      // 401 silently. This happens when /auth/me returns 401 (Railway cold-start or
      // stale cookie) after login() already succeeded but the abort signal arrived at
      // the network layer a fraction too late. Without this guard the session-expired
      // toast fires 1-2 seconds after "Welcome back!" on cold Railway boots.
      if (_authInProgress) return new Promise(() => {});

      // Grace period: Android WebView (Capacitor) sometimes doesn't honour
      // AbortController for in-flight XHR, so the /auth/me 401 can arrive AFTER
      // login() has already returned and cleared _authInProgress. Silently ignore
      // any 401 that arrives within 3 seconds of a completed auth call.
      if (_authCompletedAt && Date.now() - _authCompletedAt < 3000) return new Promise(() => {});

      // All other 401s mean the session expired — clear state, show one toast, redirect.
      // Return a never-resolving promise so component .catch() blocks never fire and
      // don't show misleading "Failed to load X" errors when the real issue is an expired session.
      const hadSession = !!storageGet("crm_user");
      storageRemove("crm_user");
      storageRemove("crm_org");
      storageRemove("_at");

      // Never show "session expired" when the user is already on an auth page.
      // Scenario: stale crm_user in localStorage → /auth/me returns 401 on mount →
      // user is already on /login and about to sign in → the toast fires BEFORE
      // login() can abort the request, causing both toasts to appear simultaneously.
      const onAuthPage = /^\/(login|signup|forgot-password|reset-password)/.test(window.location.pathname);
      if (hadSession && !onAuthPage) {
        toast.error("Your session has expired. Please log in again.", { id: "session-expired" });
      }
      window.dispatchEvent(new CustomEvent("auth:expired"));
      return new Promise(() => {});
    }

    if (status === 403) {
      if (msg === "ORGANISATION_INACTIVE") window.dispatchEvent(new CustomEvent("org:inactive"));
      if (msg === "TRIAL_EXPIRED")         window.dispatchEvent(new CustomEvent("trial:expired"));
    }

    return Promise.reject(err);
  }
);

export default api;
