"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { Feed, FeedItem } from "@/components/public/live-donation-feed";

const POLL_MS = 5000;

function useLiveFeed(initial: Feed) {
  const [feed, setFeed] = useState<Feed>(initial);
  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        setFeed(await res.json());
      } catch {
        /* keep last good */
      }
    }
    const t = setInterval(pull, POLL_MS);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return feed;
}

function gift(d: FeedItem) {
  return d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`;
}

/** A single, subtle donation pill that cross-fades over a hero — ambient. */
export function AmbientDonations({ initial }: { initial: Feed }) {
  const feed = useLiveFeed(initial);
  const [i, setI] = useState(0);
  const pool = feed.recent;
  useEffect(() => {
    if (pool.length < 1) return;
    const t = setInterval(() => setI((v) => v + 1), 4200);
    return () => clearInterval(t);
  }, [pool.length]);
  if (!pool.length) return null;
  const d = pool[i % pool.length];

  return (
    <div className="pointer-events-none absolute bottom-6 right-4 z-20 sm:bottom-10 sm:right-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${d.id}-${i}`}
          initial={{ opacity: 0, y: 18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.95 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 py-1.5 pl-1.5 pr-4 backdrop-blur-xl"
          style={{ boxShadow: "0 10px 40px -12px rgba(0,0,0,0.6)" }}
        >
          <span className="relative flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
            <Heart className="relative size-4 fill-white" />
          </span>
          <span className="text-sm leading-tight text-white/90">
            <span className="font-semibold text-white">{d.name}</span>
            <span className="text-white/60"> donated </span>
            <span className="font-bold text-white">{gift(d)}</span>
            <span className="ml-1 text-primary">💜</span>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Tally({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    const to = value;
    prev.current = value;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / 1200, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {prefix}
      {display.toLocaleString("en-US")}
    </>
  );
}

/** Big, airy, live-counting impact numbers — no boxes. */
export function LiveImpactNumbers({
  initial,
  className,
}: {
  initial: Feed;
  className?: string;
}) {
  const feed = useLiveFeed(initial);
  const c = feed.counters;
  const items = [
    { label: "Raised", value: c.moneyRaised, prefix: "TSh " },
    { label: "Packs sponsored", value: c.padsSponsored },
    { label: "Gifts", value: c.donations },
    { label: "Donors", value: c.donors },
  ];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-16",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <div className="text-gradient font-display text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl lg:text-5xl">
            <Tally value={it.value} prefix={it.prefix} />
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
