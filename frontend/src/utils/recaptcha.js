// Loads Google reCAPTCHA v3 once and generates an action-scoped token.
// v3 is invisible — no checkbox/challenge — so this adds no UI friction.
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let loadPromise = null;

function loadScript() {
  if (!SITE_KEY) return Promise.resolve(null);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) return resolve(window.grecaptcha);
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Returns a token for the given action, or null if reCAPTCHA isn't
// configured (VITE_RECAPTCHA_SITE_KEY unset) or fails to load — callers
// should still submit; the backend fails closed on a missing/invalid token.
export async function getRecaptchaToken(action) {
  try {
    const grecaptcha = await loadScript();
    if (!grecaptcha) return null;
    return await grecaptcha.execute(SITE_KEY, { action });
  } catch {
    return null;
  }
}
