// KisanAI service worker: cache public static assets only.
// IMPORTANT: navigation/authenticated requests are intentionally NOT intercepted.
// This prevents a service-worker fetch rejection from turning normal server errors
// into misleading "Failed to fetch" errors on /signedin and API endpoints.
const CACHE_NAME = "kisan-ai-cache-v7";
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

  // Never intercept page navigation. The browser must receive the real
  // /signin, /signedin, 4xx, 5xx, redirect, and server response directly.
  if (event.request.mode === "navigate") return;

  const isAuthenticated =
    url.pathname === "/api/" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/scan_history") ||
    url.pathname.startsWith("/predict") ||
    url.pathname.startsWith("/weather") ||
    url.pathname.startsWith("/market_prices") ||
    url.pathname.startsWith("/plot_fertilizer") ||
    url.pathname.startsWith("/calculate_profit") ||
    url.pathname === "/set_session" ||
    url.pathname === "/signout" ||
    url.pathname === "/logout";

  // Never intercept authenticated/API traffic. This also means a temporary
  // network failure is handled by the browser/app rather than by SW logic.
  if (isAuthenticated) return;

  // Firebase configuration must never be served from a stale cache.
  if (url.pathname === "/static/js/firebase-config.js") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, response.clone()))
              .catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }
});
