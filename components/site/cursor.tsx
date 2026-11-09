"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * The site's cursor, as on the Reckless site: a small ORA-pink dot with a ring that trails it. Over links and buttons
 * the ring grows; over anything marked data-cursor="…" it shows that word ("View", "Open"…). Computers with a mouse
 * only — phones and tablets keep their own touch.
 */
export function SiteCursor() {
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 30, mass: 0.4 });
  const ry = useSpring(y, { stiffness: 350, damping: 30, mass: 0.4 });

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setOn(true);
    document.body.classList.add("s-has-cursor");
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [data-cursor], input, textarea, select");
      setHover(Boolean(el));
      setLabel(el?.getAttribute("data-cursor") ?? null);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => {
      window.removeEventListener("mousemove", move);
      document.body.classList.remove("s-has-cursor");
    };
  }, [x, y]);

  if (!on) return null;
  return (
    <>
      <motion.div aria-hidden className="pointer-events-none fixed left-0 top-0 z-[100] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--s-pink))]" style={{ x, y }} />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-site-mono text-[0.55rem] uppercase tracking-[0.2em] text-[rgb(var(--s-ink))]"
        style={{ x: rx, y: ry }}
        animate={{
          width: label ? 78 : hover ? 52 : 34,
          height: label ? 78 : hover ? 52 : 34,
          backgroundColor: label ? "rgba(255,46,151,0.14)" : "rgba(0,0,0,0)",
          borderColor: hover ? "rgba(255,46,151,0.9)" : "rgba(236,232,225,0.4)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        {label}
      </motion.div>
    </>
  );
}
