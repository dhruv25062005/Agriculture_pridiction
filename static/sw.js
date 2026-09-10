// KisanAI service worker: cache public static assets only.
const CACHE_NAME = "kisan-ai-cache-v5";
const PRECACHE_URLS = [
  "/static/manifest.json",
  "/static/smart_agri_hero.webp",
  "/static/smart_agri_hero.jpg",
  "/static/js/3d-engine.js",
  "/static/js/translations.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !/^https?:$/.test(url.protocol)) return;

  const isAuthenticated =
    url.pathname === "/signedin" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/scan_history") ||
    url.pathname.startsWith("/predict") ||
    url.pathname.startsWith("/weather") ||
    url.pathname.startsWith("/market_prices") ||
    url.pathname.startsWith("/plot_fertilizer") ||
    url.pathname.startsWith("/calculate_profit");

  // Navigations must remain real network responses. A synthetic 503 here makes
  // Chrome report a misleading HTTP failure when the network is temporarily down.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAuthenticated) {
    event.respondWith(fetch(event.request).catch(error => {
      console.warn("KisanAI authenticated request failed:", url.pathname, error?.message || error);
      return new Response("Network unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
    }));
    return;
  }

  if (url.pathname === "/static/js/firebase-config.js") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => new Response("Firebase configuration unavailable", { status: 503, headers: { "Content-Type": "text/plain" } })));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())).catch(() => {});
          return response;
        });
      }).catch(() => new Response("Asset unavailable", { status: 503 }))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
