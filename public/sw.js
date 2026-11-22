// ORA service worker. It stores NOTHING on the phone (no pages, no business data) and changes no request except one thing:
// when a page cannot load because the phone has no signal, it shows a short "No internet" page instead of the browser's error.
// Its other job is to make the app installable on every phone browser: Chrome only offers its one-tap Install button to sites with a service worker.
// Third job: show ORA's alerts as pop-ups (Web Push) on devices that turned them on — it only displays the message the server sent; it keeps nothing.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b0014"><title>No internet</title>
<style>html,body{margin:0;height:100%;background:#0b0014;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
h1{margin:0;font-size:20px;font-weight:600}p{margin:0;max-width:20rem;color:rgba(255,255,255,.7);font-size:15px;line-height:1.45}
button{margin-top:6px;height:44px;padding:0 26px;border:0;border-radius:999px;background:linear-gradient(90deg,#f42aaa,#775af6);color:#fff;font-size:15px;font-weight:600}</style></head>
<body><main><h1>No internet</h1><p>ORA needs a connection. Nothing you did is lost. Check your signal or Wi-Fi, then try again.</p><button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // pictures, data and form posts go straight to the network, untouched
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })),
  );
});

// ── Alerts as pop-ups (Web Push) ────────────────────────────────────────────────────────────────────────────────────────
// The server sends { title, body, url, tag } only when an alert is created. Any open ORA page is told ("ora-notify") so its
// bell refreshes and rings straight away instead of waiting to ask.
// Safari / iPhone require every push to show a pop-up. Other browsers do not when an ORA page is open and in front (the bell
// already rings and shows a toast there), so we skip the duplicate.
const IS_SAFARI = /Safari\//.test(self.navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg\/|OPR\//.test(self.navigator.userAgent);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      wins.forEach((w) => w.postMessage({ type: "ora-notify" }));
      const inFront = wins.some((w) => w.visibilityState === "visible" && w.focused);
      if (inFront && !IS_SAFARI) return;
      await self.registration.showNotification(data.title || "ORA", {
        body: data.body || "",
        tag: data.tag || undefined,
        renotify: !!data.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: typeof data.url === "string" ? data.url : "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      let target = new URL("/", self.location.origin).href;
      try {
        const u = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
        if (u.origin === self.location.origin) target = u.href; // never open anything outside ORA
      } catch (e) {
        /* keep the home page */
      }
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          try {
            await w.focus();
            if ("navigate" in w) await w.navigate(target);
            return;
          } catch (e) {
            /* fall through and open a new window */
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
