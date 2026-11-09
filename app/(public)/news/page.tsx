import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { listPublicPosts } from "@/lib/services/news";
import { Reveal } from "@/components/ui/reveal";
import { cn, humanize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "News",
  description:
    "The latest news, announcements and stories from the ORA movement across Tanzania.",
};

const FALLBACK = "/ora/event/e09.jpg";
const IMG_HOVER =
  "object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]";
const FOCUS =
  "rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsPage() {
  const posts = await listPublicPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="container pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="max-w-3xl">
        <p className="ora-rise text-sm font-medium text-primary">Newsroom</p>
        <h1 className="ora-rise ora-rise-1 mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
          News &amp; <span className="text-primary">announcements</span>
        </h1>
        <p className="ora-rise ora-rise-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
          Stories, milestones and updates from ORA outreach across Tanzania.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="mt-14 border-t border-border pt-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">No posts yet</h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Check back soon — news and announcements are posted here.
          </p>
        </div>
      ) : (
        <>
          {/* The latest story, large */}
          <Reveal className="mt-14 sm:mt-20">
            <Link
              href={`/news/${featured.slug}`}
              className={cn(
                "group grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-center md:gap-12 lg:gap-16",
                FOCUS,
              )}
            >
              <div className="relative aspect-[16/11] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={featured.coverImage ?? FALLBACK}
                  alt={featured.title}
                  fill
                  sizes="(min-width:768px) 55vw, 100vw"
                  className={IMG_HOVER}
                  priority
                />
              </div>
              <div>
                <p className="text-sm">
                  <span className="font-medium text-primary">{humanize(featured.category)}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    <time dateTime={featured.publishedAt.toISOString()} className="tabular-nums">
                      {fmt(featured.publishedAt)}
                    </time>
                  </span>
                </p>
                <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-4xl">
                  {featured.title}
                </h2>
                <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{featured.excerpt}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
                  Read more
                  <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </Reveal>

          {/* Everything else, as a list with hairlines */}
          {rest.length > 0 && (
            <ul className="mt-16 divide-y divide-border border-y border-border sm:mt-20">
              {rest.map((p, i) => (
                <li key={p.id}>
                  <Reveal delay={Math.min(i, 5) * 0.06}>
                    <Link
                      href={`/news/${p.slug}`}
                      className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-10 sm:py-8"
                    >
                      <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-48 lg:w-60">
                        <Image
                          src={p.coverImage ?? FALLBACK}
                          alt={p.title}
                          fill
                          sizes="(min-width:1024px) 240px, (min-width:640px) 192px, 96px"
                          className={IMG_HOVER}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-muted-foreground">
                          <span className="font-medium text-primary">{humanize(p.category)}</span>
                          {" · "}
                          <time dateTime={p.publishedAt.toISOString()} className="tabular-nums">
                            {fmt(p.publishedAt)}
                          </time>
                        </p>
                        <h3 className="mt-2 text-pretty font-display text-lg font-semibold leading-snug tracking-[-0.015em] transition-colors duration-150 group-hover:text-primary sm:text-2xl">
                          {p.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                          {p.excerpt}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
