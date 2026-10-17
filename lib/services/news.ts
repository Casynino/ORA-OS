import { prisma } from "@/lib/db";
import { STATIC_POSTS, type PublicPost } from "@/lib/news/static-posts";

export type { PublicPost };

/** Published posts: the ones written in Admin → News plus the ones that ship with the site, newest first. */
export async function listPublicPosts(take?: number): Promise<PublicPost[]> {
  const db = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });
  const slugs = new Set(db.map((p) => p.slug));
  const all: PublicPost[] = [...db, ...STATIC_POSTS.filter((p) => !slugs.has(p.slug))].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
  return take ? all.slice(0, take) : all;
}

/** One published post by slug (Admin posts first, then the built-in ones). */
export async function getPublicPost(slug: string): Promise<PublicPost | null> {
  const db = await prisma.newsPost.findUnique({ where: { slug } });
  if (db) return db.published ? db : null;
  return STATIC_POSTS.find((p) => p.slug === slug) ?? null;
}
