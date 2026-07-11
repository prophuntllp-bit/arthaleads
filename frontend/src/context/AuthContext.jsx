// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api, { setAuthInProgress, setToken } from "../services/api";
import axios from "axios";

const AuthContext = createContext(null);

// ── Storage helpers ───────────────────────────────────────────────────────────
// iOS Safari Private Mode throws QuotaExceededError on localStorage writes.
// Apple ITP evicts localStorage after 7 days of no site interaction.
// Solution: try localStorage first; on failure fall back to sessionStorage so
// the session survives both Private Mode and ITP within the same browser tab.
function storageSave(key, value) {
  try { localStorage.setItem(key, value); return; } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
}
function storageGet(key) {
  try { const v = localStorage.getItem(key); if (v !== null) return v; } catch {}
  try { return sessionStorage.getItem(key); } catch {}
  return null;
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

export function AuthProvider({ children }) {
  // Seed state from whichever storage has the value (localStorage or sessionStorage fallback).
  // Non-sensitive display data only — the real auth token lives in an httpOnly cookie.
  const [user, setUser] = useState(() => { try { return JSON.parse(storageGet("crm_user") || "null"); } catch { return null; } });
  const [org,  setOrg]  = useState(() => { try { return JSON.parse(storageGet("crm_org")  || "null"); } catch { return null; } });
  const [loading, setLoading] = useState(true);

  // Holds the AbortController for the mount-time /auth/me session check.
  // Every auth method aborts it before completing so that a slow /auth/me 401
  // (Railway cold-start) can never fire the session-expired handler after a
  // successful login — the root cause of the "kicked out after Welcome back!" bug.
  const authMeControllerRef = useRef(null);

  const persist = useCallback((nextUser, nextOrg, token) => {
    // Never store base64 logos — they're several MB and cause QuotaExceededError.
    // Only persist a Cloudinary/HTTPS URL; base64 stays in-memory only.
    const orgForStorage = nextOrg
      ? { ...nextOrg, logo: nextOrg.logo?.startsWith("data:") ? "" : (nextOrg.logo || "") }
      : null;
    storageSave("crm_user", JSON.stringify(nextUser));
    storageSave("crm_org",  JSON.stringify(orgForStorage));
    // Keep in-memory token in sync so requests work even when localStorage
    // reads fail (Samsung Android storage restrictions, privacy extensions).
    if (token) setToken(token);
    setUser(nextUser);
    setOrg(nextOrg || null);  // in-memory state keeps the full base64 logo
    setLoading(false);
  }, []);

  const clearSession = useCallback(() => {
    storageRemove("crm_user");
    storageRemove("crm_org");
    setToken(null); // clears both _memToken and storage
    setUser(null);
    setOrg(null);
  }, []);

  // Re-validate session on mount - cookie is sent automatically via withCredentials.
  // AbortSignal lets login/signup cancel this request before it settles.
  useEffect(() => {
    const controller = new AbortController();
    authMeControllerRef.current = controller;

    api.get("/auth/me", { signal: controller.signal })
      .then((r) => persist(r.data.user, r.data.org))
      .catch((err) => {
        // Aborted by a login/signup call — user is now authenticated, ignore.
        if (axios.isCancel(err)) return;
        const status = err.response?.status;
        const msg    = err.response?.data?.message;
        // 401 is handled by the api.js interceptor (dispatches auth:expired).
        // Handle 403 org-level blocks here so the correct overlay is shown on mount.
        if (status === 403) {
          if (msg === "TRIAL_EXPIRED")         window.dispatchEvent(new CustomEvent("trial:expired"));
          if (msg === "ORGANISATION_INACTIVE") window.dispatchEvent(new CustomEvent("org:inactive"));
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [persist, clearSession]);

  // Global 401 handler — any API call with an expired/invalid token fires this.
  // Also calls setLoading(false) so RequireAuth can redirect to login even when
  // the never-resolving promise in api.js swallows /auth/me's .finally() call.
  useEffect(() => {
    const onExpired = () => { clearSession(); setLoading(false); };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [clearSession]);

  // ── withAuthInProgress ────────────────────────────────────────────────────────
  // Wraps every auth API call (login, signup, google, phone, OTP):
  //   1. Sets _authInProgress=true so the api.js 401 interceptor silences any
  //      concurrent /auth/me 401 (Railway cold-start race — Scenario A).
  //   2. Aborts any pending /auth/me before the auth call fires.
  //   3. Clears the flag in finally so normal 401 handling resumes afterward.
  const withAuthInProgress = useCallback(async (fn) => {
    setAuthInProgress(true);
    authMeControllerRef.current?.abort();
    try {
      return await fn();
    } finally {
      setAuthInProgress(false);
    }
  }, []);

  const login = useCallback((email, password, recaptchaToken) =>
    withAuthInProgress(async () => {
      const { data } = await api.post("/auth/login", { email, password, recaptchaToken });
      persist(data.user, data.org, data.token);
      return data;
    }), [withAuthInProgress, persist]);

  const signup = useCallback((payload) =>
    withAuthInProgress(async () => {
      const { data } = await api.post("/auth/signup", payload);
      persist(data.user, data.org, data.token);
      return data;
    }), [withAuthInProgress, persist]);

  const googleLogin = useCallback((credential) =>
    withAuthInProgress(async () => {
      const { data } = await api.post("/auth/google", { credential });
      persist(data.user, data.org, data.token);
      return data;
    }), [withAuthInProgress, persist]);

  const phoneLogin = useCallback((idToken) =>
    withAuthInProgress(async () => {
      const { data } = await api.post("/auth/phone-login", { idToken });
      persist(data.user, data.org, data.token);
      return data;
    }), [withAuthInProgress, persist]);

  // Used after backend-verified OTP — data already contains user + org + token.
  const persistAuth = useCallback((data) =>
    withAuthInProgress(async () => {
      persist(data.user, data.org, data.token);
    }), [withAuthInProgress, persist]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    persist(data.user, data.org);
    return data.user;
  }, [persist]);

  const updateUserState = useCallback((nextUser) => {
    persist(nextUser, org);
  }, [persist, org]);

  const updateOrg = useCallback((nextOrg) => {
    storageSave("crm_org", JSON.stringify(nextOrg));
    setOrg(nextOrg);
  }, []);

  const logout = useCallback(async () => {
    // Clear cookie first (httpOnly — only the server can remove it).
    try { await api.post("/auth/logout"); } catch { /* proceed even if offline */ }
    clearSession(); // clears both localStorage and sessionStorage via storageRemove
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, org, loading, login, signup, googleLogin, phoneLogin, persistAuth, logout, refreshUser, updateUserState, updateOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
