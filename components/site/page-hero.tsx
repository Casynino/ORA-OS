import Image from "next/image";
import type { ReactNode } from "react";
import { Atmosphere, Parallax, SplitText, SectionLabel } from "@/components/site/motion";
import { cn } from "@/lib/utils";

/**
 * The opening of every inner public page, in the home page's language: night light, a numbered label, a huge title
 * that rises word by word (one accent word in pink italic serif), the intro, optional actions, and optionally a real
 * photo — either in the ORA arch beside the words ("arch") or full-bleed behind them ("cover").
 */
export function PageHero({
  label,
  title,
  accent = [],
  intro,
  actions,
  image,
  imageAlt = "",
  variant = "arch",
  aside,
  className,
}: {
  label: string;
  title: string;
  accent?: string[];
  intro?: ReactNode;
  actions?: ReactNode;
  image?: string;
  imageAlt?: string;
  variant?: "arch" | "cover" | "plain";
  aside?: ReactNode;
  className?: string;
}) {
  const cover = variant === "cover" && image;
  return (
    <section className={cn("relative isolate overflow-hidden", className)}>
      {cover ? (
        <>
          <Parallax speed={0.1} className="absolute inset-0 -z-10">
            <Image src={image} alt={imageAlt} fill priority sizes="100vw" className="object-cover" />
          </Parallax>
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(11_6_18)] via-[rgb(11_6_18/0.7)] to-[rgb(11_6_18/0.45)]" />
        </>
      ) : (
        <Atmosphere variant="a" className="-z-10" />
      )}
      <div
        className={cn(
          "mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 pb-16 pt-[calc(var(--sat)+7.5rem)] sm:px-8 sm:pb-24 sm:pt-[calc(var(--sat)+9rem)]",
          variant === "arch" && image && "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-end",
          cover && "min-h-[78svh] content-end",
        )}
      >
        <div className="min-w-0">
          <SectionLabel index="ORA" label={label} aside={aside} />
          <SplitText
            as="h1"
            immediate
            delay={0.15}
            text={title}
            accent={accent}
            className="mt-8 font-site-display text-[clamp(2.3rem,7vw,6.4rem)] font-semibold uppercase leading-[0.95] tracking-[-0.035em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]"
          />
          {intro && <div className="ora-rise ora-rise-3 mt-7 max-w-2xl text-[17px] leading-relaxed text-white/70 sm:text-lg">{intro}</div>}
          {actions && <div className="ora-rise ora-rise-4 mt-9 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {variant === "arch" && image && (
          <div className="relative mx-auto hidden w-full max-w-[380px] lg:block">
            <div aria-hidden className="s-arch absolute -inset-3 border border-white/15" />
            <Parallax speed={0.08} className="s-arch arch-reveal aspect-[4/5] w-full">
              <Image src={image} alt={imageAlt} fill priority sizes="380px" className="object-cover" />
            </Parallax>
          </div>
        )}
      </div>
    </section>
  );
}

/** A section's opening: numbered label, a big title rising word by word, and an optional note beside it. */
export function SectionHead({ index, label, title, accent = [], note, aside }: { index: string; label: string; title: string; accent?: string[]; note?: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <SectionLabel index={index} label={label} aside={aside} />
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
        <SplitText
          text={title}
          accent={accent}
          className="font-site-display text-[clamp(2rem,4.8vw,4.6rem)] font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]"
        />
        {note && <div className="max-w-md text-[17px] leading-relaxed text-white/65">{note}</div>}
      </div>
    </div>
  );
}

/** Primary and secondary buttons in the site's style. */
export const btnPrimary = "s-btn s-btn--pink";
export const btnGhost = "group s-btn s-btn--line";
