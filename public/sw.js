/// <reference lib="webworker" />

const CACHE_NAME = "f-guild-v1";

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
