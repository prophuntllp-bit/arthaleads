// Arthaleads Service Worker - PWA + Web Push + Background Sync + Periodic Sync
// v2: v1 had cached opaque cross-origin responses, which are padded against
// the storage quota and can never be read back usefully. Renaming the cache
// makes the activate handler above delete the old one on next load.
const CACHE_NAME = "arthaleads-v2";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/offline.html"];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch - Network-first, fall back to cache ─────────────────────────────────
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return;

  // Same-origin only. Cross-origin images -- org logos on a CDN, Google
  // profile pictures -- have no business coming through here:
  //
  //   * an <img> request is no-cors, so the response is opaque. Caching one is
  //     allowed but each entry is padded to several MB against the quota, and
  //     it can never be inspected or revalidated.
  //   * worse, anything that goes wrong below turns a request the browser
  //     would have handled itself into a hard load error, and an <img> has no
  //     way to tell that apart from a missing file.
  //
  // Letting them go straight to the network is both simpler and what the
  // browser already does well. This is also why a hard reload "fixed" a
  // missing logo: it bypasses the service worker entirely.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(e.request.url).origin === self.location.origin;
  } catch { sameOrigin = false; }
  if (!sameOrigin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        // Navigation requests get the offline page as last resort
        if (e.request.mode === "navigate") {
          const offline = await caches.match("/offline.html");
          if (offline) return offline;
        }
        // Returning undefined from respondWith is itself a network error, so
        // say so explicitly rather than leaving the caller to infer it.
        return Response.error();
      })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
// Retries queued API mutations (lead updates, remarks, follow-ups) that
// failed while the device was offline.
const SYNC_STORE = "arthaleads-pending-sync";

self.addEventListener("sync", (e) => {
  if (e.tag === "sync-pending-requests") {
    e.waitUntil(replayPendingRequests());
  }
});

async function replayPendingRequests() {
  let db;
  try {
    db = await openSyncDB();
    const tx  = db.transaction(SYNC_STORE, "readwrite");
    const store = tx.objectStore(SYNC_STORE);
    const all = await idbGetAll(store);

    for (const item of all) {
      try {
        const res = await fetch(item.url, {
          method:  item.method,
          headers: item.headers,
          body:    item.body,
        });
        if (res.ok) {
          store.delete(item.id);
        }
      } catch {
        // Still offline - leave in queue, will retry next sync
      }
    }
    await tx.complete;
  } catch (err) {
    console.error("[SW] Background sync failed:", err);
  } finally {
    db?.close();
  }
}

// ── Periodic Sync ─────────────────────────────────────────────────────────────
// Fires hourly (when the OS permits) to let open tabs refresh follow-up data
// and check for new leads - no server polling, just wakes the tab.
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "check-followups") {
    e.waitUntil(notifyClientsToRefresh("followups"));
  }
  if (e.tag === "check-leads") {
    e.waitUntil(notifyClientsToRefresh("leads"));
  }
});

async function notifyClientsToRefresh(resource) {
  const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
  clientList.forEach((c) =>
    c.postMessage({ type: "PERIODIC_SYNC", resource })
  );
}

// ── Web Push ──────────────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = {}; }

  const title     = data.title || "Arthaleads";
  const body      = data.body  || "You have a new notification";
  const notifData = { url: "/leads", ...(data.data || {}) };

  const showNotif = self.registration.showNotification(title, {
    body,
    icon:    "/icons/icon-192x192.png",
    badge:   "/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    tag:     `arthaleads-${Date.now()}`,
    silent:  false,
    data:    notifData,
  });

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

// ── IndexedDB helpers (no idb lib dependency) ─────────────────────────────────
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("arthaleads-sync", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(e.target.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Public helper: queue a request for background sync ────────────────────────
// Called from the app via postMessage when a fetch fails offline.
self.addEventListener("message", (e) => {
  if (e.data?.type === "QUEUE_SYNC") {
    queueRequest(e.data.payload);
  }
});

async function queueRequest({ url, method, headers, body }) {
  try {
    const db    = await openSyncDB();
    const tx    = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).add({ url, method, headers, body, queuedAt: Date.now() });
    await tx.complete;
    db.close();
    // Register the sync tag so the browser retries as soon as online
    self.registration.sync.register("sync-pending-requests").catch(() => {});
  } catch (err) {
    console.error("[SW] Failed to queue request:", err);
  }
}
