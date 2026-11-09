"use client";

import { useEffect } from "react";

/** Registers the service worker (public/sw.js: stores nothing; only shows "No internet" when a page cannot load) so phones can install ORA as an app.
 *  Production only — a dev server shouldn't have a worker hanging around. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const go = () =>
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* not available here (private mode, old browser) — the site works the same without it */
      });
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
