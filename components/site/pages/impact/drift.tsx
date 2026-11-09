"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Moves its children up or down against the page scroll (transform only). A positive `distance` starts the block
 * lower and lets it rise past the reader; a negative one does the opposite. Used for the impact gallery's columns,
 * which travel at different speeds. Stands still for reduced-motion users.
 */
export function Drift({ children, distance = 60, className }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <motion.div ref={ref} style={{ y: reduce ? 0 : y }} className={cn("min-w-0", className)}>
      {children}
    </motion.div>
  );
}
