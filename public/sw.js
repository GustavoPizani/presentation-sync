// Minimal service worker: exists only to satisfy PWA installability checks
// (Chrome/Android's "Add to Home Screen" heuristics look for a registered
// service worker with a fetch handler). No caching — every request still
// goes straight to the network, since this app is Supabase-realtime-backed
// and offline support would just mean serving a stale build.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
