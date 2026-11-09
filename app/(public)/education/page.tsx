import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Marquee, Magnetic, Parallax, Rise, SectionLabel } from "@/components/site/motion";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { ArrowCircle, ClosingBand, MONO, PINK, ZOOM, pad } from "@/components/site/pages/education-news/parts";
import { cn, humanize } from "@/lib/utils";
import { educationCover } from "@/lib/education-cover";

export const metadata: Metadata = {
  title: "Education hub",
  description:
    "Menstrual-health education in English and Swahili — hygiene, myths vs facts and community knowledge.",
};

const categories = [
  { key: "", label: "All" },
  { key: "MENSTRUAL_HEALTH", label: "Menstrual health" },
  { key: "HYGIENE", label: "Hygiene" },
  { key: "MYTHS_FACTS", label: "Myths vs facts" },
  { key: "COMMUNITY_STORY", label: "Community" },
];

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--s-pink))] focus-visible:ring-offset-4 focus-visible:ring-offset-[rgb(var(--s-night))]";

function langLabel(language: string) {
  return language === "SW" ? "Kiswahili" : "English";
}

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const where: Prisma.EducationContentWhereInput = { published: true };
  if (sp.category) {
    where.category = sp.category as Prisma.EducationContentWhereInput["category"];
  }

  const articles = await prisma.educationContent.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const [featured, ...rest] = articles;

  const tips = [
    "/ora/tips/myths.jpg",
    "/ora/tips/noteat.jpg",
    "/ora/tips/late.jpg",
    "/ora/tips/dispose.jpg",
    "/ora/tips/todo.jpg",
    "/ora/tips/size-guide.jpg",
  ];

  return (
    <>
      {/* ── Hero: the words and the topics, the ORA arch beside them ── */}
      <PageHero
        label="Education hub"
        aside="English · Kiswahili"
        title="Knowledge is dignity"
        accent={["dignity"]}
        image="/ora/events/girls-day-2026/speaker-pad.jpg"
        imageAlt="An ORA speaker holding up a pad as she talks with the girls about periods, health and hygiene"
        intro={
          <>
            Clear, judgement-free menstrual-health education — in English and Kiswahili. Learn the facts, break the
            myths and pass it on.
          </>
        }
        actions={
          <nav aria-label="Filter by topic" className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = (sp.category ?? "") === c.key;
              return (
                <Link
                  key={c.key}
                  href={c.key ? `/education?category=${c.key}` : "/education"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border px-5 text-[14px] font-medium transition-[background-color,border-color,color] duration-200",
                    active
                      ? "border-[rgb(var(--s-pink))] bg-[rgb(var(--s-pink))] text-white shadow-[0_10px_30px_-12px_rgb(255_63_168/0.9)]"
                      : "border-white/15 text-white/70 hover:border-white/40 hover:bg-white/[0.04] hover:text-white",
                    FOCUS,
                  )}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        }
      />

      {/* ── The topics, running ── */}
      <div className="border-y border-white/[0.08] py-5 sm:py-7">
        <Marquee
          duration={36}
          itemClassName="font-site-display text-[clamp(1.4rem,3.2vw,2.8rem)] font-semibold uppercase tracking-[-0.02em]"
          items={["Menstrual health", "Hygiene", "Myths vs facts", "Community", "English", "Kiswahili"].map((t, i) => (
            <span key={t} className={i % 2 ? "s-outline" : "text-white"}>
              {t}
            </span>
          ))}
        />
      </div>

      {articles.length === 0 ? (
        /* ── Nothing under this topic yet ── */
        <section className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <SectionLabel index="01" label="The library" />
            <Rise className="mt-12 max-w-2xl">
              <h2 className="font-site-display text-[clamp(1.8rem,3.6vw,3rem)] font-semibold uppercase leading-[1] tracking-[-0.03em]">
                No articles here yet
              </h2>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/65">
                Check back soon — new education content is added regularly.
              </p>
              {sp.category && (
                <Link href="/education" className={cn("group mt-8", btnGhost, FOCUS)}>
                  See all articles
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}
            </Rise>
          </div>
        </section>
      ) : (
        <>
          {/* ── 01 Start here: the featured guide, big ── */}
          <section className="relative py-20 sm:py-28">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
              <SectionLabel index="01" label="Start here" aside="Featured" />
              <Rise className="mt-12">
                <Link
                  href={`/education/${featured.slug}`}
                  className={cn(
                    "group grid grid-cols-1 gap-9 rounded-[28px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-end lg:gap-16",
                    FOCUS,
                  )}
                >
                  <div className="relative">
                    <Parallax speed={0.08} className="aspect-[4/3] w-full rounded-[28px] bg-white/5 sm:aspect-[16/10]">
                      <Image
                        src={educationCover(featured.category, featured.slug)}
                        alt={featured.title}
                        fill
                        sizes="(min-width:1024px) 62vw, 100vw"
                        className={ZOOM}
                      />
                    </Parallax>
                    <span className={cn(MONO, "absolute left-4 top-4 rounded-full bg-[rgb(11_6_18/0.6)] px-3.5 py-2 text-white backdrop-blur-md sm:left-6 sm:top-6")}>
                      Featured
                    </span>
                  </div>
                  <div className="min-w-0 lg:pb-4">
                    <span aria-hidden className="s-outline block font-site-display text-[clamp(4.5rem,9vw,8.5rem)] font-semibold leading-[0.85] tracking-[-0.06em]">
                      01
                    </span>
                    <p className={cn(MONO, "mt-8 text-white/55")}>
                      <span className={PINK}>{humanize(featured.category)}</span>
                      {" · "}
                      {langLabel(featured.language)} · <span className="tabular-nums">{featured.readMinutes} min read</span>
                    </p>
                    <h2 className="mt-5 text-pretty font-site-display text-[clamp(1.8rem,3.4vw,3.2rem)] font-semibold uppercase leading-[1] tracking-[-0.03em] transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))]">
                      {featured.title}
                    </h2>
                    <p className="mt-5 text-[17px] leading-relaxed text-white/65">{featured.excerpt}</p>
                    <span className="mt-9 inline-flex items-center gap-4 text-[15px] font-medium text-white">
                      <ArrowCircle size="lg" />
                      Read article
                    </span>
                  </div>
                </Link>
              </Rise>
            </div>
          </section>

          {/* ── 02 The library: the other guides, arranged like a magazine spread ── */}
          {rest.length > 0 && (
            <section className="relative py-20 sm:py-28">
              <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
                <SectionHead
                  index="02"
                  label="The library"
                  aside={`${pad(articles.length)} articles`}
                  title="Learn the facts, break the myths"
                  accent={["myths"]}
                  note="Short, judgement-free guides on periods, health and hygiene — read them, then pass them on."
                />
                <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-24">
                  {rest.map((a, i) => {
                    const row = Math.floor(i / 2);
                    const first = i % 2 === 0;
                    // Even rows: wide then tall; odd rows: tall then wide. The second card in each row sits lower.
                    const wide = row % 2 === 0 ? first : !first;
                    const alone = first && i === rest.length - 1;
                    return (
                      <Rise
                        key={a.id}
                        delay={first ? 0 : 0.1}
                        className={cn(
                          alone ? "md:col-span-2 lg:col-span-12" : wide ? "lg:col-span-7" : "lg:col-span-5",
                          !first && "md:mt-16 lg:mt-24",
                        )}
                      >
                        <Link href={`/education/${a.slug}`} className={cn("group block rounded-[24px]", FOCUS)}>
                          <div
                            className={cn(
                              "relative overflow-hidden rounded-[24px] bg-white/5",
                              alone ? "aspect-[4/3] sm:aspect-[21/9]" : wide ? "aspect-[4/3] lg:aspect-[16/11]" : "aspect-[4/3] lg:aspect-square",
                            )}
                          >
                            <Image
                              src={educationCover(a.category, a.slug)}
                              alt={a.title}
                              fill
                              sizes={alone ? "100vw" : wide ? "(min-width:1024px) 55vw, (min-width:768px) 50vw, 100vw" : "(min-width:1024px) 40vw, (min-width:768px) 50vw, 100vw"}
                              className={ZOOM}
                            />
                            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgb(11_6_18/0.55)] via-transparent to-transparent" />
                            <span className={cn(MONO, "absolute bottom-4 left-4 rounded-full bg-[rgb(11_6_18/0.55)] px-3 py-1.5 text-white backdrop-blur-md sm:bottom-5 sm:left-5")}>
                              {langLabel(a.language)}
                            </span>
                          </div>
                          <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-5">
                            <span aria-hidden className="s-outline font-site-display text-[2.8rem] font-semibold leading-[0.85] tracking-[-0.05em] sm:text-[3.4rem]">
                              {pad(i + 2)}
                            </span>
                            <div className="min-w-0">
                              <p className={cn(MONO, "text-white/55")}>
                                <span className={PINK}>{humanize(a.category)}</span>
                                {" · "}
                                <span className="tabular-nums">{a.readMinutes} min read</span>
                              </p>
                              <h3 className="mt-3 text-pretty font-site-display text-[1.3rem] font-semibold uppercase leading-[1.05] tracking-[-0.025em] transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))] sm:text-[1.6rem]">
                                {a.title}
                              </h3>
                              <p className="mt-3 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-white/60">{a.excerpt}</p>
                            </div>
                            <ArrowCircle className="hidden sm:grid" />
                          </div>
                        </Link>
                      </Rise>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── 03 Period tips at a glance: the guides, staggered like pinned posters ── */}
      <section className="relative isolate overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[rgb(var(--s-deep))] to-transparent" />
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index={rest.length > 0 ? "03" : "02"}
            label="Quick tips"
            title="Period tips at a glance"
            accent={["glance"]}
            note="Bite-sized ORA guides — save them, share them, pass them on."
          />
          <div className="mt-14 grid grid-cols-2 gap-3 pb-10 sm:mt-16 sm:grid-cols-3 sm:gap-6 sm:pb-16">
            {tips.map((src, i) => {
              const low = i % 2 === 1; // phones: two columns, the right one lower
              const mid = i % 3 === 1; // larger screens: three columns, the middle one lower
              return (
                <Rise key={src} delay={(i % 3) * 0.08}>
                  <div className={cn(low && "translate-y-8", mid ? "sm:translate-y-16" : low && "sm:translate-y-0")}>
                    <div className="group relative aspect-[19/24] overflow-hidden rounded-[18px] bg-white/5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:rotate-[-1.2deg] sm:rounded-[22px]">
                      <Image src={src} alt="ORA period tip" fill sizes="(max-width:640px) 50vw, 33vw" className={ZOOM} loading="lazy" />
                    </div>
                    <p className={cn(MONO, "mt-3 text-white/45")}>Tip {pad(i + 1)}</p>
                  </div>
                </Rise>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Closing: pass it on ── */}
      <ClosingBand
        label="Pass it on"
        title="Pass the knowledge on"
        accent={["knowledge"]}
        image="/ora/site/wide-GTM00015.jpg"
        body="Track your cycle, get insights and take control of your health."
        packs
      >
        <Magnetic>
          <Link href="/tracker" className={cn(btnPrimary, FOCUS)}>
            Track your cycle
          </Link>
        </Magnetic>
        <Link href="/find-ora" className={cn(btnGhost, FOCUS)}>
          Find ORA near you
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </ClosingBand>
    </>
  );
}
