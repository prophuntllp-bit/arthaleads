// PropCRM Service Worker — PWA + Web Push notifications
const CACHE_NAME = "propcrm-v7";
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
  try { data = e.data?.json() || {}; } catch { data = {}; }

  const title = data.title || "PropCRM";
  const body  = data.body  || "You have a new notification";
  const notifData = { url: "/leads", ...(data.data || {}) };

  // Always show the system notification (works in background AND foreground)
  const showNotif = self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192x192.png",
    // badge must be a white-on-transparent monochrome PNG for Android status bar.
    // Using the full-colour 192px icon here so it renders correctly instead of
    // showing as an empty white box.
    badge: "/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    tag: `propcrm-${Date.now()}`,
    silent: false,
    data: notifData,
  });

  // Also forward to any open tabs so they can show an in-app toast
  const notifyClients = clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((list) =>
      list.forEach((c) => c.postMessage({ type: "PUSH_NOTIFICATION", title, body, data: notifData }))
    );

  e.waitUntil(Promise.all([showNotif, notifyClients]));
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
