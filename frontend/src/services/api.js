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
    const status = err.response?.status;
    const msg    = err.response?.data?.message;

    if (status === 401) {
      // Token expired or invalid — clear session, show one friendly toast, and redirect.
      // Return a never-resolving promise so component .catch() blocks never fire —
      // prevents misleading "Failed to load X" toasts when the real issue is an expired session.
      // Only show the toast when a session was previously stored — avoids showing "session
      // expired" on a fresh page load (e.g. user has never logged in or just logged out).
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
