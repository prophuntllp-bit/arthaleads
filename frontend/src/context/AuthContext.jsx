// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Non-sensitive display data kept in localStorage for instant UI hydration.
  // The actual auth token lives in an httpOnly cookie - JS cannot read or steal it.
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("crm_user") || "null"));
  const [org,  setOrg]  = useState(() => JSON.parse(localStorage.getItem("crm_org")  || "null"));
  const [loading, setLoading] = useState(true);

  const persist = useCallback((nextUser, nextOrg) => {
    // Never store base64 logos in localStorage — they're several MB and silently get
    // truncated or throw QuotaExceededError, causing broken images on refresh.
    // We only persist a Cloudinary/HTTPS URL (small string); base64 stays in-memory only.
    const orgForStorage = nextOrg
      ? { ...nextOrg, logo: nextOrg.logo?.startsWith("data:") ? "" : (nextOrg.logo || "") }
      : null;
    localStorage.setItem("crm_user", JSON.stringify(nextUser));
    localStorage.setItem("crm_org",  JSON.stringify(orgForStorage));
    setUser(nextUser);
    setOrg(nextOrg || null);  // in-memory state keeps the full logo
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("crm_user");
    localStorage.removeItem("crm_org");
    setUser(null);
    setOrg(null);
  }, []);

  // Re-validate session on mount - cookie is sent automatically via withCredentials
  useEffect(() => {
    api.get("/auth/me")
      .then((r) => persist(r.data.user, r.data.org))
      .catch((err) => {
        // 401 = cookie expired/missing; 403 = org inactive or trial expired
        if (err.response?.status === 401 || err.response?.status === 403) clearSession();
      })
      .finally(() => setLoading(false));
  }, [persist, clearSession]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    // Backend sets httpOnly cookie; we only store display-safe fields locally
    persist(data.user, data.org);
    return data;
  }, [persist]);

  const signup = useCallback(async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    persist(data.user, data.org);
    return data;
  }, [persist]);

  const googleLogin = useCallback(async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    persist(data.user, data.org);
    return data;
  }, [persist]);

  const phoneLogin = useCallback(async (idToken) => {
    const { data } = await api.post("/auth/phone-login", { idToken });
    persist(data.user, data.org);
    return data;
  }, [persist]);

  // Used after backend-verified OTP — data already contains user + org
  const persistAuth = useCallback((data) => {
    persist(data.user, data.org);
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
