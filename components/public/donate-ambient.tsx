"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  donationVerb,
  type Feed,
  type FeedItem,
} from "@/components/public/live-donation-feed";

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
    <div className="pointer-events-none absolute bottom-5 right-4 z-20 sm:bottom-8 sm:right-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${d.id}-${i}`}
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.94 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 py-1 pl-1 pr-3 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 18px 40px -16px rgba(217,70,239,0.45)" }}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
            <Heart className="size-3 fill-white text-white" />
          </span>
          <span className="whitespace-nowrap text-[13px] leading-none text-white/70">
            <span className="font-semibold text-white">{d.name}</span> {donationVerb(d.id)}{" "}
            <span className="font-semibold text-white">{gift(d)}</span>
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
