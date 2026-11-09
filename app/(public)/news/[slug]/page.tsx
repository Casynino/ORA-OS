import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Share2 } from "lucide-react";
import { getPublicPost, listPublicPosts } from "@/lib/services/news";
import { Atmosphere, Magnetic, Parallax, Rise, SectionLabel, SplitText } from "@/components/site/motion";
import { btnGhost, btnPrimary } from "@/components/site/page-hero";
import { ArrowCircle, ClosingBand, MONO, PINK, ZOOM, pad } from "@/components/site/pages/education-news/parts";
import { ReadingProgress } from "@/components/site/pages/education-news/reading-progress";
import { RichText } from "@/components/public/rich-text";
import { siteOrigin } from "@/lib/site-origin";
import { cn, humanize } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) return { title: "Post not found" };
  // The picture + title that show when the link is shared on WhatsApp, Facebook, X, LinkedIn —
  // on the same domain the visitor is on (so ora.co.tz links preview with ora.co.tz images).
  return {
    metadataBase: new URL(await siteOrigin()),
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt.toISOString(),
      url: `/news/${post.slug}`,
      ...(post.coverImage ? { images: [{ url: post.coverImage, width: 1600, height: 1067, alt: post.title }] } : {}),
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

const FALLBACK = "/ora/event/e09.jpg";
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--s-pink))] focus-visible:ring-offset-4 focus-visible:ring-offset-[rgb(var(--s-night))]";

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();

  const date = post.publishedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // ~200 words a minute; photos and headings don't count as words.
  const words = post.body.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));

  const url = `${await siteOrigin()}/news/${post.slug}`;
  const text = encodeURIComponent(`${post.title}`);
  const link = encodeURIComponent(url);
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${text}%20${link}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${link}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
  ];

  const more = (await listPublicPosts()).filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <article>
      <ReadingProgress />

      {/* ── Title block over the cover photo ─────────────────────────── */}
      <header className="relative isolate overflow-hidden">
        {post.coverImage ? (
          <>
            <Parallax speed={0.1} className="absolute inset-0 -z-10">
              <Image src={post.coverImage} alt={post.title} fill sizes="100vw" className="object-cover" priority />
            </Parallax>
            <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_6_18)_0%,rgb(11_6_18/0.84)_45%,rgb(11_6_18/0.62)_100%)]" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgb(11_6_18/0.55)] to-transparent" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_10%_100%,rgb(255_63_168/0.25),transparent_55%)]" />
          </>
        ) : (
          <Atmosphere variant="a" className="-z-10" />
        )}
        <div
          className={cn(
            "mx-auto flex max-w-[1440px] flex-col justify-between gap-16 px-5 pb-14 pt-[calc(var(--sat)+6.5rem)] sm:px-8 sm:pb-20 sm:pt-[calc(var(--sat)+8.5rem)]",
            post.coverImage && "min-h-[92svh]",
          )}
        >
          <Link
            href="/news"
            className={cn("group inline-flex w-fit items-center gap-3 text-white/70 transition-colors hover:text-white", MONO, FOCUS)}
          >
            <span className="grid size-9 place-items-center rounded-full border border-white/20 transition-colors duration-300 group-hover:border-white/50">
              <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            Back to newsroom
          </Link>

          <div className="min-w-0">
            <p className={cn(MONO, "ora-rise flex flex-wrap items-center gap-x-5 gap-y-2 text-white/70")}>
              <span className={PINK}>[ {humanize(post.category)} ]</span>
              <time dateTime={post.publishedAt.toISOString()} className="tabular-nums">
                {date}
              </time>
              <span className="tabular-nums">{minutes} min read</span>
            </p>
            <SplitText
              as="h1"
              immediate
              delay={0.15}
              stagger={0.035}
              text={post.title}
              className="mt-7 max-w-6xl text-pretty font-site-display text-[clamp(1.9rem,5vw,4.9rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white"
            />
            <p className="ora-rise ora-rise-3 mt-7 max-w-3xl text-pretty text-lg leading-relaxed text-white/75 sm:text-xl">{post.excerpt}</p>

            <div className="ora-rise ora-rise-4 mt-9 flex items-center gap-3">
              <Image
                src="/ora/logo.png"
                alt=""
                width={40}
                height={40}
                className="size-11 rounded-full border border-white/15 bg-white object-contain p-1.5"
              />
              <div className="text-sm leading-tight">
                <p className="font-medium text-white">ORA Pads</p>
                <p className="mt-0.5 text-white/60">Empowering every cycle</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Story, with the details and sharing held beside it on a computer ── */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-5 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,190px)_minmax(0,760px)_minmax(0,190px)] lg:justify-between">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-8">
            <div>
              <p className={cn(MONO, "text-white/45")}>Published</p>
              <p className="mt-2 text-[15px] text-white/85">
                <time dateTime={post.publishedAt.toISOString()} className="tabular-nums">
                  {date}
                </time>
              </p>
            </div>
            <div>
              <p className={cn(MONO, "text-white/45")}>Reading</p>
              <p className="mt-2 text-[15px] tabular-nums text-white/85">{minutes} min read</p>
            </div>
            <div>
              <p className={cn(MONO, "text-white/45")}>Share</p>
              <ul className="mt-3 border-t border-white/10">
                {shares.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn("group flex items-center justify-between border-b border-white/10 py-3 text-[15px] text-white/80 transition-colors hover:text-[rgb(var(--s-pink))]", FOCUS)}
                    >
                      {s.label}
                      <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="text-[17px] leading-[1.8] text-white/80 sm:text-[18px]">
            <RichText body={post.body} />
          </div>

          <Rise>
            {/* Share */}
            <div className="mt-20 border-y border-white/10 py-8">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="inline-flex items-center gap-3 font-site-display text-xl font-semibold uppercase tracking-[-0.02em] text-white">
                  <Share2 className="size-5 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                  Share this story
                </p>
                <div className="flex flex-wrap gap-2">
                  {shares.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "group inline-flex h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-medium text-white/85 transition-[background-color,border-color,color] duration-200 hover:border-[rgb(var(--s-pink))] hover:bg-[rgb(var(--s-pink))] hover:text-white",
                        FOCUS,
                      )}
                    >
                      {s.label}
                      <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </Rise>
        </div>

        <div aria-hidden className="hidden lg:block" />
      </div>

      {/* ── More stories ────────────────────────────────────────────── */}
      {more.length > 0 && (
        <section className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <SectionLabel
              index="Next"
              label="More from the newsroom"
              aside={
                <Link href="/news" className="group inline-flex items-center gap-2 hover:text-white">
                  All stories
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              }
            />
            <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2">
              {more.map((p, i) => (
                <Rise key={p.slug} delay={i * 0.1} className={cn(i === 1 && "md:mt-24")}>
                  <Link href={`/news/${p.slug}`} className={cn("group block rounded-[24px]", FOCUS)}>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-white/5 sm:aspect-[16/11]">
                      <Image src={p.coverImage ?? FALLBACK} alt={p.title} fill sizes="(min-width:768px) 50vw, 100vw" className={ZOOM} />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgb(11_6_18/0.5)] via-transparent to-transparent" />
                    </div>
                    <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-5">
                      <span aria-hidden className="s-outline font-site-display text-[2.8rem] font-semibold leading-[0.85] tracking-[-0.05em] sm:text-[3.4rem]">
                        {pad(i + 1)}
                      </span>
                      <div className="min-w-0">
                        <p className={cn(MONO, PINK)}>{humanize(p.category)}</p>
                        <h3 className="mt-3 text-pretty font-site-display text-[1.2rem] font-semibold leading-[1.15] tracking-[-0.025em] text-white transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))] sm:text-[1.5rem]">
                          {p.title}
                        </h3>
                        <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-white/60">{p.excerpt}</p>
                      </div>
                      <ArrowCircle className="hidden sm:grid" />
                    </div>
                  </Link>
                </Rise>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Be part of the story ───────────────────────────────────── */}
      <ClosingBand
        label="Join us"
        title="Be part of the story"
        accent={["story"]}
        image="/ora/site/wide-GTM00027.jpg"
        body="Your support helps us reach the next school, the next community."
        packs
      >
        <Magnetic>
          <Link href="/impact" className={cn(btnPrimary, FOCUS)}>
            Join the movement
          </Link>
        </Magnetic>
        <Link href="/news" className={cn(btnGhost, FOCUS)}>
          All stories
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </ClosingBand>
    </article>
  );
}
