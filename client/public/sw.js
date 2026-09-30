// ARCHER AI — minimal service worker.
// Purpose: satisfy PWA installability (Android "Install app" / Chrome install prompt).
// It deliberately does NOT cache app files — users always get the freshest build
// (a stale cache once caused "old version" complaints). Pure passthrough.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* no interception — network only */
});
