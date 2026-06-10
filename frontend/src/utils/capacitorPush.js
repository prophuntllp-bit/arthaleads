// utils/capacitorPush.js
// FCM push notifications for the Capacitor Android APK.
// All code is no-op when running in a browser or PWA — safe to import everywhere.
import api from "../services/api";

// Detect Capacitor native context — window.Capacitor is injected by the native
// layer; it is undefined in any browser or PWA context.
export const isCapacitorNative =
  typeof window !== "undefined" && !!window?.Capacitor?.isNativePlatform?.();

let _currentToken = null;

/**
 * Set up FCM push for the Capacitor Android APK.
 *
 * - Creates a high-importance "Leads" notification channel so alerts pop up
 *   immediately on screen (heads-up / banner notification).
 * - Requests permission, registers with FCM, and sends the token to the backend.
 * - Handles foreground push (shows in-app toast).
 * - Handles notification tap (navigates to the URL in the notification data).
 *
 * Called once after the user authenticates (from App.jsx RequireAuth).
 * Safe to call multiple times — listeners are idempotent.
 */
export async function setupCapacitorPush() {
  if (!isCapacitorNative) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // ── Notification channel (Android 8+) ─────────────────────────────────────
    // IMPORTANCE_HIGH (5) = heads-up banner + sound + vibration — required for
    // instant lead alerts that appear even when the phone is locked/screen off.
    await PushNotifications.createChannel({
      id:          "leads",
      name:        "Lead Notifications",
      description: "Instant alerts when new leads are assigned",
      importance:  5,      // IMPORTANCE_HIGH
      visibility:  1,      // VISIBILITY_PUBLIC — shows on lock screen
      sound:       "default",
      vibration:   true,
      lights:      true,
    });

    // ── Permission ────────────────────────────────────────────────────────────
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt") {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== "granted") {
      console.warn("[capacitorPush] Permission not granted:", status.receive);
      return;
    }

    // ── Register with FCM ─────────────────────────────────────────────────────
    // Triggers the "registration" event below with the FCM token.
    await PushNotifications.register();

    // ── FCM token received ────────────────────────────────────────────────────
    // Send token to backend so the server can target this device.
    // Uses upsert so calling register() repeatedly is safe.
    PushNotifications.addListener("registration", async ({ value: token }) => {
      if (_currentToken === token) return; // already registered this session
      _currentToken = token;
      try {
        await api.post("/push/fcm-token", { token, platform: "android" });
        console.log("[capacitorPush] FCM token registered");
      } catch (err) {
        console.warn("[capacitorPush] Token registration failed:", err.message);
      }
    });

    PushNotifications.addListener("registrationError", ({ error }) => {
      console.warn("[capacitorPush] FCM registration error:", error);
    });

    // ── Foreground notification ───────────────────────────────────────────────
    // When a push arrives while the app is open, show a toast so the agent
    // sees it immediately without leaving the current screen.
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const { title, body } = notification;
      // Dynamically import toast to avoid circular deps — safe in Capacitor context
      import("react-hot-toast").then(({ default: toast }) => {
        toast(
          `${title || "New notification"}\n${body || ""}`.trim(),
          { duration: 6000, icon: "🔔" }
        );
      }).catch(() => {});
    });

    // ── Notification tap ──────────────────────────────────────────────────────
    // When the user taps a notification in the Android tray, navigate to the
    // URL embedded in the notification data (e.g. "/leads").
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (url) {
        // Use replace so tapping back doesn't re-navigate to the notification target
        window.location.replace(url);
      }
    });

  } catch (err) {
    console.warn("[capacitorPush] Setup failed:", err.message);
  }
}

/**
 * Unregister the current FCM token on logout so the device stops receiving
 * push notifications for this user's session.
 */
export async function unregisterCapacitorPush() {
  if (!isCapacitorNative || !_currentToken) return;
  try {
    await api.delete("/push/fcm-token", { data: { token: _currentToken } });
    _currentToken = null;
  } catch {
    // Silently ignore — token will expire naturally
  }
}
