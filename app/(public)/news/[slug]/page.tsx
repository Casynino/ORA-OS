import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { humanize } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  const paragraphs = post.body.split(/\n\n+/).filter(Boolean);
  const date = post.publishedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="container max-w-3xl py-12">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to newsroom
      </Link>

      {post.coverImage && (
        <div className="relative mt-6 aspect-[21/10] overflow-hidden rounded-3xl">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(min-width:768px) 768px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{humanize(post.category)}</Badge>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-white/85">
                <Calendar className="size-3.5" />
                {date}
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              {post.title}
            </h1>
          </div>
        </div>
      )}

      {!post.coverImage && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{humanize(post.category)}</Badge>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              {date}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>
        </div>
      )}

      <p className="mt-8 text-lg text-muted-foreground">{post.excerpt}</p>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-foreground/90">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 text-center">
        <h3 className="font-display text-lg font-semibold">
          Be part of the story
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your support helps us reach the next school, the next community.
        </p>
        <Link
          href="/impact"
          className={buttonVariants({ variant: "accent", className: "mt-4" })}
        >
          Join the movement
        </Link>
      </div>
    </article>
  );
}
