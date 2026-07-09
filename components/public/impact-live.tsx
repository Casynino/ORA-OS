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

/** "Latest ORA activities" — an alive, softly-rotating stack of real work. */
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
      <p className={cn("rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground", className)}>
        Our next community activities will appear here — the movement never stops.
      </p>
    );
  }

  const visible = Array.from(
    { length: Math.min(SHOW, pool.length) },
    (_, j) => pool[(cursor + j) % pool.length],
  );

  return (
    <div className={cn("space-y-2.5", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((a) => {
          const meta = activityMeta(a.type);
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 backdrop-blur"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                <meta.icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{impactLine(a)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {a.location}
                    {a.region ? `, ${a.region}` : ""}
                  </span>
                  <span>· {meta.label}</span>
                  <span>· {timeAgo(new Date(a.at))}</span>
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
