import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { cn, formatNumber, formatDate } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";
import { PhotoGallery } from "@/components/public/photo-gallery";
import { ImpactPulse, ImpactActivityFeed } from "@/components/public/impact-live";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere, Magnetic, Marquee, Parallax, Rise, ScrollWords, SectionLabel, SplitText } from "@/components/site/motion";
import { activityMeta } from "@/lib/impact-meta";
import { getPublicImpactStats } from "@/lib/stats";
import { getImpactFeed } from "@/lib/services/impact";

export const metadata: Metadata = {
  title: "ORA Impact",
  description:
    "Every pad distributed represents dignity, confidence and opportunity. See the impact ORA is creating across Tanzania — school by school, community by community.",
};

// Impact counters and activities must always be current.
export const dynamic = "force-dynamic";

/*
 * The impact page as a chapter of the cinematic public site (2026-11-09): a full-bleed opening over real girls
 * clapping, a pink word band, then numbered chapters — the figures huge with the packs floating beside them, the
 * live feed, the activities as an editorial index (rows that fill and slide on hover), the story in three acts (the
 * last one a manifesto that lights up as it is read), a gallery whose columns drift at different speeds, the voices,
 * and a closing band over a photo. All motion is transform/opacity and stands still for reduced-motion users.
 */

const H2 =
  "font-site-display font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";

const story = [
  {
    eyebrow: "Why we exist",
    title: "No girl should miss school because of her period",
    accent: ["school"],
    body: "Across Tanzania, period poverty keeps girls out of class for days every month — falling behind, losing confidence, sometimes dropping out for good. ORA was born to change that story, one cycle at a time.",
    img: "/ora/event/e17.jpg",
  },
  {
    eyebrow: "What we do",
    title: "Pads, education and dignity — delivered where they're needed",
    accent: ["dignity"],
    body: "Hand in hand with partners and agents across the country, we run judgement-free menstrual-health education in schools and put real pads into real hands — community by community, school by school.",
    img: "/ora/event/e40.jpg",
  },
  {
    eyebrow: "Why we're different",
    title: "We don't focus on selling. We focus on impact",
    accent: ["impact"],
    body: "Every decision we make begins with one question: will this reach more girls? We measure success in classrooms filled and confidence restored — never in units sold. That is the difference a movement makes.",
    img: "/ora/event/e09.jpg",
  },
];

const galleryPhotos = [
  "e02", "e06", "e08", "e10", "e15", "e20", "e21", "e23",
  "e27", "e28", "e30", "e31", "e32", "e34", "e36", "e39",
].map((e) => `/ora/event/${e}.jpg`);

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The three packs floating in pink light under an arch outline — pure CSS motion. */
function FloatingPacks({ className }: { className?: string }) {
  const packs = [
    { src: "/ora/site/pack-night.webp", alt: "ORA night pads, 360 mm", w: 1100, h: 716, pos: "left-[0%] top-[8%] w-[56%]", float: { "--dur": "7s", "--amp": "-16px", "--r0": "-12deg", "--r1": "-7deg" } },
    { src: "/ora/site/pack-day.webp", alt: "ORA day pads, 290 mm", w: 1100, h: 817, pos: "right-[0%] top-[30%] w-[50%]", float: { "--dur": "8.5s", "--amp": "-22px", "--r0": "10deg", "--r1": "5deg", "--delay": "-2s" } },
    { src: "/ora/site/pack-liner.webp", alt: "ORA daily liners, 180 mm", w: 851, h: 895, pos: "bottom-[2%] left-[24%] w-[32%]", float: { "--dur": "6.5s", "--amp": "-12px", "--r0": "-5deg", "--r1": "1deg", "--delay": "-1s" } },
  ];
  return (
    <div className={cn("relative mx-auto aspect-[6/5] w-full max-w-[560px]", className)}>
      <div aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgb(255_63_168/0.38),rgb(139_92_246/0.18)_45%,transparent_70%)] blur-2xl" />
      <div aria-hidden className="s-arch absolute inset-x-[22%] bottom-0 top-[4%] border border-white/10" />
      {packs.map((p) => (
        <div key={p.src} className={cn("absolute", p.pos)}>
          <div className="s-float" style={p.float as CSSProperties}>
            <Image
              src={p.src}
              alt={p.alt}
              width={p.w}
              height={p.h}
              sizes="(max-width: 1024px) 50vw, 300px"
              className="h-auto w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ImpactPage() {
  const [stories, stats, feed, activities] = await Promise.all([
    prisma.impactStory.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    getPublicImpactStats(),
    getImpactFeed(),
    prisma.impactActivity.findMany({
      where: { isPublished: true },
      orderBy: { activityDate: "desc" },
      take: 9,
    }),
  ]);

  const counters = [
    { label: "Pads distributed", value: stats.padsDistributed, suffix: "+" },
    { label: "Girls supported", value: stats.girlsReached, suffix: "+" },
    { label: "Communities visited", value: stats.communities, suffix: "+" },
    { label: "Regions covered", value: stats.regionsCovered, suffix: "" },
    ...(stats.schoolsReached > 0
      ? [{ label: "Schools reached", value: stats.schoolsReached, suffix: "" }]
      : []),
    ...(stats.educationSessions > 0
      ? [{ label: "Education sessions", value: stats.educationSessions, suffix: "" }]
      : []),
  ];
  const [lead, ...rest] = counters;
  // 3, 4 or 5 smaller figures: one even row on desktop (5 = two wide + three narrow on a six-track grid)
  const restGrid = rest.length === 4 ? "lg:grid-cols-4" : rest.length === 5 ? "lg:grid-cols-6" : "lg:grid-cols-3";
  const restSpan = (i: number) => (rest.length === 5 ? (i < 2 ? "lg:col-span-3" : "lg:col-span-2") : "");
  // Unbounded digits are wide: size the figures to the narrowest cell so "10,000+" never runs into its neighbour
  const restSize = rest.length === 4 ? "text-[clamp(2.8rem,6.4vw,4.4rem)] lg:text-[clamp(2.4rem,4.1vw,4rem)]" : "text-[clamp(2.8rem,5.4vw,5.2rem)]";

  // chapter numbers follow the sections actually shown
  const idx: Record<string, string> = {};
  let n = 0;
  for (const [key, on] of [
    ["impact", true],
    ["live", true],
    ["activities", activities.length > 0],
    ["story", true],
    ["moments", true],
    ["voices", stories.length > 0],
    ["join", true],
  ] as const) {
    if (on) idx[key] = pad2(++n);
  }

  // real places from the latest activities, for the outlined ticker
  const places = Array.from(new Set(activities.map((a) => a.location.trim()).filter(Boolean)));
  const ticker = places.length ? Array.from({ length: Math.max(6, places.length) }, (_, i) => places[i % places.length]) : [];

  return (
    <div>
      {/* ── Opening: girls clapping, full bleed, the title rising over them ── */}
      <PageHero
        label="Impact"
        aside="Tanzania · school by school"
        title="Empowering every cycle"
        accent={["cycle"]}
        variant="cover"
        image="/ora/site/wide-GTM00027.jpg"
        imageAlt="Schoolgirls clapping at an ORA school visit in Tanzania"
        intro={
          <>
            Every pad distributed represents dignity, confidence and opportunity. This is the movement — measured in
            girls supported, schools reached and communities visited. Never in money.
          </>
        }
        actions={
          <>
            <Magnetic>
              <Link href="/request-access" className={btnPrimary}>
                Join the movement
              </Link>
            </Magnetic>
            <Link href="/find-ora" className={btnGhost}>
              Find ORA near you
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
            </Link>
            {/* live activities — the movement in motion */}
            <ImpactPulse initial={feed} className="mt-6 min-w-0 basis-full border-t border-white/15 pt-5" />
          </>
        }
      />

      {/* ── The word band ── */}
      <div className="relative border-y border-white/[0.08] bg-[rgb(var(--s-pink))] py-4 text-white sm:py-5">
        <Marquee
          duration={32}
          itemClassName="font-site-display text-[clamp(1.1rem,2.4vw,1.8rem)] font-semibold uppercase tracking-[-0.01em] [&>span]:bg-white"
          items={["Dignity", "Confidence", "Opportunity", "School by school", "Community by community", "Empowering every cycle"]}
        />
      </div>

      {/* ── 01 The figures, huge — the packs floating beside the headline number ── */}
      <section className="relative isolate overflow-hidden py-24 sm:py-32">
        <Atmosphere variant="b" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index={idx.impact}
            label="Our impact"
            aside="Updated with every activity"
            title="Our impact"
            accent={["impact"]}
            note="Real numbers from the field — updated with every activity we run."
          />

          <div className="mt-14 grid grid-cols-1 items-center gap-6 border-t border-white/10 pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
            <Rise>
              <dl className="flex flex-col-reverse">
                <dt className="mt-6 max-w-md text-[17px] leading-relaxed text-white/65">
                  <span className="s-label mb-3 block text-[rgb(var(--s-pink))]">{lead.label}</span>
                  Pads delivered straight to girls who need them.
                </dt>
                <dd className="font-site-display text-[clamp(3.6rem,10vw,9.5rem)] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">
                  <CountUp value={lead.value} suffix={lead.suffix} />
                </dd>
              </dl>
            </Rise>
            <Rise delay={0.12}>
              <FloatingPacks className="max-w-[420px] lg:max-w-[560px]" />
            </Rise>
          </div>

          <dl className={cn("mt-10 grid grid-cols-1 gap-x-8 sm:grid-cols-2", restGrid)}>
            {rest.map((h, i) => (
              <Rise key={h.label} delay={Math.min(i, 5) * 0.07} className={cn("group border-t border-white/10 py-8 sm:py-10", restSpan(i))}>
                <div className="flex items-start justify-between gap-4">
                  <dt className="s-label pt-2">{h.label}</dt>
                  <span aria-hidden className="s-outline font-site-display text-4xl font-semibold leading-none tracking-[-0.04em] transition-colors duration-500 group-hover:text-[rgb(var(--s-pink)/0.25)] sm:text-5xl">
                    {pad2(i + 2)}
                  </span>
                </div>
                <dd className={cn("mt-6 font-site-display font-semibold leading-none tracking-[-0.045em] tabular-nums", restSize)}>
                  <CountUp value={h.value} suffix={h.suffix} />
                </dd>
              </Rise>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 02 Live from the field ── */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionLabel
            index={idx.live}
            label="Live from the field"
            aside={
              <span className="inline-flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-[rgb(var(--s-pink))] motion-reduce:animate-none" />
                Live
              </span>
            }
          />
          <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
            <div className="min-w-0">
              <SplitText text="Happening on the ground" accent={["ground"]} className={`text-[clamp(2.2rem,5vw,4.8rem)] ${H2}`} />
              <Rise delay={0.1}>
                <p className="mt-7 max-w-md text-[17px] leading-relaxed text-white/65">
                  The latest ORA activities — schools, streets and communities.
                </p>
              </Rise>
            </div>
            <Rise delay={0.08} className="lg:pt-3">
              <ImpactActivityFeed initial={feed} />
            </Rise>
          </div>
        </div>
      </section>

      {/* ── 03 Community activities: an editorial index — rows fill and slide on hover ── */}
      {activities.length > 0 && (
        <section className="relative pb-4 sm:pb-8">
          {ticker.length > 0 && (
            <div className="border-y border-white/10 py-6 sm:py-8">
              <Marquee
                duration={60}
                reverse
                itemClassName="s-outline font-site-display text-[clamp(2.4rem,6vw,5.6rem)] font-semibold uppercase leading-none tracking-[-0.03em]"
                items={ticker}
              />
            </div>
          )}
          <div className="mx-auto mt-24 max-w-[1440px] px-5 sm:mt-32 sm:px-8">
            <SectionHead
              index={idx.activities}
              label="Community activities"
              aside="Where we've been"
              title="Community activities"
              accent={["activities"]}
              note="Where we've been and what it changed."
            />
            <ul className="mt-14 border-t border-white/10">
              {activities.map((a, i) => {
                const meta = activityMeta(a.type);
                const figures = [
                  a.padsDistributed > 0 ? `${formatNumber(a.padsDistributed)} pads` : null,
                  a.peopleReached > 0 ? `${formatNumber(a.peopleReached)} reached` : null,
                  a.partnerOrg ? `with ${a.partnerOrg}` : null,
                ].filter(Boolean);
                return (
                  <li key={a.id} className="group relative border-b border-white/10">
                    <span
                      aria-hidden
                      className="absolute inset-0 origin-bottom scale-y-0 bg-white/[0.03] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100"
                    />
                    <Rise
                      delay={Math.min(i, 4) * 0.05}
                      className="relative grid grid-cols-1 gap-6 py-9 sm:py-11 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] md:gap-10 lg:grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,22rem)]"
                    >
                      <span
                        aria-hidden
                        className="s-outline hidden font-site-display text-6xl font-semibold leading-none tracking-[-0.05em] transition-colors duration-500 group-hover:text-[rgb(var(--s-pink))] lg:block"
                      >
                        {pad2(i + 1)}
                      </span>
                      <div className={cn("min-w-0", !a.images[0] && "md:col-span-2 lg:col-span-1")}>
                        <p className="s-label leading-relaxed">
                          <span className="lg:hidden">{pad2(i + 1)} — </span>
                          <span className="text-[rgb(var(--s-pink))]">{meta.label}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="tabular-nums">{formatDate(a.activityDate)}</span>
                        </p>
                        <h3 className="mt-4 font-site-display text-[clamp(1.5rem,2.6vw,2.4rem)] font-medium leading-[1.08] tracking-[-0.025em] transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2 group-hover:text-[rgb(var(--s-pink))]">
                          {a.title}
                        </h3>
                        <p className="mt-3 flex items-start gap-1.5 text-[15px] text-white/60">
                          <MapPin className="mt-[3px] size-4 shrink-0 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                          <span>
                            {a.location}
                            {a.region ? `, ${a.region}` : ""}
                          </span>
                        </p>
                        {a.description && (
                          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">{a.description}</p>
                        )}
                        {figures.length > 0 && (
                          <p className="s-label mt-5 leading-relaxed tabular-nums text-white/85">{figures.join(" · ")}</p>
                        )}
                      </div>
                      {a.images[0] && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[22px] bg-white/[0.05]">
                          <Image
                            src={a.images[0]}
                            alt={a.title}
                            fill
                            sizes="(max-width:768px) 100vw, (max-width:1024px) 240px, 352px"
                            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                          />
                        </div>
                      )}
                    </Rise>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── 04 The story, in three acts ── */}
      <section className="relative pt-24 sm:pt-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionLabel index={idx.story} label="The story" aside="Three acts" />
          <div className="mt-20 space-y-28 sm:mt-28 sm:space-y-40">
            {story.slice(0, 2).map((s, i) => (
              <div
                key={s.title}
                className={cn(
                  "grid grid-cols-1 items-center gap-12 lg:gap-20",
                  i === 0 ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]",
                )}
              >
                <Rise className={cn("relative", i === 1 && "lg:order-2")}>
                  <span
                    aria-hidden
                    className={cn(
                      "s-outline pointer-events-none absolute z-10 font-site-display text-[clamp(5.5rem,13vw,12rem)] font-semibold leading-none tracking-[-0.06em]",
                      i === 0 ? "-top-12 right-0 sm:-top-16 lg:-right-6" : "-top-12 left-0 sm:-top-16 lg:-left-6",
                    )}
                  >
                    {pad2(i + 1)}
                  </span>
                  {i === 0 ? (
                    <div className="relative mx-auto max-w-[440px] px-3">
                      <div aria-hidden className="s-arch absolute inset-x-0 -inset-y-3 border border-white/15" />
                      <Parallax speed={0.1} className="s-arch aspect-[4/5] w-full">
                        <Image src={s.img} alt={s.title} fill sizes="(max-width:1024px) 90vw, 440px" className="object-cover" />
                      </Parallax>
                    </div>
                  ) : (
                    <Parallax speed={0.1} className="aspect-[4/3] w-full rounded-[28px]">
                      <Image src={s.img} alt={s.title} fill sizes="(max-width:1024px) 100vw, 55vw" className="object-cover" />
                    </Parallax>
                  )}
                </Rise>
                <div className={cn("min-w-0", i === 1 && "lg:order-1")}>
                  <p className="s-label text-[rgb(var(--s-pink))]">
                    Act {pad2(i + 1)} — {s.eyebrow}
                  </p>
                  <SplitText text={s.title} accent={s.accent} className={`mt-6 text-[clamp(2rem,4.2vw,4.1rem)] ${H2}`} />
                  <Rise delay={0.1}>
                    <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-white/65">{s.body}</p>
                  </Rise>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Act 03: the difference, as a manifesto that lights up as it is read */}
        <div className="relative isolate mt-28 overflow-hidden py-20 sm:mt-40 sm:py-28">
          <Atmosphere variant="c" grid={false} className="opacity-70" />
          <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
            <p className="s-label text-[rgb(var(--s-pink))]">Act 03 — {story[2].eyebrow}</p>
            <h2 className="sr-only">{story[2].title}</h2>
            <ScrollWords
              text={`${story[2].title}.`}
              accent={story[2].accent}
              className="mt-8 font-site-display text-[clamp(2.3rem,6.6vw,6.6rem)] font-semibold uppercase leading-[0.98] tracking-[-0.035em]"
            />
            <div className="mt-14 grid grid-cols-1 items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-20">
              <Rise>
                <p className="max-w-2xl text-[clamp(1.1rem,1.6vw,1.35rem)] leading-relaxed text-white/75">{story[2].body}</p>
              </Rise>
              <Rise delay={0.1} className="w-full max-w-[340px] justify-self-start lg:justify-self-end">
                <Parallax speed={0.1} className="s-arch aspect-[4/5] w-full">
                  <Image src={story[2].img} alt={story[2].title} fill sizes="(max-width:1024px) 80vw, 340px" className="object-cover" />
                </Parallax>
              </Rise>
            </div>
          </div>
        </div>
      </section>

      {/* ── 05 Moments from the field: a gallery whose columns drift at their own speeds ── */}
      <section className="relative isolate overflow-hidden py-24 sm:py-32">
        <Atmosphere variant="a" className="opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index={idx.moments}
            label="ORA in action"
            aside={`${galleryPhotos.length} photographs`}
            title="Moments from the field"
            accent={["field"]}
            note="Every photo is a real ORA outreach — dignity reaching schools and communities across Tanzania."
          />
          <div className="mt-16 sm:mt-20">
            <PhotoGallery photos={galleryPhotos} alt="ORA school outreach in Tanzania" />
          </div>
        </div>
      </section>

      {/* ── 06 Voices from the community ── */}
      {stories.length > 0 && (
        <section className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <SectionHead
              index={idx.voices}
              label="Voices"
              title="Voices from the community"
              accent={["community"]}
              note="The people behind the numbers."
            />
            <div className="mt-14 border-t border-white/10">
              {stories.map((s, i) => {
                const figures = [
                  s.padsDistributed ? `${formatNumber(s.padsDistributed)} pads` : null,
                  s.livesReached ? `${formatNumber(s.livesReached)} reached` : null,
                ].filter(Boolean);
                return (
                  <Rise key={s.id} delay={Math.min(i, 4) * 0.05}>
                    <figure className="group grid grid-cols-1 gap-7 border-b border-white/10 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:gap-16">
                      <figcaption className="flex items-start gap-5 lg:flex-col lg:gap-8">
                        <span aria-hidden className="s-outline font-site-display text-5xl font-semibold leading-none tracking-[-0.05em] transition-colors duration-500 group-hover:text-[rgb(var(--s-pink)/0.3)] sm:text-7xl">
                          {pad2(i + 1)}
                        </span>
                        <div className="min-w-0 pt-1">
                          <p className="font-site-display text-lg font-semibold uppercase leading-tight tracking-[-0.01em] sm:text-xl">
                            {s.personName ?? s.title}
                          </p>
                          {s.location && <p className="s-label mt-2.5 leading-relaxed">{s.location}</p>}
                          {figures.length > 0 && (
                            <p className="s-label mt-4 leading-relaxed tabular-nums text-[rgb(var(--s-pink))]">{figures.join(" · ")}</p>
                          )}
                        </div>
                      </figcaption>
                      <div className="min-w-0">
                        {s.quote && (
                          <blockquote className="font-site-display text-[clamp(1.45rem,3vw,2.7rem)] font-medium leading-[1.15] tracking-[-0.025em]">
                            <span aria-hidden className="mr-1 font-site-serif text-[1.3em] italic leading-none text-[rgb(var(--s-pink))]">
                              “
                            </span>
                            {s.quote}
                            <span aria-hidden className="ml-0.5 font-site-serif text-[1.3em] italic leading-none text-[rgb(var(--s-pink))]">
                              ”
                            </span>
                          </blockquote>
                        )}
                        <p className={cn("max-w-2xl text-[17px] leading-relaxed text-white/65", s.quote && "mt-6")}>{s.body}</p>
                      </div>
                    </figure>
                  </Rise>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 07 Be part of the change: the closing band over girls laughing ── */}
      <section className="relative isolate overflow-hidden">
        <Parallax speed={0.12} className="absolute inset-0 -z-10">
          <Image src="/ora/site/wide-GTM00015.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_35%]" />
        </Parallax>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[rgb(11_6_18/0.74)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgb(11_6_18)] via-transparent to-[rgb(11_6_18/0.6)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_25%_70%,rgb(255_63_168/0.3),transparent_60%)]" />
        <div className="mx-auto flex min-h-[86svh] max-w-[1440px] flex-col justify-end px-5 py-24 sm:px-8 sm:py-32">
          <SectionLabel index={idx.join} label="Get involved" />
          <SplitText text="Be part of the change" accent={["change"]} className={`mt-10 max-w-5xl text-[clamp(2.7rem,8vw,8rem)] ${H2}`} />
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <Rise>
              <p className="max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-lg">
                Every partner, every stockist, every education session helps us reach one more girl, one more school,
                one more community.
              </p>
            </Rise>
            <Rise delay={0.1} className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/request-access" className={btnPrimary}>
                  Join the movement
                </Link>
              </Magnetic>
              <Link href="/find-ora" className={btnGhost}>
                Find ORA near you
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Rise>
          </div>
        </div>
      </section>
    </div>
  );
}
