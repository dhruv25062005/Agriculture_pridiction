// KisanAI service worker is intentionally disabled for now.
// The application uses live authentication, Firestore and Gemini APIs, so
// intercepting requests can turn normal network/server responses into opaque
// "Failed to fetch" errors. Keep this worker as a harmless compatibility
// worker so browsers that already installed an older worker can replace it.
const KISANAI_SW_VERSION = "disabled-2026-09-10-v1";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Deliberately NO fetch handler.
// Every navigation, authentication request, API request and static asset goes
// directly to the network/browser default handling.
