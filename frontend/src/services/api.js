import axios from "axios";

const api = axios.create({
  baseURL:          import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout:          45000,      // 45s — handles Railway cold-start (~20-30s)
  withCredentials:  true,       // send httpOnly cookie on every request (XSS-safe auth)
});

// Propagate org-inactive 403 as a recognisable error the UI can handle
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 && err.response?.data?.message === "ORGANISATION_INACTIVE") {
      window.dispatchEvent(new CustomEvent("org:inactive"));
    }
    return Promise.reject(err);
  }
);

export default api;
