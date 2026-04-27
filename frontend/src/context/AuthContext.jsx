// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("crm_user") || "null"));
  const [org,  setOrg]  = useState(() => JSON.parse(localStorage.getItem("crm_org")  || "null"));
  const [loading, setLoading] = useState(true);

  const persist = useCallback((nextUser, nextOrg) => {
    localStorage.setItem("crm_user", JSON.stringify(nextUser));
    localStorage.setItem("crm_org",  JSON.stringify(nextOrg || null));
    setUser(nextUser);
    setOrg(nextOrg || null);
  }, []);

  // Re-validate token on mount
  useEffect(() => {
    const token = localStorage.getItem("crm_token");
    if (!token) { setLoading(false); return; }

    api.get("/auth/me")
      .then((r) => persist(r.data.user, r.data.org))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.clear();
          setUser(null);
          setOrg(null);
        }
      })
      .finally(() => setLoading(false));
  }, [persist]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("crm_token", data.token);
    persist(data.user, data.org);
    return data;
  }, [persist]);

  const signup = useCallback(async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("crm_token", data.token);
    persist(data.user, data.org);
    return data;
  }, [persist]);

  const googleLogin = useCallback(async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    localStorage.setItem("crm_token", data.token);
    persist(data.user, data.org);
    return data;
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

  const logout = useCallback(() => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    localStorage.removeItem("crm_org");
    setUser(null);
    setOrg(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, org, loading, login, signup, googleLogin, logout, refreshUser, updateUserState, updateOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
