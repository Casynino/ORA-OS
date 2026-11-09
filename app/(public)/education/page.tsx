import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Reveal } from "@/components/ui/reveal";
import { ArchPhoto } from "@/components/public/arch-photo";
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

const PINK = "text-[hsl(322_100%_72%)]"; // ORA magenta, lifted for text on the plum ground
const IMG_HOVER =
  "object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]";
const FOCUS =
  "rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

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
      {/* ── Hero: the words and the topics on the left, the ORA arch on the right ── */}
      <section className="container py-16 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="ora-rise text-sm font-medium text-primary">Education hub</p>
            <h1 className="ora-rise ora-rise-1 mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
              Knowledge is <span className="text-primary">dignity</span>
            </h1>
            <p className="ora-rise ora-rise-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
              Clear, judgement-free menstrual-health education — in English and
              Kiswahili. Learn the facts, break the myths and pass it on.
            </p>

            {/* Topic filter */}
            <nav aria-label="Filter by topic" className="ora-rise ora-rise-3 mt-10 flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = (sp.category ?? "") === c.key;
                return (
                  <Link
                    key={c.key}
                    href={c.key ? `/education?category=${c.key}` : "/education"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop only. Loaded eagerly so it rises into the arch on load; below lg it is not shown, so the
              sizes hint lets phones fetch only the tiniest copy. */}
          <div className="hidden w-full max-w-[360px] justify-self-end text-foreground lg:block">
            <ArchPhoto
              src="/ora/events/girls-day-2026/speaker-pad.jpg"
              alt="An ORA speaker holding up a pad as she talks with the girls about periods, health and hygiene"
              sizes="(min-width: 1024px) 360px, 1px"
              position="48% 40%"
              priority
              reveal
              outline
            />
          </div>
        </div>
      </section>

      {/* ── Articles ── */}
      <section className="container pb-20 sm:pb-28">
        {articles.length === 0 ? (
          <div className="border-t border-border pt-8">
            <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">No articles here yet</h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Check back soon — new education content is added regularly.
            </p>
            {sp.category && (
              <Link href="/education" className="group mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
                See all articles
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Featured story */}
            <Reveal>
              <Link
                href={`/education/${featured.slug}`}
                className={cn(
                  "group grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-center md:gap-12 lg:gap-16",
                  FOCUS,
                )}
              >
                <div className="relative aspect-[16/11] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={educationCover(featured.category, featured.slug)}
                    alt={featured.title}
                    fill
                    sizes="(min-width:768px) 55vw, 100vw"
                    className={IMG_HOVER}
                    priority
                  />
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium text-primary">Featured</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {humanize(featured.category)} · {langLabel(featured.language)} ·{" "}
                      <span className="tabular-nums">{featured.readMinutes} min read</span>
                    </span>
                  </p>
                  <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{featured.excerpt}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
                    Read article
                    <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </Reveal>

            {/* Article grid */}
            {rest.length > 0 && (
              <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 border-t border-border pt-12 sm:mt-20 sm:grid-cols-2 sm:pt-16 lg:grid-cols-3">
                {rest.map((a, i) => (
                  <Reveal key={a.id} delay={(i % 3) * 0.06}>
                    <Link href={`/education/${a.slug}`} className={cn("group block", FOCUS)}>
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                        <Image
                          src={educationCover(a.category, a.slug)}
                          alt={a.title}
                          fill
                          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                          className={IMG_HOVER}
                        />
                      </div>
                      <p className="mt-5 text-[13px] text-muted-foreground">
                        <span className="font-medium text-primary">{humanize(a.category)}</span>
                        {" · "}
                        {langLabel(a.language)} · <span className="tabular-nums">{a.readMinutes} min read</span>
                      </p>
                      <div className="mt-2 flex items-start justify-between gap-4">
                        <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.015em]">{a.title}</h3>
                        <ArrowRight
                          className="mt-1 size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">{a.excerpt}</p>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Period tips at a glance: the guides on the plum ground ── */}
      <section className="bg-[#0d0016] py-20 text-white sm:py-28">
        <div className="container">
          <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div>
              <p className={`text-sm font-medium ${PINK}`}>Quick tips</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Period tips at a glance
              </h2>
            </div>
            <p className="max-w-md text-[17px] leading-relaxed text-white/65">
              Bite-sized ORA guides — save them, share them, pass them on.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {tips.map((src, i) => (
              <Reveal key={src} delay={(i % 3) * 0.06}>
                <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/5">
                  <Image
                    src={src}
                    alt="ORA period tip"
                    fill
                    sizes="(max-width:640px) 50vw, 33vw"
                    className={IMG_HOVER}
                    loading="lazy"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
