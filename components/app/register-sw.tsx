"use client";

import { useEffect } from "react";

/** Registers the do-nothing service worker (public/sw.js) so phones can install ORA as an app.
 *  Production only — a dev server shouldn't have a worker hanging around. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* not available here (private mode, old browser) — the site works the same without it */
    });
  }, []);
  return null;
}
