"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Rise } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { ArrowCircle, MONO, PINK, pad } from "./parts";

export type Story = {
  href: string;
  title: string;
  excerpt: string;
  img: string;
  alt: string;
  kicker: string;
  date: string;
  dateTime: string;
};

/**
 * Stories as an editorial index: outlined numbers, the date, the title in display type. Hovering a row washes it
 * pink, slides the title and turns the arrow; on a computer the story's photo follows the cursor. Phones see each
 * photo as a thumbnail in its row.
 */
export function StoryIndex({ items, start = 1 }: { items: Story[]; start?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 22 });
  const sy = useSpring(y, { stiffness: 200, damping: 22 });
  return (
    <div
      className="relative"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <ul className="border-t border-white/10">
        {items.map((s, i) => (
          <li key={s.href} onMouseEnter={() => setHover(i)}>
            <Rise delay={Math.min(i, 5) * 0.05} y={20}>
              <Link
                href={s.href}
                className="group relative isolate grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4 border-b border-white/10 py-6 outline-none focus-visible:bg-white/[0.04] sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:py-9 lg:grid-cols-[110px_190px_minmax(0,1fr)_auto]"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 origin-left scale-x-0 bg-gradient-to-r from-[rgb(var(--s-pink)/0.12)] via-[rgb(var(--s-pink)/0.04)] to-transparent transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
                <span className="relative aspect-[4/5] w-full overflow-hidden rounded-[2px] bg-white/5 sm:aspect-[4/3] lg:hidden">
                  <Image src={s.img} alt={s.alt} fill sizes="(min-width:640px) 132px, 88px" className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
                </span>
                <span aria-hidden className="s-outline hidden font-site-display text-[3.4rem] font-semibold leading-none tracking-[-0.05em] transition-[-webkit-text-stroke-color] duration-300 group-hover:[-webkit-text-stroke-color:rgb(var(--s-pink))] lg:block">
                  {pad(start + i)}
                </span>
                <time dateTime={s.dateTime} className={cn(MONO, "hidden text-white/55 lg:block")}>
                  {s.date}
                </time>
                <span className="min-w-0">
                  <span className={cn(MONO, "block")}>
                    <span className={PINK}>{s.kicker}</span>
                    <span className="text-white/50 lg:hidden">
                      {" · "}
                      <time dateTime={s.dateTime}>{s.date}</time>
                    </span>
                  </span>
                  <span className="mt-3 block text-pretty font-site-display text-[1.08rem] font-medium leading-[1.2] tracking-[-0.02em] text-white transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2 group-hover:text-[rgb(var(--s-pink))] sm:text-2xl lg:text-[1.9rem]">
                    {s.title}
                  </span>
                  <span className="mt-3 line-clamp-2 block max-w-2xl text-[15px] leading-relaxed text-white/55">{s.excerpt}</span>
                </span>
                <ArrowCircle className="hidden sm:grid" />
              </Link>
            </Rise>
          </li>
        ))}
      </ul>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-20 hidden lg:block"
        style={{ x: sx, y: sy }}
        animate={{ opacity: hover === null ? 0 : 1, scale: hover === null ? 0.85 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative -ml-[150px] -mt-[105px] h-[210px] w-[300px] overflow-hidden rounded-[2px] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
          {items.map((s, i) => (
            <Image key={s.href} src={s.img} alt="" fill sizes="300px" className={`object-cover transition-opacity duration-300 ${hover === i ? "opacity-100" : "opacity-0"}`} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
