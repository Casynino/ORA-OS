// Deliberately tiny. It exists so Chrome on Android treats ORA as an installable app (the
// "Install app" prompt / full-screen launch from the home screen). It caches nothing and
// changes nothing: every request still goes straight to the network, so pages are never stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
