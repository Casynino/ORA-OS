"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

const schema = z.object({
  title: z.string().min(3).max(160),
  excerpt: z.string().min(3).max(300),
  body: z.string().min(10),
  category: z.enum(["NEWS", "ANNOUNCEMENT", "EVENT", "STORY"]),
  coverImage: z.string().max(500).optional().nullable(),
  published: z.boolean().optional(),
});

export async function createNews(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid post.");
    }
    let slug = slugify(parsed.data.title);
    const clash = await prisma.newsPost.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const post = await prisma.newsPost.create({
      data: {
        slug,
        title: parsed.data.title.trim(),
        excerpt: parsed.data.excerpt.trim(),
        body: parsed.data.body.trim(),
        category: parsed.data.category,
        coverImage: parsed.data.coverImage?.trim() || null,
        published: parsed.data.published ?? true,
        authorId: admin.id,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "NEWS_CREATED",
      entity: "NewsPost",
      entityId: post.id,
      summary: `News post "${post.title}" created.`,
    });
    revalidatePath("/news");
    revalidatePath("/admin/news");
    revalidatePath("/");
    return ok(undefined, "Post published.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleNewsPublished(id: string): Promise<ActionResult> {
  try {
    await requireActor(["ADMIN"]);
    const post = await prisma.newsPost.findUnique({ where: { id } });
    if (!post) return fail("Post not found.");
    await prisma.newsPost.update({
      where: { id },
      data: { published: !post.published },
    });
    revalidatePath("/news");
    revalidatePath("/admin/news");
    revalidatePath("/");
    return ok(undefined, post.published ? "Post unpublished." : "Post published.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteNews(id: string): Promise<ActionResult> {
  try {
    await requireActor(["ADMIN"]);
    const post = await prisma.newsPost.findUnique({ where: { id } });
    if (!post) return fail("Post not found.");
    await prisma.newsPost.delete({ where: { id } });
    revalidatePath("/news");
    revalidatePath("/admin/news");
    revalidatePath("/");
    return ok(undefined, "Post deleted.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
