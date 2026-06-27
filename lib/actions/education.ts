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

const createSchema = z.object({
  title: z.string().min(3).max(160),
  excerpt: z.string().min(3).max(300),
  body: z.string().min(10),
  category: z.enum([
    "MENSTRUAL_HEALTH",
    "HYGIENE",
    "MYTHS_FACTS",
    "COMMUNITY_STORY",
    "GENERAL",
  ]),
  language: z.enum(["EN", "SW"]),
  readMinutes: z.number().int().min(1).max(60).optional(),
  published: z.boolean().optional(),
});

export async function createContent(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid content.");
    }
    let slug = slugify(parsed.data.title);
    const clash = await prisma.educationContent.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const content = await prisma.educationContent.create({
      data: {
        slug,
        title: parsed.data.title.trim(),
        excerpt: parsed.data.excerpt.trim(),
        body: parsed.data.body.trim(),
        category: parsed.data.category,
        language: parsed.data.language,
        readMinutes: parsed.data.readMinutes ?? 3,
        published: parsed.data.published ?? true,
        authorId: admin.id,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CONTENT_CREATED",
      entity: "EducationContent",
      entityId: content.id,
      summary: `Education article "${content.title}" created.`,
    });
    revalidatePath("/education");
    revalidatePath("/admin/education");
    return ok(undefined, "Article published.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleContentPublished(
  id: string,
): Promise<ActionResult> {
  try {
    await requireActor(["ADMIN"]);
    const content = await prisma.educationContent.findUnique({ where: { id } });
    if (!content) return fail("Article not found.");
    await prisma.educationContent.update({
      where: { id },
      data: { published: !content.published },
    });
    revalidatePath("/education");
    revalidatePath("/admin/education");
    return ok(
      undefined,
      content.published ? "Article unpublished." : "Article published.",
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}
