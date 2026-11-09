"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { Magnetic, SplitText, EASE } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";
import { ImpactPulse } from "@/components/public/impact-live";
import type { ImpactFeedItem } from "@/lib/services/impact";

type Stat = { label: string; value: number };

/*
 * The first screen, full-bleed like the Reckless site (owner, 2026-11-09: the cut-out on a glow looked empty — the old
 * page had a big photo that moved). Real ORA moments fill the whole screen, one after another: each slowly settles from
 * a zoom while it is on, then dissolves into the next. The words sit on the dark side of the picture; the slide counter
 * and place sit bottom-right with a bar that fills while each picture is on (click a bar to jump).
 */
const SLIDES = [
  { src: "/ora/site/wide-GTM00063.jpg", place: "On stage · Jangwani", pos: "62% 32%", alt: "An ORA host on stage holding up a pack of ORA pads" },
  { src: "/ora/site/wide-GTM00015.jpg", place: "School day · Jangwani", pos: "55% 40%", alt: "Girls laughing together at an ORA school day" },
  { src: "/ora/site/g-juhudi-table.jpg", place: "Girls' Day 2026 · Juhudi Jeshini", pos: "50% 45%", alt: "ORA pads stacked high for International Girls' Day" },
  { src: "/ora/site/wide-FLP00062.jpg", place: "School visit · Zanaki", pos: "50% 40%", alt: "The ORA team cheering beside stacks of pads" },
];
const HOLD = 6500;

export function Hero({ stats, feed }: { stats: Stat[]; feed: ImpactFeedItem[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setI((v) => (v + 1) % SLIDES.length), HOLD);
    return () => window.clearTimeout(t);
  }, [i, reduce]);
  const s = SLIDES[i];

  return (
    <>
      <section data-photo-hero className="s-on-photo relative isolate h-[100svh] min-h-[620px] overflow-hidden bg-[rgb(10_10_11)]">
        {/* the pictures */}
        <AnimatePresence initial={false}>
          <motion.div
            key={s.src}
            className="absolute inset-0 -z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-0"
              initial={{ scale: reduce ? 1 : 1.14 }}
              animate={{ scale: 1.02 }}
              transition={{ duration: HOLD / 1000 + 1.4, ease: "linear" }}
            >
              <Image src={s.src} alt={s.alt} fill priority={i === 0} sizes="100vw" className="object-cover" style={{ objectPosition: s.pos }} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
        {/* grade: dark on the words' side, night at the foot, a touch of ORA pink up top */}
        {/* a soft shade along the top of the photo so the header words stay readable over bright pictures */}
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-44 bg-[linear-gradient(to_bottom,rgb(10_10_11/0.6),rgb(10_10_11/0.25)_55%,transparent)]" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[linear-gradient(90deg,rgb(10_10_11/0.85)_0%,rgb(10_10_11/0.5)_40%,rgb(10_10_11/0.12)_72%,transparent_100%)] md:block" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(10_10_11)_0%,rgb(10_10_11/0.88)_38%,rgb(10_10_11/0.55)_68%,rgb(10_10_11/0.4)_100%)] md:bg-[linear-gradient(to_top,rgb(10_10_11)_0%,rgb(10_10_11/0.55)_24%,transparent_55%)]" />
        
        <div className="mx-auto flex h-full max-w-[1440px] flex-col justify-end px-5 pb-10 pt-[calc(var(--sat)+6rem)] sm:px-8 sm:pb-14">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="flex items-center gap-3">
            <span className="s-label whitespace-nowrap text-[rgb(var(--s-pink))]">[ ORA Pads ]</span>
            <span className="h-px w-6 shrink-0 bg-white/30 sm:w-10" />
            <span className="s-label whitespace-nowrap text-white/75">Tanzania<span className="hidden sm:inline"> · Period dignity</span></span>
          </motion.p>
          <SplitText
            as="h1"
            immediate
            delay={0.25}
            stagger={0.08}
            text="Empowering every cycle"
            accent={["cycle"]}
            className="mt-6 max-w-[16ch] font-site-display text-[clamp(2.5rem,10.5vw,4.4rem)] font-semibold uppercase leading-[0.9] tracking-[-0.035em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.12em] sm:max-w-none lg:text-[min(8.4vw,8.8rem)]"
          />
          <div className="mt-8 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.9, ease: EASE }}
                className="max-w-lg text-[17px] leading-relaxed text-white/80 sm:text-lg"
              >
                ORA-Pads is building a world where every girl can manage her period with dignity, confidence and access.
                Together, we create healthier communities.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.9, ease: EASE }}
                className="mt-9 flex flex-wrap items-center gap-6"
              >
                <Magnetic>
                  <Link href="/products" data-cursor="View" className="group s-btn s-btn--bone">
                    Discover the range
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.75} />
                  </Link>
                </Magnetic>
                <Link href="/find-ora" className="group inline-flex items-center gap-2 text-white">
                  <MapPin className="size-4 text-[rgb(var(--s-pink))] transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={1.75} />
                  <span className="s-link">Find ORA near you</span>
                </Link>
              </motion.div>
            </div>

            {/* slide counter: number, place, a bar per picture that fills while it is on */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }} className="w-full max-w-[340px] lg:w-[340px]">
              <div className="flex items-end justify-between gap-4">
                <span className="font-site-display text-3xl font-semibold tabular-nums leading-none tracking-[-0.04em]">
                  0{i + 1}
                  <span className="s-label ml-2 align-middle text-white/55">/ 0{SLIDES.length}</span>
                </span>
                <AnimatePresence mode="wait">
                  <motion.span key={s.place} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="flex flex-col items-end gap-1.5 text-right">
                    {/* event over place, each on its own line, so a long caption never breaks mid-name */}
                    <span className="s-label whitespace-nowrap text-white/85">{s.place.split(" · ")[0]}</span>
                    <span className="s-label whitespace-nowrap text-white/50">{s.place.split(" · ")[1]}</span>
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {SLIDES.map((sl, k) => (
                  <button key={sl.src} type="button" onClick={() => setI(k)} aria-label={`Show picture ${k + 1}: ${sl.place}`} className="group relative h-6">
                    <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
                      <motion.span
                        key={k === i ? `on-${i}` : `off-${k}`}
                        className="absolute inset-y-0 left-0 bg-[rgb(var(--s-pink))]"
                        initial={{ width: k < i ? "100%" : "0%" }}
                        animate={{ width: k <= i ? "100%" : "0%" }}
                        transition={{ duration: k === i && !reduce ? HOLD / 1000 : 0.3, ease: "linear" }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* the live figures, under the picture */}
      <section className="relative">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <dl className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
            {stats.map((st, k) => (
              <div key={st.label} className={`flex flex-col-reverse gap-2 py-7 ${k % 2 ? "pl-5" : "pr-5"} ${k > 0 ? "sm:border-l sm:border-white/10 sm:pl-6" : ""}`}>
                <dt className="s-label">{st.label}</dt>
                <dd className="font-site-display text-[clamp(1.8rem,3.4vw,3rem)] font-medium tabular-nums leading-none tracking-[-0.03em]">
                  <CountUp value={st.value} suffix="+" />
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between gap-6 py-5">
            <ImpactPulse initial={feed} className="min-w-0" />
            <span className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="s-label">Scroll</span>
              <span className="relative h-8 w-px overflow-hidden bg-white/10">
                <span className="s-cue absolute inset-0 bg-[rgb(var(--s-pink))]" />
              </span>
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
