// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => JSON.parse(localStorage.getItem("crm_user") || "null"));
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((nextUser) => {
    localStorage.setItem("crm_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  // Re-validate token on mount
  useEffect(() => {
    const token = localStorage.getItem("crm_token");
    if (!token) { setLoading(false); return; }

    api.get("/auth/me")
      .then((r) => persistUser(r.data.user))
      .catch(() => { localStorage.clear(); setUser(null); })
      .finally(() => setLoading(false));
  }, [persistUser]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("crm_token", data.token);
    persistUser(data.user);
    return data;
  }, [persistUser]);

  const signup = useCallback(async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("crm_token", data.token);
    persistUser(data.user);
    return data;
  }, [persistUser]);

  const googleLogin = useCallback(async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    localStorage.setItem("crm_token", data.token);
    persistUser(data.user);
    return data;
  }, [persistUser]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    persistUser(data.user);
    return data.user;
  }, [persistUser]);

  const updateUserState = useCallback((nextUser) => {
    persistUser(nextUser);
  }, [persistUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, googleLogin, logout, refreshUser, updateUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
