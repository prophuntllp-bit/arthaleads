// utils/firebase.js
// Safe lazy initialization — only runs if all 4 VITE_FIREBASE_* env vars are present.
// If any are missing (e.g. before you add them to Vercel), auth = null and
// firebaseReady = false so the OTP tab is hidden and the app never crashes.
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

export let auth = null;
export let firebaseReady = false;

const _key      = import.meta.env.VITE_FIREBASE_API_KEY;
const _domain   = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const _project  = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const _appId    = import.meta.env.VITE_FIREBASE_APP_ID;

if (_key && _domain && _project && _appId) {
  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ apiKey: _key, authDomain: _domain, projectId: _project, appId: _appId });
    auth = getAuth(app);
    // Disable client-side reCAPTCHA — Firebase backend still validates OTPs.
    // Remove this line only after setting up reCAPTCHA Enterprise site key.
    auth.settings.appVerificationDisabledForTesting = true;
    firebaseReady = true;
  } catch (e) {
    // Never crash the app — OTP features are just hidden
    console.warn("[firebase] init failed:", e.message);
  }
}
