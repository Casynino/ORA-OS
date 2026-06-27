import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Newspaper } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { humanize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "News",
  description:
    "The latest news, announcements and stories from the ORA movement across Tanzania.",
};

const FALLBACK = "/ora/event/e09.jpg";

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsPage() {
  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });
  const [featured, ...rest] = posts;

  return (
    <div className="container py-16">
      <Reveal className="max-w-2xl">
        <Badge variant="accent" className="gap-1.5">
          <Newspaper className="size-3.5" />
          Newsroom
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          News &amp; <span className="text-gradient">announcements</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Stories, milestones and updates from ORA outreach across Tanzania.
        </p>
      </Reveal>

      {posts.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Newspaper}
          title="No posts yet"
          description="Check back soon — news and announcements are posted here."
        />
      ) : (
        <>
          <Link href={`/news/${featured.slug}`} className="group mt-10 block">
            <article className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:shadow-glow md:grid-cols-2">
              <div className="relative aspect-[16/11] overflow-hidden md:aspect-auto md:min-h-[320px]">
                <Image
                  src={featured.coverImage ?? FALLBACK}
                  alt={featured.title}
                  fill
                  sizes="(min-width:768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />
                <Badge className="absolute left-4 top-4 border-none bg-white/90 text-foreground shadow-sm">
                  {humanize(featured.category)}
                </Badge>
              </div>
              <div className="flex flex-col justify-center gap-3 p-7 sm:p-9">
                <span className="text-sm text-muted-foreground">
                  {fmt(featured.publishedAt)}
                </span>
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="text-muted-foreground">{featured.excerpt}</p>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Read more
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </article>
          </Link>

          {rest.length > 0 && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Link key={p.id} href={`/news/${p.slug}`} className="group">
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={p.coverImage ?? FALLBACK}
                        alt={p.title}
                        fill
                        sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <Badge
                        variant="accent"
                        className="absolute left-3 top-3 shadow-sm"
                      >
                        {humanize(p.category)}
                      </Badge>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <span className="text-xs text-muted-foreground">
                        {fmt(p.publishedAt)}
                      </span>
                      <h3 className="mt-1 font-display text-lg font-semibold leading-snug">
                        {p.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                        {p.excerpt}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read more
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
    </div>
  );
}
