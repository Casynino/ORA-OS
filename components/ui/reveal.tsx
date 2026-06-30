"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Fade-and-rise wrapper that animates once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  id?: string;
}) {
  return (
    <motion.div
      id={id}
      // min-w-0 is a no-op for normal blocks but stops a Reveal that happens to
      // be a flex/grid item from blowing the layout wider than its track.
      className={cn("min-w-0", className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
