// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Non-sensitive display data kept in localStorage for instant UI hydration.
  // The actual auth token lives in an httpOnly cookie - JS cannot read or steal it.
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("crm_user") || "null"));
  const [org,  setOrg]  = useState(() => JSON.parse(localStorage.getItem("crm_org")  || "null"));
  const [loading, setLoading] = useState(true);

  // Holds the AbortController for the mount-time /auth/me session check.
  // Every login/signup method aborts it before completing so that a slow
  // /auth/me 401 (e.g. Railway cold-start) can never fire the session-expired
  // handler after a successful login — the root cause of the "kicked out
  // immediately after Welcome back!" race condition.
  const authMeControllerRef = useRef(null);

  const persist = useCallback((nextUser, nextOrg, token) => {
    // Never store base64 logos in localStorage — they're several MB and silently get
    // truncated or throw QuotaExceededError, causing broken images on refresh.
    // We only persist a Cloudinary/HTTPS URL (small string); base64 stays in-memory only.
    const orgForStorage = nextOrg
      ? { ...nextOrg, logo: nextOrg.logo?.startsWith("data:") ? "" : (nextOrg.logo || "") }
      : null;
    localStorage.setItem("crm_user", JSON.stringify(nextUser));
    localStorage.setItem("crm_org",  JSON.stringify(orgForStorage));
    // Bearer token fallback for cross-domain environments where the httpOnly cookie
    // is rejected by the browser (backend on railway.app, frontend on arthaleads.com).
    if (token) localStorage.setItem("_at", token);
    setUser(nextUser);
    setOrg(nextOrg || null);  // in-memory state keeps the full logo
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("crm_user");
    localStorage.removeItem("crm_org");
    localStorage.removeItem("_at");
    setUser(null);
    setOrg(null);
  }, []);

  // Re-validate session on mount - cookie is sent automatically via withCredentials.
  // We attach an AbortSignal so login/signup can cancel this request before it settles.
  useEffect(() => {
    const controller = new AbortController();
    authMeControllerRef.current = controller;

    api.get("/auth/me", { signal: controller.signal })
      .then((r) => persist(r.data.user, r.data.org))
      .catch((err) => {
        // Request was aborted by a login/signup call — the user is now authenticated,
        // so we simply ignore this error and let the login flow complete normally.
        if (axios.isCancel(err)) return;

        const status = err.response?.status;
        const msg    = err.response?.data?.message;
        // 401 is handled by the api.js interceptor (dispatches auth:expired below).
        // Handle 403 org-level blocks here so the correct overlay is shown.
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

  const login = useCallback(async (email, password) => {
    // Cancel any pending /auth/me — prevents its eventual 401 from firing the
    // session-expired handler after this login succeeds (race condition fix).
    authMeControllerRef.current?.abort();
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.user, data.org, data.token);
    return data;
  }, [persist]);

  const signup = useCallback(async (payload) => {
    authMeControllerRef.current?.abort();
    const { data } = await api.post("/auth/signup", payload);
    persist(data.user, data.org, data.token);
    return data;
  }, [persist]);

  const googleLogin = useCallback(async (credential) => {
    authMeControllerRef.current?.abort();
    const { data } = await api.post("/auth/google", { credential });
    persist(data.user, data.org, data.token);
    return data;
  }, [persist]);

  const phoneLogin = useCallback(async (idToken) => {
    authMeControllerRef.current?.abort();
    const { data } = await api.post("/auth/phone-login", { idToken });
    persist(data.user, data.org, data.token);
    return data;
  }, [persist]);

  // Used after backend-verified OTP — data already contains user + org + token
  const persistAuth = useCallback((data) => {
    authMeControllerRef.current?.abort();
    persist(data.user, data.org, data.token);
  }, [persist]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    persist(data.user, data.org);
    return data.user;
  }, [persist]);

  const updateUserState = useCallback((nextUser) => {
    persist(nextUser, org);
  }, [persist, org]);

  const updateOrg = useCallback((nextOrg) => {
    localStorage.setItem("crm_org", JSON.stringify(nextOrg));
    setOrg(nextOrg);
  }, []);

  const logout = useCallback(async () => {
    // Clear cookie first (httpOnly — only the server can remove it).
    // clearSession() after so the re-render races don't matter —
    // window.location.href in the caller tears down React before paint.
    try {
      await api.post("/auth/logout");
    } catch {
      // Proceed even if request fails (offline)
    }
    localStorage.removeItem("_at");
    clearSession();
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
