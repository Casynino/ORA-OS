"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { Feed, FeedItem } from "@/components/public/live-donation-feed";

const TEMPLATES = [
  (n: string) => `Some love from ${n}`,
  (n: string) => `${n} shared love`,
  (n: string) => `A gift from ${n}`,
  (n: string) => `${n} sent love`,
  (n: string) => `Kindness from ${n}`,
  (n: string) => `With love, ${n}`,
];
function love(id: string, name: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEMPLATES[h % TEMPLATES.length](name);
}
function gift(d: FeedItem) {
  return d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`;
}

/**
 * A single plain "live pulse" line — a green dot + one donation that softly
 * cross-fades to the next, cycling the real recent gifts. No card, no chrome.
 */
export function HomeLivePulse({
  initial,
  className,
}: {
  initial: Feed;
  className?: string;
}) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [i, setI] = useState(0);

  // Refresh real data occasionally.
  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (res.ok && alive) setFeed(await res.json());
      } catch {
        /* keep last good */
      }
    }
    const t = setInterval(pull, 6000);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Advance to the next gift on a gentle cadence.
  const pool = feed.recent;
  useEffect(() => {
    if (pool.length < 1) return;
    const t = setInterval(() => setI((v) => v + 1), 3000);
    return () => clearInterval(t);
  }, [pool.length]);

  const d = pool.length ? pool[i % pool.length] : null;

  return (
    <p className={cn("flex items-center gap-2.5 text-sm text-white/55", className)}>
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-success" />
      {d ? (
        <span className="relative inline-flex h-5 items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${d.id}-${i}`}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -7 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="whitespace-nowrap"
            >
              <span className="text-white/85">{love(d.id, d.name)}</span>
              <span className="text-white/35"> · </span>
              <span className="font-semibold text-white">{gift(d)}</span>
            </motion.span>
          </AnimatePresence>
        </span>
      ) : (
        <span>Live updates from communities we serve</span>
      )}
    </p>
  );
}
