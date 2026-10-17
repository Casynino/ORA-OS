import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Clock, Share2 } from "lucide-react";
import { getPublicPost, listPublicPosts } from "@/lib/services/news";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RichText } from "@/components/public/rich-text";
import { siteOrigin } from "@/lib/site-origin";
import { humanize } from "@/lib/utils";

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
    <article className="pb-20">
      {/* ── Title block ─────────────────────────────────────────────── */}
      <header className="container max-w-4xl pt-10 sm:pt-14">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to newsroom
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Badge variant="accent">{humanize(post.category)}</Badge>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-3.5" />
            {date}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {minutes} min read
          </span>
        </div>

        <h1 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          {post.title}
        </h1>
        <p className="mt-5 max-w-3xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {post.excerpt}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Image
            src="/ora/logo.png"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full bg-card object-contain p-1 ring-1 ring-border"
          />
          <div className="text-sm leading-tight">
            <p className="font-semibold">ORA Pads</p>
            <p className="text-muted-foreground">Empowering every cycle</p>
          </div>
        </div>
      </header>

      {/* ── Hero photo ──────────────────────────────────────────────── */}
      {post.coverImage && (
        <div className="container mt-8 max-w-5xl sm:mt-10">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-glow ring-1 ring-border sm:aspect-[16/9]">
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
      <div className="container mt-10 max-w-3xl sm:mt-12">
        <div className="text-[17px] leading-[1.85] text-foreground/90">
          <RichText body={post.body} />
        </div>

        {/* Share */}
        <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 font-display text-base font-semibold">
            <Share2 className="size-4 text-primary" />
            Share this story
          </p>
          <div className="flex flex-wrap gap-2">
            {shares.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 text-center">
          <h3 className="font-display text-lg font-semibold">Be part of the story</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your support helps us reach the next school, the next community.
          </p>
          <Link href="/impact" className={buttonVariants({ variant: "accent", className: "mt-4" })}>
            Join the movement
          </Link>
        </div>
      </div>

      {/* ── More stories ────────────────────────────────────────────── */}
      {more.length > 0 && (
        <section className="container mt-20 max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">More from the newsroom</h2>
            <Link href="/news" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              All stories <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {more.map((p) => (
              <Link key={p.slug} href={`/news/${p.slug}`} className="group">
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                  {p.coverImage && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={p.coverImage}
                        alt={p.title}
                        fill
                        sizes="(min-width:640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <span className="text-xs text-muted-foreground">{humanize(p.category)}</span>
                    <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
