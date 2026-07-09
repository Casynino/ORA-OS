"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// Every community activity recorded here updates the public impact
// statistics automatically — pads, people and places, never money.

const ACTIVITY_TYPES = [
  "SCHOOL_VISIT",
  "COMMUNITY_OUTREACH",
  "EDUCATION_SESSION",
  "AWARENESS_CAMPAIGN",
  "PAD_DISTRIBUTION",
  "OTHER",
] as const;

function revalidateImpact() {
  for (const p of ["/impact", "/", "/admin/impact", "/admin/reports"])
    revalidatePath(p);
}

const activitySchema = z.object({
  title: z.string().min(3, "Give the activity a title.").max(160),
  type: z.enum(ACTIVITY_TYPES),
  description: z.string().max(1000).optional().or(z.literal("")),
  location: z.string().min(2, "Where did it happen?").max(120),
  region: z.string().max(80).optional().or(z.literal("")),
  district: z.string().max(80).optional().or(z.literal("")),
  partnerOrg: z.string().max(120).optional().or(z.literal("")),
  padsDistributed: z.number().int().nonnegative().max(10000000),
  peopleReached: z.number().int().nonnegative().max(10000000),
  images: z.array(z.string().max(500)).max(8),
  activityDate: z.string().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
});

function activityData(d: z.infer<typeof activitySchema>) {
  return {
    title: d.title.trim(),
    type: d.type,
    description: d.description?.trim() || null,
    location: d.location.trim(),
    region: d.region?.trim() || null,
    district: d.district?.trim() || null,
    partnerOrg: d.partnerOrg?.trim() || null,
    padsDistributed: d.padsDistributed,
    peopleReached: d.peopleReached,
    images: d.images.filter(Boolean),
  };
}

export async function createImpactActivity(
  input: z.infer<typeof activitySchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = activitySchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid activity.");
    const a = await prisma.impactActivity.create({
      data: {
        ...activityData(parsed.data),
        activityDate: parsed.data.activityDate
          ? new Date(parsed.data.activityDate)
          : new Date(),
        isPublished: parsed.data.isPublished ?? true,
        createdById: actor.id,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "IMPACT_ACTIVITY_CREATED",
      entity: "ImpactActivity",
      entityId: a.id,
      summary: `${actor.name} recorded impact activity "${a.title}" at ${a.location}.`,
    });
    revalidateImpact();
    return ok(undefined, `"${a.title}" is live on the impact page.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function updateImpactActivity(
  id: string,
  input: z.infer<typeof activitySchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = activitySchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid activity.");
    const existing = await prisma.impactActivity.findUnique({ where: { id } });
    if (!existing) return fail("Activity not found.");
    // Publish state and date are only changed when explicitly provided —
    // editing a hidden activity must never silently republish it.
    await prisma.impactActivity.update({
      where: { id },
      data: {
        ...activityData(parsed.data),
        ...(parsed.data.activityDate
          ? { activityDate: new Date(parsed.data.activityDate) }
          : {}),
        ...(parsed.data.isPublished != null
          ? { isPublished: parsed.data.isPublished }
          : {}),
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "IMPACT_ACTIVITY_UPDATED",
      entity: "ImpactActivity",
      entityId: id,
      summary: `${actor.name} updated impact activity "${parsed.data.title}".`,
    });
    revalidateImpact();
    return ok(undefined, "Activity updated — the public page reflects it now.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleImpactActivity(
  id: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const a = await prisma.impactActivity.update({
      where: { id },
      data: { isPublished: publish },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: publish ? "IMPACT_ACTIVITY_PUBLISHED" : "IMPACT_ACTIVITY_HIDDEN",
      entity: "ImpactActivity",
      entityId: id,
      summary: `${actor.name} ${publish ? "published" : "hid"} impact activity "${a.title}".`,
    });
    revalidateImpact();
    return ok(undefined, `"${a.title}" is now ${publish ? "public" : "hidden"}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteImpactActivity(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const a = await prisma.impactActivity.findUnique({ where: { id } });
    if (!a) return fail("Activity not found.");
    await prisma.impactActivity.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "IMPACT_ACTIVITY_DELETED",
      entity: "ImpactActivity",
      entityId: id,
      summary: `${actor.name} deleted impact activity "${a.title}".`,
    });
    revalidateImpact();
    return ok(undefined, `"${a.title}" removed.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Impact stories ──────────────────────────────────────────────────────────

const storySchema = z.object({
  title: z.string().min(3, "Give the story a title.").max(160),
  personName: z.string().max(120).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  quote: z.string().max(400).optional().or(z.literal("")),
  body: z.string().min(10, "Tell the story.").max(4000),
  padsDistributed: z.number().int().nonnegative().max(10000000).optional(),
  livesReached: z.number().int().nonnegative().max(10000000).optional(),
  published: z.boolean().optional(),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

export async function createImpactStory(
  input: z.infer<typeof storySchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = storySchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid story.");
    const d = parsed.data;
    let slug = slugify(d.title);
    if (await prisma.impactStory.findUnique({ where: { slug } }))
      slug = `${slug}-${Date.now().toString(36)}`;
    const s = await prisma.impactStory.create({
      data: {
        slug,
        title: d.title.trim(),
        personName: d.personName?.trim() || null,
        location: d.location?.trim() || null,
        quote: d.quote?.trim() || null,
        body: d.body.trim(),
        padsDistributed: d.padsDistributed ?? null,
        livesReached: d.livesReached ?? null,
        published: d.published ?? true,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "IMPACT_STORY_CREATED",
      entity: "ImpactStory",
      entityId: s.id,
      summary: `${actor.name} added impact story "${s.title}".`,
    });
    revalidateImpact();
    return ok(undefined, `Story "${s.title}" added.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleImpactStory(
  id: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const s = await prisma.impactStory.update({
      where: { id },
      data: { published: publish },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: publish ? "IMPACT_STORY_PUBLISHED" : "IMPACT_STORY_HIDDEN",
      entity: "ImpactStory",
      entityId: id,
      summary: `${actor.name} ${publish ? "published" : "hid"} story "${s.title}".`,
    });
    revalidateImpact();
    return ok(undefined, `"${s.title}" is now ${publish ? "public" : "hidden"}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteImpactStory(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const s = await prisma.impactStory.findUnique({ where: { id } });
    if (!s) return fail("Story not found.");
    await prisma.impactStory.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "IMPACT_STORY_DELETED",
      entity: "ImpactStory",
      entityId: id,
      summary: `${actor.name} deleted story "${s.title}".`,
    });
    revalidateImpact();
    return ok(undefined, `"${s.title}" removed.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
