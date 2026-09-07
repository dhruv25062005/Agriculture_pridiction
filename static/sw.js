// KisanAI Progressive Web App Service Worker
const CACHE_NAME = "kisan-ai-cache-v2";

const PRECACHE_URLS = [
  "/signedin",
  "/template",
  "/static/manifest.json",
  "/static/smart_agri_hero.webp",
  "/static/smart_agri_hero.jpg",
  "/static/js/3d-engine.js",
  "/static/js/translations.js",
  "/static/js/firebase-config.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png"
];

// Install: pre-cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("🌾 KisanAI Service Worker: Pre-caching offline application shell");
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("PWA pre-cache notice (non-blocking):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: cleanup stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("🧹 Clearing old service worker cache:", name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for static assets, Network-First for APIs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome extensions
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // API calls: Network-First with offline fallback
  if (url.pathname.startsWith("/predict") || url.pathname.startsWith("/weather") || url.pathname.startsWith("/market_prices")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // App Shell & Static assets: Cache First with background network refresh
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match("/signedin") || caches.match("/template");
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
