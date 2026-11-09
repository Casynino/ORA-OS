import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Quote, ArrowRight, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { ArchPhoto } from "@/components/public/arch-photo";
import { PhotoGallery } from "@/components/public/photo-gallery";
import { ImpactPulse, ImpactActivityFeed } from "@/components/public/impact-live";
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
 * The impact page, in the calmer public style of the home page (unslop pass, 2026-11-09): the colour lives in the
 * photos, the chrome is quiet — plain eyebrows, hairlines instead of glass cards, no pills, gradient tiles or glows.
 * The hero photo sits in the ORA arch; "Moments from the field" is the one plum band.
 */

const PINK = "text-[hsl(322_100%_72%)]"; // ORA magenta, lifted for text on the plum ground

const story = [
  {
    eyebrow: "Why we exist",
    title: "No girl should miss school because of her period",
    body: "Across Tanzania, period poverty keeps girls out of class for days every month — falling behind, losing confidence, sometimes dropping out for good. ORA was born to change that story, one cycle at a time.",
    img: "/ora/event/e17.jpg",
  },
  {
    eyebrow: "What we do",
    title: "Pads, education and dignity — delivered where they're needed",
    body: "Hand in hand with partners and agents across the country, we run judgement-free menstrual-health education in schools and put real pads into real hands — community by community, school by school.",
    img: "/ora/event/e40.jpg",
  },
  {
    eyebrow: "Why we're different",
    title: "We don't focus on selling. We focus on impact",
    body: "Every decision we make begins with one question: will this reach more girls? We measure success in classrooms filled and confidence restored — never in units sold. That is the difference a movement makes.",
    img: "/ora/event/e09.jpg",
  },
];

const galleryPhotos = [
  "e02", "e06", "e08", "e10", "e15", "e20", "e21", "e23",
  "e27", "e28", "e30", "e31", "e32", "e34", "e36", "e39",
].map((e) => `/ora/event/${e}.jpg`);

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

  return (
    <div>
      {/* ── Mission hero: the words on the left, the ORA arch on the right ── */}
      <section className="container grid grid-cols-1 items-center gap-x-16 gap-y-14 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="ora-rise text-sm font-medium text-primary">ORA impact</p>
          <h1 className="ora-rise ora-rise-1 mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
            Empowering <span className="text-primary">every cycle</span>
          </h1>
          <p className="ora-rise ora-rise-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Every pad distributed represents dignity, confidence and opportunity. This is the movement — measured in
            girls supported, schools reached and communities visited. Never in money.
          </p>
          <div className="ora-rise ora-rise-3 mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link
              href="/request-access"
              className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
            >
              Join the movement
            </Link>
            <Link
              href="/find-ora"
              className="group inline-flex h-12 items-center gap-2 text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Find ORA near you
              <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          {/* live activities — the movement in motion */}
          <ImpactPulse initial={feed} tone="theme" className="ora-rise ora-rise-4 mt-10 border-t border-border pt-6" />
        </div>

        <div className="mx-auto w-full max-w-[320px] text-foreground sm:max-w-[380px] lg:max-w-[440px]">
          <ArchPhoto
            src="/ora/event/e40.jpg"
            alt="ORA distributing pads to schoolgirls in Tanzania"
            sizes="(max-width: 640px) 320px, (max-width: 1024px) 380px, 440px"
            position="50% 35%"
            priority
            reveal
            outline
          />
          <p className="ora-rise ora-rise-4 mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em]">
              <CountUp value={stats.padsDistributed} suffix="+" />
            </span>
            <span className="text-[15px] text-muted-foreground">pads delivered straight to girls who need them</span>
          </p>
        </div>
      </section>

      {/* ── Impact counters ── */}
      <section className="border-t border-border">
        <div className="container py-20 sm:py-28">
          <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Our impact</h2>
            <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
              Real numbers from the field — updated with every activity we run.
            </p>
          </Reveal>
          <dl
            className={`mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 ${
              counters.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            {counters.map((h, i) => (
              <Reveal key={h.label} delay={Math.min(i, 5) * 0.06}>
                <div className="flex flex-col-reverse border-t border-border pt-5">
                  <dt className="mt-2 text-[15px] leading-snug text-muted-foreground">{h.label}</dt>
                  <dd className="font-display text-4xl font-semibold tabular-nums tracking-[-0.025em] sm:text-5xl">
                    <CountUp value={h.value} suffix={h.suffix} />
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Latest activities feed ── */}
      <section className="container pb-20 sm:pb-28">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <Reveal>
            <p className="text-sm font-medium text-primary">Live from the field</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
              Happening on the ground
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted-foreground">
              The latest ORA activities — schools, streets and communities.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <ImpactActivityFeed initial={feed} />
          </Reveal>
        </div>
      </section>

      {/* ── Community activities ── */}
      {activities.length > 0 && (
        <section className="border-t border-border">
          <div className="container py-20 sm:py-28">
            <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
              <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Community activities</h2>
              <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
                Where we&apos;ve been and what it changed.
              </p>
            </Reveal>
            {/* a hairline list: reads as intended with one activity or nine */}
            <ul className="mt-12 divide-y divide-border border-y border-border">
              {activities.map((a, i) => {
                const meta = activityMeta(a.type);
                const figures = [
                  a.padsDistributed > 0 ? `${formatNumber(a.padsDistributed)} pads` : null,
                  a.peopleReached > 0 ? `${formatNumber(a.peopleReached)} reached` : null,
                  a.partnerOrg ? `with ${a.partnerOrg}` : null,
                ].filter(Boolean);
                return (
                  <li key={a.id}>
                    <Reveal
                      delay={Math.min(i, 5) * 0.06}
                      className="group flex flex-col-reverse gap-5 py-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10"
                    >
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                        <p className="text-[13px] text-muted-foreground lg:pt-1">
                          <span className="font-medium text-primary">{meta.label}</span>
                          <span aria-hidden="true" className="lg:hidden"> · </span>
                          <span className="tabular-nums lg:mt-1 lg:block">{formatDate(a.activityDate)}</span>
                        </p>
                        <div className="max-w-2xl">
                          <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.015em]">{a.title}</h3>
                          <p className="mt-1.5 flex items-start gap-1.5 text-[15px] text-muted-foreground">
                            <MapPin className="mt-[3px] size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                            <span>
                              {a.location}
                              {a.region ? `, ${a.region}` : ""}
                            </span>
                          </p>
                          {a.description && (
                            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{a.description}</p>
                          )}
                          {figures.length > 0 && (
                            <p className="mt-4 text-sm font-medium tabular-nums text-foreground/80">{figures.join(" · ")}</p>
                          )}
                        </div>
                      </div>
                      {a.images[0] && (
                        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56 lg:w-72">
                          <Image
                            src={a.images[0]}
                            alt={a.title}
                            fill
                            sizes="(max-width:640px) 100vw, 288px"
                            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                          />
                        </div>
                      )}
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── The story — alternating text + photo ── */}
      <section className="border-t border-border">
        <div className="container space-y-20 py-20 sm:space-y-28 sm:py-28">
          {story.map((s, i) => (
            <div key={s.title} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
              <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                  <Image src={s.img} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
                </div>
              </Reveal>
              <Reveal delay={0.06} className={i % 2 === 1 ? "lg:order-1" : ""}>
                <p className="text-sm font-medium text-primary">{s.eyebrow}</p>
                <h2 className="mt-3 text-balance font-display text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-4xl">
                  {s.title}
                </h2>
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{s.body}</p>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ── Moments from the field: the photos on the plum ground ── */}
      <section className="bg-[#0d0016] py-20 text-white sm:py-28">
        <div className="container">
          <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div>
              <p className={`text-sm font-medium ${PINK}`}>ORA in action</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Moments from the field
              </h2>
            </div>
            <p className="max-w-md text-[17px] leading-relaxed text-white/65">
              Every photo is a real ORA outreach — dignity reaching schools and communities across Tanzania.
            </p>
          </Reveal>
          <Reveal delay={0.06} className="mt-12">
            <PhotoGallery photos={galleryPhotos} alt="ORA school outreach in Tanzania" />
          </Reveal>
        </div>
      </section>

      {/* ── Voices from the community ── */}
      {stories.length > 0 && (
        <section className="container py-20 sm:py-28">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Voices from the community</h2>
            <p className="mt-3 text-[17px] text-muted-foreground">The people behind the numbers.</p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {stories.map((s, i) => {
              const figures = [
                s.padsDistributed ? `${formatNumber(s.padsDistributed)} pads` : null,
                s.livesReached ? `${formatNumber(s.livesReached)} reached` : null,
              ].filter(Boolean);
              return (
                <Reveal key={s.id} delay={Math.min(i, 5) * 0.06} className="h-full">
                  <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 sm:p-8">
                    <Quote className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                    {s.quote && (
                      <blockquote className="mt-4 text-lg font-medium leading-relaxed">“{s.quote}”</blockquote>
                    )}
                    <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                    <div className="mt-auto pt-6" />
                    <figcaption className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-border pt-5">
                      <div>
                        <p className="font-semibold">{s.personName ?? s.title}</p>
                        {s.location && <p className="text-sm text-muted-foreground">{s.location}</p>}
                      </div>
                      {figures.length > 0 && (
                        <p className="text-sm tabular-nums text-muted-foreground">{figures.join(" · ")}</p>
                      )}
                    </figcaption>
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Be part of the change ── */}
      <section className={`container pb-20 sm:pb-28 ${stories.length > 0 ? "" : "pt-20 sm:pt-28"}`}>
        <Reveal>
          <div className="flex flex-col gap-8 rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Be part of the change</h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/85">
                Every partner, every stockist, every education session helps us reach one more girl, one more school,
                one more community.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/request-access"
                className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97]"
              >
                Join the movement
              </Link>
              <Link
                href="/find-ora"
                className="group inline-flex h-12 items-center gap-2 text-[15px] font-medium text-white/85 transition-colors hover:text-white"
              >
                Find ORA near you
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
