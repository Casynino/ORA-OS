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
 * "Latest ORA activities" — a softly-rotating list of real work, one hairline row per activity. No cards or icon
 * tiles: the line, then where, what kind and when in muted text. Rows stay one line each so the list never changes
 * height while it rotates.
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
      <p className={cn("border-y border-border py-6 text-[15px] text-muted-foreground", className)}>
        Our next community activities will appear here — the movement never stops.
      </p>
    );
  }

  const visible = Array.from(
    { length: Math.min(SHOW, pool.length) },
    (_, j) => pool[(cursor + j) % pool.length],
  );

  return (
    <ul className={cn("relative border-t border-border", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((a) => {
          const meta = activityMeta(a.type);
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-start gap-3 border-b border-border bg-background py-4"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {/* two fixed lines on phones, one on wider screens, so rotating rows never change the list height */}
                <p className="line-clamp-2 min-h-[2lh] text-[15px] font-medium leading-snug sm:line-clamp-1 sm:min-h-0">
                  {impactLine(a)}
                </p>
                <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                  {a.location}
                  {a.region ? `, ${a.region}` : ""}
                  <span aria-hidden="true"> · </span>
                  {meta.label}
                  <span className="sm:hidden">
                    <span aria-hidden="true"> · </span>
                    {timeAgo(new Date(a.at))}
                  </span>
                </p>
              </div>
              <span className="hidden shrink-0 pt-0.5 text-[13px] tabular-nums text-muted-foreground sm:block">
                {timeAgo(new Date(a.at))}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
