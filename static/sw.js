const CACHE_NAME = "kisanai-pwa-v1";

const APP_SHELL = [
    "/",
    "/static/manifest.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    // Never interfere with API/backend requests.
    if (
        request.url.includes("/api/") ||
        request.url.includes("/set_session") ||
        request.url.includes("/logout") ||
        request.url.includes("/signout")
    ) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {
                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }

                return response;
            })
            .catch(() => caches.match(request))
    );
});