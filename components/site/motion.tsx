"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * The public site's motion kit, in the spirit of the Reckless site: headlines rise word by word out of a mask, a
 * manifesto brightens word by word as it is read, images drift on scroll, buttons lean toward the cursor, tickers
 * run. All of it uses native scroll (no scroll hijacking) and stands still for reduced-motion users.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Word-by-word mask reveal. `accent` words get ORA pink in the italic serif. */
export function SplitText({
  text,
  accent = [],
  className,
  delay = 0,
  stagger = 0.06,
  as = "h2",
  immediate = false,
}: {
  text: string;
  accent?: string[];
  className?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p";
  /** play on mount (hero) instead of when scrolled into view */
  immediate?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } };
  const word: Variants = reduce
    ? { hidden: { y: "0%" }, show: { y: "0%" } }
    : { hidden: { y: "110%" }, show: { y: "0%", transition: { duration: 0.9, ease: EASE } } };
  const Tag = motion[as];
  const isAccent = (w: string) => accent.includes(w.replace(/[.,!?]/g, "").toLowerCase());
  return (
    <Tag
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={immediate || inView ? "show" : "hidden"}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden>
          <motion.span
            variants={word}
            className={cn("inline-block", isAccent(w) && "font-site-serif italic text-[rgb(var(--s-pink))] [letter-spacing:-0.01em]")}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Fade and rise once when scrolled into view. */
export function Rise({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Image (or anything) drifting against the scroll. Keep speed small (0.08–0.25). */
export function Parallax({ children, speed = 0.15, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * -100}%`, `${speed * 100}%`]);
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div style={{ y: reduce ? 0 : y }} className="absolute inset-[-12%_0]">
        {children}
      </motion.div>
    </div>
  );
}

/** The child eases toward the cursor while hovered (fine pointers only). */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 14, mass: 0.12 });
  const sy = useSpring(y, { stiffness: 160, damping: 14, mass: 0.12 });
  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        if (window.matchMedia("(hover: none)").matches || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Infinite ticker; the track is doubled for a seamless loop. */
export function Marquee({
  items,
  className,
  itemClassName,
  duration = 40,
  reverse = false,
}: {
  items: ReactNode[];
  className?: string;
  itemClassName?: string;
  duration?: number;
  reverse?: boolean;
}) {
  const track = (copy: number) => (
    <div className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
      {items.map((it, i) => (
        <span key={i} className={cn("flex items-center whitespace-nowrap", itemClassName)}>
          {it}
          <span aria-hidden className="mx-[0.6em] inline-block size-[0.32em] rounded-full bg-[rgb(var(--s-pink))]" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={cn("s-marquee-wrap flex overflow-hidden", className)}>
      <div className="s-marquee" data-reverse={reverse || undefined} style={{ ["--dur" as string]: `${duration}s` }}>
        {track(0)}
        {track(1)}
      </div>
    </div>
  );
}

/** A manifesto that brightens word by word as it passes the middle of the screen. */
export function ScrollWords({ text, accent = [], className }: { text: string; accent?: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={cn("flex flex-wrap gap-x-[0.26em]", className)} aria-label={text}>
      {words.map((w, i) => (
        <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} accent={accent.includes(w.replace(/[.,]/g, "").toLowerCase())} />
      ))}
    </p>
  );
}
function Word({ word, progress, range, accent }: { word: string; progress: MotionValue<number>; range: [number, number]; accent: boolean }) {
  const reduce = useReducedMotion();
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span aria-hidden style={{ opacity: reduce ? 1 : opacity }} className={accent ? "font-site-serif italic text-[rgb(var(--s-pink))]" : undefined}>
      {word}
    </motion.span>
  );
}

/** Index label: "[ 01 ] — The range", with a hairline that draws in. */
export function SectionLabel({ index, label, aside, className }: { index: string; label: string; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="s-label text-[rgb(var(--s-pink))]">[ {index} ]</span>
      <span className="s-label">{label}</span>
      <motion.span
        aria-hidden
        className="h-px flex-1 origin-left bg-[rgb(var(--s-ink)/0.12)]"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: EASE }}
      />
      {aside && <span className="s-label hidden sm:inline">{aside}</span>}
    </div>
  );
}

/**
 * The background of a band. Reckless-style ground (owner, 2026-11-09): no coloured light — every band stays ink and
 * the photographs carry the colour. Kept as a component so pages that place it keep working.
 */
export function Atmosphere(_props: { variant?: "a" | "b" | "c"; grid?: boolean; className?: string }) {
  return null;
}
