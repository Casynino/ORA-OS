import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowUpRight, Droplet } from "lucide-react";
import { Parallax, SplitText } from "@/components/site/motion";
import type { OraProduct } from "@/lib/products";
import { cn } from "@/lib/utils";

/* Shared pieces for the Products, Product, Contact and Tracker pages of the cinematic public site. */

export const H2 =
  "font-site-display font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";

/** The transparent pack cut-outs (they float) and the colour of the light behind each pack. */
const PACKS: Record<string, { src: string; w: number; h: number; glow: string; accent: string }> = {
  "night-360": { src: "/ora/site/pack-night.webp", w: 1100, h: 716, glow: "123 97 255", accent: "night" },
  "day-290": { src: "/ora/site/pack-day.webp", w: 1100, h: 817, glow: "56 189 248", accent: "day" },
  "liner-180": { src: "/ora/site/pack-liner.webp", w: 851, h: 895, glow: "255 77 189", accent: "liners" },
};

export function packFor(p: Pick<OraProduct, "slug" | "image">) {
  return PACKS[p.slug] ?? { src: p.image, w: 2048, h: 2587, glow: "255 63 168", accent: "" };
}

/** Absorbency as drops in the pack's colour. */
export function Drops({ n, color, className }: { n: number; color?: string; className?: string }) {
  const c = color ?? "rgb(255 63 168)";
  return (
    <span role="img" aria-label={`${n} of 5 drops`} className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Droplet
          key={i}
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("size-[18px]", i >= n && "text-white/20")}
          style={i < n ? { color: c, fill: c } : undefined}
        />
      ))}
    </span>
  );
}

/** The round arrow that fills pink and turns when its row or card is hovered (needs a `group` parent). */
export function ArrowDisc({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-white/20 text-white transition-colors duration-300 group-hover:border-[rgb(var(--s-pink))] group-hover:bg-[rgb(var(--s-pink))]",
        size === "lg" ? "size-14" : "size-11 sm:size-12",
        className,
      )}
    >
      <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} />
    </span>
  );
}

/** A closing band: a real photo drifting under a dark veil and ORA light, a huge line, and the actions. */
export function CtaBand({
  label,
  title,
  accent = [],
  body,
  img,
  position = "50% 50%",
  children,
}: {
  label: string;
  title: string;
  accent?: string[];
  body?: ReactNode;
  img: string;
  position?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <Parallax speed={0.12} className="absolute inset-0 -z-10">
        <Image src={img} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: position }} />
      </Parallax>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(11_6_18)] via-[rgb(11_6_18/0.72)] to-[rgb(11_6_18/0.5)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_25%_75%,rgb(255_63_168/0.28),transparent_60%)]" />
      <div className="mx-auto flex min-h-[78svh] max-w-[1440px] flex-col justify-end px-5 py-24 sm:px-8 sm:py-32">
        <p className="s-label text-white/75">[ {label} ]</p>
        <SplitText text={title} accent={accent} className={`mt-7 max-w-5xl text-[clamp(2.4rem,7vw,7rem)] ${H2}`} />
        {body && <div className="mt-7 max-w-xl text-[17px] leading-relaxed text-white/75">{body}</div>}
        {children && <div className="mt-10 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </section>
  );
}

/** A band of big words running across the page, filled and outlined in turn. */
export function WordRun({ words, pink = false }: { words: string[]; pink?: boolean }) {
  return (
    <div
      className={cn(
        "s-marquee-wrap relative flex overflow-hidden border-y py-4 sm:py-5",
        pink ? "border-white/[0.08] bg-[rgb(var(--s-pink))] text-white" : "border-white/10 text-white",
      )}
    >
      <div className="s-marquee" style={{ ["--dur" as string]: "34s" }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
            {words.map((w, i) => (
              <span
                key={w}
                className={cn(
                  "flex items-center whitespace-nowrap font-site-display text-[clamp(1.1rem,2.4vw,1.8rem)] font-semibold uppercase tracking-[-0.01em]",
                  !pink && i % 2 === 1 && "s-outline",
                )}
              >
                {w}
                <span aria-hidden className={cn("mx-[0.7em] inline-block size-[0.32em] rounded-full", pink ? "bg-white" : "bg-[rgb(var(--s-pink))]")} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
