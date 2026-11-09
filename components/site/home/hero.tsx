"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Atmosphere, Magnetic, SplitText, EASE } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";
import { ImpactPulse } from "@/components/public/impact-live";
import type { ImpactFeedItem } from "@/lib/services/impact";

type Stat = { label: string; value: number };

/**
 * The first screen: a campaign. Big words on the left; on the right a real ORA model holding the packs inside the
 * ORA arch, with the three packs floating around her — they bob on their own, lean away from the mouse at different
 * depths, and drift apart as the page scrolls. A faint real crowd photo sits under the night light.
 */
export function Hero({ stats, feed }: { stats: Stat[]; feed: ImpactFeedItem[] }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const { scrollY } = useScroll();
  const spread = useTransform(scrollY, [0, 700], [0, 1]);
  const textY = useTransform(scrollY, [0, 700], [0, -90]);
  const photoScale = useTransform(scrollY, [0, 900], [1.05, 1.18]);

  useEffect(() => {
    if (reduce || window.matchMedia("(hover: none)").matches) return;
    const on = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, [mx, my, reduce]);

  // each layer moves by its depth; packs also spread out with scroll
  const layer = (depth: number, sxDir: number, syDir: number) => ({
    x: useTransform([sx, spread] as never, ([a, s]: number[]) => a * depth * 60 + s * sxDir * 120),
    y: useTransform([sy, spread] as never, ([b, s]: number[]) => b * depth * 40 + s * syDir * 90),
  });
  /* eslint-disable react-hooks/rules-of-hooks */
  const L1 = layer(1.4, -1, -0.6);
  const L2 = layer(2.2, 1, -0.3);
  const L3 = layer(1.0, -0.8, 0.8);
  const L0 = layer(0.5, 0, 0);
  /* eslint-enable react-hooks/rules-of-hooks */

  return (
    <section className="relative isolate overflow-hidden">
      {/* ground: a faint real crowd under ORA's night light */}
      <motion.div aria-hidden className="absolute inset-0 -z-10" style={{ scale: reduce ? 1.05 : photoScale }}>
        <Image src="/ora/site/wide-GTM00015.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-[0.14] mix-blend-luminosity" />
      </motion.div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,transparent_0%,rgb(11_6_18/0.6)_55%,rgb(11_6_18)_100%)]" />
      <Atmosphere variant="a" className="-z-10" />

      <div className="mx-auto grid min-h-[100svh] max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-10 pt-[calc(var(--sat)+6.5rem)] sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-6 lg:pb-14 lg:pt-[calc(var(--sat)+7rem)]">
        <motion.div style={{ y: reduce ? 0 : textY }} className="relative z-10">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="flex items-center gap-3">
            <span className="s-label text-[rgb(var(--s-pink))]">[ ORA Pads ]</span>
            <span className="h-px w-10 bg-white/20" />
            <span className="s-label">Tanzania · Period dignity</span>
          </motion.p>
          <SplitText
            as="h1"
            immediate
            delay={0.25}
            stagger={0.08}
            text="Empowering every cycle"
            accent={["cycle"]}
            className="mt-6 font-site-display text-[clamp(2.1rem,9.4vw,3.6rem)] font-semibold uppercase lg:text-[min(5.6vw,6.2rem)] leading-[0.92] tracking-[-0.035em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.12em]"
          />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.9, ease: EASE }}
            className="mt-7 max-w-lg text-[17px] leading-relaxed text-white/70 sm:text-lg"
          >
            ORA-Pads is building a world where every girl can manage her period with dignity, confidence and access.
            Together, we create healthier communities.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.9, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <Link
                href="/impact"
                className="inline-flex h-14 items-center gap-2 rounded-full bg-[rgb(var(--s-pink))] px-7 text-[15px] font-semibold text-white shadow-[0_12px_40px_-10px_rgb(255_63_168/0.8)] transition-transform active:scale-[0.97]"
              >
                Join the movement
              </Link>
            </Magnetic>
            <Link
              href="/find-ora"
              className="group inline-flex h-14 items-center gap-2 rounded-full border border-white/15 px-6 text-[15px] font-medium text-white/90 transition-colors hover:border-white/35 hover:bg-white/[0.04]"
            >
              Find ORA near you
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
            </Link>
          </motion.div>
        </motion.div>

        {/* the campaign: model in the arch, packs floating */}
        <div className="relative mx-auto aspect-square w-full max-w-[400px] sm:max-w-[520px] lg:max-w-[640px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1.4, ease: EASE }}
            aria-hidden
            className="absolute left-1/2 top-[6%] h-[88%] w-[64%] -translate-x-1/2"
          >
            <div className="s-arch absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgb(255_63_168/0.55),rgb(139_92_246/0.35)_45%,rgb(20_9_31/0.2)_75%)]" />
            <div className="s-arch absolute -inset-3 border border-white/15" />
            <div className="s-arch absolute -inset-7 border border-white/[0.07]" />
          </motion.div>

          <motion.div style={L0} className="absolute inset-x-[10%] bottom-0 top-[4%]">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 1.3, ease: EASE }} className="relative h-full w-full [-webkit-mask-image:linear-gradient(to_bottom,#000_68%,transparent_97%),linear-gradient(to_right,transparent_0%,#000_12%)] [-webkit-mask-composite:source-in] [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,#000_68%,transparent_97%),linear-gradient(to_right,transparent_0%,#000_12%)]">
              <Image
                src="/ora/site/model-hold.webp"
                alt="A young woman in an ORA polo holding up ORA sanitary pads"
                fill
                priority
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 420px, 520px"
                className="object-contain object-bottom drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
              />
            </motion.div>
          </motion.div>

          <Pack style={L1} delay={0.7} src="/ora/site/pack-night.webp" alt="ORA night pads, 360 mm" className="left-[-6%] top-[50%] w-[36%]" float="--dur:7s;--amp:-16px;--r0:-14deg;--r1:-9deg" />
          <Pack style={L2} delay={0.85} src="/ora/site/pack-day.webp" alt="ORA day pads, 290 mm" className="right-[-7%] top-[8%] w-[34%]" float="--dur:8.5s;--amp:-22px;--r0:12deg;--r1:7deg;--delay:-2s" />
          <Pack style={L3} delay={1} src="/ora/site/pack-liner.webp" alt="ORA daily liners, 180 mm" className="bottom-[0%] right-[2%] w-[24%]" float="--dur:6.5s;--amp:-12px;--r0:8deg;--r1:3deg;--delay:-1s" />
        </div>
      </div>

      {/* foot of the hero: the live figures */}
      <div className="relative mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:pb-12">
        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 1 }}
          className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4"
        >
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col-reverse gap-2 py-6 ${i % 2 ? "pl-5 sm:pl-6" : "pr-5"} ${i > 0 ? "sm:border-l sm:border-white/10 sm:pl-6" : ""}`}>
              <dt className="s-label">{s.label}</dt>
              <dd className="font-site-display text-[clamp(1.8rem,3.4vw,3rem)] font-medium tabular-nums leading-none tracking-[-0.03em]">
                <CountUp value={s.value} suffix="+" />
              </dd>
            </div>
          ))}
        </motion.dl>
        <div className="flex items-center justify-between gap-6 border-t border-white/10 pt-5">
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
  );
}

function Pack({ src, alt, className, style, float, delay }: { src: string; alt: string; className: string; style: object; float: string; delay: number }) {
  const vars = Object.fromEntries(float.split(";").map((kv) => kv.split(":")));
  return (
    <motion.div style={style} className={`absolute ${className}`}>
      <motion.div initial={{ opacity: 0, scale: 0.6, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay, duration: 1.2, ease: EASE }}>
        <div className="s-float" style={vars}>
          <Image src={src} alt={alt} width={600} height={450} sizes="(max-width: 640px) 160px, 260px" className="h-auto w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.5)]" />
        </div>
      </motion.div>
    </motion.div>
  );
}
