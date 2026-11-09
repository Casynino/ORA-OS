import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Share2 } from "lucide-react";
import { getPublicPost, listPublicPosts } from "@/lib/services/news";
import { Reveal } from "@/components/ui/reveal";
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
    <article className="pb-20 sm:pb-28">
      {/* ── Title block ─────────────────────────────────────────────── */}
      <header className="container max-w-4xl pt-12 sm:pt-20">
        <Link
          href="/news"
          className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
          Back to newsroom
        </Link>

        <p className="ora-rise mt-10 text-sm text-muted-foreground">
          <span className="font-medium text-primary">{humanize(post.category)}</span>
          {" · "}
          <time dateTime={post.publishedAt.toISOString()} className="tabular-nums">
            {date}
          </time>
          {" · "}
          <span className="tabular-nums">{minutes} min read</span>
        </p>

        <h1 className="ora-rise ora-rise-1 mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
          {post.title}
        </h1>
        <p className="ora-rise ora-rise-2 mt-6 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {post.excerpt}
        </p>

        <div className="ora-rise ora-rise-3 mt-8 flex items-center gap-3">
          <Image
            src="/ora/logo.png"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full border border-border bg-card object-contain p-1"
          />
          <div className="text-sm leading-tight">
            <p className="font-medium">ORA Pads</p>
            <p className="mt-0.5 text-muted-foreground">Empowering every cycle</p>
          </div>
        </div>
      </header>

      {/* ── Hero photo ──────────────────────────────────────────────── */}
      {post.coverImage && (
        <div className="ora-rise ora-rise-4 container mt-10 max-w-5xl sm:mt-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted sm:aspect-[16/9]">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(min-width:1024px) 1024px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}

      {/* ── Story ───────────────────────────────────────────────────── */}
      <div className="container mt-12 max-w-3xl sm:mt-16">
        <div className="text-[17px] leading-[1.8] text-foreground/90">
          <RichText body={post.body} />
        </div>

        <Reveal>
          {/* Share */}
          <div className="mt-16 flex flex-col items-start gap-4 border-y border-border py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2 text-[15px] font-medium">
              <Share2 className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              Share this story
            </p>
            <div className="flex flex-wrap gap-2">
              {shares.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors duration-150 hover:border-foreground/25 hover:bg-muted"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6 rounded-2xl bg-[#2a0845] p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Be part of the story</h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/75">
                Your support helps us reach the next school, the next community.
              </p>
            </div>
            <Link
              href="/impact"
              className="inline-flex h-11 w-fit shrink-0 items-center rounded-full bg-white px-5 text-[15px] font-medium text-[#2a0845] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97]"
            >
              Join the movement
            </Link>
          </div>
        </Reveal>
      </div>

      {/* ── More stories ────────────────────────────────────────────── */}
      {more.length > 0 && (
        <section className="container mt-24 max-w-5xl sm:mt-28">
          <Reveal className="flex items-end justify-between gap-6">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">More from the newsroom</h2>
            <Link href="/news" className="group inline-flex shrink-0 items-center gap-2 text-[15px] font-medium text-primary">
              All stories
              <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
            {more.map((p, i) => (
              <Reveal key={p.slug} delay={i * 0.06}>
                <Link
                  href={`/news/${p.slug}`}
                  className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  {p.coverImage && (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                      <Image
                        src={p.coverImage}
                        alt={p.title}
                        fill
                        sizes="(min-width:640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <p className={cn("text-[13px] font-medium text-primary", p.coverImage && "mt-5")}>{humanize(p.category)}</p>
                  <h3 className="mt-2 text-pretty font-display text-xl font-semibold leading-snug tracking-[-0.015em] transition-colors duration-150 group-hover:text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">{p.excerpt}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
