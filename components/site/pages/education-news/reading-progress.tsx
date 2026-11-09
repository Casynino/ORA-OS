"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** A thin ORA-pink line across the very top that fills as the story is read. */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.2 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[51] h-[2px] origin-left bg-[rgb(var(--s-pink))] shadow-[0_0_12px_rgb(255_63_168/0.8)]"
      style={{ scaleX }}
    />
  );
}
