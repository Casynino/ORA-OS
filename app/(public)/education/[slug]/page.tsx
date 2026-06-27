import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { humanize } from "@/lib/utils";
import { educationCover } from "@/lib/education-cover";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.educationContent.findUnique({ where: { slug } });
  if (!article) return { title: "Article not found" };
  return { title: article.title, description: article.excerpt };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.educationContent.findUnique({
    where: { slug },
  });
  if (!article || !article.published) notFound();

  const paragraphs = article.body.split(/\n\n+/).filter(Boolean);
  const cover = educationCover(article.category, article.slug);

  return (
    <article className="container max-w-3xl py-12">
      <Link
        href="/education"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to education hub
      </Link>

      {/* Cover hero */}
      <div className="relative mt-6 aspect-[21/10] overflow-hidden rounded-3xl">
        <Image
          src={cover}
          alt={article.title}
          fill
          sizes="(min-width:768px) 768px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{humanize(article.category)}</Badge>
            <Badge className="border-none bg-white/90 text-foreground">
              {article.language === "SW" ? "Kiswahili" : "English"}
            </Badge>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-white/85">
              <Clock className="size-3.5" />
              {article.readMinutes} min read
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            {article.title}
          </h1>
        </div>
      </div>

      <p className="mt-8 text-lg text-muted-foreground">{article.excerpt}</p>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-foreground/90">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 text-center">
        <h3 className="font-display text-lg font-semibold">
          Help us share dignity
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your donation puts pads and knowledge into the hands that need them.
        </p>
        <Link
          href="/donate"
          className={buttonVariants({ variant: "accent", className: "mt-4" })}
        >
          Donate now
        </Link>
      </div>
    </article>
  );
}
