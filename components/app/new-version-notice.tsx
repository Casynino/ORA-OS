"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BUILD_ID } from "@/lib/build-id";

/**
 * "A new update is available."
 *
 * After every deploy, someone was being told to hard-refresh before they could
 * see a fix — and the people who most need the fix are the least likely to think
 * of that. So the page checks for itself: it compares the build it loaded with
 * against the one the server is now serving, and when they differ it OFFERS a
 * reload rather than forcing one (never pull a half-typed form out from under
 * someone). BUILD_ID is imported here in a client module so it's the build-time
 * value the page actually loaded — not the server's current one.
 *
 * Checked when the tab is looked at again (focus / visibility) plus a slow 5-min
 * timer, not a fast poll — staff leave this open all day beside WhatsApp, and a
 * per-second poll would be thousands of requests to answer a question that
 * changes twice a day.
 */
const EVERY = 5 * 60 * 1000;

export function NewVersionNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // A dev server rebuilds constantly and would cry wolf all day.
    if (BUILD_ID === "development") return;

    let alive = true;

    async function check() {
      if (!alive || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        // Only ever SET stale — a later network hiccup answering with the old
        // build must not make the banner flicker away once a new one exists.
        if (alive && data.build && data.build !== BUILD_ID) setStale(true);
      } catch {
        // Offline, or a deploy mid-flight. Silence is right: this is a
        // convenience and must never interrupt someone's work to report itself.
      }
    }

    const timer = setInterval(check, EVERY);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    check();

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex justify-end print:hidden">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-soft backdrop-blur">
        <span className="text-sm font-medium">A new update is available.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-3.5" /> Reload
        </button>
      </div>
    </div>
  );
}
