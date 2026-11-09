import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Parallax, SplitText } from "@/components/site/motion";
import { cn } from "@/lib/utils";

/*
 * Small shared pieces for the Education and News chapters of the public site: the mono index label, the big
 * section-title type, the round arrow that turns on hover, and the closing band (a real photo under night light,
 * a huge line that rises word by word, and optionally the three ORA packs floating beside it).
 */

/** Mono index label. Unlike `.s-label` it takes any text colour class. */
export const MONO = "font-site-mono text-[11px] leading-[1.35] uppercase tracking-[0.22em]";
export const PINK = "text-[rgb(var(--s-pink))]";
/** Big display headline type (uppercase; the accent word stays in the italic serif). */
export const H2 =
  "font-site-display font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";
/** Image zoom on hover, slow like the Reckless series. */
export const ZOOM = "object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The round arrow: fills pink and turns 45° when its link is hovered. */
export function ArrowCircle({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-white/20 text-white transition-[background-color,border-color] duration-300 group-hover:border-[rgb(var(--s-pink))] group-hover:bg-[rgb(var(--s-pink))]",
        size === "lg" ? "size-14" : "size-11",
        className,
      )}
    >
      <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} />
    </span>
  );
}

const floatVars = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).map(([k, val]) => [`--${k}`, val])) as CSSProperties;

/** The three packs drifting in the air, with a pink glow behind them. Decorative. */
export function PackCluster({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto h-[250px] w-full max-w-[460px] sm:h-[360px] lg:h-[440px]", className)}>
      <div className="absolute inset-[14%] rounded-full bg-[rgb(var(--s-pink)/0.35)] blur-[70px]" />
      <div className="s-float absolute left-[0%] top-[30%] w-[58%]" style={floatVars({ dur: "7s", amp: "-16px", r0: "-13deg", r1: "-8deg" })}>
        <Image src="/ora/site/pack-night.webp" alt="" width={1100} height={716} sizes="(min-width:1024px) 270px, 60vw" className="h-auto w-full drop-shadow-[0_30px_40px_rgb(0_0_0/0.55)]" />
      </div>
      <div className="s-float absolute right-[0%] top-[0%] w-[52%]" style={floatVars({ dur: "8.5s", amp: "-22px", r0: "11deg", r1: "6deg", delay: "-2s" })}>
        <Image src="/ora/site/pack-day.webp" alt="" width={1100} height={817} sizes="(min-width:1024px) 240px, 55vw" className="h-auto w-full drop-shadow-[0_30px_40px_rgb(0_0_0/0.55)]" />
      </div>
      <div className="s-float absolute bottom-[0%] right-[8%] w-[34%]" style={floatVars({ dur: "6.5s", amp: "-12px", r0: "7deg", r1: "2deg", delay: "-1s" })}>
        <Image src="/ora/site/pack-liner.webp" alt="" width={851} height={895} sizes="(min-width:1024px) 160px, 36vw" className="h-auto w-full drop-shadow-[0_30px_40px_rgb(0_0_0/0.55)]" />
      </div>
    </div>
  );
}

/** Closing band: a real photo drifting under night light, the line huge, the buttons, optional floating packs. */
export function ClosingBand({
  label,
  title,
  accent = [],
  body,
  image,
  packs = false,
  children,
}: {
  label: string;
  title: string;
  accent?: string[];
  body?: ReactNode;
  image: string;
  packs?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <Parallax speed={0.12} className="absolute inset-0 -z-10">
        <Image src={image} alt="" fill sizes="100vw" className="object-cover" />
      </Parallax>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[rgb(11_6_18/0.76)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_25%_75%,rgb(255_63_168/0.3),transparent_60%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[rgb(11_6_18)] to-transparent" />
      <div
        className={cn(
          "mx-auto grid min-h-[80svh] max-w-[1440px] grid-cols-1 content-center items-center gap-12 px-5 py-24 sm:px-8 sm:py-32",
          packs && "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]",
        )}
      >
        <div className="min-w-0">
          <p className={cn(MONO, "text-white/75")}>[ {label} ]</p>
          <SplitText text={title} accent={accent} className={cn("mt-8 max-w-5xl text-[clamp(2.4rem,6.6vw,6.6rem)]", H2)} />
          {body && <div className="mt-7 max-w-xl text-[17px] leading-relaxed text-white/70">{body}</div>}
          {children && <div className="mt-10 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
        {packs && <PackCluster />}
      </div>
    </section>
  );
}
