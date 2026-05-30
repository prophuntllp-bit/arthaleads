import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL:          import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout:          45000,      // 45s - handles Railway cold-start (~20-30s)
  withCredentials:  true,       // send httpOnly cookie on every request (XSS-safe auth)
});

// Bearer token fallback — used when the httpOnly cookie cannot be stored
// (e.g. API domain differs from frontend domain so browser rejects Set-Cookie).
// The backend already accepts Authorization: Bearer <token> as a second auth path.
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("_at");
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

      // All other 401s mean the session expired — clear state, show one toast, redirect.
      // Return a never-resolving promise so component .catch() blocks never fire and
      // don't show misleading "Failed to load X" errors when the real issue is an expired session.
      const hadSession = !!localStorage.getItem("crm_user");
      localStorage.removeItem("crm_user");
      localStorage.removeItem("crm_org");
      localStorage.removeItem("_at");
      if (hadSession) {
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
