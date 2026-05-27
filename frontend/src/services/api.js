import axios from "axios";

const api = axios.create({
  baseURL:          import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout:          45000,      // 45s - handles Railway cold-start (~20-30s)
  withCredentials:  true,       // send httpOnly cookie on every request (XSS-safe auth)
});

// Propagate blocking org-level 403s as window events so overlays can react
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403) {
      const msg = err.response?.data?.message;
      if (msg === "ORGANISATION_INACTIVE") window.dispatchEvent(new CustomEvent("org:inactive"));
      if (msg === "TRIAL_EXPIRED")         window.dispatchEvent(new CustomEvent("trial:expired"));
    }
    return Promise.reject(err);
  }
);

export default api;
