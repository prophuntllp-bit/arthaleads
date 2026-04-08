// PropCRM Service Worker — PWA + Web Push notifications
const CACHE_NAME = "propcrm-v5";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: try network, fall back to cache
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Web Push ──────────────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { title: "PropCRM", body: e.data?.text() || "" }; }

  const title = data.title || "PropCRM";
  const body  = data.body  || "You have a new update";
  const notifData = { url: "/leads", ...data.data };

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is open in a focused tab → send message so it shows an in-app toast
      const focusedClient = clientList.find((c) => c.focused);
      if (focusedClient) {
        focusedClient.postMessage({ type: "PUSH_NOTIFICATION", title, body, data: notifData });
        // Also show system notification for non-focused open tabs
        const unfocused = clientList.filter((c) => !c.focused);
        if (!unfocused.length) return; // only focused tab open — toast is enough
      }

      // Show system notification (background or unfocused tab)
      return self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        vibrate: [200, 100, 200],
        tag: `${data.type || "propcrm"}-${Date.now()}`, // unique tag so notifications stack
        requireInteraction: true, // stays until user taps — won't disappear silently
        silent: false,
        data: notifData,
      });
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || "/leads";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
