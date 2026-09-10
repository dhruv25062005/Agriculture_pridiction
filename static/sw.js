// KisanAI service worker: cache public static assets only.
const CACHE_NAME = "kisan-ai-cache-v3";
const PRECACHE_URLS = [
  "/static/manifest.json",
  "/static/smart_agri_hero.webp",
  "/static/smart_agri_hero.jpg",
  "/static/js/3d-engine.js",
  "/static/js/translations.js",
  "/static/js/firebase-config.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS).catch(()=>{})).then(()=>self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !/^https?:$/.test(url.protocol)) return;
  // Never cache authenticated pages, API responses, user data, uploads or history.
  if (url.pathname === "/signedin" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/scan_history") || url.pathname.startsWith("/predict") || url.pathname.startsWith("/weather") || url.pathname.startsWith("/market_prices") || url.pathname.startsWith("/plot_fertilizer") || url.pathname.startsWith("/calculate_profit")) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if(response.ok)caches.open(CACHE_NAME).then(c=>c.put(event.request,response.clone())); return response; })));
    return;
  }
  // Do not cache arbitrary navigation responses; this avoids persisting signed-in HTML.
  event.respondWith(fetch(event.request));
});
