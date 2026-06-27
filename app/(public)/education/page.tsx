import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
    <div className="container py-16">
      {/* Hero */}
      <div className="max-w-2xl">
        <Badge variant="accent" className="gap-1.5">
          <BookOpen className="size-3.5" />
          Education hub
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Knowledge is <span className="text-gradient">dignity</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Clear, judgement-free menstrual-health education — in English and
          Kiswahili. Learn the facts, break the myths and pass it on.
        </p>
      </div>

      {/* Filter pills */}
      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = (sp.category ?? "") === c.key;
          return (
            <Link
              key={c.key}
              href={c.key ? `/education?category=${c.key}` : "/education"}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                active
                  ? "border-transparent bg-gradient-to-r from-primary to-accent text-white shadow-glow"
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {articles.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={BookOpen}
          title="No articles here yet"
          description="Check back soon — new education content is added regularly."
        />
      ) : (
        <>
          {/* Featured story */}
          <Link href={`/education/${featured.slug}`} className="group mt-10 block">
            <article className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:shadow-glow md:grid-cols-2">
              <div className="relative aspect-[16/11] overflow-hidden md:aspect-auto md:min-h-[340px]">
                <Image
                  src={educationCover(featured.category, featured.slug)}
                  alt={featured.title}
                  fill
                  sizes="(min-width:768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                <Badge className="absolute left-4 top-4 border-none bg-white/90 text-foreground shadow-sm">
                  Featured
                </Badge>
              </div>
              <div className="flex flex-col justify-center gap-3 p-7 sm:p-9">
                <div className="flex items-center gap-2">
                  <Badge variant="accent">{humanize(featured.category)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {langLabel(featured.language)} · {featured.readMinutes} min
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="text-muted-foreground">{featured.excerpt}</p>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Read article
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </article>
          </Link>

          {/* Article grid */}
          {rest.length > 0 && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <Link
                  key={a.id}
                  href={`/education/${a.slug}`}
                  className="group"
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={educationCover(a.category, a.slug)}
                        alt={a.title}
                        fill
                        sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                      <Badge
                        variant="accent"
                        className="absolute left-3 top-3 shadow-sm"
                      >
                        {humanize(a.category)}
                      </Badge>
                      <span className="absolute bottom-3 left-3 text-xs font-medium text-white/90">
                        {langLabel(a.language)} · {a.readMinutes} min
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-lg font-semibold leading-snug">
                        {a.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                        {a.excerpt}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read article
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Period tips at a glance */}
      <section className="mt-16">
        <div className="max-w-2xl">
          <Badge variant="accent" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Quick tips
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Period tips at a glance
          </h2>
          <p className="mt-3 text-muted-foreground">
            Bite-sized ORA guides — save them, share them, pass them on.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tips.map((src) => (
            <div
              key={src}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-border"
            >
              <Image
                src={src}
                alt="ORA period tip"
                fill
                sizes="(max-width:640px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
