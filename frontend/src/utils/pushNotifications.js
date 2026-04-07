// utils/pushNotifications.js — Web Push subscription helpers
import api from "../services/api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;

    // Get VAPID public key from backend
    const { data } = await api.get("/push/vapid-public-key");
    if (!data.key) return;

    const applicationServerKey = urlBase64ToUint8Array(data.key);

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }

    // Send subscription to backend
    const subJson = sub.toJSON();
    await api.post("/push/subscribe", {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });
  } catch (err) {
    console.warn("Push subscription failed:", err.message);
  }
}
