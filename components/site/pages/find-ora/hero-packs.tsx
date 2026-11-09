"use client";

import Image from "next/image";
import { useEffect, type CSSProperties } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { EASE } from "@/components/site/motion";

type PackSpec = {
  src: string;
  className: string;
  depth: number;
  lift: number;
  delay: number;
  float: Record<string, string>;
};

const PACKS: PackSpec[] = [
  {
    src: "/ora/site/pack-night.webp",
    className:
      "right-[4%] top-[calc(var(--sat)+4.25rem)] w-[30vw] max-w-[140px] lg:right-[3%] lg:top-[15%] lg:w-[16vw] lg:max-w-[240px]",
    depth: 1.5,
    lift: 170,
    delay: 0.55,
    float: { "--dur": "7s", "--amp": "-16px", "--r0": "-13deg", "--r1": "-8deg" },
  },
  {
    src: "/ora/site/pack-day.webp",
    className:
      "right-[37%] top-[calc(var(--sat)+5rem)] w-[21vw] max-w-[105px] lg:right-[17%] lg:top-[33%] lg:w-[12vw] lg:max-w-[190px]",
    depth: 2.3,
    lift: 260,
    delay: 0.7,
    float: { "--dur": "8.5s", "--amp": "-22px", "--r0": "11deg", "--r1": "6deg", "--delay": "-2s" },
  },
  {
    src: "/ora/site/pack-liner.webp",
    className: "hidden lg:block right-[6%] top-[55%] w-[9vw] max-w-[140px]",
    depth: 1,
    lift: 120,
    delay: 0.85,
    float: { "--dur": "6.5s", "--amp": "-12px", "--r0": "-5deg", "--r1": "-1deg", "--delay": "-1s" },
  },
];

/**
 * The three ORA packs floating at the right of the Find ORA hero: they bob on their own, lean away from the cursor at
 * different depths and rise out of the frame as the page scrolls. On phones and tablets two smaller packs float in the
 * band between the header and the hero's words.
 */
export function HeroPacks() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const { scrollY } = useScroll();

  useEffect(() => {
    if (reduce || window.matchMedia("(hover: none)").matches) return;
    const on = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, [mx, my, reduce]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto max-w-[1440px]">
      {PACKS.map((p) => (
        <Pack key={p.src} p={p} sx={sx} sy={sy} scrollY={scrollY} still={!!reduce} />
      ))}
    </div>
  );
}

function Pack({
  p,
  sx,
  sy,
  scrollY,
  still,
}: {
  p: PackSpec;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  scrollY: MotionValue<number>;
  still: boolean;
}) {
  const x = useTransform(sx, (v) => v * p.depth * -50);
  const y = useTransform([sy, scrollY] as never, ([b, s]: number[]) => b * p.depth * -36 - (Math.min(s, 900) / 900) * p.lift);
  return (
    <motion.div style={still ? undefined : { x, y }} className={`absolute ${p.className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: p.delay, duration: 1.2, ease: EASE }}
      >
        <div className="s-float" style={p.float as CSSProperties}>
          <Image
            src={p.src}
            alt=""
            width={600}
            height={450}
            sizes="240px"
            className="h-auto w-full drop-shadow-[0_26px_32px_rgba(0,0,0,0.55)]"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
