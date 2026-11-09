"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin } from "lucide-react";
import type { ImpactFeedItem } from "@/lib/services/impact";
import { cn, timeAgo } from "@/lib/utils";

import { activityMeta, impactLine } from "@/lib/impact-meta";

/**
 * A single plain "live pulse" line — green dot + one activity softly
 * cross-fading to the next. No card, no chrome. Replaces the donation pulse.
 */
export function ImpactPulse({
  initial,
  className,
  tone = "light",
}: {
  initial: ImpactFeedItem[];
  className?: string;
  tone?: "light" | "theme";
}) {
  const [i, setI] = useState(0);
  const pool = initial;

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setI((v) => v + 1), 3400);
    return () => clearInterval(t);
  }, [pool.length]);

  const a = pool.length ? pool[i % pool.length] : null;
  const c =
    tone === "light"
      ? { base: "text-white/55", main: "text-white/85" }
      : { base: "text-muted-foreground", main: "text-foreground/90" };

  return (
    <p className={cn("flex items-center gap-2.5 text-sm", c.base, className)}>
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
      {a ? (
        <span className="relative inline-flex h-5 items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${a.id}-${i}`}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -7 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={cn("truncate whitespace-nowrap", c.main)}
            >
              {impactLine(a)}
            </motion.span>
          </AnimatePresence>
        </span>
      ) : (
        <span>Serving girls and communities across Tanzania</span>
      )}
    </p>
  );
}

/**
 * "Latest ORA activities" — a softly-rotating list of real work, one hairline row per activity, in the cinematic
 * site's language: a mono index and "when" column, the line in display type that slides and turns pink on hover,
 * then where and what kind as a mono label. The newest row carries a live dot. Rows keep a fixed height so the list
 * never changes size while it rotates.
 */
export function ImpactActivityFeed({
  initial,
  className,
}: {
  initial: ImpactFeedItem[];
  className?: string;
}) {
  const SHOW = 4;
  const [cursor, setCursor] = useState(0);
  const pool = initial;

  useEffect(() => {
    if (pool.length <= SHOW) return;
    const t = setInterval(() => setCursor((v) => v + 1), 3800);
    return () => clearInterval(t);
  }, [pool.length]);

  if (pool.length === 0) {
    return (
      <p className={cn("border-y border-white/10 py-8 text-[17px] text-white/60", className)}>
        Our next community activities will appear here — the movement never stops.
      </p>
    );
  }

  const visible = Array.from(
    { length: Math.min(SHOW, pool.length) },
    (_, j) => pool[(cursor + j) % pool.length],
  );

  return (
    <ul className={cn("relative border-t border-white/10", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((a, j) => {
          const meta = activityMeta(a.type);
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="group grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 border-b border-white/10 bg-[rgb(var(--s-night))] py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:py-6"
            >
              <span className="s-label flex items-center gap-2 pt-1.5 tabular-nums">
                {j === 0 ? (
                  <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-[rgb(var(--s-pink))] motion-reduce:animate-none" />
                ) : (
                  String(j + 1).padStart(2, "0")
                )}
              </span>
              <div className="min-w-0">
                {/* two fixed lines on phones, one on wider screens, so rotating rows never change the list height */}
                <p className="line-clamp-2 min-h-[2lh] font-site-display text-[17px] font-medium leading-snug tracking-[-0.015em] text-white transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-[rgb(var(--s-pink))] sm:line-clamp-1 sm:min-h-0 sm:text-xl">
                  {impactLine(a)}
                </p>
                <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50 font-site-mono">
                  <MapPin className="size-3.5 shrink-0 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="truncate">
                    {a.location}
                    {a.region ? `, ${a.region}` : ""}
                    <span aria-hidden="true"> · </span>
                    {meta.label}
                    <span className="sm:hidden">
                      <span aria-hidden="true"> · </span>
                      {timeAgo(new Date(a.at))}
                    </span>
                  </span>
                </p>
              </div>
              <span className="s-label hidden shrink-0 pt-1.5 tabular-nums sm:block">{timeAgo(new Date(a.at))}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
