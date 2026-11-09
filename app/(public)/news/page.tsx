import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { listPublicPosts } from "@/lib/services/news";
import { Magnetic, Parallax, Rise, SectionLabel } from "@/components/site/motion";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { ArrowCircle, ClosingBand, MONO, PINK, pad } from "@/components/site/pages/education-news/parts";
import { StoryIndex } from "@/components/site/pages/education-news/story-index";
import { cn, humanize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "News",
  description:
    "The latest news, announcements and stories from the ORA movement across Tanzania.",
};

const FALLBACK = "/ora/event/e09.jpg";
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--s-pink))] focus-visible:ring-offset-4 focus-visible:ring-offset-[rgb(var(--s-night))]";

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
    <>
      {/* ── Hero: the crowd outdoors under night light ── */}
      <PageHero
        variant="cover"
        image="/ora/site/wide-GTM00117.jpg"
        imageAlt="A crowd of girls outdoors at an ORA school visit"
        label="Newsroom"
        aside={posts.length > 0 ? `${pad(posts.length)} stories` : undefined}
        title="News & announcements"
        accent={["announcements"]}
        intro="Stories, milestones and updates from ORA outreach across Tanzania."
      />


      {posts.length === 0 ? (
        <section className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <SectionLabel index="01" label="The latest" />
            <Rise className="mt-12 max-w-2xl">
              <h2 className="font-site-display text-[clamp(1.8rem,3.6vw,3rem)] font-semibold uppercase leading-[1] tracking-[-0.03em]">No posts yet</h2>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/65">
                Check back soon — news and announcements are posted here.
              </p>
            </Rise>
          </div>
        </section>
      ) : (
        <>
          {/* ── 01 The latest story, cinema-sized ── */}
          <section className="relative py-20 sm:py-28">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
              <SectionLabel index="01" label="The latest" aside={humanize(featured.category)} />
              <Rise className="mt-12">
                <Link
                  href={`/news/${featured.slug}`}
                  className={cn("s-on-photo group relative isolate flex min-h-[600px] flex-col justify-end overflow-hidden rounded-[2px] border border-white/10 sm:min-h-[78svh]", FOCUS)}
                >
                  <Parallax speed={0.08} className="absolute inset-0 -z-10">
                    <Image
                      src={featured.coverImage ?? FALLBACK}
                      alt={featured.title}
                      fill
                      sizes="(min-width:1440px) 1376px, 100vw"
                      className="object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                      priority
                    />
                  </Parallax>
                  <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_6_18/0.97)_0%,rgb(11_6_18/0.86)_40%,rgb(11_6_18/0.35)_80%,rgb(11_6_18/0.2)_100%)]" />
                  <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgb(11_6_18/0.5)] to-transparent" />
                  <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_100%,rgb(255_63_168/0.28),transparent_55%)]" />
                  <span className={cn(MONO, "absolute left-6 top-6 rounded-full bg-[rgb(11_6_18/0.6)] px-3.5 py-2 text-white backdrop-blur-md sm:left-10 sm:top-10 lg:left-14")}>
                    Latest story
                  </span>
                  <div className="grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-14">
                    <div className="min-w-0">
                      <p className={cn(MONO, "text-white/70")}>
                        <span className={PINK}>{humanize(featured.category)}</span>
                        {" · "}
                        <time dateTime={featured.publishedAt.toISOString()} className="tabular-nums">
                          {fmt(featured.publishedAt)}
                        </time>
                      </p>
                      <h2 className="mt-5 max-w-5xl text-pretty font-site-display text-[clamp(1.6rem,4.2vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
                        {featured.title}
                      </h2>
                      <p className="mt-5 line-clamp-4 max-w-2xl text-[16px] leading-relaxed text-white/75 sm:line-clamp-none sm:text-[17px]">{featured.excerpt}</p>
                    </div>
                    <span className="inline-flex items-center gap-4 text-[15px] font-medium text-white">
                      <ArrowCircle size="lg" />
                      Read more
                    </span>
                  </div>
                </Link>
              </Rise>
            </div>
          </section>

          {/* ── 02 Everything else, as an index ── */}
          {rest.length > 0 && (
            <section className="relative py-20 sm:py-28">
              <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
                <SectionHead
                  index="02"
                  label="All stories"
                  aside={`${pad(rest.length)} more`}
                  title="More from the newsroom"
                  accent={["newsroom"]}
                  note="Every story from ORA outreach, in one place — open one to read it in full."
                />
                <div className="mt-14">
                  <StoryIndex
                    start={2}
                    items={rest.map((p) => ({
                      href: `/news/${p.slug}`,
                      title: p.title,
                      excerpt: p.excerpt,
                      img: p.coverImage ?? FALLBACK,
                      alt: p.title,
                      kicker: humanize(p.category),
                      date: fmt(p.publishedAt),
                      dateTime: p.publishedAt.toISOString(),
                    }))}
                  />
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Closing ── */}
      <ClosingBand
        label="Be part of the story"
        title="Be part of the next story"
        accent={["next"]}
        image="/ora/site/wide-GTM00145.jpg"
        body="Your support helps us reach the next school, the next community."
      >
        <Magnetic>
          <Link href="/impact" className={cn(btnPrimary, FOCUS)}>
            Join the movement
          </Link>
        </Magnetic>
        <Link href="/contact" className={cn(btnGhost, FOCUS)}>
          Talk to the team
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </ClosingBand>
    </>
  );
}
