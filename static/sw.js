// v3.1 SW: always network-first for API, cache-first for static shell
const CACHE = "eng-trainer-v3p1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    // network-first for API to avoid stale/empty data on mobile
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({cards: [], count: 0}), {headers: {"Content-Type": "application/json"}})));
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).catch(() => {
      if (request.mode === "navigate") return caches.match("/");
    }))
  );
});
