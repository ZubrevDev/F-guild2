/// <reference lib="webworker" />

const CACHE_NAME = "f-guild-v2";

const APP_SHELL = [
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Guild", {
      body: data.body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(clients.openWindow(url));
});

// -------------------------------------------------------------------------
// Background sync — replays queued offline actions when connectivity returns
// -------------------------------------------------------------------------

/**
 * Reads pending items from the "fguild-offline" IndexedDB and posts a
 * message to all open tabs so the React layer can call processSyncQueue().
 * @returns {Promise<void>}
 */
async function syncOfflineActions() {
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("fguild-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // DB not yet initialised — nothing to sync
    return;
  }

  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction("syncQueue", "readonly");
    const store = tx.objectStore("syncQueue");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!Array.isArray(items) || items.length === 0) return;

  // Tell open tabs to run the queue through their tRPC executor
  const windowClients = await self.clients.matchAll({ type: "window" });
  for (const client of windowClients) {
    client.postMessage({ type: "SYNC_OFFLINE_ACTIONS", count: items.length });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "fguild-sync") {
    event.waitUntil(syncOfflineActions());
  }
});

// -------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!request.url.startsWith("http")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.ok &&
          (request.url.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/) ||
            request.destination === "style" ||
            request.destination === "script" ||
            request.destination === "font")
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Serve from cache if available
        return caches.match(request).then((cached) => {
          if (cached) return cached;

          // For navigation requests, show offline page
          if (request.mode === "navigate") {
            return caches.match("/offline");
          }

          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
      })
  );
});
